// Acceptance tests: one test per Gherkin scenario, named after it (the commands adapter matches by name).
// They drive the application boundary (run), not the domain internals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/app/cli.js';

function bowl(args) {
  const out = [];
  const err = [];
  const code = run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
const times = (n, v) => Array(n).fill(v);

test('全部落空得 0 分', () => {
  assert.deepEqual(bowl(times(20, '0')), { code: 0, out: '0', err: '' });
});

test('每球击倒 1 个得 20 分', () => {
  assert.deepEqual(bowl(times(20, '1')), { code: 0, out: '20', err: '' });
});

test('补中奖励下一球', () => {
  assert.deepEqual(bowl(['5', '5', '3', ...times(17, '0')]), { code: 0, out: '16', err: '' });
});

test('全中奖励下两球', () => {
  assert.deepEqual(bowl(['10', '3', '4', ...times(16, '0')]), { code: 0, out: '24', err: '' });
});

test('完美比赛得 300 分', () => {
  assert.deepEqual(bowl(times(12, '10')), { code: 0, out: '300', err: '' });
});

const invalid = [
  ['11', '非法的击倒数'],
  ['x', '不是数字'],
  ['5 6', '超过 10 个'],
  ['0 0', '比赛还没有打完'],
  ['10 10 10 10 10 10 10 10 10 10 10 10 10', '多余的投球'],
];
for (const [input, error] of invalid) {
  test(`非法输入被拒绝 [输入=${input}, 错误=${error}]`, () => {
    const r = bowl(input.split(' '));
    assert.equal(r.code, 2);
    assert.equal(r.out, '');
    assert.match(r.err, new RegExp(`^error: .*${error}`));
  });
}
