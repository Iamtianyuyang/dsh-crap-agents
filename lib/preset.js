// 生成「Gauntlet 小队」Agent preset 的配置（交给 @deepseek-ai/dsh-agent-preset）。
//
// dsh 0.2.1 起 dsh-tool-subagent 不再接受 persona / toolFilter：阶段子 agent 的
// persona 和工具组合必须做成独立的 Agent Preset，子代理工具用 agentPreset 选中它
//（spawn 提供方：The selected preset owns persona and tool composition）。
// 所以这里生成 1 + 7 份 preset：
//   - gauntlet          Leader：完整工具 + 7 个阶段委派工具。
//   - gauntlet-<stage>  每个阶段一份：同样的基础工具，persona 换成阶段 persona；
//                       没有 delegation 组和 ask_user_question（相当于旧的 toolFilter 拒绝项），
//                       阶段 agent 不能再委派、也不能直接问用户：一切经 Leader。
// 注册表没有"隐藏 preset"的机制（roster 列出所有 preset，内置的几个靠界面字典特殊处理），
// 所以 8 份都会出现在选择器里：阶段 preset 用 name / description 标明"内部阶段、别直接选"。
//
// 基于 dsh-web-app 0.2.1-rc.2 的 `standard` preset 抄写，差别：
//   - 去掉 planning（plan mode）：小队自己有流程；也避免把第三方改过的 plan-mode 文案固化进来。
//   - delegation 组只放 7 个 gauntlet_* 阶段工具：去掉普通 subagent / subagent_fork / workflow / ralph
//     和只服务于 continuable 子 agent 的 subagent-control，Leader 不能绕开流水线。
//   - persona.prefix = Leader 协议（阶段 preset 里是阶段 persona）；skill-filesystem 额外挂本插件的 skills/。
//   - 不加 tool-schedule / tool-plugin-market：定时和插件市场对 Gauntlet 流水线没有意义，少一个工具少一条弯路。
// dsh 升级时对照新版 standard.patch.yml 更新这里。
import { STAGES, STAGE_KEYS, stagePersona } from './stages.js';

export const PRESET_ID = 'gauntlet';

/** 阶段子 agent 的 preset id（Leader 的 delegation 工具用它选 preset；shellEnv 也按它识别 Gauntlet 会话）。 */
export const stagePresetId = (key) => `gauntlet-${key}`;

/** 只有填了 provider + model 才给 agentOptions；否则继承会话默认模型。 */
function agentOptionsOf(route) {
  if (!route?.provider || !route?.model) return undefined;
  return {
    provider: route.provider,
    model: route.model,
    ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
  };
}

function stageTool(stage, route) {
  const agentOptions = agentOptionsOf(route);
  return {
    id: `gauntlet-${stage.key}`,
    name: '@deepseek-ai/dsh-tool-subagent',
    config: {
      provider: 'spawn',
      toolName: stage.toolName,
      maxDepth: 1,
      agentPreset: stagePresetId(stage.key),
      ...(agentOptions ? { agentOptions } : {}),
    },
  };
}

/**
 * Leader 和阶段 preset 共用的基础插件（对照 standard preset；delegation / ask-user 不在这里）。
 * @param {object} o
 * @param {string} o.platform       process.platform
 * @param {string} o.skillsDir      本插件 skills/ 的绝对路径
 * @param {string} o.personaPrefix  persona 前缀（Leader 协议或阶段 persona）
 */
function basePlugins({ platform, skillsDir, personaPrefix }) {
  const win = platform === 'win32';
  return [
    {
      id: 'persona',
      name: '@deepseek-ai/dsh-persona',
      // suffix 会进入每份 preset（Leader 和阶段 agent 都有），只能放通用内容；协议类内容只在 prefix。
      config: { prefix: personaPrefix, suffix: 'Your working directory is {{cwd}}.' },
    },
    { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
    { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
    { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash', disabled: win },
    { id: 'tool-pwsh', name: '@deepseek-ai/dsh-tool-pwsh', disabled: !win },
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
    { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
    { id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' },
    { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem', config: { customSkillDirs: [skillsDir] } },
    { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
    { id: 'command-goal', name: '@deepseek-ai/dsh-command-goal' },
    { id: 'tool-goal', name: '@deepseek-ai/dsh-tool-goal' },
    {
      id: 'compaction',
      name: 'cordis:group',
      group: true,
      isolate: { compaction: true, toolResultPruner: true },
      config: [
        { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
        { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
        {
          id: 'tool-result-pruner',
          name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
          config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
        },
      ],
    },
    { id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } },
    { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, searchTimeoutMs: 60000 } },
    { id: 'present', name: '@deepseek-ai/dsh-tool-present' },
  ];
}

/**
 * Leader 的 preset：基础工具 + delegation 组（7 个阶段工具）+ ask_user_question。
 * 带 name，出现在 preset 选择器的「自定义」分组。
 * @param {object} o
 * @param {string} o.platform        process.platform
 * @param {string} o.skillsDir       本插件 skills/ 的绝对路径
 * @param {string} o.leaderPrompt    prompts/leader.md 的内容
 * @param {Record<string, {provider?: string, model?: string, reasoningEffort?: string}>} o.stages
 */
export function buildPreset({ platform, skillsDir, leaderPrompt, stages = {} }) {
  const base = basePlugins({ platform, skillsDir, personaPrefix: leaderPrompt });
  return {
    id: PRESET_ID,
    name: 'Gauntlet 小队',
    description: 'Leader 把需求按阶段派给 7 个子 agent：摸底 → 规格 → TDD 编码 → 清理 → 变异加固 → QA → 证据包，每关过闸门才推进，最后交给你一页 5 分钟看完的证据包。',
    order: 10,
    plugins: [
      ...base.slice(0, 13), // persona … compaction
      {
        id: 'delegation',
        name: 'cordis:group',
        group: true,
        config: STAGES.map((stage) => stageTool(stage, stages[stage.key])),
      },
      { id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' },
      ...base.slice(13), // todo、web、present
    ],
  };
}

/**
 * 7 份阶段 preset：基础工具 + 阶段 persona。
 * 注册表没有隐藏机制（roster 列出所有 preset），所以每份都带清楚的 name / description，
 * 写明是内部阶段、由 Leader 委派时使用；order 11+ 排在 Leader（order 10）后面。
 * 不依赖阶段模型配置（模型路由在 Leader preset 的委派工具上），设置变更时无需重注册。
 */
const STAGE_NUMBERS = '⓪①②③④⑤⑥⑦⑧⑨';

/** 选择器里的阶段名称，例如「③ 清理重构 · Gauntlet」：卡片截断后仍能看出阶段和用途。 */
export const stagePresetName = (stage, i) => `${STAGE_NUMBERS[i]} ${stage.label} · Gauntlet`;

export function buildStagePresets({ platform, skillsDir }) {
  return STAGES.map((stage, i) => ({
    id: stagePresetId(stage.key),
    name: stagePresetName(stage, i),
    description: `${stage.summary}Gauntlet 小队的内部阶段，由 Leader 通过 ${stage.toolName} 派活；不要直接选它新建会话，请选「Gauntlet 小队」。`,
    order: 11 + i,
    plugins: basePlugins({ platform, skillsDir, personaPrefix: stagePersona(stage, platform) }),
  }));
}

// 供 index.js 识别 Gauntlet 会话（Leader 或任一阶段子 agent）。
export const GAUNTLET_PRESET_IDS = new Set([PRESET_ID, ...STAGE_KEYS.map(stagePresetId)]);
