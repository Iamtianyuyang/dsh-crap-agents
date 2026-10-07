// 用 lib/client.js 里的真实组件渲染一页静态预览（.preview/preview.html），不依赖宿主。
// 只做首屏渲染：effect 不执行、按钮不可交互，用来检查布局和明暗配色。
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('lib/client.js', 'utf8');
const css = source.match(/const css = `([\s\S]*?)`;/)[1];

// ---------------------------------------------------------------- 最小 React：createElement + 首屏 hooks + 转 HTML
const Fragment = Symbol('Fragment');
let ids = 0;
const React = {
  Fragment,
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  useRef: (value) => ({ current: value }),
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect: () => {},
  useLayoutEffect: () => {},
  useId: () => 'p' + ids++,
};
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kebab = (name) => name.startsWith('--') ? name : name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const svgAttrs = { textAnchor: 'text-anchor', markerEnd: 'marker-end', strokeDasharray: 'stroke-dasharray' };
function render(node) {
  if (node == null || node === false || node === true) return '';
  if (Array.isArray(node)) return node.map(render).join('');
  if (typeof node !== 'object') return escape(node);
  const { type, props, children } = node;
  if (type === Fragment) return render(children);
  if (typeof type === 'function') return render(type({ ...props, children }));
  let attrs = '';
  for (const [key, value] of Object.entries(props)) {
    if (key === 'key' || key === 'ref' || key.startsWith('on') || value == null || value === false) continue;
    const name = key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : svgAttrs[key] || key;
    if (key === 'style') attrs += ' style="' + escape(Object.entries(value).map(([k, v]) => kebab(k) + ':' + v).join(';')) + '"';
    else attrs += value === true ? ' ' + name : ' ' + name + '="' + escape(value) + '"';
  }
  const inner = render(children);
  return /^(input|br|img)$/.test(type) ? '<' + type + attrs + '>' : '<' + type + attrs + '>' + inner + '</' + type + '>';
}

let client;
vm.runInNewContext(source, { window: { __ModuleLoader__: { load: ({ factory }) => {
  client = factory((name) => name === 'react' ? React : {});
} } } });
const { views } = client;
const t = (key) => views.zh[key] ?? key;

// ---------------------------------------------------------------- 示例会话：编码重做一次，QA 退回编码，摸底等待确认的另一份
const result = (verdict, gates, summary, extra = '') => `GAUNTLET-RESULT: ${verdict}\nstage: x\ngates: ${gates}\n${extra}summary: ${summary}`;
const minute = 60 * 1000, start = Date.UTC(2026, 9, 7, 6, 0);
let order = 0;
function call(key, output, prompt = '需求：导出 CSV\n返工说明：\n完成后返回', running = false) {
  const id = key + order++;
  const time = start + order * 7 * minute;
  if (running) return { key: id, visibility: 'visible', kind: 'tool-call', data: { root: { phase: 'start', callId: id, name: 'gauntlet_' + key, argsRaw: JSON.stringify({ prompt }), time, subCalls: [] } } };
  return { key: id, visibility: 'visible', kind: 'tool-call', data: { root: {
    kind: 'tool-result', callId: id, call: { name: 'gauntlet_' + key, argsRaw: JSON.stringify({ prompt }) }, callTime: time, time: time + 5 * minute,
    content: [{ type: 'text', text: output }], isError: false, subCalls: [] } } };
}
const nodes = [
  call('surveyor', result('PASS', 'doctor ✅ test ✅ profile ✅', '识别为 Node 项目，适配器 commands，开启棘轮（基线 14 项）。')),
  call('specifier', result('PASS', 'spec ✅ constraints ✅', '写了 6 个验收场景、11 条约束。')),
  call('coder', result('FAIL', 'spec ✅ build ✅ tests ❌ (23/25)', '两个边界场景未通过，距离连续 3 轮未缩小。')),
  call('coder', result('PASS', 'spec ✅ build ✅ tests ✅ (25/25)', 'TDD 完成，全部场景通过。'), '需求：导出 CSV\n返工说明：补齐空表和超长字段两个场景\n完成后返回'),
  call('cleaner', result('PASS', 'tests ✅ crap ✅ complexity ✅ dup ✅', 'max CRAP 12.4 → 5.2。')),
  call('hardener', result('PASS', 'tests ✅ mutation ✅ (96.4%) coverage ✅', '补 9 个测试，零存活变异体。')),
  call('qa', result('FAIL', 'qa ❌ (9/11)', '真实产物上导出列顺序与约束 C-4 不符。')),
  call('coder', result('PASS', 'spec ✅ build ✅ tests ✅ (27/27)', '修正列顺序并补了回归测试。'), '需求：导出 CSV\n返工说明：QA 发现导出列顺序与约束 C-4 不符，验收测试却是绿的\n完成后返回'),
  call('cleaner', '', '需求：导出 CSV\n返工说明：编码改动后重新清理\n完成后返回', true),
];
const session = { running: true };
const progress = client.buildProgress(nodes, session, null);
const events = client.buildFlowEvents(progress);
const byKey = Object.fromEntries(progress.stages.map((stage) => [stage.key, stage]));
const nextStage = byKey.hardener;

// 等待确认的场景：摸底 PASS 后停在人类闸门。
const waitingNodes = [call('surveyor', result('PASS', 'doctor ✅ test ✅ profile ✅', '首次接入：新建 gauntlet.config.json 与架构规则。'))];
const waitingProgress = client.buildProgress(waitingNodes, { running: false },
  [{ content: 'surveyor · 摸底 — 等待确认：首次接入，请确认构建命令与测量范围 sources', status: 'in_progress' }]);

const h = React.createElement;
const noop = () => {};
const shell = (context, body) => `
  <section class="gx-workflow frame">
    <nav class="gx-panel-nav"><button type="button" aria-pressed="true">流程</button><button type="button" aria-pressed="false">参数</button></nav>
    <div class="gx-panel-context">${context}</div>
    <div class="gx-panel-body" style="overflow:visible">${body}</div>
  </section>`;
const context = (now, status, next, done) => `
      <div class="gx-context-line" role="status">
        <span class="gx-context-now" data-status="${status}"><i></i><strong>${now}</strong><span>${t('progressStatus_' + status)}</span></span>
        <span class="gx-context-next"><span>→</span>下一阶段 <strong>${next}</strong></span>
        <span class="gx-workflow-count">${done} / 7</span>
      </div>
      <div class="gx-progress-track"><div class="gx-progress-fill" style="width:${(done / 7 * 100).toFixed(1)}%"></div></div>`;

const overview = shell(context('清理', 'running', '加固', progress.completed), render([
  h(views.AttentionBox, { t, progress, onOpen: noop }),
  h(views.WorkflowDiagram, { t, progress, events, onOpen: noop, nextStage, leaderRunning: true }),
  h(views.ReworkList, { t, events, onOpen: noop }),
]));
const waiting = shell(context('摸底', 'waiting', '规格', 0), render([
  h(views.AttentionBox, { t, progress: waitingProgress, onOpen: noop }),
  h(views.WorkflowDiagram, { t, progress: waitingProgress, events: [], onOpen: noop, nextStage: null, leaderRunning: false }),
]));
const detail = shell(context('清理', 'running', '加固', progress.completed), render(
  h(views.StageDetails, { t, stage: byKey.coder, events, catalog: [], parentSessionId: 'p', openStageSession: noop,
    loadSnapshot: () => new Promise(() => {}), observeActivity: () => ({ dispose: noop }), refresh: 0, onBack: noop })));

const lightTokens = `
  --dsw-alias-label-primary:#20242d; --dsw-alias-label-secondary:#5f6876; --dsw-alias-label-tertiary:#8a93a1;
  --dsw-alias-bg-layer-1:#ffffff; --dsw-alias-bg-layer-2:#f4f5f7; --dsw-alias-border-l2:#e3e6eb; --dsw-alias-border-l3:#d3d8df;
  --dsw-alias-brand-primary:#4263eb; --dsw-alias-interactive-bg-hover:#f2f4f7; --dsw-alias-state-error-primary:#c54c44;`;
const darkTokens = `
  --dsw-alias-label-primary:#e8eaf0; --dsw-alias-label-secondary:#a1a9b6; --dsw-alias-label-tertiary:#737c8a;
  --dsw-alias-bg-layer-1:#1a1d22; --dsw-alias-bg-layer-2:#23272e; --dsw-alias-border-l2:#30353e; --dsw-alias-border-l3:#3a404b;
  --dsw-alias-brand-primary:#6b8afd; --dsw-alias-interactive-bg-hover:#262b33; --dsw-alias-state-error-primary:#e2756b;`;

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gauntlet preview</title>
<style>
:root{${lightTokens} --dsw-radius-md:8px}
@media (prefers-color-scheme: dark){:root:not([data-theme=light]){${darkTokens}}}
:root[data-theme=dark]{${darkTokens}}
body{margin:0;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;padding:24px 16px}
.wrap{display:flex;flex-wrap:wrap;gap:24px;justify-content:center;align-items:flex-start}
.col{width:420px;max-width:100%;display:flex;flex-direction:column;gap:8px}
.col>h1{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);margin:0}
.frame{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.gx-workflow.frame{height:auto}
${css}
</style></head><body>
<div class="wrap">
  <div class="col"><h1>总览 · 有返工</h1>${overview}</div>
  <div class="col"><h1>阶段详情 · 编码</h1>${detail}</div>
  <div class="col"><h1>总览 · 等待你确认</h1>${waiting}</div>
</div>
</body></html>`;

fs.mkdirSync('.preview', { recursive: true });
fs.writeFileSync('.preview/preview.html', html);
console.log('written', html.length);
