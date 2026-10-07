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
const plain = (value) => JSON.parse(JSON.stringify(value));
const normalize = (reports = {}) => plain(client.normalizeWorkflowMetrics(reports));
const ready = (value, path = 'gauntlet-out/report.json') => ({ status: 'ready', path, value });
const fn = (name, file, line, endLine, values = {}) => ({ name, file, line, endLine, ...values });
const mutant = (status, line = 3, file = 'src/math.js') => ({ status, line, file, col: 2, op: 'binary', original: '+', replacement: '-' });

test('joins uniquely identified functions while keeping coverage and AST complexity distinct', () => {
  const result = normalize({
    crap: ready({ summary: { maxComplexity: 7, lineCoverage: 0.75 }, functions: [fn('sum', './src/math.js', 1, 8, { complexity: 7, coverage: 0.5, crap: 13.125, calls: 4 })] }),
    static: ready({ summary: { maxComplexity: 3 }, functions: [fn('sum', 'src\\math.js', 1, 8, { complexity: 3, lines: 8, nesting: null, params: 2 })] }),
  });
  assert.equal(result.quality.functions.length, 1);
  const row = result.quality.functions[0];
  assert.equal(row.crapComplexity, 7);
  assert.equal(row.staticComplexity, 3);
  assert.equal(row.coverage, 0.5);
  assert.equal(row.crap, 13.125);
  assert.equal(row.calls, 4);
  assert.equal(row.lines, 8);
  assert.equal(row.nesting, null);
  assert.equal(result.quality.summary.maxComplexity, 7);
  assert.equal(result.quality.staticSummary.maxComplexity, 3);
});

test('mutation scores include timeouts and exclude accepted, compilation errors, and unknown statuses', () => {
  const result = normalize({ mutation: ready({ results: ['KILLED', 'TIMEOUT', 'SURVIVED', 'NO_COVERAGE', 'ACCEPTED', 'COMPILE_ERROR', 'pending'].map((status) => mutant(status)) }) });
  assert.equal(result.mutation.tested, 4);
  assert.equal(result.mutation.total, 7);
  assert.equal(result.mutation.score, 0.5);
  assert.equal(result.mutation.scoreSource, 'derived');
  assert.equal(result.mutation.complete, false);
  assert.deepEqual(result.mutation.counts, { killed: 2, killedByTests: 1, timedOut: 1, survived: 1, noCoverage: 1, accepted: 1, compileError: 1, unknown: 1 });
  assert.equal(result.mutation.results.length, 7);
});

test('uses a reported fractional score and exposes the separately derived score', () => {
  const result = normalize({ mutation: ready({ score: 0.667, summary: { score: 0.666 }, results: ['KILLED', 'TIMEOUT', 'SURVIVED'].map((status) => mutant(status)) }) });
  assert.equal(result.mutation.reportedScore, 0.667);
  assert.equal(result.mutation.derivedScore, 2 / 3);
  assert.equal(result.mutation.score, 0.667);
  assert.equal(result.mutation.scoreSource, 'reported');
});

test('maps mutants to file and inclusive function ranges and leaves overlapping matches unassigned', () => {
  const result = normalize({
    crap: ready({ functions: [fn('outer', './src/math.js', 1, 10), fn('nested', 'src/math.js', 4, 6), fn('other', 'src/other.js', 1, 10)] }),
    mutation: ready({ results: [mutant('KILLED', 1), mutant('TIMEOUT', 10), mutant('SURVIVED', 5), mutant('NO_COVERAGE', 11), mutant('ACCEPTED', 2, 'src/other.js')] }),
  });
  const [outer, nested, other] = result.quality.functions;
  assert.equal(outer.mutation.derived, true);
  assert.equal(outer.mutation.score, 1);
  assert.equal(outer.mutation.tested, 2);
  assert.equal(outer.mutation.total, 2);
  assert.equal(nested.mutation.score, null);
  assert.equal(other.mutation.score, null);
  assert.equal(other.mutation.counts.accepted, 1);
  assert.deepEqual(result.mutation.results.map((row) => row.association), ['matched', 'matched', 'ambiguous', 'unmatched', 'matched']);
  assert.equal(result.mutation.results[2].functionId, null);
  assert.equal(result.mutation.results[3].functionId, null);
});

test('does not merge duplicate identities or infer a function range from its start alone', () => {
  const result = normalize({
    crap: ready({ functions: [fn('same', 'src/math.js', 1, 4), fn('same', 'src/math.js', 1, 4), fn('no-end', 'src/math.js', 20, undefined)] }),
    static: ready({ functions: [fn('same', 'src/math.js', 1, 4, { complexity: 2 })] }),
    mutation: ready({ results: [mutant('KILLED', 2), mutant('KILLED', 20)] }),
  });
  assert.equal(result.quality.functions.length, 4);
  assert.equal(result.quality.functions[0].staticComplexity, null);
  assert.equal(result.quality.functions[3].crapComplexity, null);
  assert.equal(result.mutation.results[0].association, 'ambiguous');
  assert.equal(result.mutation.results[1].association, 'unmatched');
});

test('empty or entirely excluded mutation tables are unmeasured even when the report writes score zero', () => {
  for (const statuses of [[], ['ACCEPTED'], ['COMPILE_ERROR'], ['ACCEPTED', 'COMPILE_ERROR']]) {
    const result = normalize({ mutation: ready({ score: 0, results: statuses.map((status) => mutant(status)) }) });
    assert.equal(result.mutation.reportedScore, 0);
    assert.equal(result.mutation.score, null);
    assert.equal(result.mutation.derivedScore, null);
    assert.equal(result.mutation.scoreSource, 'unavailable');
    assert.equal(result.mutation.tested, 0);
  }
  const missing = normalize();
  assert.equal(missing.mutation.score, null);
  assert.equal(missing.mutation.total, null);
  assert.equal(missing.mutation.tested, null);
  assert.equal(missing.mutation.counts.killed, null);
  assert.equal(missing.quality.tableAvailable, false);
  assert.equal(missing.quality.hasFunctions, false);
});

test('rejects invalid numeric metrics and never coerces absent data into a zero', () => {
  const result = normalize({
    crap: ready({ pass: 'true', summary: { maxCrap: Infinity, lineCoverage: 80, linesTotal: '10' }, functions: [fn('invalid', 'src/math.js', 0, -2, { calls: -1, complexity: NaN, coverage: 50, crap: '12' })] }),
    static: ready({ functions: [fn('real-zero', 'src/zero.js', 1, 1, { complexity: 0, lines: 0, nesting: 0, params: 0 })] }),
    mutation: ready({ score: 95, summary: { killed: '4' } }),
  });
  const invalid = result.quality.functions[0];
  for (const field of ['line', 'endLine', 'calls', 'crapComplexity', 'coverage', 'crap']) assert.equal(invalid[field], null, field);
  assert.equal(result.quality.pass, null);
  assert.equal(result.quality.summary.maxCrap, null);
  assert.equal(result.quality.summary.lineCoverage, null);
  assert.equal(result.quality.summary.linesTotal, null);
  assert.equal(result.quality.functions[1].staticComplexity, 0);
  assert.equal(result.quality.functions[1].nesting, 0);
  assert.equal(result.mutation.score, null);
  assert.equal(result.mutation.counts.killed, null);
});

test('preserves every raw report and row including errors, malformed rows, and unknown report keys', () => {
  const reports = {
    crap: ready({ functions: [null, { name: 'x', extra: { trace: ['a'] } }], extra: 'preserve' }),
    mutation: ready({ results: [null, { status: 'ACCEPTED', rationale: 'documented equivalent' }] }),
    constraints: ready([{ id: 'C1', text: 'no external service' }], 'qa/constraints.json'),
    tests: { status: 'error', path: 'gauntlet-out/tests.json', error: 'Invalid JSON', observedAt: 'now', value: null },
  };
  const result = normalize(reports);
  assert.deepEqual(result.sources.crap.raw, reports.crap.value);
  assert.deepEqual(result.sources.constraints.raw, reports.constraints.value);
  assert.equal(result.sources.tests.status, 'error');
  assert.equal(result.sources.tests.error, 'Invalid JSON');
  assert.equal(result.sources.tests.observedAt, 'now');
  assert.equal(result.quality.functions.length, 2);
  assert.deepEqual(result.quality.functions[1].sourceRows.crap, reports.crap.value.functions[1]);
  assert.equal(result.mutation.results.length, 2);
  assert.deepEqual(result.mutation.results[1].raw, reports.mutation.value.results[1]);
  assert.equal(reports.mutation.value.results[1].status, 'ACCEPTED');
  assert.equal(reports.crap.value.functions[1].id, undefined);
});

test('preserves gate evidence, QA checks, and every convergence round without deriving a pass', () => {
  const gates = { tests: { pass: true, ran: false, skipped: true, reason: 'not configured' }, mutation: { pass: false, score: 0.4, custom: ['evidence'] } };
  const checks = [{ id: 'Q1', title: 'launch', expected: 'works', actual: 'works', status: 'pass', constraint: ['C1'], extra: 2 }, null];
  const rounds = [{ at: '2026-10-07T01:00:00Z', remaining: 2, distance: 0.25, improved: false, verdict: 'STALLED', failing: ['mutation'], detail: 'unchanged' }];
  const result = normalize({
    gate: ready({ pass: true, profile: 'hardener', commit: { hash: 'abc' }, gates }),
    qa: ready({ verdict: 'pass', summary: 'checked', environment: { workdir: '/tmp/test' }, checks }),
    loop: ready({ rounds }),
  });
  assert.equal(result.gates.pass, true);
  assert.equal(result.gates.items[0].ran, false);
  assert.equal(result.gates.items[0].skipped, true);
  assert.deepEqual(result.gates.items[1].raw, gates.mutation);
  assert.deepEqual(result.gates.commit, { hash: 'abc' });
  assert.equal(result.qa.checks.length, 2);
  assert.deepEqual(result.qa.checks[0].raw, checks[0]);
  assert.equal(result.qa.checks[1].status, null);
  assert.equal(result.loop.rounds[0].distance, 0.25);
  assert.equal(result.loop.rounds[0].improved, false);
  assert.deepEqual(result.loop.rounds[0].raw, rounds[0]);
});

test('normalizes portable file spelling without merging case-sensitive POSIX paths', () => {
  assert.equal(client.normalizeMetricFile('.\\src\\folder\\..\\math.js'), 'src/math.js');
  assert.equal(client.normalizeMetricFile('D:\\Repo\\SRC\\math.js'), 'd:/repo/src/math.js');
  assert.equal(client.normalizeMetricFile('/Repo/SRC/math.js'), '/Repo/SRC/math.js');
  assert.equal(client.normalizeMetricFile(''), null);
  const result = normalize({
    crap: ready({ functions: [fn('x', '/Repo/SRC/math.js', 1, 4)] }),
    mutation: ready({ results: [mutant('KILLED', 2, '/repo/src/math.js')] }),
  });
  assert.equal(result.mutation.results[0].association, 'unmatched');
});

test('summary-only mutation reports retain available counts without inventing individual mutants', () => {
  const result = normalize({ mutation: ready({ summary: { total: 6, killed: 2, survived: 1, noCoverage: 1, accepted: 1, compileErrors: 1, score: 0.5 } }) });
  assert.equal(result.mutation.score, 0.5);
  assert.equal(result.mutation.scoreSource, 'reported');
  assert.equal(result.mutation.countSource, 'summary');
  assert.equal(result.mutation.tested, 4);
  assert.equal(result.mutation.total, 6);
  assert.equal(result.mutation.counts.timedOut, null);
  assert.equal(result.mutation.results.length, 0);
});
