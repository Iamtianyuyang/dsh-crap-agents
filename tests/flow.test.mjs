import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

let client;
vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load: ({ factory }) => {
    client = factory((name) => name === 'react' ? { createElement: () => null } : {});
  } } },
});
const plain = (value) => value === undefined ? value : JSON.parse(JSON.stringify(value));
function call(key, id, output, prompt = 'Do ' + key) {
  return { key: 'node-' + id, visibility: 'visible', kind: 'tool-call', data: { root: {
    kind: 'tool-result', callId: id, call: { name: 'gauntlet_' + key, argsRaw: JSON.stringify({ prompt }) },
    content: [{ type: 'text', text: output }], isError: false, subCalls: [],
  } } };
}
const pass = 'GAUNTLET-RESULT: PASS\ngates: tests ✅ build ✅\nsummary: done';
const fail = 'GAUNTLET-RESULT: FAIL\ngates: spec ✅ build ✅ tests ❌ (23/25)\nsummary: stalled';

test('parseGates splits each gate with its verdict and note', () => {
  assert.deepEqual(plain(client.parseGates('spec ✅ build ✅ tests ❌ (23/25)')), [
    { name: 'spec', pass: true }, { name: 'build', pass: true }, { name: 'tests', pass: false, note: '23/25' },
  ]);
  assert.deepEqual(plain(client.parseGates('doctor: PASS, test FAIL；mutation')), [
    { name: 'doctor', pass: true }, { name: 'test', pass: false }, { name: 'mutation', pass: null },
  ]);
  assert.deepEqual(plain(client.parseGates(undefined)), []);
});

test('parseGates handles · separators, trailing words and multi-word names', () => {
  assert.deepEqual(plain(client.parseGates('doctor ✅ 全绿 · build ✅ · test ✅ 25/25')), [
    { name: 'doctor', pass: true, note: '全绿' }, { name: 'build', pass: true }, { name: 'test', pass: true, note: '25/25' },
  ]);
  assert.deepEqual(plain(client.parseGates('spec ✅ (79 scenarios, undefinedSteps=0) · mutation score ❌ (91%)')), [
    { name: 'spec', pass: true, note: '79 scenarios, undefinedSteps=0' }, { name: 'mutation score', pass: false, note: '91%' },
  ]);
});

test('a PASS whose gate note contains commas is not downgraded to unverified', () => {
  const result = client.parseStageResult('GAUNTLET-RESULT: PASS\ngates: spec ✅ (79 scenarios, undefinedSteps=0, ambiguous=0)\nsummary: ok');
  assert.equal(result.status, 'passed');
  assert.equal(client.parseStageResult('GAUNTLET-RESULT: PASS\ngates: spec ✅ · qa pending\nsummary: ok').status, 'unknown');
});

test('reworkNote tolerates Markdown bold and list markers', () => {
  assert.equal(client.reworkNote('需求：x\n- **返工说明**：QA 报告第 4 条失败\n\n完成后返回'), 'QA 报告第 4 条失败');
  assert.equal(client.reworkNote('**返工原因:** 变异测试存活 3 个'), '变异测试存活 3 个');
});

test('buildFlowEvents falls back to the previous summary, then the task description', () => {
  const unknown = 'GAUNTLET-RESULT: PASS\ngates: qa pending\nsummary: QA 发现导出为空\n更多细节';
  const described = (key, id, description) => ({ key: 'node-' + id, visibility: 'visible', kind: 'tool-call', data: { root: {
    kind: 'tool-result', callId: id, call: { name: 'gauntlet_' + key, argsRaw: JSON.stringify({ prompt: 'Do', description }) },
    content: [{ type: 'text', text: pass }], isError: false, subCalls: [] } } });
  const nodes = [call('qa', 'a', unknown), call('qa', 'b', pass), described('coder', 'c', '修复 QA 发现的空导出')];
  const events = plain(client.buildFlowEvents(client.buildProgress(nodes, { running: false })));
  assert.deepEqual(events.map((event) => event.reason), ['QA 发现导出为空', '修复 QA 发现的空导出']);
});

test('buildRounds starts a new round at every rollback and keeps retries in the same cell', () => {
  const nodes = [
    call('surveyor', 'a', pass), call('coder', 'b', fail), call('coder', 'c', pass), call('qa', 'd', fail),
    call('coder', 'e', pass, '需求：x\n返工说明：QA 发现列顺序错误'), call('cleaner', 'f', pass),
  ];
  const rounds = plain(client.buildRounds(client.buildProgress(nodes, { running: false })));
  assert.equal(rounds.length, 2);
  assert.equal(rounds[0].cause, null);
  assert.deepEqual(Object.fromEntries(Object.entries(rounds[0].cells).map(([key, list]) => [key, list.map((a) => a.id)])),
    { surveyor: ['a'], coder: ['b', 'c'], qa: ['d'] });
  assert.deepEqual({ from: rounds[1].cause.from, to: rounds[1].cause.to, reason: rounds[1].cause.reason },
    { from: 'qa', to: 'coder', reason: 'QA 发现列顺序错误' });
  assert.deepEqual(Object.keys(rounds[1].cells), ['coder', 'cleaner']);
});

test('groupFlowEvents merges consecutive repeats, newest first', () => {
  const events = [
    { kind: 'retry', from: 'qa', to: 'qa', cause: 'failed', reason: 'a', attemptId: '1' },
    { kind: 'retry', from: 'qa', to: 'qa', cause: 'failed', reason: 'b', attemptId: '2' },
    { kind: 'rollback', from: 'qa', to: 'coder', cause: 'failed', reason: 'c', attemptId: '3' },
  ];
  assert.deepEqual(plain(client.groupFlowEvents(events)).map(({ kind, count, reason, attemptId }) => ({ kind, count, reason, attemptId })), [
    { kind: 'rollback', count: 1, reason: 'c', attemptId: '3' },
    { kind: 'retry', count: 2, reason: 'b', attemptId: '2' },
  ]);
});

test('reworkNote reads the rework line and ignores first dispatches', () => {
  const prompt = '需求：导出 CSV\n分支：gauntlet/csv\n返工说明：QA 发现列顺序错误，\n回到编码修复\n完成后按 gauntlet-core 第 6 节返回';
  assert.equal(client.reworkNote(prompt), 'QA 发现列顺序错误，\n回到编码修复');
  assert.equal(client.reworkNote('需求：x\n返工说明：\n完成后返回'), undefined);
  assert.equal(client.reworkNote('需求：x\n返工说明：<首次为空>'), undefined);
  assert.equal(client.reworkNote('no rework here'), undefined);
});

test('buildFlowEvents finds retries and rollbacks with their reasons', () => {
  const nodes = [
    call('surveyor', 'a', pass), call('specifier', 'b', pass), call('coder', 'c', fail),
    call('coder', 'd', pass, '需求：x\n返工说明：补齐两个失败场景'), call('cleaner', 'e', pass), call('hardener', 'f', pass),
    call('qa', 'g', 'GAUNTLET-RESULT: FAIL\ngates: qa ❌\nsummary: wrong order'),
    call('coder', 'h', pass, '需求：x\n返工说明：QA 发现列顺序错误'),
  ];
  const events = plain(client.buildFlowEvents(client.buildProgress(nodes, { running: false })));
  assert.deepEqual(events.map(({ kind, from, to, reason, cause }) => ({ kind, from, to, reason, cause })), [
    { kind: 'retry', from: 'coder', to: 'coder', reason: '补齐两个失败场景', cause: 'failed' },
    { kind: 'rollback', from: 'qa', to: 'coder', reason: 'QA 发现列顺序错误', cause: 'failed' },
  ]);
});

test('buildFlowEvents falls back to the failed gates when no rework note was given', () => {
  const nodes = [call('coder', 'c', fail), call('coder', 'd', pass)];
  const [event] = plain(client.buildFlowEvents(client.buildProgress(nodes, { running: false })));
  assert.equal(event.reason, 'tests 23/25 — stalled');
});
