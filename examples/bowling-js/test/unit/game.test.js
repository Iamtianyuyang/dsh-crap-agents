import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, BowlingError } from '../../src/domain/game.js';
import { run } from '../../src/app/cli.js';

const times = (n, v) => Array(n).fill(v);
const rejects = (rolls, message) => assert.throws(() => score(rolls), (e) => e instanceof BowlingError && e.message.includes(message));

test('open frames add up', () => {
  assert.equal(score([3, 4, ...times(18, 0)]), 7);
});

test('spare in the tenth frame gets exactly one bonus roll', () => {
  assert.equal(score([...times(18, 0), 4, 6, 7]), 17);
  rejects([...times(18, 0), 4, 6, 7, 1], '多余的投球');
});

test('strike in the tenth frame gets exactly two bonus rolls', () => {
  assert.equal(score([...times(18, 0), 10, 2, 3]), 15);
  rejects([...times(18, 0), 10, 2, 3, 1], '多余的投球');
});

test('a complete open game takes exactly 20 rolls', () => {
  rejects(times(21, 0), '多余的投球');
  rejects(times(19, 0), '比赛还没有打完');
});

test('a strike still needs its two bonus rolls', () => {
  rejects([...times(18, 0), 10, 2], '比赛还没有打完');
});

test('a frame cannot knock down more than 10 pins', () => {
  rejects([5, 6, ...times(18, 0)], '第 1 格击倒 11 个瓶');
  rejects([...times(2, 0), 9, 2, ...times(16, 0)], '第 2 格击倒 11 个瓶');
});

test('every roll is a whole number of pins between 0 and 10', () => {
  for (const bad of [-1, 11, 1.5]) rejects([bad, ...times(19, 0)], '非法的击倒数');
  assert.equal(score([0, 10, ...times(18, 0)]), 10);
  assert.equal(score([10, ...times(18, 0)]), 10);
});

test('cli: errors other than bowling errors are not swallowed', () => {
  const boom = new Error('io failure');
  assert.throws(() => run(times(20, '0'), { out: () => { throw boom; }, err: () => {} }), (e) => e === boom);
});
