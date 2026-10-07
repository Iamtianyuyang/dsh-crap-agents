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
  assert.equal(event.reason, 'tests');
});
