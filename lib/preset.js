// 生成「Gauntlet 小队」Agent preset 的配置（交给 @deepseek-ai/dsh-agent-preset）。
//
// 子 agent 会继承父 Agent 的整份 preset（dsh-subagent: agentPresets.composeFrom），
// 所以这里必须包含任何阶段需要的全部工具；阶段工具只能用 toolFilter 再减。
//
// 基于 dsh-web-app 0.2.0-rc.2 的 `standard` preset 抄写，差别：
//   - 去掉 planning（plan mode）：小队自己有流程；也避免把第三方改过的 plan-mode 文案固化进来。
//   - delegation 组只放 7 个 gauntlet_* 阶段工具：去掉普通 subagent / subagent_fork / workflow / ralph
//     和只服务于 continuable 子 agent 的 subagent-control，Leader 不能绕开流水线。
//   - persona.prefix = Leader 协议；skill-filesystem 额外挂本插件的 skills/。
// dsh 升级时对照新版 standard.patch.yml 更新这里。
import { STAGES, STAGE_TOOL_NAMES, stagePersona } from './stages.js';

export const PRESET_ID = 'gauntlet';

/** 只有填了 provider + model 才给 agentOptions；否则继承会话默认模型。 */
function agentOptionsOf(route) {
  if (!route?.provider || !route?.model) return undefined;
  return {
    provider: route.provider,
    model: route.model,
    ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
  };
}

function stageTool(stage, platform, route) {
  const agentOptions = agentOptionsOf(route);
  return {
    id: `gauntlet-${stage.key}`,
    name: '@deepseek-ai/dsh-tool-subagent',
    config: {
      provider: 'spawn',
      toolName: stage.toolName,
      backgroundMode: 'one-shot',
      maxDepth: 1,
      persona: stagePersona(stage, platform),
      // 子 agent 看不到阶段工具（反正 maxDepth 不让它再委派），也不直接问用户：一切经 Leader。
      toolFilter: { deny: [...STAGE_TOOL_NAMES, 'ask_user_question'] },
      ...(agentOptions ? { agentOptions } : {}),
    },
  };
}

/**
 * @param {object} o
 * @param {string} o.platform        process.platform
 * @param {string} o.skillsDir       本插件 skills/ 的绝对路径
 * @param {string} o.leaderPrompt    prompts/leader.md 的内容
 * @param {Record<string, {provider?: string, model?: string, reasoningEffort?: string}>} o.stages
 */
export function buildPreset({ platform, skillsDir, leaderPrompt, stages = {} }) {
  const win = platform === 'win32';
  return {
    id: PRESET_ID,
    name: 'Gauntlet 小队',
    description: 'Leader 把需求按阶段派给 7 个子 agent：摸底 → 规格 → TDD 编码 → 清理 → 变异加固 → QA → 证据包，每关过闸门才推进，最后交给你一页 5 分钟看完的证据包。',
    order: 10,
    plugins: [
      {
        id: 'persona',
        name: '@deepseek-ai/dsh-persona',
        // suffix 会被阶段子 agent 继承，只能放通用内容；Leader 协议只在 prefix（子 agent 的 persona 会遮蔽它）。
        config: { prefix: leaderPrompt, suffix: 'Your working directory is {{cwd}}.' },
      },
      { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
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
      {
        id: 'delegation',
        name: 'cordis:group',
        group: true,
        config: STAGES.map((stage) => stageTool(stage, platform, stages[stage.key])),
      },
      { id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' },
      { id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } },
      { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, searchTimeoutMs: 60000 } },
      { id: 'present', name: '@deepseek-ai/dsh-tool-present' },
    ],
  };
}
