import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

let client;
vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
  TextDecoder,
  window: { __ModuleLoader__: { load: ({ factory }) => {
    client = factory((name) => name === 'react' ? { createElement: () => null } : {});
  } } },
});
const plain = (value) => JSON.parse(JSON.stringify(value));

function workspace(files = {}, failures = {}) {
  const calls = [];
  const ctx = { remote: { workspaceFiles: { readBytes: async (sessionId, path, options, signal) => {
    calls.push({ sessionId, path, options, signal });
    if (failures[path]) return failures[path];
    if (!(path in files)) return { ok: false, error: { code: 'ENOENT', message: 'File not found' } };
    const source = typeof files[path] === 'string' ? files[path] : JSON.stringify(files[path]);
    return { ok: true, value: { data: new TextEncoder().encode(source), eof: true, modifiedAt: 123 } };
  } } } };
  return { ctx, calls };
}

test('reports honor local custom paths and retain every missing report envelope', async () => {
  const { ctx, calls } = workspace({
    'gauntlet.config.json': { outDir: 'build/reports', paths: { qa: 'docs/qa' }, thresholds: { crapMax: 8, nestingMax: 4 }, sources: ['one', 'two'] },
    'gauntlet.local.json': { outDir: '../local-reports', thresholds: { crapMax: 6 }, sources: ['override'] },
    '../local-reports/crap.json': { functions: [{ name: 'f', crap: 9 }] },
    '../local-reports/gate.json': { profile: 'cleaner', pass: false },
    '../local-reports/loop-cleaner.json': { rounds: [{ remaining: 1 }] },
    'docs/qa/constraints.json': [{ id: 'C1' }],
    'docs/qa/equivalence.json': { checks: ['output-preserved'] },
  });
  const controller = new AbortController();
  const reports = plain(await client.loadWorkflowReports(ctx, 'session', controller.signal));
  assert.equal(reports.crap.path, '../local-reports/crap.json');
  assert.equal(reports.crap.status, 'ready');
  assert.deepEqual(reports.config.value.thresholds, { crapMax: 6, nestingMax: 4 });
  assert.deepEqual(reports.config.value.sources, ['override']);
  assert.deepEqual(reports.config.committed.sources, ['one', 'two']);
  assert.equal(reports.qa.path, 'docs/qa/qa-report.json');
  assert.equal(reports.constraints.status, 'ready');
  assert.deepEqual(reports.equivalence.value.checks, ['output-preserved']);
  assert.equal(reports.loop.path, '../local-reports/loop-cleaner.json');
  for (const key of ['static', 'mutation', 'tests', 'survey', 'qa', 'loopSpecifier', 'loopCoder', 'loopHardener', 'loopFull', 'loopQuality']) {
    assert.equal(reports[key].status, 'missing', key);
  }
  assert.equal(reports.crap.metadata.modifiedAt, 123);
  assert.equal(calls.every((call) => call.sessionId === 'session' && call.signal === controller.signal), true);
});

test('missing configuration uses kit report locations while invalid configuration never guesses locations', async () => {
  const missing = workspace({ 'gauntlet-out/tests.json': { total: 1 } });
  const reports = plain(await client.loadWorkflowReports(missing.ctx, 'session'));
  assert.equal(reports.config.status, 'missing');
  assert.equal(reports.tests.status, 'ready');
  assert.equal(reports.qa.path, 'qa/qa-report.json');
  assert.equal(reports.loop.status, 'missing');
  for (const config of ['{ invalid json', 'null', '[]', '{"outDir":null}', '{"paths":null}', '{"paths":{"qa":""}}']) {
    const invalid = workspace({ 'gauntlet.config.json': config, 'gauntlet-out/tests.json': { total: 999 } });
    const result = plain(await client.loadWorkflowReports(invalid.ctx, 'session'));
    assert.equal(result.tests.status, 'error', config);
    assert.equal(result.tests.path, null);
    assert.equal(invalid.calls.some((call) => call.path === 'gauntlet-out/tests.json'), false);
  }
});

test('read errors and incomplete bytes remain distinct from missing reports', async () => {
  const { ctx } = workspace({}, {
    'gauntlet-out/static.json': { ok: false, error: { code: 'EACCES', message: 'Permission denied' } },
    'gauntlet-out/crap.json': { ok: true, value: { data: new TextEncoder().encode('{"summary":{}}'), eof: false } },
    'gauntlet-out/tests.json': { ok: true, value: { data: new TextEncoder().encode('invalid json'), eof: true } },
  });
  const reports = plain(await client.loadWorkflowReports(ctx, 'session'));
  assert.equal(reports.static.status, 'error');
  assert.match(reports.static.error, /Permission denied/);
  assert.equal(reports.crap.status, 'error');
  assert.match(reports.crap.error, /complete JSON/);
  assert.equal(reports.tests.status, 'error');
  assert.equal(reports.mutation.status, 'missing');
});

test('malformed machine configuration and cancelled requests remain explicit errors', async () => {
  const bad = workspace({ 'gauntlet.config.json': { outDir: 'custom' }, 'gauntlet.local.json': 'bad JSON' });
  const badResult = plain(await client.loadWorkflowReports(bad.ctx, 'session'));
  assert.equal(badResult.local.status, 'error');
  assert.equal(badResult.gate.status, 'error');
  assert.equal(bad.calls.length, 2);
  const cancelled = workspace();
  const controller = new AbortController();
  controller.abort();
  const cancelledResult = plain(await client.loadWorkflowReports(cancelled.ctx, 'session', controller.signal));
  assert.equal(cancelledResult.config.status, 'error');
  assert.match(cancelledResult.config.error, /cancelled/);
  assert.equal(cancelled.calls.length, 0);
});

test('completion snapshots require the exact call and parent identity', async () => {
  const callId = '..';
  const path = 'gauntlet-out/workflow/%2E%2E/reports.json';
  const snapshot = { version: 1, callId, parentSessionId: 'parent', childSessionId: 'child', reports: { tests: { status: 'ready', value: {} } } };
  const source = workspace({ [path]: snapshot });
  const value = plain(await client.loadStageSnapshot(source.ctx, 'parent', callId));
  assert.equal(value.status, 'ready');
  assert.equal(value.path, path);
  assert.equal(source.calls[0].path, path);
  const wrongParent = plain(await client.loadStageSnapshot(source.ctx, 'other-parent', callId));
  assert.equal(wrongParent.status, 'error');
  const wrongCall = workspace({ 'gauntlet-out/workflow/wanted/reports.json': snapshot });
  assert.equal((await client.loadStageSnapshot(wrongCall.ctx, 'parent', 'wanted')).status, 'error');
  assert.equal((await client.loadStageSnapshot(source.ctx, 'parent', '')).status, 'error');
});

function toolNode(id, root, visibility = 'visible') {
  return { key: id, kind: 'tool-call', visibility, data: { root } };
}

test('activity keeps complete assistant messages and nested tool actions in visible render order', () => {
  const output = 'Complete output '.repeat(2000);
  const shell = { kind: 'tool-result', callId: 'shell', call: { name: 'shell', argsRaw: JSON.stringify({ command: 'npm test' }) },
    content: [{ type: 'text', text: output }], time: 4, callTime: 3, subCalls: [] };
  const outer = { kind: 'tool-result', callId: 'parallel', call: { name: 'parallel', argsRaw: '{}' },
    content: [{ type: 'text', text: 'Both checks finished' }], time: 5, callTime: 2, subCalls: [shell, shell] };
  const nodes = [
    { key: 'request', kind: 'user', visibility: 'visible', data: { content: [{ type: 'text', text: 'Implement filters' }], time: 1 } },
    { key: 'assistant', kind: 'assistant-step', visibility: 'visible', data: { blocks: [
      { kind: 'reasoning', text: 'Hidden reasoning' }, { kind: 'text', text: 'I changed the search component.' },
      { kind: 'tool-call', callId: 'parallel', name: 'parallel', argsRaw: '{}' }, { kind: 'text', text: 'Now verifying.' },
    ], turn: 1, step: 1, time: 2 } },
    toolNode('parallel-node', outer),
    toolNode('duplicate-shell', { ...shell }),
    { key: 'steering', kind: 'steering', visibility: 'visible', data: { content: 'Keep backward compatibility', seq: 9, time: 6 } },
    toolNode('hidden', { ...shell, callId: 'hidden' }, 'hidden'),
  ];
  const chat = { order: nodes.map((node) => node.key), nodes: new Map(nodes.map((node) => [node.key, node])) };
  const activity = plain(client.buildStageActivity(chat));
  assert.equal(activity.toolCount, 2);
  assert.equal(activity.messageCount, 3);
  assert.deepEqual(activity.entries.map((entry) => entry.id), ['request', 'assistant', 'parallel', 'shell', 'steering']);
  assert.equal(activity.entries[1].text, 'I changed the search component.\nNow verifying.');
  assert.equal(JSON.stringify(activity).includes('Hidden reasoning'), false);
  assert.equal(activity.entries[2].subCalls.length, 1);
  assert.equal(activity.entries[3].output, output);
  assert.equal(activity.entries[3].command, 'npm test');
  assert.equal(activity.entries[3].callTime, 3);
  assert.equal(activity.entries[3].parentId, 'parallel');
  assert.equal(activity.entries[3].depth, 1);
});

test('an eventual tool result replaces its dispatch record without duplicate actions or lost error details', () => {
  const dispatch = { phase: 'start', callId: 'call', name: 'shell', argsRaw: '{ bad json', time: 2, subCalls: [] };
  const result = { kind: 'tool-result', callId: 'call', call: dispatch, time: 3, callTime: 2, isError: true,
    error: { code: 'interrupted', message: 'Task interrupted' }, content: [], subCalls: [] };
  const activity = plain(client.buildStageActivity([toolNode('dispatch', dispatch), toolNode('result', result)]));
  assert.equal(activity.toolCount, 1);
  assert.equal(activity.entries.length, 1);
  assert.equal(activity.entries[0].status, 'error');
  assert.equal(activity.entries[0].output, 'Error: Task interrupted');
  assert.equal(activity.entries[0].argsRaw, '{ bad json');
  assert.equal(activity.entries[0].error.code, 'interrupted');
});

function observable(initial) {
  let value = initial;
  const callbacks = new Set();
  return {
    getSnapshot: () => value,
    subscribe: (callback) => { callbacks.add(callback); return () => callbacks.delete(callback); },
    emit: (next) => { value = next; for (const callback of callbacks) callback(); },
    subscribers: () => callbacks.size,
  };
}

function childSession({ deferReady = false, loadOlder } = {}) {
  const chat = observable({ order: [], nodes: new Map() });
  const session = observable({ running: true, hasMore: true, loadingOlder: false });
  session.loadOlder = loadOlder || (async () => session.emit({ running: false, hasMore: false, loadingOlder: false }));
  const eventSource = observable({ entries: [], revision: 0 });
  const binding = { sessionId: 'child', session, eventSource };
  let resolveReady;
  const ready = deferReady ? new Promise((resolve) => { resolveReady = resolve; }) : Promise.resolve(binding);
  const lifecycle = { retained: [], released: 0, binds: 0 };
  const ctx = {
    sessions: { retain: (address, options) => {
      lifecycle.retained.push({ address, options });
      return { ready, release: () => { lifecycle.released++; } };
    } },
    uiConversation: { binding: (value) => {
      assert.equal(value, binding);
      lifecycle.binds++;
      return { target: (name) => { assert.equal(name, 'chat'); return chat; } };
    } },
  };
  return { ctx, chat, session, eventSource, lifecycle, resolveReady: () => resolveReady(binding) };
}

test('live observation retains the child, updates activity and releases all subscriptions exactly once', async () => {
  const child = childSession();
  const states = [];
  const address = { parentSessionId: 'parent', childSessionId: 'child', mode: 'one-shot' };
  const observer = client.observeStageActivity(child.ctx, address, (state) => states.push(plain(state)));
  assert.equal(states[0].status, 'loading');
  await new Promise(setImmediate);
  assert.equal(states.at(-1).status, 'ready');
  assert.equal(states.at(-1).running, true);
  assert.equal(child.chat.subscribers(), 1);
  assert.equal(child.session.subscribers(), 1);
  assert.deepEqual(plain(child.lifecycle.retained), [{ address, options: { source: 'gauntlet-workflow' } }]);
  const assistant = { key: 'message', kind: 'assistant-step', visibility: 'visible', data: { blocks: [{ kind: 'text', text: 'Build completed' }] } };
  child.chat.emit({ order: ['message'], nodes: new Map([['message', assistant]]) });
  assert.equal(states.at(-1).activity.messageCount, 1);
  await observer.loadOlder();
  assert.equal(states.at(-1).hasMore, false);
  observer.dispose();
  observer.dispose();
  const count = states.length;
  child.chat.emit({ order: [], nodes: new Map() });
  child.session.emit({ running: false });
  await observer.loadOlder();
  assert.equal(states.length, count);
  assert.equal(child.chat.subscribers(), 0);
  assert.equal(child.session.subscribers(), 0);
  assert.equal(child.lifecycle.released, 1);
});

test('closing before the child is ready prevents binding and late callbacks', async () => {
  const child = childSession({ deferReady: true });
  const states = [];
  const observer = client.observeStageActivity(child.ctx, {}, (state) => states.push(state));
  observer.dispose();
  child.resolveReady();
  await observer.loadOlder();
  assert.equal(states.length, 1);
  assert.equal(child.lifecycle.binds, 0);
  assert.equal(child.lifecycle.released, 1);
});

test('older history failures remain retryable even when the host swallows load errors', async () => {
  const child = childSession({ loadOlder: async () => {} });
  const states = [];
  const observer = client.observeStageActivity(child.ctx, {}, (state) => states.push(plain(state)));
  await observer.loadOlder();
  assert.match(states.at(-1).error, /did not load/);
  child.session.loadOlder = async () => { throw new Error('History RPC failed'); };
  await observer.loadOlder();
  assert.match(states.at(-1).error, /History RPC failed/);
  observer.dispose();
});
