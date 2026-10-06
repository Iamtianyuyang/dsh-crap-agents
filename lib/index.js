// dsh-gauntlet — DeepSeek Harness 插件入口（Cordis plugin）
//
//   1. 在代码里声明「Gauntlet 小队」Agent preset（见 preset.js）：Leader 协议做 persona，
//      7 个阶段子代理工具，skills/ 只在这个 preset 里注册。preset 带 name，所以出现在「自定义」分组。
//   2. 每个阶段用哪个模型存在本插件自己的 Config（stages，volatile 字段，设置页 lib/client.js 编辑）。
//      改动只触发 preset 重新声明，只影响之后新建的会话。
//   3. 通过 dsh-shell-env 给 Gauntlet 会话（Leader 和阶段子 agent）的每次 shell 调用提供
//      DSH_GAUNTLET_KIT_DIR，指向插件自带的零依赖工具本体 kit/。
//
// 纯 ESM，零第三方依赖；@deepseek-ai/* 由 dsh 运行时解析。
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import z from '@deepseek-ai/schemastery';
import AgentPreset from '@deepseek-ai/dsh-agent-preset';
import { buildPreset, PRESET_ID } from './preset.js';
import { STAGE_KEYS } from './stages.js';

export const name = 'gauntlet';

// Cordis 4：inject 里列出的服务都是必需的；可选的 shellEnv / settings 在 apply 里用 ctx.inject 延迟挂。
export const inject = ['agentPresets'];

const HERE = dirname(fileURLToPath(import.meta.url)); // .../dsh-gauntlet/lib
const PKG_ROOT = resolve(HERE, '..');
const SKILLS_DIR = join(PKG_ROOT, 'skills');
const KIT_DIR = join(PKG_ROOT, 'kit');
const LEADER_PROMPT = join(PKG_ROOT, 'prompts', 'leader.md');

const StageRoute = z.object({
  provider: z.string().description('LLM provider id（留空 = 继承会话默认模型）'),
  model: z.string().description('该 provider 下的模型 id'),
  reasoningEffort: z.string().description('推理强度（模型公布的 effort id；留空用模型默认）'),
});

export const Config = z.object({
  stages: z.dict(StageRoute)
    .default({})
    .description(`每个阶段子 agent 的模型，key 为 ${STAGE_KEYS.join(' / ')}`)
    .volatile(),
});

export function apply(ctx, config) {
  const leaderPrompt = fs.readFileSync(LEADER_PROMPT, 'utf8');
  const presetConfig = () => buildPreset({
    platform: process.platform,
    skillsDir: SKILLS_DIR,
    leaderPrompt,
    stages: sanitizeStages(config.stages.get()),
  });

  // preset 作为本插件的子 fiber：插件卸载时随之注销；设置变更时 update → 先注销旧定义再注册新定义。
  const preset = ctx.plugin(AgentPreset, presetConfig());
  ctx.on('loader/volatile-update', () => preset.update(presetConfig(), true));

  // 设置页由 lib/client.js 自己画，不要 Settings 按 schema 自动生成一份。
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });

  ctx.inject(['shellEnv'], (envCtx) => {
    envCtx.shellEnv.register({
      name: 'gauntlet',
      variables: {
        DSH_GAUNTLET_KIT_DIR: { description: 'Gauntlet 工具本体目录（含 gauntlet.mjs 与 install-kit.mjs）' },
      },
      resolve: (execution) => (inGauntletSession(ctx, execution) ? { DSH_GAUNTLET_KIT_DIR: KIT_DIR } : {}),
    });
  });
}

/** 只给 Gauntlet preset 里的 Agent（Leader 与它的阶段子 agent）；判断不了时照样给——只是一个路径。 */
function inGauntletSession(ctx, execution) {
  if (execution.agent === undefined) return true;
  try {
    const presetId = ctx.get('agentPresets')?.composedPreset(execution.agent.ctx);
    return presetId === undefined || presetId === PRESET_ID;
  } catch {
    return true;
  }
}

/** 丢掉未知阶段和只填了一半的路由，避免一条坏配置让整个 preset 挂载失败。 */
function sanitizeStages(stages) {
  const out = {};
  for (const key of STAGE_KEYS) {
    const r = stages?.[key];
    if (r?.provider && r?.model) out[key] = { provider: r.provider, model: r.model, reasoningEffort: r.reasoningEffort || undefined };
  }
  return out;
}
