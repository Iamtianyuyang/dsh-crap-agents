#!/usr/bin/env node
// Humble object: no logic here, so nothing here needs testing.
import { run } from '../src/app/cli.js';

process.exitCode = run(process.argv.slice(2), { out: (s) => console.log(s), err: (s) => console.error(s) });
