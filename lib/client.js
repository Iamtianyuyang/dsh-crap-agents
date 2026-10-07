// dsh-gauntlet 阶段模型设置与会话流程进度。手写成 dsh 客户端模块格式，不需要构建步骤。
//
// 出现在 Web 侧栏「插件」→「已安装」→ dsh-gauntlet 的页面上（plugins.bundle.config slot），
// 编辑本插件行 `gauntlet` 的 volatile 配置 stages：
// 每个阶段子 agent 用哪个 provider / model / reasoningEffort。留空 = 继承会话默认模型。
// 模型列表来自 remote.session.modelCatalog()（真实可用的路由）；已保存但目录里没有的路由单独列出。
// 写入用 configForms 的修订号做栅栏，冲突时提示重新加载，不覆盖更新的值。
//
// 只用宿主共享模块：react、@deepseek-ai/dsh-client-ui-primitives、@deepseek-ai/dsh-client-store。
// 阶段 key 必须与 lib/stages.js 一致。
window.__ModuleLoader__.load({
  id: 'dsh-gauntlet',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    const clientStore = require('@deepseek-ai/dsh-client-store');
    const h = React.createElement;

    const PACKAGE = 'dsh-gauntlet';
    const PRESET_ID = 'gauntlet'; // = lib/preset.js 的 PRESET_ID
    const NS = 'settings.gauntlet';
    const CONFIG_NS = 'gauntlet'; // = cordis.patch.yml 里插件行的 id
    const STAGE_KEYS = ['surveyor', 'specifier', 'coder', 'cleaner', 'hardener', 'qa', 'reporter'];

    // ---------------------------------------------------------------- 文案
    const zh = {
      title: 'Gauntlet 小队',
      description: '为 7 个阶段子 agent 分别选择模型。',
      intro: '每个阶段由一个独立的子 agent 完成。常见做法：编码、加固用更强的模型，摸底、规格用更快的模型。',
      colStage: '阶段',
      colModel: '模型',
      colEffort: '推理强度',
      inherit: '继承会话默认',
      effortDefault: '模型默认',
      effortDefaultNamed: '模型默认（{name}）',
      effortNone: '—',
      unavailableGroup: '已保存但当前不可用',
      unavailableHint: '这个模型已不在可用列表里，调用该阶段会失败。请换一个，或恢复为继承会话默认。',
      catalogLoading: '正在读取可用模型…',
      catalogError: '读取可用模型失败。',
      catalogPartial: '部分 provider 读取失败，列表可能不完整。',
      retry: '重试',
      resetAll: '全部恢复为继承会话默认',
      footnote: '改动只影响之后新建的 Gauntlet 会话；正在运行的会话保持原来的模型。Leader 使用会话本身的模型。',
      conflict: '配置在别处被修改过。放弃这里的改动以加载最新值。',
      unavailable: '插件没有加载，暂时无法配置。',
      readOnly: '这个部署的设置是只读的。',
      saveFailed: '部署没有接受这些值，已保留以便修改。',
      save: '保存',
      saving: '保存中…',
      composerButton: '阶段模型',
      composerButtonCount: '阶段模型 · {n} 个自定义',
      composerHint: '为 Gauntlet 小队的 7 个阶段选择模型',
      close: '关闭',
      stage_surveyor: '⓪ 摸底 Surveyor',
      stage_surveyor_desc: '摸清仓库、装好工具、写项目档案',
      stage_specifier: '① 规格 Specifier',
      stage_specifier_desc: '需求 → 验收场景与约束',
      stage_coder: '② 编码 Coder',
      stage_coder_desc: 'TDD 实现，全部场景通过',
      stage_cleaner: '③ 清理 Cleaner',
      stage_cleaner_desc: '不改行为，重构到质量阈值',
      stage_hardener: '④ 加固 Hardener',
      stage_hardener_desc: '变异测试，补测试杀死变异体',
      stage_qa: '⑤ QA',
      stage_qa_desc: '在真实产物上逐条验证',
      stage_reporter: '⑥ 证据包 Reporter',
      stage_reporter_desc: '复验、录演示、生成证据包',
      progressTitle: '流程进度',
      progressHint: '点击阶段查看任务、闸门和执行详情',
      progressEmpty: '尚未开始，等待 Leader 派发第一个阶段',
      progressCount: '{n} / 7 已通过',
      progressCurrent: '当前：{stage}',
      progressReview: '七个阶段已通过，可审阅证据包',
      progressPartial: '历史记录未加载完整，以下仅显示已加载记录。',
      progressLoading: '正在加载流程记录…',
      progressLoadHistory: '加载更早记录',
      progressLoadFailed: '较早记录加载失败，请重试。',
      progressCountPartial: '{n} / 7 已通过（已加载记录）',
      progressStatus_pending: '未开始',
      progressStatus_running: '进行中',
      progressStatus_passed: '已通过',
      progressStatus_failed: '需返工',
      progressStatus_waiting: '等待确认',
      progressStatus_interrupted: '已中断',
      progressStatus_unknown: '待核实',
      progressStatus_stale: '需重跑',
      progressAttempts: '{n} 次尝试',
      progressAttempt: '第 {n} 次尝试',
      progressDetails: '阶段详情',
      progressTask: '派发任务',
      progressOutput: '原始输出',
      progressSummary: '结果摘要',
      progressGates: '闸门',
      progressBranch: '分支 / 提交',
      progressProfile: '检查配置',
      progressLoop: '返工收敛',
      progressNext: '后续提示',
      progressTodo: 'Leader 进度记录',
      progressNoAttempt: '这个阶段还没有执行记录。',
      progressNoOutput: '尚未收到阶段结果，执行记录会自动更新。',
      progressStale: '前面的阶段已重新执行，这个阶段的旧结果需要重新验证。',
      progressOpenSession: '打开子 agent 会话',
    };
    const en = {
      title: 'Gauntlet squad',
      description: 'Choose a model for each of the 7 stage agents.',
      intro: 'Each stage runs in its own subagent. A common setup: stronger models for coding and hardening, faster ones for survey and spec.',
      colStage: 'Stage',
      colModel: 'Model',
      colEffort: 'Reasoning effort',
      inherit: 'Inherit session default',
      effortDefault: 'Model default',
      effortDefaultNamed: 'Model default ({name})',
      effortNone: '—',
      unavailableGroup: 'Saved but currently unavailable',
      unavailableHint: 'This model is no longer offered; the stage will fail when called. Pick another or inherit the session default.',
      catalogLoading: 'Loading available models…',
      catalogError: 'Could not load the available models.',
      catalogPartial: 'Some providers failed to load; the list may be incomplete.',
      retry: 'Retry',
      resetAll: 'Reset all to session default',
      footnote: 'Changes apply to new Gauntlet sessions only; running sessions keep their models. The Leader uses the session model.',
      conflict: 'The settings changed elsewhere. Discard your edits to load the latest values.',
      unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
      readOnly: 'This deployment stores settings read-only.',
      saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
      save: 'Save',
      saving: 'Saving…',
      composerButton: 'Stage models',
      composerButtonCount: 'Stage models · {n} custom',
      composerHint: 'Choose models for the 7 Gauntlet stages',
      close: 'Close',
      stage_surveyor: '⓪ Surveyor',
      stage_surveyor_desc: 'Map the repo, install tools, write the profile',
      stage_specifier: '① Specifier',
      stage_specifier_desc: 'Requirement → acceptance scenarios and constraints',
      stage_coder: '② Coder',
      stage_coder_desc: 'TDD until every scenario passes',
      stage_cleaner: '③ Cleaner',
      stage_cleaner_desc: 'Refactor to the quality thresholds, same behavior',
      stage_hardener: '④ Hardener',
      stage_hardener_desc: 'Mutation testing, kill every mutant',
      stage_qa: '⑤ QA',
      stage_qa_desc: 'Verify each constraint on the real build',
      stage_reporter: '⑥ Reporter',
      stage_reporter_desc: 'Re-verify, record demos, build the evidence pack',
      progressTitle: 'Workflow progress',
      progressHint: 'Select a stage to inspect its task, gates, and execution',
      progressEmpty: 'Waiting for the Leader to start the first stage',
      progressCount: '{n} / 7 passed',
      progressCurrent: 'Current: {stage}',
      progressReview: 'All seven stages passed; the evidence pack is ready to review',
      progressPartial: 'History is incomplete. Only loaded records are shown.',
      progressLoading: 'Loading workflow history…',
      progressLoadHistory: 'Load earlier history',
      progressLoadFailed: 'Earlier history could not be loaded. Please retry.',
      progressCountPartial: '{n} / 7 passed in loaded history',
      progressStatus_pending: 'Pending',
      progressStatus_running: 'Running',
      progressStatus_passed: 'Passed',
      progressStatus_failed: 'Rework',
      progressStatus_waiting: 'Needs input',
      progressStatus_interrupted: 'Interrupted',
      progressStatus_unknown: 'Unverified',
      progressStatus_stale: 'Rerun needed',
      progressAttempts: '{n} attempts',
      progressAttempt: 'Attempt {n}',
      progressDetails: 'Stage details',
      progressTask: 'Assigned task',
      progressOutput: 'Raw output',
      progressSummary: 'Result summary',
      progressGates: 'Gates',
      progressBranch: 'Branch / commit',
      progressProfile: 'Gate profile',
      progressLoop: 'Rework convergence',
      progressNext: 'Next steps',
      progressTodo: 'Leader progress record',
      progressNoAttempt: 'No execution has been recorded for this stage yet.',
      progressNoOutput: 'No stage result yet. Execution records update automatically.',
      progressStale: 'An earlier stage was rerun. This stage’s old result needs verification again.',
      progressOpenSession: 'Open subagent session',
    };

    Object.assign(zh, {
      workflowButton: '流程', workflowNext: '下一阶段：{stage}', workflowLeader: 'Leader 正在处理阶段间工作',
      workflowOverview: '七个阶段，选择查看详情', workflowRefresh: '刷新报告', workflowLive: '实时更新',
      workflowActivity: 'Agent 做了什么', workflowTools: '次工具调用', workflowMessages: '条消息',
      workflowActivityMissing: '尚未关联到唯一子会话；执行记录关联后会显示在这里。', workflowActivityEmpty: '子 agent 尚未产生可见执行记录。',
      workflowOlder: '加载更早执行记录', workflowLoading: '正在读取执行记录…', workflowGoal: '阶段职责',
      workflowMetrics: '质量指标与函数详情', workflowUnmeasured: '未测量', workflowSnapshot: '本次执行结束时的报告快照',
      workflowNoSnapshot: '这次执行没有保存指标快照。较早的历史不会用最新报告代替。',
      workflowWorkspace: '工作区最新报告', workflowWorkspaceHint: '最新文件可能来自另一个阶段；各阶段的历史指标请展开阶段查看快照。',
      workflowReading: '正在读取报告…', workflowFunctions: '函数详情', workflowSearch: '搜索函数或文件',
      workflowNoFunctions: '尚无函数级报告。清理和加固阶段生成报告后，可查看每个函数的复杂度、覆盖率、CRAP 与变异结果。',
      workflowComplexity: '复杂度', workflowCoverage: '行覆盖率', workflowMutation: '变异杀死率', workflowCrap: 'CRAP 风险值',
      workflowDerived: '按函数源码行范围汇总；不是报告直接提供的函数分数。', workflowFormula: 'CRAP = CC² × (1 − 覆盖率)³ + CC；变异杀死率单独统计。',
      workflowMutants: '变异体明细', workflowKilled: '已杀死', workflowSurvived: '存活', workflowNoCoverage: '未覆盖',
      workflowTimeout: '超时（计为杀死）', workflowExcluded: '编译错误 / 已接受（不计分）', workflowSources: '报告文件与原始证据',
      workflowMissing: '尚未生成', workflowError: '读取失败', workflowTests: '测试、QA 与收敛记录',
      workflowInput: '调用参数', workflowToolOutput: '返回结果', workflowNoResult: '等待工具结果',
      workflowThresholds: '质量阈值', workflowNoGates: '尚无结构化闸门报告，阶段返回的检查结果保留在上方。',
      workflowElapsed: '耗时', workflowStarted: '开始', workflowFinished: '结束', workflowAttemptId: '调用 ID',
      workflowAllRecords: '完整记录可按项展开，不截断原始内容。', workflowOtherPreset: '切换到 Gauntlet 小队后显示流程记录。',
      workflowReportProfile: '报告配置', workflowCommit: '报告提交', workflowReportedAt: '报告完成', workflowChangedAt: '文件更新时间',
      workflowCheckAction: '执行步骤', workflowExpected: '预期', workflowActual: '实际结果', workflowTestTotal: '测试总数', workflowTestFailed: '失败测试',
      workflowSnapshotProvenance: '快照保留结束时工作区已有的报告；来源以报告配置、提交和文件更新时间为准。',
      workflowNoMatches: '没有匹配的函数，清空搜索可查看全部函数。',
      workflowStageResult: '阶段结果与闸门',
      workflowMetricMethod: '指标含义',
    });
    Object.assign(en, {
      workflowButton: 'Workflow', workflowNext: 'Next stage: {stage}', workflowLeader: 'Leader is handling work between stages',
      workflowOverview: 'Seven stages; select a stage to inspect its details', workflowRefresh: 'Refresh reports', workflowLive: 'Live',
      workflowActivity: 'Agent activity', workflowTools: 'tool calls', workflowMessages: 'messages',
      workflowActivityMissing: 'No unique subagent session is linked yet. Its records will appear once linked.', workflowActivityEmpty: 'No visible subagent activity yet.',
      workflowOlder: 'Load earlier activity', workflowLoading: 'Loading activity…', workflowGoal: 'Stage responsibilities',
      workflowMetrics: 'Quality metrics and functions', workflowUnmeasured: 'Unmeasured', workflowSnapshot: 'Reports captured when this attempt finished',
      workflowNoSnapshot: 'No metric snapshot was saved for this attempt. Latest reports do not replace historical measurements.',
      workflowWorkspace: 'Latest workspace reports', workflowWorkspaceHint: 'These files may belong to another stage. Expand a stage for its historical snapshot.',
      workflowReading: 'Reading reports…', workflowFunctions: 'Function details', workflowSearch: 'Search functions or files',
      workflowNoFunctions: 'No function report yet. Cleaning and hardening reports provide complexity, coverage, CRAP and mutation results for each function.',
      workflowComplexity: 'Complexity', workflowCoverage: 'Line coverage', workflowMutation: 'Mutation kill rate', workflowCrap: 'CRAP risk',
      workflowDerived: 'Derived from source line ranges, rather than a reported per-function score.', workflowFormula: 'CRAP = CC² × (1 − coverage)³ + CC. Mutation kill rate is measured separately.',
      workflowMutants: 'Mutation details', workflowKilled: 'Killed', workflowSurvived: 'Survived', workflowNoCoverage: 'Not covered',
      workflowTimeout: 'Timed out (counts as killed)', workflowExcluded: 'Compile errors / accepted (excluded)', workflowSources: 'Report files and raw evidence',
      workflowMissing: 'Not generated', workflowError: 'Read failed', workflowTests: 'Tests, QA and convergence',
      workflowInput: 'Arguments', workflowToolOutput: 'Result', workflowNoResult: 'Waiting for tool result',
      workflowThresholds: 'Quality thresholds', workflowNoGates: 'No structured gate report yet. Stage-returned checks are retained above.',
      workflowElapsed: 'Elapsed', workflowStarted: 'Started', workflowFinished: 'Finished', workflowAttemptId: 'Call ID',
      workflowAllRecords: 'Expand individual records to read the complete, untruncated content.', workflowOtherPreset: 'Select the Gauntlet preset to view workflow records.',
      workflowReportProfile: 'Report profile', workflowCommit: 'Report commit', workflowReportedAt: 'Report finished', workflowChangedAt: 'File modified',
      workflowCheckAction: 'Action', workflowExpected: 'Expected', workflowActual: 'Actual', workflowTestTotal: 'Total tests', workflowTestFailed: 'Failed tests',
      workflowSnapshotProvenance: 'The snapshot retains reports present at completion. Their profile, commit and modification time identify the measurement source.',
      workflowNoMatches: 'No functions match. Clear the search to view all functions.',
      workflowStageResult: 'Stage result and gates',
      workflowMetricMethod: 'Metric definitions',
    });

    Object.assign(zh, {
      panelFlow: '流程', panelSettings: '参数', panelNavigation: 'Gauntlet 面板',
      settingsTitle: '运行参数', settingsQualityHint: '当前项目的质量闸门。保存后，后续运行读取新阈值。',
      settingsModels: '阶段模型', settingsModelsHint: '为每个阶段选择模型与推理强度，留空则继承会话模型。',
      settingsAdvanced: '更多质量阈值', settingsSaveQuality: '保存质量阈值', settingsSaveModels: '保存阶段模型',
      settingsSaved: '已保存', settingsChanged: '有未保存的修改', settingsDiscard: '放弃修改',
      settingsLoad: '正在读取项目配置…', settingsReload: '重新加载', settingsFailed: '保存失败',
      settingsConflict: '配置已在别处更新。请重新加载后修改，避免覆盖他人的改动。',
      settingsInvalid: '请输入范围内的数值', settingsQualitySource: '保存位置：当前项目的 gauntlet.local.json',
      settingsModelsSource: '模型设置作用于之后新建的 Gauntlet 会话。', settingsLimitMax: '上限', settingsLimitMin: '下限',
      quality_crapMax: 'CRAP 风险值', quality_complexityMax: '函数复杂度', quality_functionLinesMax: '函数行数',
      quality_paramsMax: '函数参数个数', quality_lineCoverageMin: '行覆盖率', quality_mutationScoreMin: '变异杀死率',
      quality_nestingMax: '嵌套深度', quality_duplicationMax: '重复代码比例', quality_warningsMax: '编译警告数',
      quality_tidyMax: 'clang-tidy 告警数', quality_staticScopeMin: '静态分析范围', quality_cppcheckMax: 'cppcheck 告警数',
      workflowCurrentStage: '当前阶段', workflowNextStage: '下一阶段', workflowAllPassed: '流程已完成',
      workflowStartNext: '从摸底阶段开始', workflowAfterGate: '当前阶段通过后进入', workflowAfterComplete: '审阅证据包',
      workflowUpcoming: '即将进入',
      settingsDefaults: '尚无项目配置，当前显示默认阈值。保存会创建本地配置。',
      diagramInput: '需求输入', diagramLeader: 'Leader 调度', diagramGatePending: '待验证', diagramGatePassed: '通过',
      diagramGateFailed: '未通过', diagramGateWaiting: '待确认', diagramGateStale: '需复验', diagramGateInterrupted: '中断',
      diagramGateUnknown: '待核实', diagramGateEmpty: '未执行', diagramOutput: '证据输出',
      diagramOutputReady: '可审阅', diagramOutputPending: '等待阶段完成',
      diagramGate: '闸门',
      workflowBack: '查看全流程',
      workflowLeaderShort: 'Leader 执行中',
      diagramSupervisor: 'Agent 协作图', diagramExchange: '派发任务 ↔ 返回结果', diagramAsTool: '阶段 Agent',
      diagramOrderHint: '按阶段编号推进，通过闸门后进入下一阶段。',
      flowRequire_surveyor: 'doctor · test · 项目档案', flowRequire_specifier: 'gate · specifier', flowRequire_coder: 'gate · coder',
      flowRequire_cleaner: 'gate · cleaner', flowRequire_hardener: 'gate · hardener', flowRequire_qa: 'QA 报告 verdict', flowRequire_reporter: 'gate · full · 证据包',
      flowRequire: '需通过', flowAttention: '需要你处理', flowAttentionHint: '在对话里回复 Leader，流程才会继续。',
      flowHuman_survey: '你确认摸底结果', flowHumanNote_survey: '首次接入或规则变更时',
      flowHuman_spec: '你确认验收场景', flowHumanNote_spec: '可选',
      flowHuman_final: '你审阅证据包', flowHumanNote_final: '通过后 Leader 推送并开 PR',
      flowHumanWaiting: '等待你确认', flowHumanDone: '已过',
      flowRework: '返工记录', flowRetry: '{stage} 重做', flowRollback: '{from} 退回 {to}', flowResumed: '{stage} 中断后继续',
      flowNoReason: '未写明原因', flowReworkFrom: '由 {stage} 退回', flowReworkSelf: '同阶段重做', flowResumedShort: '中断后继续',
      flowBack: '流程', flowGates: '闸门结果', flowGatesPending: '尚无闸门结果', flowConclusion: '结论', flowAttempts: '尝试记录',
      flowWaitingDetail: '这一阶段在等你回复。', flowRaw: '原始记录',
    });
    Object.assign(en, {
      panelFlow: 'Workflow', panelSettings: 'Parameters', panelNavigation: 'Gauntlet panel',
      settingsTitle: 'Run parameters', settingsQualityHint: 'Quality gates for this project. Subsequent runs read saved thresholds.',
      settingsModels: 'Stage models', settingsModelsHint: 'Choose a model and reasoning effort for each stage. An empty selection inherits the session model.',
      settingsAdvanced: 'More quality thresholds', settingsSaveQuality: 'Save thresholds', settingsSaveModels: 'Save stage models',
      settingsSaved: 'Saved', settingsChanged: 'Unsaved changes', settingsDiscard: 'Discard changes',
      settingsLoad: 'Reading project configuration…', settingsReload: 'Reload', settingsFailed: 'Save failed',
      settingsConflict: 'Configuration changed elsewhere. Reload before editing to avoid overwriting those changes.',
      settingsInvalid: 'Enter a number within the allowed range', settingsQualitySource: 'Saved in this project’s gauntlet.local.json',
      settingsModelsSource: 'Model settings apply to newly created Gauntlet sessions.', settingsLimitMax: 'Maximum', settingsLimitMin: 'Minimum',
      quality_crapMax: 'CRAP risk', quality_complexityMax: 'Function complexity', quality_functionLinesMax: 'Function lines',
      quality_paramsMax: 'Function parameters', quality_lineCoverageMin: 'Line coverage', quality_mutationScoreMin: 'Mutation kill rate',
      quality_nestingMax: 'Nesting depth', quality_duplicationMax: 'Duplicated code', quality_warningsMax: 'Compiler warnings',
      quality_tidyMax: 'clang-tidy warnings', quality_staticScopeMin: 'Static analysis scope', quality_cppcheckMax: 'cppcheck warnings',
      workflowCurrentStage: 'Current stage', workflowNextStage: 'Next stage', workflowAllPassed: 'Workflow complete',
      workflowStartNext: 'Begin with the survey stage', workflowAfterGate: 'After the current stage passes', workflowAfterComplete: 'Review the evidence pack',
      workflowUpcoming: 'Up next',
      settingsDefaults: 'No project configuration yet. Default thresholds are shown; saving creates local configuration.',
      diagramInput: 'Input', diagramLeader: 'Leader orchestration', diagramGatePending: 'Pending', diagramGatePassed: 'Passed',
      diagramGateFailed: 'Failed', diagramGateWaiting: 'Input', diagramGateStale: 'Recheck', diagramGateInterrupted: 'Stopped',
      diagramGateUnknown: 'Unknown', diagramGateEmpty: 'Not run', diagramOutput: 'Evidence',
      diagramOutputReady: 'Ready to review', diagramOutputPending: 'Waiting for stages',
      diagramGate: 'Gate',
      workflowBack: 'View workflow',
      workflowLeaderShort: 'Leader active',
      diagramSupervisor: 'Agent topology', diagramExchange: 'Task dispatch ↔ Result return', diagramAsTool: 'Stage agent',
      diagramOrderHint: 'Stages follow their numbers. Each gate must pass before the next stage.',
      flowRequire_surveyor: 'doctor · test · profile', flowRequire_specifier: 'gate · specifier', flowRequire_coder: 'gate · coder',
      flowRequire_cleaner: 'gate · cleaner', flowRequire_hardener: 'gate · hardener', flowRequire_qa: 'QA report verdict', flowRequire_reporter: 'gate · full · evidence',
      flowRequire: 'Must pass', flowAttention: 'Needs you', flowAttentionHint: 'Reply to the Leader in the conversation to continue.',
      flowHuman_survey: 'You confirm the survey', flowHumanNote_survey: 'First run or rule changes',
      flowHuman_spec: 'You confirm the scenarios', flowHumanNote_spec: 'Optional',
      flowHuman_final: 'You review the evidence', flowHumanNote_final: 'On approval the Leader pushes and opens a PR',
      flowHumanWaiting: 'Waiting for you', flowHumanDone: 'Done',
      flowRework: 'Rework', flowRetry: '{stage} redone', flowRollback: '{from} sent back to {to}', flowResumed: '{stage} resumed',
      flowNoReason: 'No reason given', flowReworkFrom: 'Sent back from {stage}', flowReworkSelf: 'Redone', flowResumedShort: 'Resumed',
      flowBack: 'Workflow', flowGates: 'Gate results', flowGatesPending: 'No gate results yet', flowConclusion: 'Conclusion', flowAttempts: 'Attempts',
      flowWaitingDetail: 'This stage is waiting for your reply.', flowRaw: 'Raw records',
    });

    // ---------------------------------------------------------------- 样式（宿主主题 token，自动适配明暗）
    const css = `
/* 设置卡片（插件管理页 / 输入框悬浮窗） */
.gx-intro{margin:0 0 4px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6}
.gx-table{display:grid;grid-template-columns:minmax(150px,1.1fr) minmax(180px,1.6fr) minmax(130px,1fr);border-top:.5px solid var(--dsw-alias-border-l2);margin-top:12px}
.gx-head{color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600;letter-spacing:.4px;padding:10px 12px 8px 0}
.gx-cell{padding:12px 12px 12px 0;border-top:.5px solid var(--dsw-alias-border-l2);min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
.gx-stage{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.4;display:flex;align-items:center;gap:8px}
.gx-stage-icon{flex:none;width:28px;height:28px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2,#f6f7f9);color:var(--dsw-alias-label-secondary,#657080)}
.gx-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.4}
.gx-select{appearance:none;-webkit-appearance:none;width:100%;min-width:0;height:32px;padding:0 28px 0 10px;border-radius:var(--dsw-radius-md,8px);border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%23888' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-overflow:ellipsis;cursor:pointer;transition:border-color .15s,background-color .15s}
.gx-select:hover:not(:disabled){background-color:var(--dsw-alias-interactive-bg-hover);border-color:color-mix(in srgb,var(--dsw-alias-label-tertiary,#7a8494) 50%,var(--dsw-alias-border-l3))}
.gx-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.gx-select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default;opacity:.7}
.gx-select[data-invalid]{border-color:var(--dsw-alias-state-error-primary)}
.gx-select option,.gx-select optgroup{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.gx-warn{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5;border-left:2px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,transparent);padding-left:8px;overflow-wrap:anywhere}
.gx-notice{margin-top:10px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gx-notice[data-tone=error]{color:var(--dsw-alias-state-error-primary);border-left:2px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,transparent);padding-left:8px}
.gx-link{background:none;border:0;padding:0;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.gx-link:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.gx-link:disabled{color:var(--dsw-alias-label-tertiary);text-decoration:none;cursor:default}
.gx-foot{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-top:14px}
.gx-footnote{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;flex:1 1 260px}
.gx-modal{width:min(760px,calc(100vw - 32px));max-width:none}
.gx-modal .gx-table{margin-top:4px}
.gx-composer-button{white-space:nowrap;color:var(--dsw-alias-label-secondary)}
@media (max-width:640px){
  .gx-table{grid-template-columns:1fr}
  .gx-head{display:none}
  .gx-cell{border-top:0;padding:4px 0}
  .gx-cell[data-col=stage]{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:14px}
  .gx-cell[data-col=effort]{padding-bottom:12px}
}

/* 流程面板：一套 token。状态色和宿主文字色混合，明暗主题下都保持足够对比度。 */
.gx-workflow{
  --gx-ink:var(--dsw-alias-label-primary,#20242d);--gx-subtle:var(--dsw-alias-label-secondary,#657080);--gx-muted:var(--dsw-alias-label-tertiary,#8a93a1);
  --gx-bg:var(--dsw-alias-bg-layer-1,#fff);--gx-surface:var(--dsw-alias-bg-layer-2,#f5f6f8);--gx-line:var(--dsw-alias-border-l2,#e4e7ec);
  --gx-brand:var(--dsw-alias-brand-primary,#4263eb);
  --gx-ok:color-mix(in srgb,#2f8a62 82%,var(--gx-ink));
  --gx-err:var(--dsw-alias-state-error-primary,color-mix(in srgb,#c9473e 85%,var(--gx-ink)));
  --gx-warn:color-mix(in srgb,#b27b1f 82%,var(--gx-ink));
  --gx-hover:color-mix(in srgb,var(--gx-ink) 4%,transparent);
  --gx-ease:cubic-bezier(.2,.7,.3,1);
  height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;color:var(--gx-ink);font-family:inherit;font-size:13px;line-height:1.6}
.gx-workflow *{box-sizing:border-box}
.gx-workflow [hidden]{display:none!important}
.gx-workflow :focus-visible{outline:2px solid var(--gx-brand);outline-offset:2px}

/* 顶部：分段切换 + 一行状态条 */
.gx-panel-nav{display:flex;align-items:center;gap:2px;flex-shrink:0;margin:12px 20px 0;padding:2px;width:max-content;border-radius:8px;background:var(--gx-surface)}
.gx-panel-nav button{border:0;background:transparent;color:var(--gx-subtle);font:inherit;font-size:12px;font-weight:500;padding:4px 14px;border-radius:6px;cursor:pointer;transition:background .15s,color .15s}
.gx-panel-nav button:hover{color:var(--gx-ink)}
.gx-panel-nav button[aria-pressed=true]{color:var(--gx-ink);background:var(--gx-bg);box-shadow:0 1px 2px color-mix(in srgb,var(--gx-ink) 10%,transparent)}
.gx-panel-context{flex-shrink:0;padding:12px 20px 0}
.gx-context-line{display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap;font-size:12px;color:var(--gx-subtle);padding-bottom:10px}
.gx-context-now{display:inline-flex;align-items:center;gap:7px;min-width:0}
.gx-context-now strong{font-size:14px;font-weight:600;color:var(--gx-ink)}
.gx-context-now i{width:7px;height:7px;flex:none;border-radius:50%;background:var(--gx-muted)}
.gx-context-now[data-status=running] i{background:var(--gx-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--gx-brand) 18%,transparent)}
.gx-context-now[data-status=running]>span{color:var(--gx-brand)}
.gx-context-now[data-status=passed] i{background:var(--gx-ok)}
.gx-context-now[data-status=failed] i{background:var(--gx-err)}
.gx-context-now[data-status=failed]>span{color:var(--gx-err)}
.gx-context-now:is([data-status=waiting],[data-status=stale],[data-status=interrupted]) i{background:var(--gx-warn)}
.gx-context-now:is([data-status=waiting],[data-status=stale],[data-status=interrupted])>span{color:var(--gx-warn)}
.gx-context-next{display:inline-flex;align-items:center;gap:6px;min-width:0}
.gx-context-next strong{font-weight:500;color:var(--gx-ink)}
.gx-workflow-count{margin-left:auto;font-size:12px;color:var(--gx-subtle);font-variant-numeric:tabular-nums;white-space:nowrap}
.gx-progress-track{height:2px;margin:0 -20px;background:var(--gx-line)}
.gx-progress-fill{height:100%;width:0;background:var(--gx-ok);transition:width .6s var(--gx-ease)}

.gx-panel-body{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;padding:0 20px 24px}
.gx-panel-empty{padding:20px}
.gx-history{padding-top:8px}
.gx-muted{font-size:12px;line-height:1.7;color:var(--gx-muted);margin:8px 0;overflow-wrap:anywhere}
.gx-progress-text{margin:8px 0}

/* 时间线：Leader → 七个阶段 → 证据输出，标记都落在同一条竖轴上 */
.gx-pipeline{width:100%;max-width:560px;margin:16px auto 4px}
.gx-pipe-canvas{position:relative;min-width:0}
.gx-pipe-wires{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.gx-pipe-rail{fill:none;stroke:var(--gx-line);stroke-width:2}
.gx-pipe-progress{fill:none;stroke:var(--gx-ok);stroke-width:2;transition:d .6s var(--gx-ease)}
.gx-pipe-gate circle{fill:var(--gx-bg);stroke:color-mix(in srgb,var(--gx-muted) 55%,var(--gx-line));stroke-width:1.5;transition:fill .2s,stroke .2s}
.gx-pipe-gate-mark{fill:var(--gx-muted);font-size:10px;font-weight:600;font-family:inherit;font-variant-numeric:tabular-nums}
.gx-pipe-gate[data-status=passed] circle{fill:var(--gx-ok);stroke:var(--gx-ok)}
.gx-pipe-gate[data-status=running] circle{stroke:var(--gx-brand);stroke-width:2}
.gx-pipe-gate[data-status=running] .gx-pipe-gate-mark{fill:var(--gx-brand)}
.gx-pipe-gate[data-status=failed] circle{fill:var(--gx-err);stroke:var(--gx-err)}
.gx-pipe-gate:is([data-status=waiting],[data-status=stale],[data-status=interrupted]) circle{fill:var(--gx-warn);stroke:var(--gx-warn)}
.gx-pipe-gate:is([data-status=passed],[data-status=failed],[data-status=waiting],[data-status=stale],[data-status=interrupted]) .gx-pipe-gate-mark{fill:#fff}
.gx-pipe-gate[data-next=true] circle{stroke-dasharray:3 2.5}
.gx-pipe-gate circle.gx-pipe-halo{fill:var(--gx-brand);stroke:none;opacity:.18;transform-box:fill-box;transform-origin:center;animation:gx-halo 2.4s var(--gx-ease) infinite}
@keyframes gx-halo{0%{transform:scale(1);opacity:.22}80%,100%{transform:scale(1.9);opacity:0}}

.gx-pipe-leader{position:absolute;left:0;right:0;display:flex;align-items:center;gap:12px;padding-right:12px;font-size:12px;color:var(--gx-subtle)}
.gx-pipe-leader-badge{flex:none;width:28px;height:28px;margin-left:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--gx-ink);color:var(--gx-bg)}
.gx-pipe-leader strong{margin-left:-6px;font-size:13px;font-weight:600;color:var(--gx-ink)}
.gx-pipe-leader small{margin-left:auto;font-size:12px;white-space:nowrap}
.gx-pipe-leader small[data-live]{color:var(--gx-brand)}

/* 阶段行：第一行名称和状态，第二行要过的闸门 / 最近一次逐项结果 */
.gx-pipe-card{position:absolute;left:48px;right:0;display:flex;flex-direction:column;justify-content:center;gap:3px;padding:0 28px 0 12px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;font:inherit;transition:background-color .15s}
button.gx-pipe-card{cursor:pointer}
button.gx-pipe-card:hover{background:var(--gx-hover)}
button.gx-pipe-card:focus-visible{outline-offset:0}
.gx-pipe-card[data-status=running]{background:color-mix(in srgb,var(--gx-brand) 6%,transparent)}
.gx-pipe-card:is([data-status=failed],[data-status=waiting]){background:color-mix(in srgb,var(--gx-warn) 8%,transparent)}
.gx-pipe-chevron{position:absolute;right:12px;top:50%;width:6px;height:6px;margin-top:-3px;border-right:1.5px solid var(--gx-muted);border-top:1.5px solid var(--gx-muted);transform:rotate(45deg);opacity:.6;transition:opacity .15s,transform .15s}
button.gx-pipe-card:hover .gx-pipe-chevron{opacity:1;transform:translateX(2px) rotate(45deg)}
.gx-pipe-top{display:flex;align-items:baseline;gap:8px;min-width:0}
.gx-pipe-name{font-size:13px;font-weight:600;line-height:1.4;white-space:nowrap}
.gx-pipe-card[data-status=pending]:not([data-next=true]) .gx-pipe-name{font-weight:500;color:var(--gx-subtle)}
.gx-pipe-role{font-size:11.5px;color:var(--gx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.gx-pipe-pill{margin-left:auto;font-size:12px;line-height:1.4;color:var(--gx-subtle);white-space:nowrap}
.gx-pipe-pill[data-status=running]{color:var(--gx-brand);font-weight:500}
.gx-pipe-pill[data-status=failed]{color:var(--gx-err);font-weight:500}
.gx-pipe-pill:is([data-status=waiting],[data-status=stale],[data-status=interrupted]){color:var(--gx-warn);font-weight:500}
.gx-pipe-gateline{display:flex;align-items:center;gap:8px;min-width:0;font-size:11.5px;line-height:1.4}
.gx-pipe-require{color:var(--gx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px}
.gx-pipe-require code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}

/* 闸门逐项结果 */
.gx-gates{display:flex;flex-wrap:wrap;gap:4px;min-width:0}
.gx-pipe-gateline .gx-gates{flex-wrap:nowrap;overflow:hidden}
.gx-gate{display:inline-flex;align-items:center;gap:3px;padding:0 6px;border-radius:4px;font-size:11px;line-height:18px;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--gx-surface);color:var(--gx-subtle)}
.gx-gate i{font-style:normal;font-weight:700}
.gx-gate small{font-size:10.5px;opacity:.85}
.gx-gate[data-pass=true] i{color:var(--gx-ok)}
.gx-gate[data-pass=false]{background:color-mix(in srgb,var(--gx-err) 11%,transparent);color:var(--gx-err)}
.gx-gate-more{font-size:11px;color:var(--gx-muted)}
.gx-attempt-dots{margin-left:auto;display:inline-flex;align-items:center;gap:3px;flex:none}
.gx-attempt-dots i{width:6px;height:6px;border-radius:50%;background:var(--gx-muted)}
.gx-attempt-dots i[data-status=passed]{background:var(--gx-ok)}
.gx-attempt-dots i[data-status=failed]{background:var(--gx-err)}
.gx-attempt-dots i:is([data-status=waiting],[data-status=interrupted],[data-status=stale]){background:var(--gx-warn)}
.gx-attempt-dots i[data-status=running]{background:var(--gx-brand)}
.gx-attempt-dots small{margin-left:2px;font-size:11px;color:var(--gx-muted);font-variant-numeric:tabular-nums}

/* 人类闸门（菱形）与回流箭头 */
.gx-human-node{fill:var(--gx-bg);stroke:color-mix(in srgb,var(--gx-muted) 70%,var(--gx-line));stroke-width:1.5}
.gx-human-node[data-state=done]{fill:var(--gx-muted);stroke:var(--gx-muted)}
.gx-human-node[data-state=waiting]{fill:var(--gx-warn);stroke:var(--gx-warn)}
.gx-human{position:absolute;left:48px;right:0;display:flex;align-items:center;gap:8px;padding:0 12px;font-size:12px;color:var(--gx-subtle)}
.gx-human small{margin-left:auto;font-size:11.5px;color:var(--gx-muted);white-space:nowrap}
.gx-human[data-state=waiting]{color:var(--gx-ink);font-weight:500}
.gx-human[data-state=waiting] small{color:var(--gx-warn);font-weight:600}
.gx-loop{fill:none;stroke:var(--gx-warn);stroke-width:1.5;stroke-dasharray:4 3}
.gx-loop-head{fill:none;stroke:var(--gx-warn);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}

/* 需要你处理 / 返工记录 */
.gx-attention{display:flex;flex-direction:column;gap:6px;margin:16px 0 0;padding:10px 12px;border-radius:8px;border:1px solid color-mix(in srgb,var(--gx-warn) 40%,var(--gx-line));background:color-mix(in srgb,var(--gx-warn) 7%,var(--gx-bg))}
.gx-attention>strong{font-size:12px;font-weight:600;color:var(--gx-warn)}
.gx-attention>button{display:flex;gap:10px;align-items:baseline;text-align:left;border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer}
.gx-attention>button>span:first-child{flex:none;font-weight:600}
.gx-attention>button>span:last-child{font-size:12px;color:var(--gx-subtle);overflow-wrap:anywhere}
.gx-attention>button:hover>span:last-child{color:var(--gx-ink);text-decoration:underline;text-underline-offset:2px}
.gx-attention>span{font-size:12px;overflow-wrap:anywhere}
.gx-attention>small{font-size:11.5px;color:var(--gx-muted)}
.gx-rework{margin-top:16px;border-top:1px solid var(--gx-line);padding-top:12px}
.gx-rework h3,.gx-workflow .gx-block h4{display:flex;align-items:baseline;gap:6px;margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0;color:var(--gx-ink)}
.gx-rework h3 span,.gx-workflow .gx-block h4 span{font-weight:400;color:var(--gx-muted);font-variant-numeric:tabular-nums}
.gx-rework ol,.gx-attempts{list-style:none;margin:0;padding:0}
.gx-rework button,.gx-attempts button{display:flex;gap:10px;text-align:left;border:0;background:none;font:inherit;color:inherit;padding:7px 8px;margin:0 -8px;width:calc(100% + 16px);border-radius:6px;cursor:pointer;transition:background .15s}
.gx-rework button:hover,.gx-attempts button:hover{background:var(--gx-hover)}
.gx-rework i{flex:none;font-style:normal;color:var(--gx-warn);font-weight:700;width:14px;text-align:center}
.gx-rework li[data-kind=resumed] i{color:var(--gx-muted)}
.gx-rework button>span{display:flex;flex-direction:column;min-width:0}
.gx-rework strong{font-size:12px;font-weight:600}
.gx-rework strong+span{font-size:12px;color:var(--gx-subtle);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* 阶段详情页 */
.gx-stage-details{padding:12px 0 0;min-width:0;animation:gx-fade-in .18s ease both}
.gx-detail-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;margin-bottom:6px;background:var(--gx-bg)}
.gx-back{display:inline-flex;align-items:center;gap:6px;border:0;background:none;font:inherit;font-size:12px;color:var(--gx-subtle);padding:4px 8px;margin-left:-8px;border-radius:6px;cursor:pointer}
.gx-back:hover{background:var(--gx-hover);color:var(--gx-ink)}
.gx-detail-title{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.gx-detail-title h3{font-size:18px;font-weight:600;line-height:1.4;margin:0}
.gx-detail-title .gx-tag{margin-left:auto;align-self:center}
.gx-inspector-role{font-size:12px;color:var(--gx-muted)}
.gx-detail-desc{display:flex;flex-direction:column;gap:2px;margin:4px 0 12px;font-size:12px;line-height:1.6;color:var(--gx-subtle)}
.gx-detail-desc span{color:var(--gx-muted);font-size:11.5px}
.gx-stage-details>.gx-attention{margin:0 0 12px}
.gx-block{padding:12px 0;border-top:1px solid var(--gx-line)}
.gx-block .gx-gates{gap:6px}
.gx-block .gx-gate{font-size:12px;line-height:22px;padding:0 8px}
.gx-attempts li+li{border-top:1px solid color-mix(in srgb,var(--gx-line) 60%,transparent)}
.gx-attempts button{flex-direction:column;gap:3px}
.gx-attempts button[aria-pressed=true]{background:var(--gx-surface)}
.gx-attempt-row{display:flex;align-items:center;gap:8px;min-width:0;font-size:12px}
.gx-attempt-row strong{font-variant-numeric:tabular-nums;font-weight:600;min-width:20px}
.gx-attempt-failed{color:var(--gx-err);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.gx-attempt-row time{margin-left:auto;font-size:11px;color:var(--gx-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.gx-attempt-origin{display:flex;gap:6px;padding-left:28px;font-size:12px;color:var(--gx-subtle);overflow-wrap:anywhere}
.gx-attempt-origin b{flex:none;font-weight:500;color:var(--gx-warn)}
.gx-attempt-origin[data-kind=resumed] b{color:var(--gx-muted)}
.gx-result-summary{font-size:13px;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 8px}
.gx-run-meta{margin:12px 0;color:var(--gx-subtle);font-size:12px}
.gx-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 14px;font-size:12px;margin:8px 0 0;line-height:1.7}
.gx-facts dt{color:var(--gx-muted)}
.gx-facts dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}

/* 折叠区 */
.gx-fold{border:0;margin:0;padding:0;min-width:0}
.gx-fold>summary{list-style:none;display:flex;align-items:flex-start;gap:8px;min-height:32px;cursor:pointer;padding:6px;margin:0 -6px;font-size:12px;font-weight:500;overflow-wrap:anywhere;border-radius:6px;color:var(--gx-subtle);transition:background .15s,color .15s}
.gx-fold>summary:hover{background:var(--gx-hover);color:var(--gx-ink)}
.gx-fold>summary::-webkit-details-marker{display:none}
.gx-fold>summary:before{content:'';display:block;flex:0 0 5px;width:5px;height:5px;border-right:1.2px solid currentColor;border-bottom:1.2px solid currentColor;transform:rotate(-45deg);margin:7px 4px 0 2px;opacity:.7;transition:transform .15s}
.gx-fold[open]>summary:before{transform:rotate(45deg);margin-top:5px}
.gx-fold[open]>summary{color:var(--gx-ink)}
.gx-fold[open]>*:not(summary){animation:gx-fade-in .18s ease}
.gx-section{margin-top:2px}
.gx-section>summary,.gx-inspector-body>.gx-fold>summary,.gx-inspector-body>.gx-section>.gx-fold>summary{font-size:13px;min-height:36px;padding-top:8px;padding-bottom:8px;color:var(--gx-ink)}
.gx-section[open]{margin-bottom:12px}
.gx-workflow pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.7;background:var(--gx-surface);border-radius:6px;padding:10px 12px;margin:6px 0 12px}
.gx-workflow h4{font-size:11px;font-weight:600;letter-spacing:.3px;color:var(--gx-muted);margin:14px 0 0}

/* 按钮与标签 */
.gx-soft-button,.gx-workflow-button{font:inherit;font-size:12px;background:transparent;border:1px solid var(--gx-line);border-radius:6px;color:var(--gx-subtle);padding:4px 10px;cursor:pointer;transition:background .15s,color .15s,border-color .15s}
.gx-soft-button:hover:not(:disabled),.gx-workflow-button:hover{background:var(--gx-hover);color:var(--gx-ink)}
.gx-soft-button:disabled{opacity:.5;cursor:default}
.gx-workflow-button{display:flex;align-items:center;gap:5px}
.gx-tag{display:inline-flex;align-items:center;font-size:11px;line-height:1.5;font-weight:500;color:var(--gx-subtle);padding:0 7px;border-radius:4px;background:var(--gx-surface);white-space:nowrap}
.gx-tag[data-status=running]{color:var(--gx-brand);background:color-mix(in srgb,var(--gx-brand) 10%,transparent)}
.gx-tag:is([data-status=SURVIVED],[data-status=NO_COVERAGE],[data-status=failed]){color:var(--gx-err);background:color-mix(in srgb,var(--gx-err) 10%,transparent)}
.gx-tag:is([data-status=passed],[data-status=KILLED],[data-status=TIMEOUT]){color:var(--gx-ok);background:color-mix(in srgb,var(--gx-ok) 10%,transparent)}
.gx-tag:is([data-status=waiting],[data-status=stale],[data-status=interrupted]){color:var(--gx-warn);background:color-mix(in srgb,var(--gx-warn) 12%,transparent)}

/* 指标：数字为主，细条 + 阈值刻度为辅 */
.gx-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin:12px 0;background:var(--gx-line);border:1px solid var(--gx-line);border-radius:8px;overflow:hidden}
.gx-metric{display:flex;flex-direction:column;gap:2px;min-width:0;padding:10px 12px;background:var(--gx-bg)}
.gx-metric>span,.gx-metric-label{font-size:12px;color:var(--gx-subtle);line-height:1.5}
.gx-metric>strong{font-size:20px;font-weight:600;line-height:1.35;font-variant-numeric:tabular-nums}
.gx-metric[data-tone=over]>strong{color:var(--gx-err)}
.gx-metric>small,.gx-metric-note{font-size:11px;color:var(--gx-muted);line-height:1.5;font-variant-numeric:tabular-nums}
.gx-meter{position:relative;display:block;height:3px;border-radius:2px;background:var(--gx-surface);margin:4px 0 2px}
.gx-meter i{display:block;height:100%;border-radius:inherit;background:var(--gx-subtle);transition:width .7s var(--gx-ease)}
.gx-metric[data-tone=pass] .gx-meter i{background:var(--gx-ok)}
.gx-metric[data-tone=over] .gx-meter i{background:var(--gx-err)}
.gx-meter b{position:absolute;top:-3px;bottom:-3px;width:1.5px;margin-left:-.75px;background:var(--gx-ink);opacity:.45}
.gx-metric-context{font-size:12px;line-height:1.6;color:var(--gx-subtle);margin:8px 0 12px}
.gx-mutbar-wrap{margin:8px 0 12px}
.gx-mutbar{display:flex;height:6px;border-radius:3px;overflow:hidden;gap:1px;background:var(--gx-surface)}
.gx-mutseg{display:block;height:100%}
.gx-mut-killed{background:var(--gx-ok)}
.gx-mut-timeout{background:color-mix(in srgb,var(--gx-ok) 55%,var(--gx-bg))}
.gx-mut-survived{background:var(--gx-err)}
.gx-mut-nocov{background:var(--gx-warn)}
.gx-mut-excluded{background:color-mix(in srgb,var(--gx-muted) 60%,var(--gx-bg))}
.gx-mut-unknown{background:var(--gx-line)}
.gx-mutlegend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px}
.gx-mutchip{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--gx-subtle);line-height:1.5;font-variant-numeric:tabular-nums}
.gx-mutchip i{width:7px;height:7px;border-radius:2px;display:inline-block}

/* 记录列表 */
.gx-search{width:100%;height:32px;padding:0 10px;margin:8px 0;border:1px solid var(--gx-line);border-radius:6px;background:var(--gx-bg);font:inherit;font-size:12px;color:inherit;transition:border-color .15s}
.gx-search:focus{outline:none;border-color:var(--gx-brand)}
.gx-record-title{display:flex;flex:1;min-width:0;justify-content:space-between;gap:10px;align-items:flex-start}
.gx-record-title code{font-size:12px;min-width:0;overflow-wrap:anywhere}
.gx-record-title time{font-size:11px;font-weight:400;white-space:nowrap;color:var(--gx-muted);padding-top:1px;font-variant-numeric:tabular-nums}
.gx-record-label{min-width:0;font-size:12px;overflow-wrap:anywhere}
.gx-record-preview{display:block;max-width:100%;font-size:12px;font-weight:400;color:var(--gx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.gx-records>.gx-fold{border-top:1px solid color-mix(in srgb,var(--gx-line) 70%,transparent)}
.gx-records>.gx-fold:first-child{border-top:0}
.gx-function-title{display:flex;flex-direction:column;gap:2px;min-width:0}
.gx-function-title strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}
.gx-function-title code{font-size:12px;font-weight:400;color:var(--gx-muted)}
.gx-workflow-footer{border-top:1px solid var(--gx-line);margin-top:20px;padding-top:8px}
.gx-workflow-footer>.gx-fold{margin-top:2px}

/* 参数页 */
.gx-settings{padding:20px 0 0}
.gx-settings h2{font-size:17px;font-weight:600;margin:0 0 4px;line-height:1.4}
.gx-settings h3{font-size:14px;font-weight:600;margin:0 0 4px;line-height:1.5}
.gx-settings-intro{font-size:12px;line-height:1.7;color:var(--gx-subtle);margin:4px 0 16px}
.gx-quality-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 12px;margin:16px 0}
.gx-field{display:flex;flex-direction:column;min-width:0;gap:6px;font-size:12px}
.gx-field-label{display:flex;justify-content:space-between;align-items:baseline;gap:5px;color:var(--gx-ink);font-weight:500}
.gx-field-label small{font-size:11px;font-weight:400;color:var(--gx-muted);white-space:nowrap}
.gx-number-wrap{display:flex;align-items:center;gap:8px;border:1px solid var(--gx-line);border-radius:6px;min-width:0;background:var(--gx-bg);padding-right:10px;transition:border-color .15s}
.gx-number-wrap:hover{border-color:color-mix(in srgb,var(--gx-subtle) 40%,var(--gx-line))}
.gx-number-wrap:focus-within{border-color:var(--gx-brand)}
.gx-number-wrap input{appearance:textfield;-moz-appearance:textfield;min-width:0;width:100%;height:34px;padding:0 10px;border:0;background:transparent;font:inherit;font-size:14px;font-variant-numeric:tabular-nums;color:var(--gx-ink);outline:none}
.gx-number-wrap input::-webkit-inner-spin-button,.gx-number-wrap input::-webkit-outer-spin-button{appearance:none;margin:0}
.gx-number-wrap span{font-size:12px;color:var(--gx-muted)}
.gx-number-wrap:has(input[aria-invalid=true]){border-color:var(--gx-err)}
.gx-field-error{font-size:11px;color:var(--gx-err)}
.gx-settings-note{font-size:12px;line-height:1.7;color:var(--gx-subtle);margin:12px 0}
.gx-settings-actions{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:16px 0 0}
.gx-primary-button{font:inherit;font-size:12px;font-weight:600;background:var(--gx-ink);color:var(--gx-bg);border:0;border-radius:6px;padding:7px 14px;cursor:pointer;white-space:nowrap;transition:opacity .15s}
.gx-primary-button:hover:not(:disabled){opacity:.86}
.gx-primary-button:disabled{opacity:.35;cursor:default}
.gx-settings-status{font-size:12px;color:var(--gx-subtle);margin:10px 0 0;overflow-wrap:anywhere}
.gx-settings-status[data-error=true]{color:var(--gx-err)}
.gx-model-settings{border-top:1px solid var(--gx-line);margin-top:24px;padding-top:20px}
.gx-model-rows{margin:12px 0 8px;display:flex;flex-direction:column}
.gx-model-row{min-width:0;padding:12px 0;border-top:1px solid color-mix(in srgb,var(--gx-line) 70%,transparent)}
.gx-model-row:first-child{border-top:0;padding-top:4px}
.gx-model-row>header{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;font-weight:600}
.gx-model-row>header small{font-size:12px;font-weight:400;color:var(--gx-muted)}
.gx-model-row .gx-stage-icon{width:24px;height:24px;border-radius:6px;background:var(--gx-surface);color:var(--gx-subtle)}
.gx-model-inputs{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:8px}
.gx-model-inputs label{min-width:0;font-size:11px;color:var(--gx-muted);display:flex;flex-direction:column;gap:4px}
.gx-model-inputs .gx-select{height:32px;font-size:12px}
.gx-skeleton{height:34px;border-radius:6px;margin:10px 0;background:var(--gx-surface);animation:gx-breathe 1.6s ease-in-out infinite}

@keyframes gx-fade-in{from{opacity:0;transform:translateY(-2px)}}
@keyframes gx-breathe{50%{opacity:.55}}
@media(prefers-reduced-motion:reduce){.gx-workflow *{transition:none!important;animation:none!important}}
@media(max-width:420px){.gx-panel-nav{margin-left:12px;margin-right:12px}.gx-panel-context{padding-left:12px;padding-right:12px}.gx-progress-track{margin:0 -12px}.gx-panel-body{padding-left:12px;padding-right:12px}.gx-metrics{grid-template-columns:1fr}.gx-quality-fields,.gx-model-inputs{grid-template-columns:1fr}}
`;
    const tagId = 'dsh-gauntlet/settings.css';
    if (typeof document !== 'undefined') {
      let tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']');
      if (!tag) {
        tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-gauntlet';
        tag.dataset.pluginCss = tagId;
        document.head.appendChild(tag);
      }
      tag.textContent = css;
    }

    // ---------------------------------------------------------------- 数据
    const routeKey = (r) => (r && r.provider && r.model ? r.provider + '\u0000' + r.model : '');

    /** 只保留认识的阶段和完整的路由。 */
    function normalizeStages(value) {
      const out = {};
      for (const key of STAGE_KEYS) {
        const r = value && value[key];
        if (r && r.provider && r.model) out[key] = { provider: r.provider, model: r.model, ...(r.reasoningEffort ? { reasoningEffort: r.reasoningEffort } : {}) };
      }
      return out;
    }

    function sameStages(a, b) {
      for (const key of STAGE_KEYS) {
        const x = a[key], y = b[key];
        if (routeKey(x) !== routeKey(y)) return false;
        if ((x && x.reasoningEffort || '') !== (y && y.reasoningEffort || '')) return false;
      }
      return true;
    }

    /** 绑定 `gauntlet` 配置表单与模型目录的暂存控制器（与「子智能体」页同一模式）。 */
    class GauntletCardController {
      constructor(scope, ctx) {
        this.scope = scope;
        this.ctx = ctx;
        this.groups = [];
        this.catalogStatus = 'idle';
        this.catalogPartial = false;
        this.draft = undefined;
        this.draftRevision = undefined;
        this.saving = false;
        this.failed = false;
        this.conflicted = false;
        this.disposed = false;
        this.saveGeneration = 0;
        this.catalogGeneration = 0;
        this.store = clientStore.createSnapshotStore(this.projection());
        this.unsubscribe = scope.subscribe(() => {
          if (!this.saving && this.draft !== undefined && this.scope.getSnapshot().revision !== this.draftRevision) {
            if (sameStages(this.current(), this.draft)) this.clearDraft();
            else this.conflicted = true;
          }
          this.publish();
        });
        this.loadCatalog();
      }

      dispose() {
        this.disposed = true;
        this.saveGeneration += 1;
        this.catalogGeneration += 1;
        this.unsubscribe();
      }

      inject() {
        return {
          hooks: { gauntletCard: this.store },
          setModel: (stage, key) => this.setModel(stage, key),
          setEffort: (stage, effort) => this.setEffort(stage, effort),
          resetAll: () => this.resetAll(),
          retryCatalog: () => this.refreshCatalog(),
          save: () => this.save(),
          discard: () => this.discard(),
        };
      }

      current() {
        const snapshot = this.scope.getSnapshot();
        return normalizeStages(snapshot.value && snapshot.value.stages);
      }

      desired() {
        return this.draft !== undefined ? this.draft : this.current();
      }

      editable() {
        const snapshot = this.scope.getSnapshot();
        return !this.disposed && snapshot.status === 'ready' && snapshot.writable && !this.saving;
      }

      beginDraft() {
        if (this.draft === undefined) {
          this.draft = { ...this.current() };
          this.draftRevision = this.scope.getSnapshot().revision;
        }
        return this.draft;
      }

      findModel(provider, model) {
        const group = this.groups.find((g) => g.id === provider);
        return group && group.models.find((m) => m.id === model);
      }

      setModel(stage, key) {
        if (!this.editable() || !STAGE_KEYS.includes(stage)) return;
        const draft = this.beginDraft();
        if (!key) delete draft[stage];
        else {
          const [provider, model] = key.split('\u0000');
          const prev = draft[stage];
          const info = this.findModel(provider, model);
          const efforts = (info && info.reasoning && info.reasoning.efforts) || [];
          // 换模型时只保留新模型也支持的推理强度，否则回到模型默认。
          const keep = prev && prev.reasoningEffort && efforts.some((e) => e.id === prev.reasoningEffort) ? prev.reasoningEffort : undefined;
          draft[stage] = { provider, model, ...(keep ? { reasoningEffort: keep } : {}) };
        }
        this.failed = false;
        this.publish();
      }

      setEffort(stage, effort) {
        if (!this.editable()) return;
        const draft = this.beginDraft();
        const route = draft[stage];
        if (!route) return;
        draft[stage] = effort ? { provider: route.provider, model: route.model, reasoningEffort: effort } : { provider: route.provider, model: route.model };
        this.failed = false;
        this.publish();
      }

      resetAll() {
        if (!this.editable()) return;
        this.beginDraft();
        this.draft = {};
        this.failed = false;
        this.publish();
      }

      clearDraft() {
        this.draft = undefined;
        this.draftRevision = undefined;
        this.failed = false;
        this.conflicted = false;
      }

      discard() {
        if (this.saving) return;
        this.clearDraft();
        this.publish();
      }

      async save() {
        const snapshot = this.scope.getSnapshot();
        const desired = this.desired();
        if (!this.editable() || this.draft === undefined || sameStages(this.current(), desired)) return;
        if (snapshot.revision !== this.draftRevision) {
          this.conflicted = true;
          this.publish();
          return;
        }
        const generation = this.saveGeneration;
        this.saving = true;
        this.failed = false;
        this.publish();
        try {
          await this.scope.mutate([{ op: 'set', path: ['stages'], value: desired }], this.draftRevision);
        } catch {
          // 结果以下面的"是否落地"为准
        }
        if (generation !== this.saveGeneration) return;
        const landed = sameStages(this.current(), desired);
        this.saving = false;
        this.failed = !landed;
        if (landed) this.clearDraft();
        this.publish();
      }

      refreshCatalog() {
        if (this.disposed) return;
        this.catalogGeneration += 1;
        this.catalogStatus = 'idle';
        this.loadCatalog();
      }

      resetConnection() {
        if (this.disposed) return;
        this.saveGeneration += 1;
        this.saving = false;
        this.clearDraft();
        this.groups = [];
        this.refreshCatalog();
      }

      async loadCatalog() {
        if (this.disposed || this.catalogStatus === 'loading') return;
        const generation = this.catalogGeneration;
        this.catalogStatus = 'loading';
        this.catalogPartial = false;
        this.publish();
        let response;
        try {
          response = await this.ctx.remote.session.modelCatalog();
        } catch {
          response = { ok: false };
        }
        if (generation !== this.catalogGeneration || this.disposed) return;
        if (response && response.ok) {
          this.groups = response.value.groups || [];
          this.catalogPartial = (response.value.failures || []).length > 0;
          this.catalogStatus = 'ready';
        } else this.catalogStatus = 'error';
        this.publish();
      }

      /** 每个阶段一行：当前选择、它在目录里的信息、可选推理强度。 */
      rows(desired) {
        return STAGE_KEYS.map((stage) => {
          const route = desired[stage];
          if (!route) return { stage, key: '', route: undefined, known: true, efforts: [], defaultEffort: undefined };
          const info = this.findModel(route.provider, route.model);
          return {
            stage,
            key: routeKey(route),
            route,
            // 目录还没读到时不判定为"不可用"，避免闪一下警告
            known: info !== undefined || this.catalogStatus !== 'ready',
            efforts: (info && info.reasoning && info.reasoning.efforts) || [],
            defaultEffort: info && info.reasoning && info.reasoning.defaultEffort,
          };
        });
      }

      /** 目录里没有、但已保存或暂存着的路由：单独成组，仍可被选中保留或换掉。 */
      orphans(desired) {
        if (this.catalogStatus !== 'ready') return [];
        const seen = new Map();
        for (const r of [...Object.values(this.current()), ...Object.values(desired)]) {
          if (!this.findModel(r.provider, r.model)) seen.set(routeKey(r), { provider: r.provider, model: r.model });
        }
        return [...seen.entries()].map(([key, r]) => ({ key, label: r.provider + ' / ' + r.model }));
      }

      projection() {
        const snapshot = this.scope.getSnapshot();
        const desired = this.desired();
        return {
          available: snapshot.status === 'ready',
          writable: !!snapshot.writable,
          dirty: this.draft !== undefined && !sameStages(this.current(), desired),
          invalid: this.conflicted,
          saving: this.saving,
          failed: this.failed,
          conflicted: this.conflicted,
          groups: this.groups,
          orphans: this.orphans(desired),
          rows: this.rows(desired),
          anySet: Object.keys(desired).length > 0,
          catalogStatus: this.catalogStatus,
          catalogPartial: this.catalogPartial,
        };
      }

      publish() {
        this.store.set(this.projection());
      }
    }

    // ---------------------------------------------------------------- 流程状态
    // 只从当前可见分支的真实阶段调用推导状态；工具结束、todo 完成都不等于过闸门。
    function progressText(content) {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      return content.filter((block) => block && block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text).join('\n');
    }

    function parseStageResult(output) {
      if (typeof output !== 'string') return undefined;
      const headers = [...output.matchAll(/^\s*GAUNTLET-RESULT:\s*(PASS|FAIL|NEED-HUMAN)\b[^\n\r]*/gm)];
      if (!headers.length) return undefined;
      const header = headers[headers.length - 1];
      const result = { verdict: header[1], status: { PASS: 'passed', FAIL: 'failed', 'NEED-HUMAN': 'waiting' }[header[1]] };
      let field;
      for (const line of output.slice(header.index + header[0].length).split(/\r?\n/)) {
        if (/^\s*```/.test(line)) break;
        const match = /^\s*(stage|profile|branch|gates|loop|summary|next|rules):\s*(.*)$/i.exec(line);
        if (match) {
          field = match[1].toLowerCase();
          result[field] = match[2].trim();
        } else if (field && line.trim()) result[field] += '\n' + line.trimEnd();
      }
      if (result.verdict === 'PASS') {
        if (!result.gates) result.status = 'unknown';
        else if (/❌|✗|✘|\b(?:FAIL(?:ED)?|ERROR)\b/i.test(result.gates)) result.status = 'failed';
        else if (/\b(?:pending|skipped|unverified|unchecked)\b|\bnot[\s-]+(?:run|passed|verified|checked|tested)\b|待验证|未执行|跳过|未验证/i.test(result.gates)
          || !result.gates.split(/[,;；\n]+/).every((gate) => !gate.trim() || /✅|✓|✔|\bPASS(?:ED)?\b/i.test(gate))) result.status = 'unknown';
        // 协议示例中的候选值和占位符不能成为一次真实的 PASS。
        if (/\b(?:FAIL|NEED-HUMAN)\b/.test(header[0].slice(header[0].indexOf('PASS') + 4))
          || [result.stage, result.profile, result.branch, result.gates, result.loop].some((value) => value && /<[^>]+>/.test(value))) result.status = 'unknown';
      }
      return result;
    }

    function progressDeclaredKey(result) {
      if (!result || !result.stage) return undefined;
      const number = /^\s*([0-6])\b/.exec(result.stage);
      if (number) return STAGE_KEYS[Number(number[1])];
      const aliases = { survey: 'surveyor', specify: 'specifier', spec: 'specifier', code: 'coder', clean: 'cleaner',
        harden: 'hardener', report: 'reporter', ...Object.fromEntries(STAGE_KEYS.map((key) => [key, key])) };
      return aliases[result.stage.trim().toLowerCase()];
    }

    function progressPrompt(argsRaw) {
      let args = argsRaw;
      if (typeof argsRaw === 'string') {
        try { args = JSON.parse(argsRaw); } catch (_) { return argsRaw; }
      }
      if (!args || typeof args !== 'object') return '';
      if (typeof args.prompt === 'string') return args.prompt;
      if (typeof args.task === 'string') return args.task;
      return JSON.stringify(args, null, 2);
    }

    function progressNodes(conversation) {
      if (Array.isArray(conversation)) return conversation;
      if (!conversation || !Array.isArray(conversation.order) || !conversation.nodes) return [];
      const nodes = conversation.nodes;
      return conversation.order.map((key) => typeof nodes.get === 'function' ? nodes.get(key) : nodes[key]).filter(Boolean);
    }

    function progressTodoKey(content) {
      if (typeof content !== 'string') return undefined;
      const aliases = {
        surveyor: /\b(?:gauntlet_)?surveyor\b|摸底/i,
        specifier: /\b(?:gauntlet_)?specifier\b|规格/i,
        coder: /\b(?:gauntlet_)?coder\b|编码/i,
        cleaner: /\b(?:gauntlet_)?cleaner\b|清理/i,
        hardener: /\b(?:gauntlet_)?hardener\b|加固/i,
        qa: /\b(?:gauntlet_)?qa\b/i,
        reporter: /\b(?:gauntlet_)?reporter\b|证据包/i,
      };
      // 规范前缀优先，避免后续返工说明里提到别的阶段时错误归属。
      const prefix = /^\s*(?:\[[^\]]*\]\s*)?(?:[⓪①②③④⑤⑥0-6][.、：:\s-]*)?(surveyor|specifier|coder|cleaner|hardener|qa|reporter)\b/i.exec(content);
      if (prefix) return prefix[1].toLowerCase();
      const keys = STAGE_KEYS.filter((key) => aliases[key].test(content));
      return keys.length === 1 ? keys[0] : undefined;
    }

    function buildProgress(conversation, session, todos) {
      const partial = !!(session && (session.hasMore || session.loadingOlder));
      const stages = STAGE_KEYS.map((key) => ({ key, status: partial ? 'unknown' : 'pending', attempts: [] }));
      const byKey = Object.fromEntries(stages.map((stage) => [stage.key, stage]));
      const seen = new Set();
      let latestKey;
      let sequence = 0;
      function collect(root, node) {
        if (!root) return;
        const settled = root.kind === 'tool-result';
        const call = settled ? root.call : root;
        const name = call && call.name;
        const key = typeof name === 'string' && name.startsWith('gauntlet_') ? name.slice(9) : undefined;
        if (byKey[key]) {
          const id = root.callId || node.key + ':' + sequence;
          if (!seen.has(id)) {
            seen.add(id);
            let output = settled ? progressText(root.content) : '';
            if (!output && settled && root.isError && root.error) output = 'Error: ' + (root.error.message || root.error.name || root.error.code || 'Interrupted');
            const result = parseStageResult(output);
            const declaredKey = progressDeclaredKey(result);
            if (result && declaredKey && declaredKey !== key) result.status = 'unknown';
            const interrupted = /^\s*Error:/i.test(output) || (settled && !!root.isError);
            const status = interrupted ? 'interrupted' : settled ? (result ? result.status : 'unknown')
              : session && session.running === true ? 'running'
              : session && session.running === false ? 'interrupted' : 'unknown';
            const attempt = { id, prompt: progressPrompt(call && call.argsRaw), output, status, result, order: sequence++ };
            let args = call && call.argsRaw;
            if (typeof args === 'string') {
              try { args = JSON.parse(args); } catch (_) { args = undefined; }
            }
            if (args && typeof args.description === 'string') attempt.description = args.description;
            const callTime = settled ? root.callTime : root.time;
            if (typeof callTime === 'number') attempt.callTime = callTime;
            if (settled && typeof root.time === 'number') attempt.finishedTime = root.time;
            if (root.error) attempt.error = root.error;
            const meta = root.meta;
            if (meta && typeof meta === 'object') {
              const address = meta.address || meta.subagentAddress;
              if (address && typeof address === 'object' && typeof address.childSessionId === 'string') {
                attempt.address = address;
                attempt.sessionId = address.childSessionId;
              } else if (typeof meta.sessionId === 'string') attempt.sessionId = meta.sessionId;
            }
            const stage = byKey[key];
            stage.attempts.push(attempt);
            stage.latest = attempt;
            stage.status = status;
            latestKey = key;
            // 回退后所有旧的下游尝试都需重新验证，原始结果保留在详情中。
            for (const later of stages.slice(STAGE_KEYS.indexOf(key) + 1)) {
              if (later.latest) later.status = 'stale';
            }
          }
        }
        for (const subCall of root.subCalls || []) collect(subCall, node);
      }
      for (const node of progressNodes(conversation)) {
        if (node && node.kind === 'tool-call' && node.visibility === 'visible') collect(node.data && node.data.root, node);
      }
      for (const todo of Array.isArray(todos) ? todos : []) {
        const stage = byKey[progressTodoKey(todo && todo.content)];
        if (!stage) continue;
        stage.todo = todo;
        const note = todo.content;
        const noteStatus = /等待确认\s*[:：]|\b(?:awaiting confirmation|needs human|waiting for (?:approval|confirmation))\b/i.test(note) ? 'waiting'
          : /需重跑\s*[:：]|\b(?:rerun needed|needs rerun)\b/i.test(note) ? 'stale'
          : /中断待续\s*[:：]|\b(?:interrupted)\s*:/i.test(note) ? 'interrupted'
          : /返工\s*[:：]|\b(?:rework)\s*:/i.test(note) ? 'failed' : undefined;
        if (!stage.latest) {
          stage.status = noteStatus || (todo.status === 'in_progress' ? (session && session.running ? 'running' : 'interrupted')
            : todo.status === 'completed' ? 'unknown' : 'pending');
        } else if (stage.status === 'passed' && noteStatus && (noteStatus === 'stale' || stage.key === latestKey)) stage.status = noteStatus;
      }
      const hasActivity = stages.some((stage) => stage.attempts.length > 0 || stage.todo);
      const completed = stages.filter((stage) => stage.status === 'passed').length;
      const active = stages.find((stage) => stage.status === 'running');
      const last = byKey[latestKey];
      const next = stages.slice(last ? STAGE_KEYS.indexOf(last.key) + 1 : 0).find((stage) => stage.status !== 'passed');
      const current = active || (last && last.status !== 'passed' ? last : next) || stages.find((stage) => stage.status !== 'passed');
      return { stages, completed, hasActivity, currentKey: hasActivity && completed < STAGE_KEYS.length && current ? current.key : undefined,
        partial };
    }

    // 仅关联调用时间区间内、描述完全相同的唯一子会话；运行中也能查看日志。
    function progressAddress(attempt, catalog, parentSessionId, now = Date.now()) {
      if (!attempt || typeof parentSessionId !== 'string' || !parentSessionId) return undefined;
      const knownMode = (mode) => mode === 'one-shot' || mode === 'continuable';
      const address = attempt.address;
      if (address && address.parentSessionId === parentSessionId && typeof address.childSessionId === 'string'
        && address.childSessionId && knownMode(address.mode)) {
        return { parentSessionId, childSessionId: address.childSessionId, mode: address.mode };
      }
      const end = Number.isFinite(attempt.finishedTime) ? attempt.finishedTime : attempt.status === 'running' ? now : undefined;
      if (typeof attempt.description !== 'string' || !attempt.description || !Number.isFinite(attempt.callTime)
        || !Number.isFinite(end) || end < attempt.callTime || !Array.isArray(catalog)) return undefined;
      const candidates = catalog.filter((child) => child && typeof child.id === 'string' && child.id
        && child.label === attempt.description && knownMode(child.mode) && Number.isFinite(child.createdAt)
        && child.createdAt >= attempt.callTime && child.createdAt <= end);
      if (candidates.length !== 1) return undefined;
      return { parentSessionId, childSessionId: candidates[0].id, mode: candidates[0].mode };
    }

    /** 把 RESULT 的 gates 行拆成逐项结果：`spec ✅ build ✅ tests ❌ (23/25)` → [{ name, pass, note }]。 */
    function parseGates(text) {
      if (typeof text !== 'string' || !text.trim()) return [];
      const pattern = /([^\s,;，；:：()（）✅❌✓✗✔✘]+)\s*[:：]?\s*(✅|❌|✓|✗|✔|✘|\bPASS(?:ED)?\b|\bFAIL(?:ED)?\b|\bERROR\b)?\s*([(（][^)）]*[)）])?/gi;
      const items = [];
      for (const match of text.matchAll(pattern)) {
        const mark = match[2];
        items.push({ name: match[1], pass: mark ? !/❌|✗|✘|FAIL|ERROR/i.test(mark) : null,
          ...(match[3] ? { note: match[3].slice(1, -1).trim() } : {}) });
      }
      return items;
    }

    /** Leader 派活提示里的「返工说明：…」；首次派活（空 / 占位）返回 undefined。 */
    function reworkNote(prompt) {
      if (typeof prompt !== 'string') return undefined;
      const lines = prompt.split(/\r?\n/);
      const start = lines.findIndex((line) => /^\s*(?:返工说明|rework(?:\s+note)?)\s*[:：]/i.test(line));
      if (start < 0) return undefined;
      const body = [lines[start].replace(/^\s*(?:返工说明|rework(?:\s+note)?)\s*[:：]\s*/i, '')];
      for (const line of lines.slice(start + 1)) {
        if (/^\s*[^\s:：]{1,12}[:：]/.test(line) || /^\s*完成后/.test(line)) break;
        body.push(line);
      }
      const text = body.join('\n').trim();
      return !text || /^(?:无|首次.*|none|n\/a|—|-|<[^>]*>)$/i.test(text) ? undefined : text;
    }

    /**
     * 按派活顺序找出返工：同一阶段再次派活是 retry，派回更早的阶段是 rollback。
     * 原因优先取新一轮派活的返工说明，其次是上一轮失败的闸门。
     */
    function buildFlowEvents(progress) {
      const attempts = (progress?.stages || []).flatMap((stage) => stage.attempts.map((attempt) => ({ key: stage.key, index: STAGE_KEYS.indexOf(stage.key), attempt })))
        .sort((a, b) => a.attempt.order - b.attempt.order);
      const events = [];
      for (let i = 1; i < attempts.length; i++) {
        const previous = attempts[i - 1], next = attempts[i];
        if (next.index > previous.index) continue;
        const failed = parseGates(previous.attempt.result?.gates).filter((gate) => gate.pass === false).map((gate) => gate.name);
        events.push({ kind: next.index === previous.index ? 'retry' : 'rollback', from: previous.key, to: next.key,
          fromAttemptId: previous.attempt.id, attemptId: next.attempt.id, cause: previous.attempt.status,
          reason: reworkNote(next.attempt.prompt) || (failed.length ? failed.join(' · ') : undefined) });
      }
      return events;
    }

    // 纯函数同时供无宿主依赖的回归测试使用。
    exports.parseStageResult = parseStageResult;
    exports.buildProgress = buildProgress;
    exports.progressAddress = progressAddress;
    exports.parseGates = parseGates;
    exports.reworkNote = reworkNote;
    exports.buildFlowEvents = buildFlowEvents;

    // ---------------------------------------------------------------- 质量指标
    // Pure report normalization. Values stay tied to their report and measurement
    // method; missing measurements never become zero or a passing verdict.
    const metricObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const metricNumber = (value, max = Infinity) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
    const metricCount = (value) => Number.isInteger(value) && value >= 0 ? value : null;
    const metricLine = (value) => Number.isInteger(value) && value > 0 ? value : null;
    const metricText = (value) => typeof value === 'string' ? value : null;
    const metricBoolean = (value) => typeof value === 'boolean' ? value : null;
    const metricArray = (value) => Array.isArray(value) ? value : [];

    function normalizeMetricFile(value) {
      if (typeof value !== 'string' || !value.trim()) return null;
      let path = value.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
      const segments = [];
      for (const part of path.split('/')) {
        if (part === '.') continue;
        if (part === '..' && segments.length && segments[segments.length - 1] !== '..' && segments[segments.length - 1] !== '' && !/^[a-z]:$/i.test(segments[segments.length - 1])) segments.pop();
        else segments.push(part);
      }
      path = segments.join('/');
      // Windows drive paths are case insensitive; POSIX paths are not.
      return /^[a-z]:\//i.test(path) ? path.toLowerCase() : path;
    }

    function metricSource(source) {
      const data = metricObject(source);
      return { ...data, status: ['ready', 'missing', 'error'].includes(data.status) ? data.status : 'missing', path: metricText(data.path), raw: data.value };
    }

    function mutationCounts(results) {
      const counts = { killed: 0, killedByTests: 0, timedOut: 0, survived: 0, noCoverage: 0, accepted: 0, compileError: 0, unknown: 0 };
      for (const result of results) {
        if (result.status === 'KILLED') { counts.killed++; counts.killedByTests++; }
        else if (result.status === 'TIMEOUT') { counts.killed++; counts.timedOut++; }
        else if (result.status === 'SURVIVED') counts.survived++;
        else if (result.status === 'NO_COVERAGE') counts.noCoverage++;
        else if (result.status === 'ACCEPTED') counts.accepted++;
        else if (result.status === 'COMPILE_ERROR') counts.compileError++;
        else counts.unknown++;
      }
      const tested = counts.killed + counts.survived + counts.noCoverage;
      return { counts, tested, total: results.length, score: tested ? counts.killed / tested : null, complete: counts.unknown === 0 };
    }

    function normalizeWorkflowMetrics(reports = {}) {
      const sources = Object.fromEntries(Object.entries(metricObject(reports)).map(([key, source]) => [key, metricSource(source)]));
      const report = (key) => sources[key]?.status === 'ready' ? metricObject(sources[key].raw) : {};
      const config = report('config');
      const crap = report('crap');
      const statics = report('static');
      const mutantReport = report('mutation');
      const gateReport = report('gate');
      const qaReport = report('qa');
      const loopReport = report('loop');
      const crapRows = metricArray(crap.functions);
      const staticRows = metricArray(statics.functions);
      const functionKey = (row) => {
        const data = metricObject(row);
        const file = normalizeMetricFile(data.file);
        const line = metricLine(data.line);
        return file && line && typeof data.name === 'string' && data.name ? JSON.stringify([file, line, data.name]) : null;
      };
      const keys = (rows) => rows.reduce((all, row) => {
        const key = functionKey(row);
        if (key) all.set(key, (all.get(key) || 0) + 1);
        return all;
      }, new Map());
      const crapKeys = keys(crapRows);
      const staticKeys = keys(staticRows);
      const staticByKey = new Map(staticRows.map((row, index) => [functionKey(row), { row, index }]));
      const usedStatic = new Set();
      const functions = [];
      const addFunction = (crapRow, staticRow, id) => {
        const c = metricObject(crapRow);
        const s = metricObject(staticRow);
        const line = metricLine(c.line) ?? metricLine(s.line);
        const candidateEnd = metricLine(c.endLine) ?? metricLine(s.endLine);
        functions.push({
          id, name: metricText(c.name) ?? metricText(s.name), file: metricText(c.file) ?? metricText(s.file),
          canonicalFile: normalizeMetricFile(c.file) ?? normalizeMetricFile(s.file),
          line, endLine: line !== null && candidateEnd !== null && candidateEnd >= line ? candidateEnd : null,
          calls: metricCount(c.calls), crap: metricNumber(c.crap), coverage: metricNumber(c.coverage, 1),
          crapComplexity: metricNumber(c.complexity), staticComplexity: metricNumber(s.complexity),
          lines: metricCount(s.lines), nesting: metricCount(s.nesting), params: metricCount(s.params),
          accepted: metricBoolean(s.accepted),
          violations: [...metricArray(c.violations), ...metricArray(s.violations)],
          sourceRows: { crap: crapRow, static: staticRow },
        });
      };
      crapRows.forEach((row, index) => {
        const key = functionKey(row);
        const match = key && crapKeys.get(key) === 1 && staticKeys.get(key) === 1 ? staticByKey.get(key) : null;
        if (match) usedStatic.add(match.index);
        addFunction(row, match?.row, 'crap:' + index);
      });
      staticRows.forEach((row, index) => {
        if (!usedStatic.has(index)) addFunction(undefined, row, 'static:' + index);
      });

      const functionsByFile = new Map();
      const mutantsByFunction = new Map();
      for (const fn of functions) {
        if (!functionsByFile.has(fn.canonicalFile)) functionsByFile.set(fn.canonicalFile, []);
        functionsByFile.get(fn.canonicalFile).push(fn);
        mutantsByFunction.set(fn.id, []);
      }
      const hasMutationResults = Array.isArray(mutantReport.results);
      const results = metricArray(mutantReport.results).map((row, index) => {
        const data = metricObject(row);
        const file = normalizeMetricFile(data.file);
        const line = metricLine(data.line);
        const matches = file && line !== null ? (functionsByFile.get(file) || []).filter((fn) => fn.line !== null && fn.endLine !== null && line >= fn.line && line <= fn.endLine) : [];
        const result = {
          id: 'mutant:' + index, file: metricText(data.file), line, col: metricCount(data.col),
          op: metricText(data.op), status: typeof data.status === 'string' ? data.status.trim().toUpperCase() : null,
          original: metricText(data.original), replacement: metricText(data.replacement), reason: metricText(data.reason),
          functionId: matches.length === 1 ? matches[0].id : null,
          association: matches.length === 1 ? 'matched' : matches.length ? 'ambiguous' : 'unmatched', raw: row,
        };
        if (result.functionId) mutantsByFunction.get(result.functionId).push(result);
        return result;
      });
      for (const fn of functions) {
        const mutants = mutantsByFunction.get(fn.id);
        fn.mutation = { derived: true, ...mutationCounts(mutants), mutants, available: hasMutationResults };
      }
      const measuredMutation = hasMutationResults ? mutationCounts(results) : null;
      const mutationSummary = metricObject(mutantReport.summary);
      const reportedScore = metricNumber(mutantReport.score, 1) ?? metricNumber(mutationSummary.score, 1);
      const summaryCounts = {
        killed: metricCount(mutationSummary.killed), killedByTests: null, timedOut: null,
        survived: metricCount(mutationSummary.survived), noCoverage: metricCount(mutationSummary.noCoverage),
        accepted: metricCount(mutationSummary.accepted), compileError: metricCount(mutationSummary.compileErrors), unknown: null,
      };
      const summaryTested = [summaryCounts.killed, summaryCounts.survived, summaryCounts.noCoverage].every((n) => n !== null)
        ? summaryCounts.killed + summaryCounts.survived + summaryCounts.noCoverage : null;
      const tested = measuredMutation ? measuredMutation.tested : summaryTested;
      const derivedScore = measuredMutation?.score ?? null;
      // The kit writes score=0 for an empty denominator. That is unmeasured,
      // rather than a measured 0% kill rate.
      const score = tested === 0 ? null : reportedScore ?? derivedScore;
      const csummary = metricObject(crap.summary);
      const ssummary = metricObject(statics.summary);
      const numberFields = (value, fields, fractionFields = []) => Object.fromEntries(fields.map((key) => [key, metricNumber(value[key], fractionFields.includes(key) ? 1 : Infinity)]));
      const gateItems = Object.entries(metricObject(gateReport.gates)).map(([name, value]) => {
        const data = metricObject(value);
        return { name, pass: metricBoolean(data.pass), ran: metricBoolean(data.ran), skipped: metricBoolean(data.skipped), reason: metricText(data.reason), error: data.error ?? null, raw: value };
      });
      return {
        sources,
        quality: {
          functions, hasFunctions: functions.length > 0, tableAvailable: Array.isArray(crap.functions) || Array.isArray(statics.functions),
          summary: numberFields(csummary, ['functions', 'maxCrap', 'maxComplexity', 'offenders', 'lineCoverage', 'linesTotal', 'linesCovered'], ['lineCoverage']),
          staticSummary: numberFields(ssummary, ['productionFiles', 'functions', 'maxComplexity', 'maxLines', 'maxNesting', 'maxParams', 'offenders', 'warnings', 'codeLines']),
          thresholds: { ...metricObject(config.thresholds), ...metricObject(statics.thresholds), ...metricObject(crap.thresholds) },
          thresholdSources: { config: config.thresholds, static: statics.thresholds, crap: crap.thresholds },
          crapFiles: metricArray(crap.files), staticFiles: metricArray(statics.files), warnings: metricArray(statics.warnings),
          pass: metricBoolean(crap.pass), coverageSource: metricText(crap.coverageSource), engine: metricText(statics.engine),
        },
        mutation: {
          score, reportedScore, derivedScore, scoreSource: score === null ? 'unavailable' : reportedScore !== null ? 'reported' : 'derived',
          counts: measuredMutation?.counts ?? summaryCounts, countSource: hasMutationResults ? 'results' : Object.keys(mutationSummary).length ? 'summary' : 'unavailable',
          total: measuredMutation?.total ?? metricCount(mutationSummary.total), tested, complete: measuredMutation?.complete ?? null,
          candidates: metricCount(mutationSummary.candidates), threshold: metricNumber(mutantReport.threshold, 1), pass: metricBoolean(mutantReport.pass),
          results, unsupported: metricArray(mutantReport.unsupported), scope: mutantReport.scope ?? null, tool: metricText(mutantReport.tool), raw: sources.mutation?.raw,
        },
        gates: {
          pass: metricBoolean(gateReport.pass), profile: metricText(gateReport.profile), title: metricText(gateReport.title),
          startedAt: metricText(gateReport.startedAt), finishedAt: metricText(gateReport.finishedAt), commit: gateReport.commit ?? null,
          ratchet: gateReport.ratchet ?? null, items: gateItems, raw: sources.gate?.raw,
        },
        qa: {
          verdict: metricText(qaReport.verdict), summary: metricText(qaReport.summary), environment: qaReport.environment ?? null,
          checks: metricArray(qaReport.checks).map((row, index) => {
            const data = metricObject(row);
            return { index, id: metricText(data.id), title: metricText(data.title), action: metricText(data.action), expected: metricText(data.expected), actual: metricText(data.actual), status: metricText(data.status), constraint: data.constraint ?? null, raw: row };
          }), raw: sources.qa?.raw,
        },
        loop: {
          rounds: metricArray(loopReport.rounds).map((row, index) => {
            const data = metricObject(row);
            return { index, at: metricText(data.at), commit: data.commit ?? null, remaining: metricCount(data.remaining), distance: metricNumber(data.distance), failing: metricArray(data.failing), improved: metricBoolean(data.improved), verdict: metricText(data.verdict), raw: row };
          }), raw: sources.loop?.raw,
        },
      };
    }

    exports.normalizeMetricFile = normalizeMetricFile;
    exports.normalizeWorkflowMetrics = normalizeWorkflowMetrics;

    // ---------------------------------------------------------------- 工作记录数据
    // Read reports through the host workspace API: paths are relative to this
    // session's worktree, and the host applies the session's filesystem policy.
    function workflowDataError(error) {
      if (typeof error === 'string') return error;
      if (!error) return 'Unknown error';
      return error.message || error.reason || error.code || error.name || JSON.stringify(error);
    }

    function workflowMissing(error) {
      const code = error && (error.code || error.name || error.type);
      return /^(?:ENOENT|NOT_FOUND|FILE_NOT_FOUND|not-found|FileNotFound)$/i.test(String(code || ''))
        || /\bENOENT\b|(?:file|path) (?:does not exist|not found)|不存在|找不到(?:文件|路径)/i.test(workflowDataError(error));
    }

    function workflowObject(value) {
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function mergeWorkflowConfig(base, override) {
      if (!workflowObject(override)) return override;
      const result = workflowObject(base) ? { ...base } : {};
      for (const [key, value] of Object.entries(override)) {
        // JSON configuration is data. Never assign its prototype properties.
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        result[key] = workflowObject(value) ? mergeWorkflowConfig(result[key], value) : value;
      }
      return result;
    }

    function workflowReportPath(directory, name) {
      if (typeof directory !== 'string' || !directory.trim() || /[\u0000-\u001f]/.test(directory)) {
        throw new Error('Report directory must be a non-empty path');
      }
      const normalized = directory.replace(/\\/g, '/').replace(/\/+$/, '');
      return (normalized || '/') + (normalized ? '/' : '') + name;
    }

    async function readWorkflowJson(ctx, sessionId, path, signal) {
      try {
        if (signal && signal.aborted) throw new Error('Report read was cancelled');
        const reply = await ctx.remote.workspaceFiles.readBytes(sessionId, path, {}, signal);
        if (!reply || reply.ok !== true) {
          const error = reply && (reply.error || reply.reason) || 'Workspace file read failed';
          return { path, status: workflowMissing(error) ? 'missing' : 'error', error: workflowDataError(error) };
        }
        const file = reply.value;
        if (!file || !file.data || typeof file.data.byteLength !== 'number') throw new Error('Workspace returned no file bytes');
        if (file.eof === false) throw new Error('Report exceeds the workspace read limit; the complete JSON report could not be read');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(file.data).replace(/^\uFEFF/, '');
        const value = JSON.parse(text);
        const metadata = {};
        for (const [key, entry] of Object.entries(file)) {
          if (key !== 'data') metadata[key] = entry;
        }
        return { path, status: 'ready', value, metadata };
      } catch (error) {
        return { path, status: workflowMissing(error) ? 'missing' : 'error', error: workflowDataError(error) };
      }
    }

    async function loadWorkflowReports(ctx, sessionId, signal) {
      const defaults = { outDir: 'gauntlet-out', paths: { qa: 'qa' } };
      const configPaths = ['gauntlet.config.json', 'gauntlet.local.json'];
      const configReads = await Promise.allSettled(configPaths.map((path) => readWorkflowJson(ctx, sessionId, path, signal)));
      const [config, local] = configReads.map((read, index) => read.status === 'fulfilled' ? read.value
        : { path: configPaths[index], status: 'error', error: workflowDataError(read.reason) });
      const files = {
        crap: 'crap.json', static: 'static.json', mutation: 'mutation.json', gate: 'gate.json',
        tests: 'tests.json', survey: 'survey.json', loopSpecifier: 'loop-specifier.json',
        loopCoder: 'loop-coder.json', loopCleaner: 'loop-cleaner.json', loopHardener: 'loop-hardener.json',
        loopFull: 'loop-full.json', loopQuality: 'loop-quality.json',
      };
      const reports = { config, local };
      let effective = defaults;
      let configError;
      for (const envelope of [config, local]) {
        if (envelope.status === 'error') configError = envelope.path + ': ' + envelope.error;
        if (envelope.status === 'ready') {
          if (!workflowObject(envelope.value)) {
            envelope.status = 'error';
            envelope.error = 'Configuration must be a JSON object';
            configError = envelope.path + ': ' + envelope.error;
          } else effective = mergeWorkflowConfig(effective, envelope.value);
        }
      }
      if (!configError) {
        // Retain the committed configuration for inspection alongside the
        // effective values that actually locate reports and set thresholds.
        config.committed = config.value;
        config.value = effective;
        config.localOverrides = local.status === 'ready';
        if (config.status === 'missing' && local.status === 'ready') config.status = 'ready';
      }
      let paths;
      try {
        if (configError) throw new Error(configError);
        if (!workflowObject(effective.paths)) throw new Error('Configuration paths must be an object');
        paths = Object.fromEntries(Object.entries(files).map(([key, name]) => [key, workflowReportPath(effective.outDir, name)]));
        paths.constraints = workflowReportPath(effective.paths.qa, 'constraints.json');
        paths.qa = workflowReportPath(effective.paths.qa, 'qa-report.json');
        paths.equivalence = workflowReportPath(effective.paths.qa, 'equivalence.json');
      } catch (error) {
        const message = workflowDataError(error);
        for (const key of [...Object.keys(files), 'constraints', 'qa', 'equivalence', 'loop']) reports[key] = { path: null, status: 'error', error: message };
        return reports;
      }
      const entries = Object.entries(paths);
      const reads = await Promise.allSettled(entries.map(([, path]) => readWorkflowJson(ctx, sessionId, path, signal)));
      reads.forEach((read, index) => {
        const [key, path] = entries[index];
        reports[key] = read.status === 'fulfilled' ? read.value : { path, status: 'error', error: workflowDataError(read.reason) };
      });
      const profiles = { specifier: 'loopSpecifier', coder: 'loopCoder', cleaner: 'loopCleaner', hardener: 'loopHardener', full: 'loopFull', quality: 'loopQuality' };
      const profile = reports.gate.status === 'ready' && reports.gate.value && reports.gate.value.profile;
      const selected = profiles[profile];
      reports.loop = selected ? { ...reports[selected], profile }
        : { path: null, status: 'missing', error: 'No gate profile identifies the current convergence report' };
      return reports;
    }

    async function loadStageSnapshot(ctx, sessionId, attemptId, signal) {
      if (typeof attemptId !== 'string' || !attemptId) return { path: null, status: 'error', error: 'Stage call ID is unavailable' };
      const callDirectory = encodeURIComponent(attemptId).replace(/\./g, '%2E');
      const path = 'gauntlet-out/workflow/' + callDirectory + '/reports.json';
      const envelope = await readWorkflowJson(ctx, sessionId, path, signal);
      if (envelope.status !== 'ready') return envelope;
      const snapshot = envelope.value;
      if (!workflowObject(snapshot) || snapshot.version !== 1 || snapshot.callId !== attemptId
        || (snapshot.parentSessionId !== undefined && snapshot.parentSessionId !== sessionId)
        || !workflowObject(snapshot.reports)) {
        return { path, status: 'error', error: 'Stage snapshot does not belong to this session and call' };
      }
      return envelope;
    }

    function buildStageActivity(conversation) {
      const entries = [];
      const tools = new Map();
      const messages = new Set();
      const visited = new Set();
      let sequence = 0;
      const textBlocks = (content) => typeof content === 'string' ? content : Array.isArray(content)
        ? content.filter((block) => block && (block.type === 'text' || block.kind === 'text') && typeof block.text === 'string')
          .map((block) => block.text).join('\n') : '';
      function collectTool(root, node, parentId, depth) {
        if (!root || typeof root !== 'object' || visited.has(root)) return;
        visited.add(root);
        const settled = root.kind === 'tool-result';
        const call = settled ? root.call : root;
        const id = String(root.callId || call && call.callId || node.key + ':tool:' + sequence++);
        let args = call && call.argsRaw;
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch (_) { args = undefined; }
        }
        const parsedArgs = workflowObject(args) ? args : undefined;
        let output = settled ? textBlocks(root.content) : '';
        if (!output && settled && root.isError && root.error) output = 'Error: ' + workflowDataError(root.error);
        const entry = {
          id, kind: 'tool', name: call && call.name || 'tool', argsRaw: call && call.argsRaw, args: parsedArgs,
          command: parsedArgs && (typeof parsedArgs.command === 'string' ? parsedArgs.command : typeof parsedArgs.cmd === 'string' ? parsedArgs.cmd : undefined),
          prompt: parsedArgs && (typeof parsedArgs.prompt === 'string' ? parsedArgs.prompt : typeof parsedArgs.task === 'string' ? parsedArgs.task : undefined),
          output, content: settled ? root.content : undefined, time: root.time ?? (node.data && node.data.time),
          callTime: settled ? root.callTime : root.time,
          status: settled ? root.isError ? 'error' : 'completed' : root.phase === 'preparing' ? 'preparing' : 'running',
          error: root.error, meta: root.meta, parentId, depth, subCalls: [],
        };
        const existing = tools.get(id);
        if (!existing) {
          entries.push(entry);
          tools.set(id, entry);
        } else if (settled || existing.status === 'running' || existing.status === 'preparing') {
          // Render graphs may mention one call both inside a parent and as its
          // own node. Update that record in place, keeping the first position.
          const children = existing.subCalls;
          const priorParent = existing.parentId;
          const priorDepth = existing.depth;
          Object.assign(existing, entry);
          existing.subCalls = children;
          if (entry.parentId === undefined && priorParent !== undefined) {
            existing.parentId = priorParent;
            existing.depth = priorDepth;
          }
        }
        const recorded = tools.get(id);
        for (const subCall of Array.isArray(root.subCalls) ? root.subCalls : []) {
          const child = collectTool(subCall, node, id, depth + 1);
          if (child && !recorded.subCalls.some((item) => item.id === child.id)) recorded.subCalls.push(child);
        }
        return recorded;
      }
      for (const node of progressNodes(conversation)) {
        if (!node || node.visibility !== 'visible') continue;
        const data = node.data || {};
        if (node.kind === 'tool-call') {
          collectTool(data.root, node, undefined, 0);
          continue;
        }
        if (!['assistant-step', 'assistant', 'user', 'steering'].includes(node.kind)) continue;
        const text = node.kind === 'assistant-step' ? textBlocks(data.blocks) : textBlocks(data.content ?? data.blocks);
        // Reasoning blocks and assistant tool placeholders are handled by the
        // host conversation. This activity list contains what was said or done.
        if (!text) continue;
        const id = String(node.key || node.kind + ':' + sequence++);
        if (messages.has(id)) continue;
        messages.add(id);
        entries.push({ id, kind: node.kind === 'assistant-step' ? 'assistant' : node.kind,
          text, time: data.time, status: data.status, turn: data.turn, step: data.step, seq: data.seq, usage: data.usage });
      }
      return { entries, toolCount: tools.size, messageCount: messages.size };
    }

    function observeStageActivity(ctx, address, onState) {
      let disposed = false;
      let binding;
      let chat;
      let unsubscribeChat;
      let unsubscribeSession;
      let historyError;
      const empty = { entries: [], toolCount: 0, messageCount: 0 };
      const send = (state) => { if (!disposed) onState(state); };
      send({ status: 'loading', activity: empty, hasMore: false, loadingOlder: false, running: false });
      let reference;
      try { reference = ctx.sessions.retain(address, { source: 'gauntlet-workflow' }); }
      catch (error) {
        send({ status: 'error', activity: empty, hasMore: false, loadingOlder: false, running: false, error: workflowDataError(error) });
        return { dispose: () => { disposed = true; }, loadOlder: async () => {} };
      }
      const publish = () => {
        if (disposed || !binding || !chat) return;
        const session = binding.session.getSnapshot();
        send({ status: session.openError ? 'error' : 'ready', activity: buildStageActivity(chat.getSnapshot()),
          hasMore: !!session.hasMore, loadingOlder: !!session.loadingOlder, running: !!session.running,
          error: historyError || (session.openError ? workflowDataError(session.openError) : undefined) });
      };
      const ready = Promise.resolve(reference.ready).then((value) => {
        if (disposed) return;
        binding = value;
        chat = ctx.uiConversation.binding(binding).target('chat');
        unsubscribeChat = chat.subscribe(publish);
        if (disposed) { if (typeof unsubscribeChat === 'function') unsubscribeChat(); return; }
        unsubscribeSession = binding.session.subscribe(publish);
        publish();
      }).catch((error) => {
        send({ status: 'error', activity: empty, hasMore: false, loadingOlder: false, running: false, error: workflowDataError(error) });
      });
      return {
        dispose: () => {
          if (disposed) return;
          disposed = true;
          if (typeof unsubscribeChat === 'function') unsubscribeChat();
          if (typeof unsubscribeSession === 'function') unsubscribeSession();
          reference.release();
        },
        loadOlder: async () => {
          await ready;
          if (disposed || !binding || !chat) return;
          const before = binding.session.getSnapshot();
          if (!before.hasMore || before.loadingOlder) return;
          const priorOrder = chat.getSnapshot().order;
          const eventCount = binding.eventSource && binding.eventSource.getSnapshot().entries.length;
          historyError = undefined;
          publish();
          try {
            await binding.session.loadOlder();
            if (disposed) return;
            const after = binding.session.getSnapshot();
            const order = chat.getSnapshot().order;
            if (after.openError) historyError = workflowDataError(after.openError);
            else if (after.hasMore && !after.loadingOlder && Array.isArray(priorOrder) && Array.isArray(order)
              && (eventCount === undefined || binding.eventSource.getSnapshot().entries.length === eventCount)
              && priorOrder.length === order.length && priorOrder.every((id, index) => id === order[index])) {
              historyError = 'Earlier activity did not load. Please retry.';
            }
          } catch (error) { historyError = workflowDataError(error); }
          publish();
        },
      };
    }

    exports.loadWorkflowReports = loadWorkflowReports;
    exports.loadStageSnapshot = loadStageSnapshot;
    exports.buildStageActivity = buildStageActivity;
    exports.observeStageActivity = observeStageActivity;

    // ---------------------------------------------------------------- 项目质量参数
    // Defaults mirror kit/lib/util.mjs; RPC writes only gauntlet.local.json.
    const QUALITY_FIELDS = [
      ['crapMax', 8, false, 'count', 'main'], ['complexityMax', 10, true, 'count', 'main'],
      ['functionLinesMax', 60, true, 'count', 'main'], ['paramsMax', 7, true, 'count', 'main'],
      ['lineCoverageMin', 0.9, false, 'ratio', 'main'], ['mutationScoreMin', 1, false, 'ratio', 'main'],
      ['nestingMax', 4, true, 'count', 'advanced'], ['duplicationMax', 0.03, false, 'ratio', 'advanced'],
      ['warningsMax', 0, true, 'count', 'advanced'], ['tidyMax', 0, true, 'count', 'advanced'],
      ['staticScopeMin', 1, false, 'ratio', 'advanced'], ['cppcheckMax', 0, true, 'count', 'advanced'],
    ].map(([key, defaultValue, integer, unit, group]) => Object.freeze({ key, defaultValue, integer, unit, group, min: 0, max: unit === 'ratio' ? 1 : Number.MAX_SAFE_INTEGER }));
    const qualityFailure = (code, message) => Object.assign(new Error(message), { code });
    function validateQualityChanges(changes) {
      if (!workflowObject(changes)) throw qualityFailure('invalid-threshold', 'Threshold changes must be an object');
      for (const [key, value] of Object.entries(changes)) {
        const field = QUALITY_FIELDS.find((item) => item.key === key);
        if (!field) throw qualityFailure('invalid-threshold', 'Unknown quality threshold: ' + key);
        if (typeof value !== 'number' || !Number.isFinite(value) || value < field.min || value > field.max || (field.integer && !Number.isSafeInteger(value))) {
          throw qualityFailure('invalid-threshold', key + ' must be ' + (field.integer ? 'an integer' : 'a finite number') + ' between ' + field.min + ' and ' + field.max);
        }
      }
      return { ...changes };
    }
    async function qualitySettingsCall(ctx, sessionId, method, input, signal) {
      if (typeof sessionId !== 'string' || !sessionId) throw qualityFailure('unavailable', 'Session identity is unavailable');
      if (!ctx.connection?.rpc?.call) throw qualityFailure('unavailable', 'Quality settings service is unavailable');
      const reply = await ctx.connection.rpc.call('/api', 'gauntletQuality/' + method, { args: { workspaceFileScopeId: sessionId, ...input } }, signal);
      if (!reply || reply.ok !== true) throw qualityFailure(reply?.error?.code || 'unavailable', workflowDataError(reply?.error || 'Quality settings request failed'));
      if (!workflowObject(reply.value)) throw qualityFailure('unavailable', 'Quality settings service returned an invalid result');
      return reply.value;
    }
    async function loadQualitySettings(ctx, sessionId, signal) {
      try {
        const loaded = await qualitySettingsCall(ctx, sessionId, 'load', {}, signal);
        if (loaded.status !== 'error') validateQualityChanges(loaded.values);
        return loaded;
      } catch (error) { return { status: 'error', code: error.code || 'unavailable', error: error.message || String(error) }; }
    }
    async function saveQualitySettings(ctx, sessionId, loaded, changes, signal) {
      const validated = validateQualityChanges(changes);
      if (!loaded || !['ready', 'missing'].includes(loaded.status) || !workflowObject(loaded.revision)) throw qualityFailure('invalid-config', 'Reload a valid project configuration before saving');
      const saved = await qualitySettingsCall(ctx, sessionId, 'save', { revision: loaded.revision, changes: validated }, signal);
      if (saved.status === 'error') throw qualityFailure(saved.code || 'unavailable', saved.error || 'Quality settings could not be saved');
      validateQualityChanges(saved.values);
      return saved;
    }
    exports.QUALITY_FIELDS = QUALITY_FIELDS;
    exports.validateQualityChanges = validateQualityChanges;
    exports.loadQualitySettings = loadQualitySettings;
    exports.saveQualitySettings = saveQualitySettings;

    // ---------------------------------------------------------------- 视图
    function ModelSelect({ t, row, state, disabled, onChange, labelId }) {
      const options = [h('option', { key: '', value: '' }, t('inherit'))];
      for (const group of state.groups) {
        options.push(h('optgroup', { key: 'g:' + group.id, label: group.name || group.id },
          group.models.map((m) => h('option', { key: group.id + '/' + m.id, value: group.id + '\u0000' + m.id }, m.name || m.id))));
      }
      if (state.orphans.length) {
        options.push(h('optgroup', { key: 'orphans', label: t('unavailableGroup') },
          state.orphans.map((o) => h('option', { key: 'o:' + o.key, value: o.key }, o.label))));
      }
      // 目录未就绪时，已保存的路由也要能显示出来
      if (row.key && state.catalogStatus !== 'ready') {
        options.push(h('option', { key: 'cur', value: row.key }, row.route.provider + ' / ' + row.route.model));
      }
      return h('select', {
        className: 'gx-select',
        value: row.key,
        disabled,
        'aria-labelledby': labelId,
        'data-invalid': row.known ? undefined : '',
        onChange: (e) => onChange(row.stage, e.target.value),
      }, options);
    }

    function EffortSelect({ t, row, disabled, onChange, labelId }) {
      if (!row.route || row.efforts.length === 0) {
        return h('select', { className: 'gx-select', disabled: true, value: '', 'aria-labelledby': labelId },
          h('option', { value: '' }, row.route ? t('effortDefault') : t('effortNone')));
      }
      const def = row.efforts.find((e) => e.id === row.defaultEffort);
      return h('select', {
        className: 'gx-select',
        value: row.route.reasoningEffort || '',
        disabled,
        'aria-labelledby': labelId,
        onChange: (e) => onChange(row.stage, e.target.value),
      }, [
        h('option', { key: '', value: '' }, def ? t('effortDefaultNamed').replace('{name}', def.name || def.id) : t('effortDefault')),
        ...row.efforts.map((e) => h('option', { key: e.id, value: e.id, title: e.description }, e.name || e.id)),
      ]);
    }

    function CatalogNotice({ t, state, retry }) {
      if (state.catalogStatus === 'loading') return h('div', { className: 'gx-notice', role: 'status' }, t('catalogLoading'));
      if (state.catalogStatus === 'error') {
        return h('div', { className: 'gx-notice', 'data-tone': 'error', role: 'alert' },
          t('catalogError'), h('button', { type: 'button', className: 'gx-link', onClick: retry }, t('retry')));
      }
      if (state.catalogPartial) {
        return h('div', { className: 'gx-notice' },
          t('catalogPartial'), h('button', { type: 'button', className: 'gx-link', onClick: retry }, t('retry')));
      }
      return null;
    }

    function GauntletCard(props) {
      const { t } = props;
      const state = props.useGauntletCard((s) => s);
      const baseId = React.useId();
      if (props.view === 'summary') return t('description');
      const disabled = !state.available || !state.writable || state.saving;
      const head = (text, col) => h('div', { key: 'h-' + col, className: 'gx-head', id: baseId + '-' + col }, text);
      const cells = [head(t('colStage'), 'stage'), head(t('colModel'), 'model'), head(t('colEffort'), 'effort')];
      for (const row of state.rows) {
        const stageId = baseId + '-' + row.stage;
        cells.push(
          h('div', { key: row.stage + '-s', className: 'gx-cell', 'data-col': 'stage' },
            h('span', { className: 'gx-stage', id: stageId },
              h('span', { className: 'gx-stage-icon' }, h(StageIcon, { stage: { key: row.stage, status: 'pending' }, index: STAGE_KEYS.indexOf(row.stage) })),
              t('stage_' + row.stage)),
            h('span', { className: 'gx-desc' }, t('stage_' + row.stage + '_desc'))),
          h('div', { key: row.stage + '-m', className: 'gx-cell', 'data-col': 'model' },
            h(ModelSelect, { t, row, state, disabled, onChange: props.setModel, labelId: stageId + ' ' + baseId + '-model' }),
            row.known ? null : h('span', { className: 'gx-warn', role: 'alert' }, t('unavailableHint'))),
          h('div', { key: row.stage + '-e', className: 'gx-cell', 'data-col': 'effort' },
            h(EffortSelect, { t, row, disabled, onChange: props.setEffort, labelId: stageId + ' ' + baseId + '-effort' })),
        );
      }
      return h(primitives.SettingsForm, {
        labels: { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') },
        state,
        onSave: props.save,
        onDiscard: props.discard,
        children: [
          h('section', { key: 'body' },
            h('p', { className: 'gx-intro' }, t('intro')),
            h(CatalogNotice, { t, state, retry: props.retryCatalog }),
            state.conflicted ? h('div', { className: 'gx-notice', 'data-tone': 'error', role: 'alert' }, t('conflict')) : null,
            h('div', { className: 'gx-table', role: 'group', 'aria-label': t('title') }, cells),
            h('div', { className: 'gx-foot' },
              h('p', { className: 'gx-footnote' }, t('footnote')),
              h('button', { type: 'button', className: 'gx-link', disabled: disabled || !state.anySet, onClick: props.resetAll }, t('resetAll')))),
        ],
      });
    }

    /**
     * 输入框左侧的「阶段模型」按钮：只在 Gauntlet 小队模式的会话里出现，点开是悬浮窗，
     * 内容与插件页上的设置相同（共用同一个控制器，两边看到的是同一份草稿）。
     */
    function GauntletComposerButton(props) {
      const { t } = props;
      const preset = props.useSessions((s) => {
        const v = props.sessionId === undefined ? undefined : s.byId[props.sessionId]?.projectionValues?.agentPreset;
        return typeof v === 'string' ? v : undefined;
      });
      const custom = props.useGauntletCard((s) => s.rows.filter((r) => r.route).length);
      const [open, setOpen] = React.useState(false);
      if (preset !== PRESET_ID) return null;
      const close = () => {
        props.discard(); // 没保存的改动不留到下次打开
        setOpen(false);
      };
      return h(React.Fragment, null,
        h(primitives.Button, {
          variant: 'ghost',
          size: 'sm',
          className: 'gx-composer-button',
          icon: h(primitives.IconSlidersTwoOutlineRegular, { size: 16 }),
          title: t('composerHint'),
          'aria-haspopup': 'dialog',
          onClick: () => setOpen(true),
        }, custom > 0 ? t('composerButtonCount').replace('{n}', String(custom)) : t('composerButton')),
        h(primitives.Modal, {
          open,
          onClose: close,
          title: t('title'),
          closeLabel: t('close'),
          description: t('composerHint'),
          className: 'gx-modal',
          shortcutModal: 'other',
        }, h(GauntletCard, { ...props, view: 'page' })));
    }

    // ---------------------------------------------------------------- 流程视图
    const PROGRESS_KIND = 'gauntlet-progress';
    const PROGRESS_TAB = '@dsh-crap-agents/gauntlet-progress';
    const stageLabel = (t, key) => t('stage_' + key).replace(/^[⓪①②③④⑤⑥]\s*/, '').replace(/\s+(Surveyor|Specifier|Coder|Cleaner|Hardener|Reporter)$/, '');
    const statusLabel = (t, status) => t('progressStatus_' + status);
    const statusMark = (status, index) => ({ passed: '✓', failed: '!', waiting: '?', interrupted: 'Ⅱ', stale: '↻', unknown: '·' }[status] || String(index));
    function StageIcon({ stage, index }) {
      const names = { surveyor: 'IconSearchOutlineRegular', specifier: 'IconListPenOutlineRegular', coder: 'IconCodeOutlineRegular',
        cleaner: 'IconSlidersTwoOutlineRegular', hardener: 'IconShieldOutlineRegular', qa: 'IconChecklistOutlineRegular', reporter: 'IconArchiveCheckOutlineRegular' };
      const Icon = stage.status === 'passed' ? primitives.IconCheckOutlineRegular : primitives[names[stage.key]];
      return Icon ? h(Icon, { size: 18 }) : statusMark(stage.status, index);
    }
    const STAGE_ROLES = { surveyor: 'Surveyor', specifier: 'Specifier', coder: 'Coder', cleaner: 'Cleaner', hardener: 'Hardener', qa: 'QA', reporter: 'Reporter' };
    const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.split('{' + key + '}').join(value), text);
    const needsAttention = (status) => status === 'failed' || status === 'waiting' || status === 'stale' || status === 'interrupted';
    /** 人类闸门挂在哪个阶段之后：摸底确认、（可选）规格确认、最终审阅。 */
    const HUMAN_GATES = [{ id: 'survey', after: 'surveyor' }, { id: 'spec', after: 'specifier' }, { id: 'final', after: 'reporter' }];
    function humanGateState(gate, byKey) {
      const stage = byKey[gate.after];
      const next = byKey[STAGE_KEYS[STAGE_KEYS.indexOf(gate.after) + 1]];
      if (stage?.status === 'waiting' && stage.latest?.result?.verdict === 'PASS') return 'waiting';
      if (next?.attempts.length) return 'done';
      return 'idle';
    }
    /** 闸门逐项结果：通过 / 未通过 / 未判定，附带括号里的说明（如 23/25）。 */
    function GateChips({ gates, limit }) {
      const shown = limit ? gates.slice(0, limit) : gates;
      return h('span', { className: 'gx-gates' },
        shown.map((gate, index) => h('span', { key: index, className: 'gx-gate', 'data-pass': gate.pass === null ? 'unknown' : String(gate.pass) },
          h('i', { 'aria-hidden': true }, gate.pass === true ? '✓' : gate.pass === false ? '✗' : '·'), gate.name,
          gate.note ? h('small', null, gate.note) : null)),
        limit && gates.length > limit ? h('span', { className: 'gx-gate-more' }, '+' + (gates.length - limit)) : null);
    }
    /** 有阶段在等用户时置顶说明：哪一阶段、等什么、怎么继续。 */
    function AttentionBox({ t, progress, onOpen }) {
      const waiting = progress.stages.filter((stage) => stage.status === 'waiting');
      if (!waiting.length) return null;
      return h('div', { className: 'gx-attention', role: 'status' },
        h('strong', null, t('flowAttention')),
        waiting.map((stage) => {
          const note = typeof stage.todo?.content === 'string' ? (/等待确认\s*[:：]\s*([^\n]*)/.exec(stage.todo.content)?.[1] || '') : '';
          const detail = note || stage.latest?.result?.summary || t('flowWaitingDetail');
          return h('button', { key: stage.key, type: 'button', onClick: () => onOpen(stage.key) },
            h('span', null, stageLabel(t, stage.key)), h('span', null, detail));
        }),
        h('small', null, t('flowAttentionHint')));
    }
    /** 返工记录：谁把活退回给谁、为什么；点一条直接看那次尝试。 */
    function ReworkList({ t, events, onOpen }) {
      if (!events.length) return null;
      return h('section', { className: 'gx-rework', 'aria-label': t('flowRework') },
        h('h3', null, t('flowRework'), h('span', null, events.filter((event) => event.cause !== 'interrupted').length)),
        h('ol', null, events.map((event, index) => {
          const title = event.cause === 'interrupted' ? fill(t('flowResumed'), { stage: stageLabel(t, event.to) })
            : event.kind === 'retry' ? fill(t('flowRetry'), { stage: stageLabel(t, event.to) })
            : fill(t('flowRollback'), { from: stageLabel(t, event.from), to: stageLabel(t, event.to) });
          return h('li', { key: event.attemptId || index, 'data-kind': event.cause === 'interrupted' ? 'resumed' : event.kind },
            h('button', { type: 'button', onClick: () => onOpen(event.to, event.attemptId) },
              h('i', { 'aria-hidden': true }, event.kind === 'rollback' ? '↩' : '↻'),
              h('span', null, h('strong', null, title), h('span', null, event.reason || t('flowNoReason')))));
        })));
    }
    /**
     * 流程总览：竖轴上依次是 Leader、七个阶段和三处人类闸门。
     * 每个阶段写明要过的闸门和最近一次的逐项结果；退回更早阶段的返工画成轨道左侧的回流箭头。
     */
    function WorkflowDiagram({ t, progress, events, onOpen, nextStage, leaderRunning }) {
      const stages = progress.stages || [];
      const byKey = Object.fromEntries(stages.map((stage) => [stage.key, stage]));
      const label = (key, fallback) => { const value = t(key); return !value || value === key ? fallback : value; };
      const RAIL_X = 30, CARD_X = 48, LEADER_H = 40, STAGE_H = 60, HUMAN_H = 34, GAP = 4;
      const rows = [];
      let y = 0;
      const push = (row, height) => { rows.push({ ...row, y, height, center: y + height / 2 }); y += height + GAP; };
      push({ type: 'leader' }, LEADER_H);
      stages.forEach((stage, index) => {
        push({ type: 'stage', stage, index }, STAGE_H);
        const gate = HUMAN_GATES.find((item) => item.after === stage.key);
        if (gate) push({ type: 'human', gate, state: humanGateState(gate, byKey) }, HUMAN_H);
      });
      const height = y - GAP;
      const centerOf = (key) => rows.find((row) => row.type === 'stage' && row.stage.key === key)?.center;
      const first = rows[0].center, last = rows[rows.length - 1].center;
      // 实线进度只覆盖从头连续通过的阶段。
      let passedThrough = -1;
      while (passedThrough + 1 < stages.length && stages[passedThrough + 1].status === 'passed') passedThrough++;
      const progressEnd = passedThrough < 0 ? first : passedThrough === stages.length - 1 ? last : centerOf(stages[passedThrough].key);
      // 回流箭头：每对 (from → to) 画一条，按出现顺序分配到左侧的车道上。
      const lanes = [];
      for (const event of events) {
        if (event.kind !== 'rollback') continue;
        const found = lanes.find((lane) => lane.from === event.from && lane.to === event.to);
        if (found) found.count++;
        else lanes.push({ from: event.from, to: event.to, count: 1 });
      }
      const loops = lanes.map((lane, index) => {
        const x = Math.max(2, 10 - index * 4), y1 = centerOf(lane.from), y2 = centerOf(lane.to), r = 4;
        return { ...lane, d: 'M' + (RAIL_X - 10) + ' ' + y1 + 'H' + (x + r) + 'Q' + x + ' ' + y1 + ' ' + x + ' ' + (y1 - r)
          + 'V' + (y2 + r) + 'Q' + x + ' ' + y2 + ' ' + (x + r) + ' ' + y2 + 'H' + (RAIL_X - 11) };
      });
      const markerId = 'gx-loop-arrow';
      const gateMark = (stage, index) => stage.status === 'passed' ? '✓' : needsAttention(stage.status) ? '!' : String(index);
      return h('div', { className: 'gx-pipeline', 'aria-label': t('workflowOverview') },
        h('div', { className: 'gx-pipe-canvas', style: { height: height + 'px' } },
          h('svg', { className: 'gx-pipe-wires', 'aria-hidden': true, focusable: false },
            h('defs', null, h('marker', { id: markerId, viewBox: '0 0 8 8', refX: 6, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' },
              h('path', { d: 'M1 1L6 4L1 7', className: 'gx-loop-head' }))),
            h('path', { className: 'gx-pipe-rail', d: 'M' + RAIL_X + ' ' + first + 'V' + last }),
            progressEnd > first ? h('path', { className: 'gx-pipe-progress', d: 'M' + RAIL_X + ' ' + first + 'V' + progressEnd }) : null,
            loops.map((loop) => h('path', { key: loop.from + loop.to, className: 'gx-loop', d: loop.d, markerEnd: 'url(#' + markerId + ')' })),
            rows.map((row) => row.type === 'stage'
              ? h('g', { key: row.stage.key, className: 'gx-pipe-gate', 'data-status': row.stage.status,
                'data-next': nextStage?.key === row.stage.key && row.stage.status === 'pending' },
                row.stage.status === 'running' ? h('circle', { className: 'gx-pipe-halo', cx: RAIL_X, cy: row.center, r: 9 }) : null,
                h('circle', { cx: RAIL_X, cy: row.center, r: 9 }),
                h('text', { className: 'gx-pipe-gate-mark', x: RAIL_X, y: row.center, dy: '0.35em', textAnchor: 'middle' }, gateMark(row.stage, row.index)))
              : row.type === 'human'
                ? h('rect', { key: row.gate.id, className: 'gx-human-node', 'data-state': row.state, x: RAIL_X - 5, y: row.center - 5, width: 10, height: 10, rx: 2,
                  transform: 'rotate(45 ' + RAIL_X + ' ' + row.center + ')' })
                : null)),
          rows.map((row) => {
            const style = { top: row.y + 'px', height: row.height + 'px' };
            if (row.type === 'leader') {
              return h('div', { key: 'leader', className: 'gx-pipe-leader', style, title: label('diagramLeader', 'Leader') },
                h('span', { className: 'gx-pipe-leader-badge', 'aria-hidden': true }, 'L'),
                h('strong', null, 'Leader'),
                h('small', { 'data-live': leaderRunning || undefined }, leaderRunning ? statusLabel(t, 'running') : label('diagramSupervisor', 'Agent topology')));
            }
            if (row.type === 'human') {
              return h('div', { key: row.gate.id, className: 'gx-human', 'data-state': row.state, style },
                h('span', null, t('flowHuman_' + row.gate.id)),
                h('small', null, row.state === 'waiting' ? t('flowHumanWaiting') : row.state === 'done' ? t('flowHumanDone') : t('flowHumanNote_' + row.gate.id)));
            }
            const { stage, index } = row;
            const upcoming = nextStage?.key === stage.key && stage.status === 'pending';
            const name = stageLabel(t, stage.key);
            const gates = parseGates(stage.latest?.result?.gates);
            const status = stage.status === 'passed' || (stage.status === 'pending' && !upcoming) ? null
              : upcoming ? t('workflowUpcoming') : statusLabel(t, stage.status);
            const content = [
              h('span', { key: 'top', className: 'gx-pipe-top' },
                h('strong', { className: 'gx-pipe-name' }, name),
                h('span', { className: 'gx-pipe-role' }, STAGE_ROLES[stage.key]),
                status ? h('span', { className: 'gx-pipe-pill', 'data-status': stage.status, 'data-next': upcoming }, status) : null),
              h('span', { key: 'gate', className: 'gx-pipe-gateline' },
                gates.length ? h(GateChips, { gates, limit: 4 })
                  : h('span', { className: 'gx-pipe-require' }, t('flowRequire') + ' ' + t('flowRequire_' + stage.key)),
                stage.attempts.length > 1 ? h('span', { className: 'gx-attempt-dots', title: t('progressAttempts').replace('{n}', String(stage.attempts.length)) },
                  stage.attempts.map((attempt) => h('i', { key: attempt.id, 'data-status': attempt.status })),
                  h('small', null, '×' + stage.attempts.length)) : null),
            ];
            const common = { key: stage.key, className: 'gx-pipe-card', style, 'data-status': stage.status, 'data-next': upcoming,
              'aria-current': stage.status === 'running' ? 'step' : undefined };
            // 还没派过活的阶段没有可看的详情，只展示它要过的闸门。
            return stage.attempts.length || stage.todo
              ? h('button', { ...common, type: 'button', id: 'gx-stage-' + stage.key, onClick: () => onOpen(stage.key),
                'aria-label': index + ' ' + t('stage_' + stage.key) + ' · ' + statusLabel(t, stage.status) }, ...content,
                h('span', { className: 'gx-pipe-chevron', 'aria-hidden': true }))
              : h('div', common, ...content);
          })));
    }
    const rawText = (value) => typeof value === 'string' ? value : JSON.stringify(value, null, 2) || '—';
    const pct = (value, t) => value == null ? t('workflowUnmeasured') : (value * 100).toFixed(1).replace(/\.0$/, '') + '%';
    const num = (value, t) => value == null ? t('workflowUnmeasured') : Number.isInteger(value) ? String(value) : value.toFixed(2);
    const clockText = (value) => value == null ? '—' : new Date(value).toLocaleString();

    function Fold({ title, children, open, className = '' }) {
      const [visible, setVisible] = React.useState(!!open);
      return h('details', { className: 'gx-fold ' + className, open,
        onToggle: (event) => { if (event.target === event.currentTarget) setVisible(event.currentTarget.open); },
      }, h('summary', null, title), visible ? children : null);
    }
    function MetricTile({ title, value, note }) {
      return h('div', { className: 'gx-metric' }, h('span', null, title), h('strong', null, value), note ? h('small', null, note) : null);
    }
    /** 数字从旧值补间到新值，让指标"长"出来而不是跳变；非数字直接显示。 */
    function useTweenNumber(value) {
      const [display, setDisplay] = React.useState(value);
      const previous = React.useRef(value);
      React.useEffect(() => {
        const from = previous.current;
        previous.current = value;
        if (typeof from !== 'number' || typeof value !== 'number' || from === value) { setDisplay(value); return undefined; }
        let frame;
        const started = performance.now();
        const tick = (now) => {
          const progress = Math.min(1, (now - started) / 600);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(from + (value - from) * eased);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      }, [value]);
      return display;
    }
    /** 指标磁贴：数字为主，下方一条带阈值刻度的细条；越过阈值时数字变色。 */
    function GaugeTile({ t, title, value, note, ratio, threshold, format }) {
      const measured = typeof value === 'number' && Number.isFinite(value);
      const shown = useTweenNumber(measured ? value : null);
      const [armed, setArmed] = React.useState(false);
      React.useEffect(() => {
        const frame = requestAnimationFrame(() => setArmed(true));
        return () => cancelAnimationFrame(frame);
      }, []);
      const text = !measured ? t('workflowUnmeasured') : format ? format(shown) : String(shown);
      const hasThreshold = typeof threshold === 'number' && threshold > 0;
      // 比率按 0–100% 画；计数值（越小越好）把阈值放在 80% 处，超出的部分仍看得见。
      const scale = ratio ? 1 : hasThreshold ? threshold / 0.8 : 0;
      const fill = measured && scale ? Math.min(1, Math.max(0, shown / scale)) : 0;
      const tick = hasThreshold && scale ? Math.min(1, threshold / scale) : null;
      const over = measured && hasThreshold && (ratio ? shown < threshold : shown > threshold);
      const tone = !measured || !hasThreshold ? undefined : over ? 'over' : 'pass';
      const limit = hasThreshold ? (ratio ? '≥ ' : '≤ ') + (format ? format(threshold) : String(threshold)) : null;
      return h('div', { className: 'gx-metric', 'data-tone': tone },
        h('span', { className: 'gx-metric-label' }, title),
        h('strong', null, text),
        measured && scale ? h('span', { className: 'gx-meter', 'aria-hidden': true },
          h('i', { style: { width: (armed ? fill * 100 : 0) + '%' } }),
          tick != null ? h('b', { style: { left: tick * 100 + '%' } }) : null) : null,
        note || limit ? h('small', { className: 'gx-metric-note' }, [limit, note].filter(Boolean).join(' · ')) : null);
    }
    /** 变异结果分段条：比例一眼可见，具体数字放在色块图例里。 */
    function MutationBar({ t, mutation }) {
      const counts = mutation.counts || {};
      const segments = [
        { key: 'killed', label: t('workflowKilled'), value: counts.killed || 0, className: 'gx-mut-killed' },
        { key: 'timedOut', label: t('workflowTimeout'), value: counts.timedOut || 0, className: 'gx-mut-timeout' },
        { key: 'survived', label: t('workflowSurvived'), value: counts.survived || 0, className: 'gx-mut-survived' },
        { key: 'noCoverage', label: t('workflowNoCoverage'), value: counts.noCoverage || 0, className: 'gx-mut-nocov' },
        { key: 'excluded', label: t('workflowExcluded'), value: (counts.compileError || 0) + (counts.accepted || 0), className: 'gx-mut-excluded' },
        { key: 'unknown', label: t('progressStatus_unknown'), value: counts.unknown || 0, className: 'gx-mut-unknown' },
      ];
      const total = segments.reduce((sum, segment) => sum + segment.value, 0);
      if (!total) return h('p', { className: 'gx-muted' }, t('workflowUnmeasured'));
      return h('div', { className: 'gx-mutbar-wrap' },
        h('div', { className: 'gx-mutbar', role: 'img' },
          segments.map((segment, index) => segment.value ? h('span', { key: segment.key, className: 'gx-mutseg ' + segment.className,
            style: { width: (segment.value / total * 100).toFixed(2) + '%', '--i': index } }) : null)),
        h('div', { className: 'gx-mutlegend' },
          segments.filter((segment) => segment.value).map((segment) => h('span', { key: segment.key, className: 'gx-mutchip' },
            h('i', { className: segment.className }), segment.label + ' ' + segment.value))));
    }
    function MutantList({ t, results }) {
      return results.length ? h('div', { className: 'gx-records' }, results.map((m, index) =>
        h(Fold, { key: m.id || index, style: { '--i': Math.min(index, 10) }, title: h('span', { className: 'gx-record-title' },
          h('code', null, (m.file || '—') + ':' + (m.line || '—')), h('span', { className: 'gx-tag', 'data-status': m.status }, m.status || '—')) },
        h('pre', null, rawText(m.raw || m))))) : h('p', { className: 'gx-muted' }, t('workflowUnmeasured'));
    }
    function QualityDetails({ t, reports, contextNote }) {
      const [search, setSearch] = React.useState('');
      const metrics = React.useMemo(() => normalizeWorkflowMetrics(reports || {}), [reports]);
      const { quality, mutation, gates, qa, sources } = metrics;
      const tests = sources.tests?.status === 'ready' ? metricObject(sources.tests.raw) : {};
      const hasMeasurements = [quality.summary.maxCrap, quality.summary.lineCoverage, quality.staticSummary.maxComplexity, mutation.score].some((value) => value !== null);
      const reportCommit = typeof gates.commit === 'string' ? gates.commit : gates.commit?.short || gates.commit?.hash || gates.commit?.sha;
      const matches = quality.functions.filter((fn) => ((fn.name || '') + ' ' + (fn.file || '')).toLowerCase().includes(search.toLowerCase()));
      return h('div', { className: 'gx-quality' },
        hasMeasurements ? h('div', { className: 'gx-metrics' },
          h(GaugeTile, { t, title: t('workflowCrap'), value: quality.summary.maxCrap, threshold: metricNumber(quality.thresholds.crapMax), format: (v) => num(v, t), note: 'max' }),
          h(GaugeTile, { t, title: t('workflowCoverage'), value: quality.summary.lineCoverage, ratio: true, threshold: metricNumber(quality.thresholds.lineCoverageMin), format: (v) => pct(v, t) }),
          h(GaugeTile, { t, title: t('workflowComplexity'), value: quality.staticSummary.maxComplexity, threshold: metricNumber(quality.thresholds.complexityMax), format: (v) => num(v, t), note: 'AST · max' }),
          h(GaugeTile, { t, title: t('workflowMutation'), value: mutation.score, ratio: true, threshold: metricNumber(quality.thresholds.mutationScoreMin), format: (v) => pct(v, t), note: mutation.tested == null ? null : mutation.tested + ' mutants' }))
          : h('p', { className: 'gx-muted' }, t('workflowUnmeasured')),
        gates.profile || reportCommit ? h('p', { className: 'gx-metric-context' }, t('workflowReportProfile') + '：' + (gates.profile || '—') + (reportCommit ? ' · ' + reportCommit : '')) : null,
        h(Fold, { title: t('workflowMetricMethod') }, h('p', { className: 'gx-muted' }, t('workflowFormula'))),
        h(Fold, { title: t('workflowFunctions') + ' · ' + quality.functions.length },
          quality.hasFunctions ? h(React.Fragment, null,
            h('input', { className: 'gx-search', type: 'search', value: search, placeholder: t('workflowSearch'), 'aria-label': t('workflowSearch'), onChange: (event) => setSearch(event.target.value) }),
            !matches.length ? h('p', { className: 'gx-muted' }, t('workflowNoMatches')) : null,
            h('div', { className: 'gx-function-list' }, matches.map((fn) => h(Fold, { key: fn.id,
              title: h('span', { className: 'gx-function-title' }, h('strong', null, fn.name || '—'), h('code', null, (fn.file || '—') + ':' + (fn.line || '—'))),
            }, h('div', { className: 'gx-metrics' },
              h(MetricTile, { title: 'CRAP', value: num(fn.crap, t) }),
              h(MetricTile, { title: t('workflowCoverage'), value: pct(fn.coverage, t) }),
              h(MetricTile, { title: 'CC · CRAP', value: num(fn.crapComplexity, t) }),
              h(MetricTile, { title: 'CC · AST', value: num(fn.staticComplexity, t) }),
              h(MetricTile, { title: t('workflowMutation'), value: pct(fn.mutation.score, t) }),
              h(MetricTile, { title: 'Lines / Params', value: (fn.lines ?? '—') + ' / ' + (fn.params ?? '—') }),
              h(MetricTile, { title: 'Nesting', value: num(fn.nesting, t) }),
              h(MetricTile, { title: 'Calls', value: num(fn.calls, t) })),
              h('p', { className: 'gx-muted' }, t('workflowDerived')),
              fn.violations.length ? h('p', { className: 'gx-warn' }, fn.violations.map(rawText).join('\n')) : null,
              h(Fold, { title: t('workflowMutants') + ' · ' + fn.mutation.mutants.length }, h(MutantList, { t, results: fn.mutation.mutants })),
              h(Fold, { title: t('workflowSources') }, h('pre', null, rawText(fn.sourceRows)))))))
            : h('p', { className: 'gx-muted' }, t('workflowNoFunctions'))),
        h(Fold, { title: t('workflowMutants') + ' · ' + mutation.results.length },
          h(MutationBar, { t, mutation }),
          h(MutantList, { t, results: mutation.results })),
        h(Fold, { title: t('progressGates') + (gates.profile ? ' · ' + gates.profile : '') },
          gates.items.length ? gates.items.map((gate) => h(Fold, { key: gate.name,
            title: h('span', { className: 'gx-record-title' }, gate.name, h('span', { className: 'gx-tag' }, gate.skipped ? 'SKIPPED' : gate.ran === false ? 'NOT RUN' : gate.pass === true ? 'PASS' : gate.pass === false ? 'FAIL' : '—')),
          }, h('pre', null, rawText(gate.raw)))) : h('p', { className: 'gx-muted' }, t('workflowNoGates'))),
        h(Fold, { title: t('workflowTests') },
          sources.tests?.status === 'ready' ? h('div', { className: 'gx-metrics' },
            h(MetricTile, { title: t('workflowTestTotal'), value: num(metricNumber(tests.total), t) }),
            h(MetricTile, { title: t('workflowTestFailed'), value: num(metricNumber(tests.failed), t) })) : null,
          qa.summary ? h('p', { className: 'gx-progress-text' }, qa.summary) : null,
          qa.checks.map((check) => h(Fold, { key: check.index, title: h('span', { className: 'gx-record-title' },
            (check.id || '') + ' ' + (check.title || 'QA'), h('span', { className: 'gx-tag' }, check.status || '—')) },
          h('dl', { className: 'gx-facts' },
            h('dt', null, t('workflowCheckAction')), h('dd', null, check.action || '—'),
            h('dt', null, t('workflowExpected')), h('dd', null, check.expected || '—'),
            h('dt', null, t('workflowActual')), h('dd', null, check.actual || '—')),
          h('pre', null, rawText(check.raw)))),
          Object.entries(sources).filter(([key]) => /^(tests|qa|constraints|equivalence|survey|loop)/.test(key)).map(([key, source]) =>
            h(Fold, { key, title: source.path || key }, source.status === 'ready' ? h('pre', null, rawText(source.raw))
              : h('p', { className: 'gx-muted' }, t(source.status === 'error' ? 'workflowError' : 'workflowMissing') + (source.error ? ' · ' + rawText(source.error) : ''))))),
        h(Fold, { title: t('workflowThresholds') }, h('pre', null, rawText(quality.thresholdSources))),
        h(Fold, { title: t('workflowSources') },
          contextNote ? h('p', { className: 'gx-muted' }, contextNote) : null,
          gates.profile || gates.commit || gates.finishedAt ? h('dl', { className: 'gx-facts' },
            h('dt', null, t('workflowReportProfile')), h('dd', null, gates.profile || '—'),
            h('dt', null, t('workflowCommit')), h('dd', null, gates.commit == null ? '—' : rawText(gates.commit)),
            h('dt', null, t('workflowReportedAt')), h('dd', null, gates.finishedAt ? clockText(gates.finishedAt) : '—')) : null,
          Object.entries(sources).map(([key, source]) =>
          h(Fold, { key, title: h('span', { className: 'gx-record-title' }, h('code', null, source.path || key),
            h('span', { className: 'gx-tag' }, source.status === 'ready' ? 'JSON' : t(source.status === 'error' ? 'workflowError' : 'workflowMissing'))) },
          source.modifiedAt ? h('p', { className: 'gx-muted' }, t('workflowChangedAt') + ' · ' + clockText(source.modifiedAt)) : null,
          source.status === 'ready' ? h('pre', null, rawText(source.raw)) : h('p', { className: 'gx-muted' }, source.error ? rawText(source.error) : t('workflowMissing'))))));
    }
    function ActivityRecords({ t, state, loadOlder }) {
      const activity = state.activity || { entries: [], toolCount: 0, messageCount: 0 };
      return h(React.Fragment, null,
        h('p', { className: 'gx-muted' }, activity.toolCount + ' ' + t('workflowTools') + ' · ' + activity.messageCount + ' ' + t('workflowMessages')),
        state.status === 'loading' ? h('p', { className: 'gx-muted', role: 'status' }, t('workflowLoading')) : null,
        state.status === 'error' ? h('p', { className: 'gx-warn' }, rawText(state.error)) : null,
        state.hasMore ? h('button', { type: 'button', className: 'gx-soft-button', disabled: state.loadingOlder, onClick: loadOlder }, t(state.loadingOlder ? 'workflowLoading' : 'workflowOlder')) : null,
        !activity.entries.length && state.status === 'ready' ? h('p', { className: 'gx-muted' }, t('workflowActivityEmpty')) : null,
        h('div', { className: 'gx-records' }, activity.entries.map((entry, index) => h(Fold, {
          key: entry.id || index, style: { '--i': Math.min(index, 12) }, title: h('span', { className: 'gx-record-title' },
            h('span', { className: 'gx-record-label' }, String(index + 1).padStart(2, '0') + ' · ' + (entry.name || entry.kind),
              h('small', { className: 'gx-record-preview' }, (entry.command || entry.prompt || entry.text || '').split('\n')[0])),
            h('time', null, entry.time || entry.callTime ? new Date(entry.time || entry.callTime).toLocaleTimeString() : '')),
        }, entry.kind === 'tool' ? h(React.Fragment, null,
          entry.status ? h('span', { className: 'gx-tag' }, entry.status) : null,
          h('h4', null, t('workflowInput')), h('pre', null, rawText(entry.argsRaw ?? entry.args)),
          h('h4', null, t('workflowToolOutput')), h('pre', null, entry.output || (entry.error ? rawText(entry.error) : t('workflowNoResult'))))
          : h('pre', null, entry.text || '—')))),
        h('p', { className: 'gx-muted' }, t('workflowAllRecords')));
    }
    /** 阶段详情页：闸门结果、结论、全部尝试直接摊开；原始任务、日志和输出放在最后的折叠里。 */
    function StageDetails({ t, stage, events, initialAttemptId, catalog, parentSessionId, openStageSession, loadSnapshot, observeActivity, refresh, onBack }) {
      const [attemptId, setAttemptId] = React.useState(initialAttemptId || null);
      const attempt = stage.attempts.find((a) => a.id === attemptId) || stage.latest;
      const [snapshot, setSnapshot] = React.useState({ status: 'loading' });
      const [activity, setActivity] = React.useState({ status: 'loading' });
      const activityHandle = React.useRef(null);
      React.useEffect(() => {
        const abort = new AbortController();
        setSnapshot({ status: attempt ? 'loading' : 'missing' });
        if (attempt) loadSnapshot(attempt.id, abort.signal).then((value) => { if (!abort.signal.aborted) setSnapshot(value); })
          .catch((error) => { if (!abort.signal.aborted) setSnapshot({ status: 'error', error: String(error) }); });
        return () => abort.abort();
      }, [parentSessionId, attempt?.id, attempt?.status, refresh, loadSnapshot]);
      const saved = snapshot.status === 'ready' ? snapshot.value : null;
      const address = saved?.childSessionId ? { parentSessionId, childSessionId: saved.childSessionId, mode: 'one-shot' }
        : progressAddress(attempt, catalog, parentSessionId);
      React.useEffect(() => {
        setActivity({ status: address ? 'loading' : 'missing' });
        if (!address) return;
        const handle = observeActivity(address, setActivity);
        activityHandle.current = handle;
        return () => { handle.dispose(); if (activityHandle.current === handle) activityHandle.current = null; };
      }, [parentSessionId, address?.childSessionId, address?.mode, observeActivity]);
      const result = attempt?.result;
      const gates = parseGates(result?.gates);
      const facts = result ? ['branch', 'profile', 'loop', 'next'].filter((key) => result[key]) : [];
      const extraResult = result ? Object.fromEntries(Object.entries(result).filter(([key]) => !['summary', 'gates', 'verdict', 'status', ...facts].includes(key))) : {};
      const name = stageLabel(t, stage.key);
      const attemptNumber = (a) => stage.attempts.indexOf(a) + 1;
      const origin = (a) => events.find((event) => event.attemptId === a.id);
      const originText = (event) => !event ? null : event.cause === 'interrupted' ? t('flowResumedShort')
        : event.kind === 'retry' ? t('flowReworkSelf') : fill(t('flowReworkFrom'), { stage: stageLabel(t, event.from) });
      const waitingNote = stage.status === 'waiting' && typeof stage.todo?.content === 'string' ? /等待确认\s*[:：]\s*([^\n]*)/.exec(stage.todo.content)?.[1] : null;
      const measured = STAGE_KEYS.indexOf(stage.key) >= STAGE_KEYS.indexOf('coder');
      return h('div', { className: 'gx-stage-details' },
        h('header', { className: 'gx-detail-head' },
          h('button', { type: 'button', className: 'gx-back', onClick: onBack }, h('span', { 'aria-hidden': true }, '←'), t('flowBack')),
          address ? h('button', { className: 'gx-soft-button', type: 'button', onClick: () => openStageSession(address) }, t('progressOpenSession') + ' ↗') : null),
        h('div', { className: 'gx-detail-title' },
          h('h3', null, name), h('span', { className: 'gx-inspector-role' }, STAGE_ROLES[stage.key]),
          h('span', { className: 'gx-tag', 'data-status': stage.status }, statusLabel(t, stage.status))),
        h('p', { className: 'gx-detail-desc' }, t('stage_' + stage.key + '_desc'), h('span', null, t('flowRequire') + ' ' + t('flowRequire_' + stage.key))),
        stage.status === 'waiting' ? h('div', { className: 'gx-attention', role: 'status' },
          h('strong', null, t('flowHumanWaiting')), h('span', null, waitingNote || result?.summary || t('flowWaitingDetail')),
          h('small', null, t('flowAttentionHint'))) : null,
        stage.status === 'stale' ? h('p', { className: 'gx-warn' }, t('progressStale')) : null,
        attempt ? h(React.Fragment, null,
          h('section', { className: 'gx-block' },
            h('h4', null, t('flowGates'), stage.attempts.length > 1 ? h('span', null, t('progressAttempt').replace('{n}', String(attemptNumber(attempt)))) : null),
            gates.length ? h(GateChips, { gates })
              : h('p', { className: 'gx-muted' }, attempt.status === 'running' ? statusLabel(t, 'running') : attempt.status === 'interrupted' ? statusLabel(t, 'interrupted') : t('flowGatesPending'))),
          result?.summary || facts.length ? h('section', { className: 'gx-block' },
            h('h4', null, t('flowConclusion')),
            result?.summary ? h('p', { className: 'gx-result-summary' }, result.summary) : null,
            facts.length ? h('dl', { className: 'gx-facts' }, facts.flatMap((key) => [
              h('dt', { key: key + '-label' }, t('progress' + key[0].toUpperCase() + key.slice(1))), h('dd', { key }, result[key]),
            ])) : null) : null,
          stage.attempts.length > 1 ? h('section', { className: 'gx-block' },
            h('h4', null, t('flowAttempts'), h('span', null, stage.attempts.length)),
            h('ol', { className: 'gx-attempts' }, [...stage.attempts].reverse().map((a) => {
              const failed = parseGates(a.result?.gates).filter((gate) => gate.pass === false);
              const event = origin(a);
              return h('li', { key: a.id }, h('button', { type: 'button', 'aria-pressed': a === attempt, onClick: () => setAttemptId(a.id) },
                h('span', { className: 'gx-attempt-row' },
                  h('strong', null, '#' + attemptNumber(a)),
                  h('span', { className: 'gx-tag', 'data-status': a.status }, statusLabel(t, a.status)),
                  failed.length ? h('span', { className: 'gx-attempt-failed' }, failed.map((gate) => gate.name + (gate.note ? ' ' + gate.note : '')).join(' · ')) : null,
                  h('time', null, a.callTime ? new Date(a.callTime).toLocaleTimeString() : '')),
                event ? h('span', { className: 'gx-attempt-origin', 'data-kind': event.cause === 'interrupted' ? 'resumed' : event.kind },
                  h('b', null, originText(event)), event.reason ? h('span', null, event.reason) : null) : null));
            }))) : null,
          measured || saved ? h('section', { className: 'gx-block' },
            h('h4', null, t('workflowMetrics')),
            saved ? h(React.Fragment, null, h(QualityDetails, { t, reports: saved.reports, contextNote: t('workflowSnapshotProvenance') }),
              h('p', { className: 'gx-muted' }, t('workflowSnapshot') + ' · ' + clockText(saved.capturedAt)))
              : h(React.Fragment, null, h('p', { className: 'gx-muted' }, t(snapshot.status === 'loading' ? 'workflowReading' : 'workflowNoSnapshot')),
                snapshot.status === 'error' ? h('p', { className: 'gx-warn' }, rawText(snapshot.error)) : null)) : null,
          h('section', { className: 'gx-block gx-section' },
            h('h4', null, t('flowRaw')),
            h(Fold, { title: t('progressTask') },
              attempt.description ? h('p', { className: 'gx-muted' }, attempt.description) : null,
              h('pre', null, attempt.prompt || saved?.prompt || '—'),
              h('dl', { className: 'gx-facts gx-run-meta' }, h('dt', null, t('workflowAttemptId')), h('dd', null, attempt.id),
                h('dt', null, t('workflowStarted')), h('dd', null, clockText(attempt.callTime)),
                h('dt', null, t('workflowFinished')), h('dd', null, clockText(attempt.finishedTime)))),
            h(Fold, { title: t('workflowActivity') + (activity.status === 'ready' && activity.activity ? ' · ' + activity.activity.toolCount : '') },
              address ? h(ActivityRecords, { t, state: activity, loadOlder: () => activityHandle.current?.loadOlder() })
                : h('p', { className: 'gx-muted' }, t('workflowActivityMissing'))),
            h(Fold, { title: t('progressOutput') }, h('pre', null, attempt.output || saved?.output || t('progressNoOutput'))),
            Object.keys(extraResult).length ? h(Fold, { title: t('workflowStageResult') }, h('pre', null, rawText(extraResult))) : null,
            stage.todo ? h(Fold, { title: t('progressTodo') }, h('pre', null, typeof stage.todo === 'string' ? stage.todo : stage.todo.content)) : null))
          : h(React.Fragment, null, h('p', { className: 'gx-muted' }, t('progressNoAttempt')),
            stage.todo ? h(Fold, { title: t('progressTodo') }, h('pre', null, typeof stage.todo === 'string' ? stage.todo : stage.todo.content)) : null));
    }
    function StageModelSettings(props) {
      const { t } = props;
      const state = props.useGauntletCard((value) => value);
      const baseId = React.useId();
      const [saved, setSaved] = React.useState(false);
      const disabled = !state.available || !state.writable || state.saving;
      const changeModel = (...args) => { setSaved(false); props.setModel(...args); };
      const changeEffort = (...args) => { setSaved(false); props.setEffort(...args); };
      const save = async () => { setSaved(false); await props.save(); setSaved(true); };
      return h('section', { className: 'gx-model-settings', 'aria-label': t('settingsModels') },
        h('h3', null, t('settingsModels')),
        h('p', { className: 'gx-settings-intro' }, t('settingsModelsHint')),
        h(CatalogNotice, { t, state, retry: props.retryCatalog }),
        !state.available || !state.writable ? h('p', { className: 'gx-warn', role: 'alert' }, t(state.available ? 'readOnly' : 'unavailable')) : null,
        h('div', { className: 'gx-model-rows' }, state.rows.map((row) => {
          const labelId = baseId + '-' + row.stage;
          const role = { surveyor: 'Surveyor', specifier: 'Specifier', coder: 'Coder', cleaner: 'Cleaner', hardener: 'Hardener', qa: 'QA', reporter: 'Reporter' }[row.stage];
          return h('article', { className: 'gx-model-row', key: row.stage },
            h('header', { id: labelId },
              h('span', { className: 'gx-stage-icon' }, h(StageIcon, { stage: { key: row.stage, status: 'pending' }, index: STAGE_KEYS.indexOf(row.stage) })),
              stageLabel(t, row.stage), role !== stageLabel(t, row.stage) ? h('small', null, role) : null),
            h('div', { className: 'gx-model-inputs' },
              h('label', null, h('span', { id: labelId + '-model' }, t('colModel')),
                h(ModelSelect, { t, row, state, disabled, onChange: changeModel, labelId: labelId + ' ' + labelId + '-model' })),
              h('label', null, h('span', { id: labelId + '-effort' }, t('colEffort')),
                h(EffortSelect, { t, row, disabled, onChange: changeEffort, labelId: labelId + ' ' + labelId + '-effort' }))),
            !row.known ? h('p', { className: 'gx-warn', role: 'alert' }, t('unavailableHint')) : null);
        })),
        h('p', { className: 'gx-settings-note' }, t('settingsModelsSource')),
        h('div', { className: 'gx-settings-actions' },
          h('button', { type: 'button', className: 'gx-primary-button', disabled: disabled || !state.dirty || state.conflicted, onClick: save }, t(state.saving ? 'saving' : 'settingsSaveModels')),
          state.dirty ? h('button', { type: 'button', className: 'gx-link', disabled: state.saving, onClick: () => { setSaved(false); props.discard(); } }, t('settingsDiscard')) : null),
        state.conflicted || state.failed || saved && !state.dirty ? h('p', { className: 'gx-settings-status', role: 'status', 'data-error': state.conflicted || state.failed },
          t(state.conflicted ? 'settingsConflict' : state.failed ? 'saveFailed' : 'settingsSaved')) : null);
    }

    function QualitySettings(props) {
      const { t } = props;
      const [loaded, setLoaded] = React.useState(null);
      const [draft, setDraft] = React.useState({});
      const [error, setError] = React.useState(null);
      const [saving, setSaving] = React.useState(false);
      const [saved, setSaved] = React.useState(false);
      const [refresh, setRefresh] = React.useState(0);
      const generation = React.useRef(0);
      const baseId = React.useId();
      React.useEffect(() => {
        const abort = new AbortController(); const request = ++generation.current;
        setLoaded(null); setDraft({}); setError(null); setSaved(false); setSaving(false);
        props.loadQualitySettings(abort.signal).then((value) => {
          if (!abort.signal.aborted && request === generation.current) setLoaded(value);
        }).catch((failure) => { if (!abort.signal.aborted && request === generation.current) setError(failure); });
        return () => { abort.abort(); generation.current++; };
      }, [props.sessionId, props.loadQualitySettings, refresh]);
      const changes = {};
      const errors = {};
      for (const field of QUALITY_FIELDS) {
        if (!(field.key in draft)) continue;
        const raw = draft[field.key];
        const value = raw.trim() ? Number(raw) / (field.unit === 'ratio' ? 100 : 1) : NaN;
        if (!Number.isFinite(value) || value < field.min || field.max != null && value > field.max || field.integer && !Number.isInteger(value)) errors[field.key] = true;
        else if (value !== loaded?.values?.[field.key]) changes[field.key] = value;
      }
      const dirty = Object.keys(changes).length > 0 || Object.keys(errors).length > 0;
      const ready = loaded?.status === 'ready' || loaded?.status === 'missing';
      const save = async () => {
        if (!ready || saving || !dirty || Object.keys(errors).length) return;
        const request = generation.current;
        setSaving(true); setSaved(false); setError(null);
        try {
          const value = await props.saveQualitySettings(loaded, changes);
          if (request !== generation.current) return;
          setLoaded(value); setDraft({}); setSaved(true); props.onQualitySaved?.();
        } catch (failure) { if (request === generation.current) setError(failure); }
        finally { if (request === generation.current) setSaving(false); }
      };
      const fields = (group) => h('div', { className: 'gx-quality-fields' }, QUALITY_FIELDS.filter((field) => field.group === group).map((field) => {
        const ratio = field.unit === 'ratio';
        const value = draft[field.key] ?? (loaded?.values?.[field.key] == null ? '' : String(Number((loaded.values[field.key] * (ratio ? 100 : 1)).toFixed(8))));
        const id = baseId + '-' + field.key;
        return h('label', { key: field.key, className: 'gx-field', htmlFor: id },
          h('span', { className: 'gx-field-label' }, h('span', null, t('quality_' + field.key)),
            h('small', null, t(field.key.endsWith('Min') ? 'settingsLimitMin' : 'settingsLimitMax'))),
          h('span', { className: 'gx-number-wrap' },
            h('input', { id, type: 'number', inputMode: ratio || !field.integer ? 'decimal' : 'numeric', min: field.min * (ratio ? 100 : 1), max: field.max == null ? undefined : field.max * (ratio ? 100 : 1),
              step: field.integer ? 1 : ratio ? .1 : .01, value, disabled: !ready || saving,
              'aria-invalid': !!errors[field.key], 'aria-describedby': errors[field.key] ? id + '-error' : undefined,
              onChange: (event) => { setDraft((previous) => ({ ...previous, [field.key]: event.target.value })); setSaved(false); setError(null); } }),
            ratio ? h('span', { 'aria-hidden': true }, '%') : null),
          errors[field.key] ? h('span', { id: id + '-error', className: 'gx-field-error' }, t('settingsInvalid')) : null);
      }));
      return h('section', { 'aria-label': t('workflowThresholds') },
        h('h2', null, t('workflowThresholds')),
        h('p', { className: 'gx-settings-intro' }, t('settingsQualityHint')),
        loaded?.status === 'missing' ? h('p', { className: 'gx-settings-note' }, t('settingsDefaults')) : null,
        !loaded && !error ? h('div', { role: 'status' }, h('p', { className: 'gx-settings-note' }, t('settingsLoad')), h('div', { className: 'gx-skeleton' }), h('div', { className: 'gx-skeleton' })) : null,
        loaded && !ready ? h('p', { className: 'gx-warn', role: 'alert' }, loaded.error || t('workflowError')) : null,
        ready ? h(React.Fragment, null, fields('main'), h(Fold, { title: t('settingsAdvanced') }, fields('advanced')),
          h('p', { className: 'gx-settings-note' }, t('settingsQualitySource')),
          h('div', { className: 'gx-settings-actions' },
            h('button', { type: 'button', className: 'gx-primary-button', disabled: saving || !dirty || Object.keys(errors).length > 0 || error?.code === 'conflict', onClick: save }, t(saving ? 'saving' : 'settingsSaveQuality')),
            dirty ? h('button', { type: 'button', className: 'gx-link', disabled: saving, onClick: () => { setDraft({}); setError(null); setSaved(false); } }, t('settingsDiscard')) : null)) : null,
        error ? h('p', { className: 'gx-settings-status', role: 'alert', 'data-error': true }, error.code === 'conflict' ? t('settingsConflict') : error.message || String(error)) : null,
        error || loaded && !ready ? h('button', { type: 'button', className: 'gx-link', disabled: saving, onClick: () => setRefresh((value) => value + 1) }, t('settingsReload')) : null,
        saved ? h('p', { className: 'gx-settings-status', role: 'status' }, t('settingsSaved')) : null);
    }

    function GauntletSettings(props) {
      return h('div', { className: 'gx-settings' },
        h(QualitySettings, props), h(StageModelSettings, props));
    }

    function GauntletProgress(props) {
      const { t } = props;
      const preset = props.useSessions((s) => s.byId[props.sessionId]?.projectionValues?.agentPreset);
      const conversation = props.useChat((s) => s);
      const session = props.useSession((s) => s);
      const todos = props.useProjection('todos');
      const catalog = props.useProjection('subagentCatalog');
      const progress = React.useMemo(() => buildProgress(conversation, session, todos), [conversation, session, todos]);
      const events = React.useMemo(() => buildFlowEvents(progress), [progress]);
      // view 为空时显示流程总览；选中阶段后整页切到该阶段的详情，返回时恢复总览的滚动位置。
      const [view, setView] = React.useState(null);
      const [panel, setPanel] = React.useState('flow');
      const [settingsVisited, setSettingsVisited] = React.useState(false);
      const panelBody = React.useRef(null);
      const overviewScroll = React.useRef(0);
      const returnFocus = React.useRef(null);
      const [refresh, setRefresh] = React.useState(0);
      const [reports, setReports] = React.useState(null);
      const [reportError, setReportError] = React.useState(null);
      const [historyFailed, setHistoryFailed] = React.useState(false);
      const active = progress.stages.find((stage) => stage.status === 'running' && stage.latest?.status === 'running');
      const current = progress.stages.find((stage) => stage.key === progress.currentKey);
      React.useEffect(() => { setView(null); setHistoryFailed(false); setPanel('flow'); setSettingsVisited(false); }, [props.sessionId]);
      React.useLayoutEffect(() => { if (panelBody.current) panelBody.current.scrollTop = 0; }, [panel, props.sessionId]);
      React.useLayoutEffect(() => {
        const element = panelBody.current;
        if (!element || panel !== 'flow') return;
        if (view) { element.scrollTop = 0; element.querySelector('.gx-back')?.focus({ preventScroll: true }); return; }
        element.scrollTop = overviewScroll.current;
        if (returnFocus.current) document.getElementById('gx-stage-' + returnFocus.current)?.focus({ preventScroll: true });
        returnFocus.current = null;
      }, [view?.key, view?.attemptId]);
      const openStage = (key, attemptId) => {
        if (!view && panelBody.current) overviewScroll.current = panelBody.current.scrollTop;
        setView({ key, attemptId });
      };
      const closeStage = () => { returnFocus.current = view?.key; setView(null); };
      const revision = progress.stages.map((stage) => stage.latest?.id + ':' + stage.status).join('|');
      React.useEffect(() => {
        if (preset !== PRESET_ID || session.subagent) return;
        const abort = new AbortController(); let loading = false;
        const read = async () => {
          if (loading) return; loading = true;
          try { const value = await props.loadReports(abort.signal); if (!abort.signal.aborted) { setReports(value); setReportError(null); } }
          catch (error) { if (!abort.signal.aborted) setReportError(String(error)); }
          finally { loading = false; }
        };
        read();
        const timer = session.running ? setInterval(read, 10000) : null;
        return () => { abort.abort(); if (timer) clearInterval(timer); };
      }, [props.sessionId, revision, refresh, preset, session.running, session.subagent, props.loadReports]);
      if (preset !== PRESET_ID || session.subagent) return h('p', { className: 'gx-muted gx-panel-empty' }, t('workflowOtherPreset'));
      const loadHistory = async () => { setHistoryFailed(false); try { await props.loadProgressHistory(); } catch (_) { setHistoryFailed(true); } };
      const viewed = view && progress.stages.find((stage) => stage.key === view.key);
      const position = active || (current?.latest && current.status !== 'passed' ? current : null);
      const nextStage = position ? progress.stages.slice(STAGE_KEYS.indexOf(position.key) + 1).find((stage) => stage.status !== 'passed')
        : current || (!progress.hasActivity ? progress.stages[0] : null);
      const detailId = 'gx-detail-' + props.sessionId;
      return h('section', { className: 'gx-workflow', 'aria-label': t('progressTitle') },
        h('nav', { className: 'gx-panel-nav', 'aria-label': t('panelNavigation') },
          h('button', { type: 'button', 'aria-pressed': panel === 'flow', 'aria-controls': detailId + '-flow', onClick: () => setPanel('flow') }, t('panelFlow')),
          h('button', { type: 'button', 'aria-pressed': panel === 'settings', 'aria-controls': detailId + '-settings', onClick: () => { setPanel('settings'); setSettingsVisited(true); } }, t('panelSettings'))),
        // 一行状态条：现在在哪、下一步去哪、总进度；底边就是进度条，滚动到详情时依然可见。
        h('div', { className: 'gx-panel-context', hidden: panel !== 'flow' },
          h('div', { className: 'gx-context-line', role: 'status' },
            h('span', { className: 'gx-context-now', 'data-status': position?.status || (progress.completed === 7 ? 'passed' : 'pending') },
              h('i', { 'aria-hidden': true }),
              h('strong', null, position ? stageLabel(t, position.key) : progress.completed === 7 ? t('workflowAllPassed') : session.running ? t('workflowLeaderShort') : statusLabel(t, 'pending')),
              position ? h('span', null, statusLabel(t, position.status)) : null),
            nextStage || progress.completed === 7 ? h('span', { className: 'gx-context-next', title: position && nextStage ? t('workflowAfterGate') : undefined },
              h('span', { 'aria-hidden': true }, '→'), t('workflowNextStage') + ' ',
              h('strong', null, nextStage ? stageLabel(t, nextStage.key) : t('workflowAfterComplete'))) : null,
            h('span', { className: 'gx-workflow-count', 'aria-label': t('progressCount').replace('{n}', String(progress.completed)) }, progress.completed + ' / 7')),
          h('div', { className: 'gx-progress-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': STAGE_KEYS.length,
            'aria-valuenow': progress.completed, 'aria-label': t('progressCount').replace('{n}', String(progress.completed)) },
            h('div', { className: 'gx-progress-fill', style: { width: (progress.completed / STAGE_KEYS.length * 100).toFixed(1) + '%' } }))),
        h('div', { className: 'gx-panel-body', ref: panelBody },
        h('div', { id: detailId + '-flow', hidden: panel !== 'flow' },
        viewed ? h(StageDetails, { key: props.sessionId + viewed.key + (view.attemptId || ''), t, stage: viewed, events, initialAttemptId: view.attemptId, catalog,
          parentSessionId: props.sessionId, openStageSession: props.openStageSession, loadSnapshot: props.loadSnapshot, observeActivity: props.observeActivity,
          refresh, onBack: closeStage })
        : h(React.Fragment, null,
          progress.partial ? h('div', { className: 'gx-history' }, h('p', { className: 'gx-muted' }, t('progressPartial')),
            session.hasMore ? h('button', { type: 'button', className: 'gx-soft-button', disabled: session.loadingOlder, onClick: loadHistory }, t(session.loadingOlder ? 'progressLoading' : 'progressLoadHistory')) : null) : null,
          historyFailed ? h('p', { className: 'gx-warn' }, t('progressLoadFailed')) : null,
          h(AttentionBox, { t, progress, onOpen: openStage }),
          h(WorkflowDiagram, { t, progress, events, onOpen: openStage, nextStage, leaderRunning: session.running }),
          h(ReworkList, { t, events, onOpen: openStage }),
          h('footer', { className: 'gx-workflow-footer' },
            h(Fold, { title: t('workflowWorkspace'), className: 'gx-section' }, h('p', { className: 'gx-muted' }, t('workflowWorkspaceHint')),
              h('button', { type: 'button', className: 'gx-soft-button', onClick: () => setRefresh((value) => value + 1) }, '↻ ' + t('workflowRefresh')),
              reportError ? h('p', { className: 'gx-warn' }, reportError) : null,
              reports ? h(QualityDetails, { t, reports }) : h('p', { className: 'gx-muted' }, t('workflowReading')))))),
        settingsVisited ? h('div', { id: detailId + '-settings', hidden: panel !== 'settings' },
          h(GauntletSettings, { ...props, onQualitySaved: () => setRefresh((value) => value + 1) })) : null));
    }
    function GauntletProgressButton(props) {
      const preset = props.useSessions((s) => s.byId[props.sessionId]?.projectionValues?.agentPreset);
      const session = props.useSession((s) => s);
      React.useEffect(() => {
        if (preset !== PRESET_ID || session.subagent) return;
        let timer; let disposed = false; let retry = 0;
        const ensure = () => {
          if (disposed || props.ensureProgress()) return;
          // The native right surface can mount after the session header.
          if (retry < 3) timer = setTimeout(ensure, [100, 300, 1000][retry++]);
        };
        ensure();
        return () => { disposed = true; clearTimeout(timer); };
      }, [props.sessionId, preset, !!session.subagent, props.ensureProgress]);
      if (preset !== PRESET_ID || session.subagent) return null;
      return h('button', { type: 'button', className: 'gx-workflow-button', title: props.t('progressHint'), onClick: props.openProgress },
        h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
          h('path', { d: 'M6 3h7M6 8h7M6 13h7', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
          h('circle', { cx: 2.5, cy: 3, r: 1, fill: 'currentColor' }), h('circle', { cx: 2.5, cy: 8, r: 1, fill: 'currentColor' }), h('circle', { cx: 2.5, cy: 13, r: 1, fill: 'currentColor' })), props.t('workflowButton'));
    }

    // ---------------------------------------------------------------- 挂载
    const inject = ['slots', 'locale', 'connection', 'remote', 'remote.session', 'remote.workspaceFiles', 'configForms', 'uiWorkspace', 'sessions', 'uiConversation', 'sidebarRight', 'sidebarRightTabs'];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'gauntlet-settings: dictionaries');
      const card = new GauntletCardController(ctx.configForms.get(CONFIG_NS), ctx);
      const face = card.inject();
      ctx.effect(() => ctx.remote.$on('llm/adapters-updated', () => card.refreshCatalog()), 'gauntlet-settings: adapter invalidations');
      ctx.effect(() => ctx.remote.$on('settings/document-updated', () => card.refreshCatalog()), 'gauntlet-settings: settings invalidations');
      ctx.effect(() => ctx.on('connection/reset', () => card.resetConnection()), 'gauntlet-settings: connection generation');
      ctx.effect(() => () => card.dispose(), 'gauntlet-settings: form subscription');
      // 第三方 bundle 的配置用 plugins.bundle.config（按包名），显示在「已安装 → dsh-gauntlet」页上；
      // plugins.item 是官方插件专用的（会被列进「官方」分组）。
      ctx.effect(() => ctx.configForms.whileServed([CONFIG_NS], () => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PACKAGE,
        locale: NS,
        inject: () => face,
      }, GauntletCard))), 'gauntlet-settings: page');
      // 输入框按钮（会话作用域的 list slot），组件自己按会话的模式决定是否显示。
      ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left',
        id: 'gauntlet-stage-models',
        order: 50,
        locale: NS,
        inject: (sessionId) => (sessionId === undefined ? face : { ...face, sessionId }),
      }, GauntletComposerButton)), 'gauntlet-settings: composer button');
      const opened = new Set();
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: PROGRESS_TAB, kind: PROGRESS_KIND, title: () => 'Gauntlet',
        guide: [{ id: 'progress', order: 80, title: () => zh.progressTitle, description: () => zh.progressHint }],
      }), 'gauntlet-progress: tab type');
      ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities', id: 'gauntlet-progress-toggle', order: 60, locale: NS,
        inject: (sessionId) => ({
          openProgress: () => ctx.sidebarRight.openTab(PROGRESS_KIND),
          ensureProgress: () => {
            if (opened.has(sessionId)) return true;
            try {
              if (!ctx.sidebarRight.isExpanded()) ctx.sidebarRight.openTab(PROGRESS_KIND);
              opened.add(sessionId);
              return true;
            } catch (_) { return false; }
          },
        }),
      }, GauntletProgressButton)), 'gauntlet-progress: header button');
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab', key: PROGRESS_TAB,
        locale: NS,
        inject: (sessionId) => ({
          ...face,
          openStageSession: (address) => ctx.uiWorkspace.openSession(address),
          loadProgressHistory: () => ctx.sessions.binding(sessionId)?.session.loadOlder(),
          loadReports: (signal) => loadWorkflowReports(ctx, sessionId, signal),
          loadSnapshot: (callId, signal) => loadStageSnapshot(ctx, sessionId, callId, signal),
          observeActivity: (address, onState) => observeStageActivity(ctx, address, onState),
          loadQualitySettings: (signal) => loadQualitySettings(ctx, sessionId, signal),
          saveQualitySettings: (loaded, changes, signal) => saveQualitySettings(ctx, sessionId, loaded, changes, signal),
        }),
      }, GauntletProgress)), 'gauntlet-progress: right panel');
    }

    // 供 scripts/preview-diagram.mjs 用真实组件渲染静态预览。
    exports.views = { WorkflowDiagram, AttentionBox, ReworkList, StageDetails, zh };
    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
