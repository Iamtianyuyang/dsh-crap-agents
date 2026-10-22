import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the shipped browser module directly, without installing host packages.
let client;
vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load: ({ factory }) => {
    client = factory((name) => name === 'react' ? { createElement: () => null } : {});
  } } },
});
const plain = (value) => value === undefined ? value : JSON.parse(JSON.stringify(value));
const parse = (value) => plain(client.parseStageResult(value));
const progress = (nodes = [], session = { running: false }, todos = null) => plain(client.buildProgress(nodes, session, todos));
const address = (attempt, catalog, parent = 'parent') => plain(client.progressAddress(attempt, catalog, parent));
const keys = ['surveyor', 'specifier', 'coder', 'cleaner', 'hardener', 'qa', 'reporter'];
const stage = (state, key) => state.stages.find((item) => item.key === key);
const pass = 'GAUNTLET-RESULT: PASS\ngates: tests ✅ build ✅\nsummary: done';
function call(key, id, output = pass, extra = {}) {
  return { key: 'node-' + id, visibility: 'visible', kind: 'tool-call', data: { root: {
    kind: 'tool-result', callId: id, call: { name: 'gauntlet_' + key, argsRaw: JSON.stringify({ prompt: 'Do ' + key }) },
    content: [{ type: 'text', text: output }], isError: false, subCalls: [], ...extra,
  } } };
}
function running(key, id, phase = 'start') {
  return { key: 'node-' + id, visibility: 'visible', kind: 'tool-call', data: { root: {
    phase, callId: id, name: 'gauntlet_' + key, argsRaw: JSON.stringify({ prompt: 'Do ' + key }), subCalls: [],
  } } };
}

test('parses final stage result fields and multiline summary without Markdown fence', () => {
  const result = parse('intro\n```text\nGAUNTLET-RESULT: PASS # completed\nstage: 2-code\nprofile: coder\nbranch: gauntlet/demo @ abc123\ngates: tests ✅ (25/25)\nloop: rounds=3 distance=4 -> 0\nsummary: Implemented the feature.\n  Kept the existing API.\nnext: Verify the build.\nrules: unchanged\n```\nextra');
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.status, 'passed');
  assert.equal(result.stage, '2-code');
  assert.equal(result.profile, 'coder');
  assert.equal(result.branch, 'gauntlet/demo @ abc123');
  assert.equal(result.loop, 'rounds=3 distance=4 -> 0');
  assert.equal(result.summary, 'Implemented the feature.\n  Kept the existing API.');
  assert.equal(result.next, 'Verify the build.');
  assert.equal(result.rules, 'unchanged');
});

test('uses the last explicit result and rejects incomplete or merely mentioned verdicts', () => {
  assert.equal(parse(pass + '\nGAUNTLET-RESULT: FAIL\ngates: tests ❌\nsummary: regression').status, 'failed');
  assert.equal(parse('GAUNTLET-RESULT: NEED-HUMAN\nsummary: Need a decision.').status, 'waiting');
  assert.equal(parse('The agent says GAUNTLET-RESULT: PASS in this explanation.'), undefined);
  assert.equal(parse('GAUNTLET-RESULT: PASSING\ngates: tests ✅'), undefined);
  assert.equal(parse('GAUNTLET-RESULT: PASS\nsummary: no gate evidence').status, 'unknown');
  assert.equal(parse('GAUNTLET-RESULT: PASS\ngates: tests ❌').status, 'failed');
  assert.equal(parse('GAUNTLET-RESULT: PASS\ngates: build FAILED').status, 'failed');
  assert.equal(parse('> GAUNTLET-RESULT: PASS\n> gates: tests ✅'), undefined);
  assert.equal(parse('GAUNTLET-RESULT: PASS # 或 FAIL / NEED-HUMAN\ngates: tests ✅').status, 'unknown');
  assert.equal(parse('GAUNTLET-RESULT: PASS\nbranch: gauntlet/<短名> @ <commit 短哈希>\ngates: tests ✅').status, 'unknown');
});

test('PASS needs positive evidence for every delimited gate and rejects pending or skipped checks', () => {
  for (const gates of ['tests pending', 'build skipped', 'tests unverified', 'tests not-run', 'tests ✅, build pending', 'tests PASS; build skipped', 'tests ✅; build', 'tests all green']) {
    assert.equal(parse('GAUNTLET-RESULT: PASS\ngates: ' + gates).status, 'unknown', gates);
  }
  for (const gates of ['tests ✓ build ✅', 'tests PASS; build passed', 'tests ✔, build PASS']) {
    assert.equal(parse('GAUNTLET-RESULT: PASS\ngates: ' + gates).status, 'passed', gates);
  }
});

test('reads current render order only and excludes hidden branch and unrelated tools', () => {
  const visible = call('coder', 'visible');
  const hidden = { ...call('reporter', 'hidden'), visibility: 'hidden' };
  const otherBranch = call('surveyor', 'not-in-order');
  const unrelated = call('qa', 'unrelated');
  unrelated.data.root.call.name = 'subagent';
  const nodes = new Map([visible, hidden, otherBranch, unrelated].map((node) => [node.key, node]));
  const state = plain(client.buildProgress({ order: [visible.key, hidden.key, unrelated.key], nodes }, { running: false }, null));
  assert.equal(stage(state, 'coder').status, 'passed');
  assert.equal(stage(state, 'coder').latest.prompt, 'Do coder');
  assert.equal(stage(state, 'reporter').attempts.length, 0);
  assert.equal(stage(state, 'surveyor').attempts.length, 0);
  assert.equal(stage(state, 'qa').attempts.length, 0);
  assert.equal(state.completed, 1);
});

test('seven evidence-backed stages complete the workflow; finished tools alone do not', () => {
  const complete = progress(keys.map((key, index) => call(key, String(index))));
  assert.equal(complete.completed, 7);
  assert.equal(complete.currentKey, undefined);
  assert.equal(complete.hasActivity, true);
  const unverified = progress([call('coder', 'done', 'Everything is complete.')]);
  assert.equal(stage(unverified, 'coder').status, 'unknown');
  assert.equal(unverified.completed, 0);
  assert.equal(unverified.currentKey, 'coder');
});

test('a declared result for a different stage cannot verify the invoked stage', () => {
  const mismatched = progress([call('coder', 'wrong-stage', pass + '\nstage: 5-qa')]);
  assert.equal(stage(mismatched, 'coder').status, 'unknown');
  assert.equal(stage(mismatched, 'coder').latest.result.verdict, 'PASS');
  assert.equal(mismatched.completed, 0);
  const namedMismatch = progress([call('coder', 'wrong-name', pass + '\nstage: reporter')]);
  assert.equal(stage(namedMismatch, 'coder').status, 'unknown');
  const matching = progress([call('coder', 'right-stage', pass + '\nstage: 2-code')]);
  assert.equal(stage(matching, 'coder').status, 'passed');
});

test('preparing and dispatched tools run only while the parent runs; stopping interrupts them', () => {
  for (const phase of ['preparing', 'start']) {
    const active = progress([running('qa', phase, phase)], { running: true });
    assert.equal(stage(active, 'qa').status, 'running');
    assert.equal(active.currentKey, 'qa');
    const stopped = progress([running('qa', phase, phase)], { running: false });
    assert.equal(stage(stopped, 'qa').status, 'interrupted');
  }
});

test('Error output and synthesized interruption take precedence over an apparent PASS', () => {
  const textError = progress([call('coder', 'error-text', 'Error: token limit reached\n' + pass)]);
  assert.equal(stage(textError, 'coder').status, 'interrupted');
  const eventError = progress([call('coder', 'event-error', '', {
    isError: true, error: { name: 'Interrupted', code: 'interrupted' },
  })]);
  assert.equal(stage(eventError, 'coder').status, 'interrupted');
  assert.equal(stage(eventError, 'coder').latest.output, 'Error: Interrupted');
  assert.equal(eventError.completed, 0);
});

test('retry preserves all attempts and invalidates downstream PASS until rerun', () => {
  const nodes = keys.map((key, index) => call(key, String(index)));
  nodes.push(running('coder', 'retry'));
  const state = progress(nodes, { running: true });
  assert.equal(state.completed, 2);
  assert.equal(stage(state, 'coder').attempts.length, 2);
  assert.equal(stage(state, 'coder').attempts[0].result.verdict, 'PASS');
  assert.equal(stage(state, 'coder').latest.status, 'running');
  assert.equal(stage(state, 'cleaner').status, 'stale');
  assert.equal(stage(state, 'reporter').status, 'stale');
  assert.equal(stage(state, 'reporter').latest.status, 'passed');
  nodes[nodes.length - 1] = call('coder', 'retry');
  nodes.push(call('cleaner', 'fresh-cleaner'));
  const rerun = progress(nodes);
  assert.equal(stage(rerun, 'cleaner').status, 'passed');
  assert.equal(stage(rerun, 'hardener').status, 'stale');
  assert.equal(rerun.currentKey, 'hardener');
});

test('earlier rollback invalidates every old downstream attempt and fresh reruns restore their own result', () => {
  for (const [output, oldStatus] of [
    ['GAUNTLET-RESULT: FAIL\ngates: real build ❌\nsummary: Broken behavior', 'failed'],
    ['GAUNTLET-RESULT: NEED-HUMAN\nsummary: Need a device', 'waiting'],
    ['Error: token limit reached', 'interrupted'],
    ['Finished without gate evidence', 'unknown'],
  ]) {
    const nodes = [call('coder', 'initial-code'), call('qa', 'old-qa', output), running('coder', 'rollback')];
    const rollback = progress(nodes, { running: true });
    assert.equal(stage(rollback, 'qa').status, 'stale');
    assert.equal(stage(rollback, 'qa').latest.status, oldStatus);
    assert.equal(stage(rollback, 'qa').latest.output, output);
    assert.equal(stage(rollback, 'reporter').status, 'pending');
    nodes[2] = call('coder', 'rollback');
    nodes.push(call('qa', 'fresh-qa'));
    const rerun = progress(nodes);
    assert.equal(stage(rerun, 'qa').status, 'passed');
    assert.equal(stage(rerun, 'qa').attempts.length, 2);
    assert.equal(stage(rerun, 'qa').latest.result.verdict, 'PASS');
  }
});

test('nested actual stage calls are collected once and keep explicit subagent metadata', () => {
  const nested = call('qa', 'nested').data.root;
  nested.meta = { address: { parentSessionId: 'parent', childSessionId: 'child', mode: 'one-shot' } };
  const outer = call('coder', 'outer');
  outer.data.root.call.name = 'parallel';
  outer.data.root.subCalls = [nested, nested];
  const state = progress([outer]);
  assert.equal(stage(state, 'qa').attempts.length, 1);
  assert.equal(stage(state, 'qa').latest.sessionId, 'child');
  assert.equal(stage(state, 'qa').latest.address.parentSessionId, 'parent');
  assert.equal(stage(state, 'coder').attempts.length, 0);
});

test('native call description and callTime survive for strict child-session correlation', () => {
  const node = call('coder', 'native', pass, { callTime: 1700000000123, time: 1700000000321 });
  node.data.root.call.argsRaw = JSON.stringify({ description: 'Implement search filters', prompt: 'Complete the acceptance scenarios.' });
  const attempt = stage(progress([node]), 'coder').latest;
  assert.equal(attempt.description, 'Implement search filters');
  assert.equal(attempt.callTime, 1700000000123);
  assert.equal(attempt.finishedTime, 1700000000321);
  assert.equal(attempt.prompt, 'Complete the acceptance scenarios.');
});

test('child-session links use a unique exact label created within the finished call interval', () => {
  const attempt = { description: 'Implement filters', callTime: 100, finishedTime: 200 };
  const child = { id: 'child', label: 'Implement filters', mode: 'one-shot', createdAt: 150 };
  assert.deepEqual(address(attempt, [child]), { parentSessionId: 'parent', childSessionId: 'child', mode: 'one-shot' });
  assert.equal(address(attempt, [child, { ...child, id: 'ambiguous', createdAt: 175 }]), undefined);
  assert.equal(address(attempt, [{ ...child, createdAt: 99 }]), undefined);
  assert.equal(address(attempt, [{ ...child, createdAt: 201 }]), undefined);
  assert.equal(address(attempt, [{ ...child, label: 'Implement filters again' }]), undefined);
  assert.equal(address(attempt, [{ ...child, mode: 'unknown' }]), undefined);
  assert.equal(address(attempt, [{ ...child, createdAt: '150' }]), undefined);
  assert.equal(address({ ...attempt, callTime: undefined }, [child]), undefined);
  assert.equal(address({ ...attempt, finishedTime: undefined }, [child]), undefined);
  assert.equal(address({ ...attempt, finishedTime: 50 }, [child]), undefined);
  assert.equal(address(attempt, [child], ''), undefined);
});

test('explicit native addresses permit a live session link and require the current parent and known mode', () => {
  const explicit = { address: { parentSessionId: 'parent', childSessionId: 'live-child', mode: 'continuable' } };
  assert.deepEqual(address(explicit, null), explicit.address);
  assert.equal(address({ address: { ...explicit.address, mode: 'unknown' } }, null), undefined);
  assert.equal(address({ address: { ...explicit.address, parentSessionId: 'other-parent' } }, null), undefined);
  assert.equal(address({ address: { ...explicit.address, childSessionId: '' } }, null), undefined);
});

test('running calls can link only a unique child created after their start and before now', () => {
  const attempt = { description: 'Live work', callTime: Date.now() - 1000, status: 'running' };
  const child = { id: 'live', label: 'Live work', mode: 'one-shot', createdAt: attempt.callTime + 1 };
  assert.equal(address(attempt, [child]).childSessionId, 'live');
  assert.equal(address(attempt, [child, { ...child, id: 'duplicate' }]), undefined);
  assert.equal(address(attempt, [{ ...child, createdAt: Date.now() + 60000 }]), undefined);
  assert.equal(address({ ...attempt, status: 'interrupted' }, [child]), undefined);
});

test('todo completion is unverified and ambiguous task text creates no stage activity', () => {
  const state = progress([], { running: true }, [
    { content: '0 Surveyor 摸底', status: 'completed' },
    { content: '1 Specifier 规格', status: 'in_progress' },
    { content: 'Review coder and qa coordination', status: 'completed' },
    { content: 'Update documentation', status: 'in_progress' },
  ]);
  assert.equal(stage(state, 'surveyor').status, 'unknown');
  assert.equal(stage(state, 'specifier').status, 'running');
  assert.equal(stage(state, 'coder').status, 'pending');
  assert.equal(stage(state, 'qa').status, 'pending');
  assert.equal(state.currentKey, 'specifier');
  assert.equal(state.completed, 0);
  assert.equal(progress().hasActivity, false);
});

test('todo waiting applies to latest PASS only and never conceals a running attempt', () => {
  const todo = { content: '0 Surveyor 摸底 — 等待确认：请确认配置', status: 'in_progress' };
  const waiting = progress([call('surveyor', 'survey')], { running: false }, [todo]);
  assert.equal(stage(waiting, 'surveyor').status, 'waiting');
  assert.equal(stage(waiting, 'surveyor').latest.status, 'passed');
  const advanced = progress([call('surveyor', 'survey'), running('specifier', 'spec')], { running: true }, [todo]);
  assert.equal(stage(advanced, 'surveyor').status, 'passed');
  assert.equal(stage(advanced, 'specifier').status, 'running');
  const active = progress([running('surveyor', 'survey')], { running: true }, [todo]);
  assert.equal(stage(active, 'surveyor').status, 'running');
});

test('canonical todo retry notes can show fallback state and loaded history is qualified', () => {
  const state = progress([], { running: false, hasMore: true }, [
    { content: '2 Coder 编码 — 返工：修复测试', status: 'pending' },
    { content: '3 Cleaner 清理 — 需重跑：编码已变更', status: 'pending' },
    { content: '5 QA — 等待确认：缺少设备', status: 'in_progress' },
    { content: '4 Hardener 加固 — 中断待续：token 已耗尽', status: 'in_progress' },
  ]);
  assert.equal(stage(state, 'coder').status, 'failed');
  assert.equal(stage(state, 'cleaner').status, 'stale');
  assert.equal(stage(state, 'qa').status, 'waiting');
  assert.equal(stage(state, 'hardener').status, 'interrupted');
  assert.equal(state.partial, true);
  assert.equal(progress([], { running: false, loadingOlder: true }).partial, true);
  assert.equal(progress().partial, false);
});

test('explicit downstream rerun notes override old loaded passes after compacted history', () => {
  const state = progress([call('cleaner', 'old-cleaner'), call('qa', 'old-qa')], { running: false, hasMore: true }, [
    { content: 'cleaner · 清理 — 需重跑：coder 已重新派发', status: 'pending' },
    { content: 'qa · QA — 需重跑：coder 已重新派发', status: 'pending' },
  ]);
  assert.equal(stage(state, 'cleaner').status, 'stale');
  assert.equal(stage(state, 'qa').status, 'stale');
  assert.equal(state.completed, 0);
});

test('missing stage calls in partial history stay unknown without inventing a current stage', () => {
  const partial = progress([], { running: false, hasMore: true });
  assert.equal(partial.stages.every((item) => item.status === 'unknown'), true);
  assert.equal(partial.currentKey, undefined);
  assert.equal(partial.hasActivity, false);
  const loaded = progress([call('qa', 'known-qa')], { running: false, loadingOlder: true }, [
    { content: 'reporter · 证据包', status: 'pending' },
  ]);
  assert.equal(stage(loaded, 'surveyor').status, 'unknown');
  assert.equal(stage(loaded, 'qa').status, 'passed');
  assert.equal(stage(loaded, 'reporter').status, 'pending');
});
