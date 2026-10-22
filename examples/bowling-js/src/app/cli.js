// Application boundary: argv in, text + exit code out. bin/bowling.js only forwards to run().
import { score, BowlingError } from '../domain/game.js';

export function run(args, io) {
  try {
    io.out(String(score(args.map(parseRoll))));
    return 0;
  } catch (e) {
    if (!(e instanceof BowlingError)) throw e;
    io.err(`error: ${e.message}`);
    return 2;
  }
}

function parseRoll(text) {
  if (!/^\d+$/.test(text)) throw new BowlingError(`不是数字：'${text}'`);
  return Number(text);
}
