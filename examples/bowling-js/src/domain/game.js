// Bowling score (Uncle Bob's kata): 10 frames; a strike scores 10 + the next two rolls,
// a spare scores 10 + the next roll. Invalid or incomplete games are rejected.
const FRAMES = 10;
const PINS = 10;

export class BowlingError extends Error {}

export function score(rolls) {
  rolls.forEach(checkRoll);
  let total = 0;
  let frame = { next: 0 };
  for (let n = 1; n <= FRAMES; n++) {
    frame = frameAt(rolls, frame.next, n);
    total += frame.points;
  }
  if (rolls.length > frame.next + frame.bonus) throw new BowlingError('第 10 格之后还有多余的投球');
  return total;
}

function frameAt(rolls, i, n) {
  const first = rollAt(rolls, i);
  if (first === PINS) return { points: PINS + rollAt(rolls, i + 1) + rollAt(rolls, i + 2), next: i + 1, bonus: 2 };
  const second = rollAt(rolls, i + 1);
  if (first + second > PINS) throw new BowlingError(`第 ${n} 格击倒 ${first + second} 个瓶，超过 10 个`);
  if (first + second === PINS) return { points: PINS + rollAt(rolls, i + 2), next: i + 2, bonus: 1 };
  return { points: first + second, next: i + 2, bonus: 0 };
}

function rollAt(rolls, i) {
  if (i >= rolls.length) throw new BowlingError('比赛还没有打完');
  return rolls[i];
}

function checkRoll(pins) {
  if (!Number.isInteger(pins) || pins < 0 || pins > PINS) throw new BowlingError(`非法的击倒数：${pins}`);
}
