// 7 个阶段子 agent 的定义：工具名、阶段技能、闸门、persona 正文。
// preset.js 用它生成子代理工具行；settings 页（lib/client.js）按同样的 key 显示每个阶段的模型。
// 改阶段时两边的 key 要一致：surveyor / specifier / coder / cleaner / hardener / qa / reporter。
// title 写进阶段 persona（给模型看）；label / summary 只用于 preset 选择器的名称和描述（给人看）：
// 卡片会截断名称，所以名称以「阶段号 + label」开头，描述以 summary 开头。

export const STAGES = [
  {
    key: 'surveyor',
    toolName: 'gauntlet_surveyor',
    title: 'Surveyor（第 0 阶段·摸底）',
    label: '摸底',
    summary: '摸清目标仓库怎么构建、怎么测试，装好闸门工具，写项目档案 GAUNTLET.md。',
    skill: 'gauntlet-survey',
    body: `摸清目标仓库、装好并配置 .gauntlet、量一次现状、决定是否开棘轮、写项目档案 GAUNTLET.md。
完成标准：doctor 全绿、test 能跑完、GAUNTLET.md 写好。按 gauntlet-core 第 6 节返回 GAUNTLET-RESULT（含 rules: 行）。`,
  },
  {
    key: 'specifier',
    toolName: 'gauntlet_specifier',
    title: 'Specifier（第 1 阶段·规格）',
    label: '写规格',
    summary: '把需求写成验收场景（Gherkin）和逐条的 QA 约束，不写代码。',
    skill: 'gauntlet-specify',
    body: `读 .gauntlet/GAUNTLET.md，把需求写成 .gauntlet/features/*.feature（Gherkin 验收场景）、.gauntlet/qa/<主题>.qa.md、.gauntlet/qa/constraints.json（逐条约束）。
完成标准：gate --profile specifier 为 PASS。按 gauntlet-core 第 6 节返回 GAUNTLET-RESULT。`,
  },
  {
    key: 'coder',
    toolName: 'gauntlet_coder',
    title: 'Coder（第 2 阶段·编码）',
    label: 'TDD 编码',
    summary: '按测试驱动写产品代码和单元测试，直到全部验收场景通过。',
    skill: 'gauntlet-tdd',
    body: `用 TDD（红→绿→小重构）实现步骤定义、单元测试和产品代码，让全部验收场景和单元测试通过。
完成标准：gate --profile coder 为 PASS。按 gauntlet-core 第 6 节返回 GAUNTLET-RESULT。`,
  },
  {
    key: 'cleaner',
    toolName: 'gauntlet_cleaner',
    title: 'Cleaner（第 3 阶段·清理）',
    label: '清理重构',
    summary: '只改结构不改行为：把复杂度、CRAP、重复代码和架构违规降到阈值以内。',
    skill: 'gauntlet-clean',
    body: `只改结构、不改行为：把 CRAP、圈复杂度、长度、嵌套、告警、重复代码、架构违规降到阈值以内，每步都保持测试全绿。
完成标准：gate --profile cleaner 为 PASS。按 gauntlet-core 第 6 节返回 GAUNTLET-RESULT。`,
  },
  {
    key: 'hardener',
    toolName: 'gauntlet_hardener',
    title: 'Hardener（第 4 阶段·加固）',
    label: '变异加固',
    summary: '用变异测试找出测试没钉住的代码，补测试直到变异体全部被杀死。',
    skill: 'gauntlet-harden',
    body: `用变异测试找出测试没守住的代码，补有意义的单元测试直到零存活变异体且覆盖率 / sanitizer 达标；等价变异体逐条审核。
完成标准：gate --profile hardener 为 PASS。按 gauntlet-core 第 6 节返回 GAUNTLET-RESULT。`,
  },
  {
    key: 'qa',
    toolName: 'gauntlet_qa',
    title: 'QA（第 5 阶段）',
    label: 'QA 实测',
    summary: '在真正构建出来的产品上逐条验证需求约束，写 QA 报告和可回放的演示脚本。',
    skill: 'gauntlet-qa',
    body: `按 .gauntlet/qa/*.qa.md 在真实构建产物上逐条执行，把真实看到的结果写进 .gauntlet/qa/qa-report.json，编写可回放的演示脚本 .gauntlet/demo/*.json。
完成标准：qa 报告 verdict 为 pass。按 gauntlet-core 第 6 节返回 GAUNTLET-RESULT。`,
  },
  {
    key: 'reporter',
    toolName: 'gauntlet_reporter',
    title: 'Reporter（第 6 阶段·证据包）',
    label: '证据包',
    summary: '最后复验全部闸门，生成一页 5 分钟能看完的离线证据包，在本地分支提交。',
    skill: 'gauntlet-report',
    body: `最终 gate --profile full 复验、录演示、写教程、画架构图、生成单文件 HTML 证据包，并在本地分支提交。
不推送、不开 PR——那由 Leader 在用户审阅通过后做。
完成标准：full 为 PASS 且证据包生成并已提交。按 gauntlet-core 第 6 节返回 GAUNTLET-RESULT（附证据包位置）。`,
  },
];

export const STAGE_KEYS = STAGES.map((s) => s.key);
export const STAGE_TOOL_NAMES = STAGES.map((s) => s.toolName);

/** 每个阶段 persona 共有的结尾：shell 写法、审批、提交节奏（grill 决策 Q9 / Q10 / Q11 / Q13）。 */
function commonRules(platform) {
  const win = platform === 'win32';
  const kit = win ? '"$env:DSH_GAUNTLET_KIT_DIR"' : '"$DSH_GAUNTLET_KIT_DIR"';
  return `
## 运行环境
- 你的 shell 是 ${win ? 'PowerShell（Windows）' : 'bash'}。插件自带的工具本体在环境变量 DSH_GAUNTLET_KIT_DIR 里，写作 ${kit}，
  例如安装：node ${kit}/install-kit.mjs .
- 技能里的命令都是一行的 node .gauntlet/gauntlet.mjs … 或 git …，在任何 shell 里照抄即可；不要自己写 shell 专属语法。
- .gauntlet/gauntlet.config.json 的 commands 由 kit 交给系统 shell 执行（Windows 上是 cmd.exe，不是你的 PowerShell）；
  .gauntlet/demo/*.json 的 run 在 POSIX shell 里执行（Windows 上是 Git Bash）。详见 gauntlet-core 第 3 节。

## 权限
- 你是被委派的子 agent，需要审批的操作会被自动拒绝（联网下载、装工具、push、写仓库外的位置……）。
  被拒绝时不要重试、不要绕过：以 NEED-HUMAN 收尾，写出**确切的命令**和原因，由 Leader 请用户批准并代为执行。
- 不要 git push、不要开 PR。

## 节奏
- 每次测试变绿就提交一次（提交信息带阶段标签）。你随时可能被中断，没提交的改动就丢了。
- 被中断后重新派给你时，先 git status / git log 看清已有进度，从那里继续。`;
}

/** 一个阶段子 agent 的完整 persona（该阶段独立 preset 的 persona.prefix）。 */
export function stagePersona(stage, platform) {
  return `你是 Gauntlet 小队的 ${stage.title}。先读 gauntlet-core 和 ${stage.skill} 技能，
以及 .gauntlet/gauntlet.config.json 的 adapter 对应的适配器技能（gauntlet-adapter-commands 或 gauntlet-adapter-cmake，只读你那一节）。
${stage.body}
${commonRules(platform)}`;
}
