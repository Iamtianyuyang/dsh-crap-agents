import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { captureWorkflowSnapshot, readWorkflowReports, registerWorkflowSnapshots, REPORT_FILE_LIMIT, SNAPSHOT_LIMIT, workflowSnapshotPath } from '../lib/workflow-reports.js';

function fixture(t) {
  const prefix = path.join(os.tmpdir(), 'gauntlet-snapshot-');
  const directory = fs.mkdtempSync(prefix);
  t.after(() => {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(prefix)) && resolved !== path.resolve(os.tmpdir()));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const write = (name, value) => {
    const file = path.join(directory, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return file;
  };
  return { directory, write };
}
const execution = (cwd, extra = {}) => ({
  name: 'gauntlet_coder', callId: 'call-1', arguments: { prompt: 'Implement the request.' },
  agent: { ctx: { preset: 'gauntlet' }, session: { header: { id: 'leader-session', cwd } } }, ...extra,
});
const result = (extra = {}) => ({
  value: { kind: 'foreground', runId: 'child-session', output: [{ type: 'text', text: 'GAUNTLET-RESULT: PASS\ngates: tests ✅\nsummary: done' }] }, isError: false, ...extra,
});
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('captures foreground report evidence with exact parent, child, prompt, and final output', (t) => {
  const { directory, write } = fixture(t);
  const metrics = { functions: [{ name: 'sum', file: 'src/math.js', line: 1, endLine: 4, coverage: 1, crap: 2 }], summary: { maxCrap: 2 } };
  write('gauntlet.config.json', { thresholds: { crapMax: 8 } });
  write('gauntlet-out/crap.json', metrics);
  write('gauntlet-out/gate.json', { profile: 'coder', commit: { hash: 'abc123' }, gates: { tests: { pass: true } }, pass: true });
  const captured = captureWorkflowSnapshot(execution(directory), result());
  assert.equal(captured.status, 'written');
  assert.equal(captured.path, workflowSnapshotPath(directory, 'call-1'));
  const snapshot = read(captured.path);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.callId, 'call-1');
  assert.equal(snapshot.toolName, 'gauntlet_coder');
  assert.equal(snapshot.stageKey, 'coder');
  assert.equal(snapshot.parentSessionId, 'leader-session');
  assert.equal(snapshot.childSessionId, 'child-session');
  assert.equal(snapshot.prompt, 'Implement the request.');
  assert.match(snapshot.output, /GAUNTLET-RESULT: PASS/);
  assert.equal(snapshot.isError, false);
  assert.ok(Number.isFinite(Date.parse(snapshot.capturedAt)));
  assert.deepEqual(snapshot.reports.crap.value, metrics);
  assert.equal(snapshot.reports.crap.status, 'ready');
  assert.ok(snapshot.reports.crap.bytes > 0);
  assert.ok(Number.isFinite(Date.parse(snapshot.reports.crap.modifiedAt)));
  assert.equal(snapshot.reports.static.status, 'missing');
  assert.equal(snapshot.reports.mutation.status, 'missing');
  assert.equal(snapshot.limits.reportFileBytes, REPORT_FILE_LIMIT);
  assert.equal(snapshot.limits.snapshotBytes, SNAPSHOT_LIMIT);
  assert.deepEqual(fs.readdirSync(path.dirname(captured.path)), ['reports.json']);
});

test('reads configured report paths with recursive local overrides while keeping snapshots canonical', (t) => {
  const { directory, write } = fixture(t);
  write('gauntlet.config.json', { outDir: 'original-output', paths: { qa: 'original-qa', profile: 'GAUNTLET.md' }, thresholds: { crapMax: 8, complexityMax: 10 }, sources: ['a'] });
  write('gauntlet.local.json', { outDir: 'machine-output', paths: { qa: 'handoffs' }, thresholds: { crapMax: 5 }, sources: ['b', 'c'] });
  write('machine-output/mutation.json', { score: 0.75, results: [] });
  write('handoffs/constraints.json', [{ id: 'C1', text: 'offline' }]);
  write('handoffs/qa-report.json', { verdict: 'pass', checks: [{ id: 'Q1', status: 'pass', constraint: 'C1' }] });
  write('handoffs/equivalence.json', { unchanged: true });
  const captured = captureWorkflowSnapshot(execution(directory, { name: 'gauntlet_hardener' }), result());
  assert.equal(captured.status, 'written');
  const snapshot = read(captured.path);
  assert.equal(snapshot.stageKey, 'hardener');
  assert.deepEqual(snapshot.reports.config.value.thresholds, { crapMax: 5, complexityMax: 10 });
  assert.deepEqual(snapshot.reports.config.value.paths, { qa: 'handoffs', profile: 'GAUNTLET.md' });
  assert.deepEqual(snapshot.reports.config.value.sources, ['b', 'c']);
  assert.equal(snapshot.reports.mutation.path, path.join(directory, 'machine-output', 'mutation.json'));
  assert.equal(snapshot.reports.qa.status, 'ready');
  assert.equal(snapshot.reports.constraints.value[0].id, 'C1');
  assert.equal(snapshot.reports.equivalence.value.unchanged, true);
  assert.equal(captured.path, path.join(directory, 'gauntlet-out', 'workflow', 'call-1', 'reports.json'));
  assert.equal(fs.existsSync(path.join(directory, 'machine-output', 'workflow')), false);
});

test('keeps every convergence profile and aliases the current gate profile only', (t) => {
  const { directory, write } = fixture(t);
  write('gauntlet-out/gate.json', { profile: 'cleaner' });
  for (const profile of ['specifier', 'coder', 'cleaner', 'hardener', 'full', 'quality']) write(`gauntlet-out/loop-${profile}.json`, { rounds: [{ verdict: profile === 'cleaner' ? 'STALLED' : 'CONTINUE' }] });
  const reports = readWorkflowReports(directory);
  assert.equal(reports.loop.value.rounds[0].verdict, 'STALLED');
  assert.equal(reports.loop.path, reports.loopCleaner.path);
  for (const name of ['loopSpecifier', 'loopCoder', 'loopCleaner', 'loopHardener', 'loopFull', 'loopQuality']) assert.equal(reports[name].status, 'ready');
  write('gauntlet-out/gate.json', { profile: 'unknown' });
  assert.deepEqual(readWorkflowReports(directory).loop, { status: 'missing', path: null });
});

test('invalid config, local config, or configured paths produces explicit dependent errors', (t) => {
  const { directory, write } = fixture(t);
  write('gauntlet-out/crap.json', { pass: true });
  for (const invalid of ['not JSON', 'null', '[]', { outDir: '' }, { paths: null }, { paths: { qa: 5 } }]) {
    write('gauntlet.config.json', invalid);
    const reports = readWorkflowReports(directory);
    assert.equal(reports.config.status, 'error');
    assert.equal(reports.crap.status, 'error');
    assert.equal(reports.crap.path, null);
    assert.match(reports.crap.error, /Report path is unavailable/);
    assert.equal(reports.qa.status, 'error');
  }
  write('gauntlet.config.json', {});
  write('gauntlet.local.json', '{ broken');
  const reports = readWorkflowReports(directory);
  assert.equal(reports.local.status, 'error');
  assert.equal(reports.config.status, 'error');
  assert.equal(reports.crap.status, 'error');
});

test('missing configs use path defaults and malformed metric JSON stays an error', (t) => {
  const { directory, write } = fixture(t);
  write('gauntlet-out/static.json', '{ incomplete');
  write('qa/constraints.json', '\uFEFF[{"id":"C1"}]');
  const reports = readWorkflowReports(directory);
  assert.equal(reports.config.status, 'missing');
  assert.deepEqual(reports.config.value, { outDir: 'gauntlet-out', paths: { qa: 'qa' } });
  assert.equal(reports.static.status, 'error');
  assert.equal(reports.static.path, path.join(directory, 'gauntlet-out', 'static.json'));
  assert.match(reports.static.error, /JSON|property|Unexpected|Expected/i);
  assert.equal(reports.constraints.status, 'ready');
  assert.deepEqual(reports.constraints.value, [{ id: 'C1' }]);
  write('gauntlet.local.json', { thresholds: { crapMax: 4 }, outDir: 'local-output' });
  const locallyConfigured = readWorkflowReports(directory);
  assert.equal(locallyConfigured.config.status, 'ready');
  assert.equal(locallyConfigured.config.localOverrides, true);
  assert.equal(locallyConfigured.config.committed, undefined);
  assert.equal(locallyConfigured.config.value.thresholds.crapMax, 4);
  assert.equal(locallyConfigured.crap.path, path.join(directory, 'local-output', 'crap.json'));
});

test('registers a synchronous observer restricted to exact Gauntlet stage calls', (t) => {
  const { directory } = fixture(t);
  let callback;
  const disposal = () => {};
  const ctx = {
    agentPresets: { composedPreset: (agentCtx) => agentCtx.preset },
    on(name, listener) { assert.equal(name, 'tools/result'); callback = listener; return disposal; },
  };
  assert.equal(registerWorkflowSnapshots(ctx), disposal);
  for (const exec of [
    execution(directory, { name: 'subagent', callId: 'other-tool' }),
    execution(directory, { callId: 'other-preset', agent: { ctx: { preset: 'standard' }, session: { header: { cwd: directory } } } }),
    execution(directory, { callId: 'unknown-preset', agent: { ctx: {}, session: { header: { cwd: directory } } } }),
    execution(directory, { callId: 'no-agent', agent: undefined }),
  ]) assert.equal(callback(exec, result()), undefined);
  assert.equal(fs.existsSync(path.join(directory, 'gauntlet-out')), false);
  assert.equal(callback(execution(directory), result()), undefined);
  assert.equal(fs.existsSync(workflowSnapshotPath(directory, 'call-1')), true);
});

test('background launch acknowledgements do not snapshot unfinished stages', (t) => {
  const { directory } = fixture(t);
  const captured = captureWorkflowSnapshot(execution(directory), result({ value: { kind: 'background', runId: 'child-session' }, content: [{ type: 'text', text: 'Started background task' }] }));
  assert.deepEqual(captured, { status: 'skipped' });
  assert.equal(fs.existsSync(path.join(directory, 'gauntlet-out')), false);
});

test('captures final errors and prefers final content over foreground fallback output', (t) => {
  const { directory } = fixture(t);
  const failed = captureWorkflowSnapshot(execution(directory), { isError: true, content: [{ type: 'text', text: 'Error: interrupted' }] });
  assert.equal(failed.status, 'written');
  const snapshot = read(failed.path);
  assert.equal(snapshot.isError, true);
  assert.equal(snapshot.output, 'Error: interrupted');
  assert.equal(snapshot.childSessionId, undefined);
  const finished = captureWorkflowSnapshot(execution(directory, { callId: 'call-2' }), result({ content: [{ type: 'text', text: 'final native content' }, { type: 'image', data: 'ignored' }] }));
  assert.equal(read(finished.path).output, 'final native content');
});

test('re-delivery cannot replace stage evidence with overwritten live reports', (t) => {
  const { directory, write } = fixture(t);
  write('gauntlet-out/crap.json', { summary: { maxCrap: 25 } });
  const initial = captureWorkflowSnapshot(execution(directory), result());
  const bytes = fs.readFileSync(initial.path, 'utf8');
  write('gauntlet-out/crap.json', { summary: { maxCrap: 1 } });
  const repeated = captureWorkflowSnapshot(execution(directory), result({ content: [{ type: 'text', text: 'different later output' }] }));
  assert.equal(repeated.status, 'exists');
  assert.equal(fs.readFileSync(initial.path, 'utf8'), bytes);
  const retry = captureWorkflowSnapshot(execution(directory, { callId: 'retry' }), result());
  assert.equal(read(retry.path).reports.crap.value.summary.maxCrap, 1);
  assert.equal(read(initial.path).reports.crap.value.summary.maxCrap, 25);
});

test('encodes path traversal and separator characters without writing outside the snapshot directory', (t) => {
  const { directory } = fixture(t);
  const callId = '../attempt/with\\separator';
  const captured = captureWorkflowSnapshot(execution(directory, { callId }), result());
  assert.equal(captured.status, 'written');
  assert.equal(captured.path, path.join(directory, 'gauntlet-out', 'workflow', '%2E%2E%2Fattempt%2Fwith%5Cseparator', 'reports.json'));
  assert.equal(read(captured.path).callId, callId);
  const dotOnly = captureWorkflowSnapshot(execution(directory, { callId: '..' }), result());
  assert.equal(dotOnly.status, 'written');
  assert.equal(path.basename(path.dirname(dotOnly.path)), '%2E%2E');
  for (const invalid of ['', 'CON', 'a'.repeat(241)]) assert.equal(captureWorkflowSnapshot(execution(directory, { callId: invalid }), result()).status, 'error');
});

test('size limits produce explicit error envelopes while preserving other evidence', (t) => {
  const { directory, write } = fixture(t);
  write('gauntlet-out/crap.json', { functions: ['x'.repeat(REPORT_FILE_LIMIT)] });
  write('gauntlet-out/static.json', { summary: { maxComplexity: 2 }, functions: [] });
  const captured = captureWorkflowSnapshot(execution(directory), result());
  assert.equal(captured.status, 'written');
  const snapshot = read(captured.path);
  assert.equal(snapshot.reports.crap.status, 'error');
  assert.match(snapshot.reports.crap.error, /per-file snapshot limit/);
  assert.equal(snapshot.reports.crap.value, undefined);
  assert.equal(snapshot.reports.static.status, 'ready');
  assert.ok(fs.statSync(captured.path).size <= SNAPSHOT_LIMIT);
  write('gauntlet-out/crap.json', { padding: 'x'.repeat(80) });
  write('gauntlet-out/static.json', { padding: 'y'.repeat(80) });
  const reports = readWorkflowReports(directory, { fileLimit: 128, totalLimit: 150 });
  assert.equal(reports.crap.status, 'ready');
  assert.equal(reports.static.status, 'error');
  assert.match(reports.static.error, /total snapshot read limit/);
});

test('serialized size limits handle JSON escaping with explicit omissions', (t) => {
  const { directory, write } = fixture(t);
  write('gauntlet-out/crap.json', { trace: '\u0000'.repeat(1300) });
  const captured = captureWorkflowSnapshot(execution(directory), result(), { fileLimit: 10000, totalLimit: 9500 });
  assert.equal(captured.status, 'written');
  const snapshot = read(captured.path);
  assert.equal(snapshot.reports.crap.status, 'error');
  assert.match(snapshot.reports.crap.error, /serialized stage evidence/);
  assert.ok(fs.statSync(captured.path).size <= 9500);
});

test('large output truncation is explicit and keeps complete UTF-8 characters', (t) => {
  const { directory } = fixture(t);
  const captured = captureWorkflowSnapshot(execution(directory), result({ content: [{ type: 'text', text: '中文测试更多文字' }] }), { outputLimit: 8 });
  assert.equal(captured.status, 'written');
  const snapshot = read(captured.path);
  assert.equal(snapshot.output, '中文');
  assert.equal(snapshot.outputTruncated, true);
  assert.equal(snapshot.outputOriginalBytes, 24);
  assert.equal(snapshot.promptTruncated, true);
  assert.ok(Buffer.byteLength(snapshot.output) <= 8);
});

test('unwritable snapshot targets and malformed executions never throw from the observer', (t) => {
  const { directory, write } = fixture(t);
  write('gauntlet-out', 'not a directory');
  const captured = captureWorkflowSnapshot(execution(directory), result());
  assert.equal(captured.status, 'error');
  let callback;
  registerWorkflowSnapshots({ agentPresets: { composedPreset: () => { throw new Error('preset unavailable'); } }, on: (_, listener) => { callback = listener; } });
  assert.doesNotThrow(() => callback(execution(directory), result()));
  assert.doesNotThrow(() => callback(null, null));
  assert.equal(captureWorkflowSnapshot(execution(undefined), result()).status, 'error');
});
