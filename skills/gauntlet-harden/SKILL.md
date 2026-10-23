---
name: gauntlet-harden
description: Gauntlet stage 4 (Hardener) — use mutation testing to find code lines the tests do not pin down, add tests until every surviving mutant is killed (or each tier meets its target) and coverage meets its threshold; handle equivalent mutants. In a clean-up it also runs before the clean stage as "pin" (profile pin), pinning existing behaviour; big runs are split into shards worked on in parallel.
---

# Harden stage (Hardener)

Coverage only says "this code ran", not "its behaviour was checked". Mutation testing changes one token at a time
(`<`→`<=`, `+`→`-`, `true`→`false`, negated conditions, constant +1, …); if the tests still all pass, no assertion
pins that line's behaviour — that is a "surviving mutant". Your goal: **zero survivors**.

**First look at `adapter` in `.gauntlet/gauntlet.config.json`**, then read the "4 Harden" section of the matching
adapter skill: `commands` (or not set) → gauntlet-adapter-commands; `cmake-clang` → gauntlet-adapter-cmake.

## Which run this is (read the task's `Stage:` and `Shard:` lines)

| Task says | Profile | What you do |
|---|---|---|
| `harden` | hardener | the normal stage after clean: steps below |
| `pin` | pin | clean-up of existing code, **before** refactoring: pin today's behaviour (section "Pin mode") |
| `… (plan)` | pin / hardener | measure, then plan shards instead of fixing (section "Plan, shards, confirm") |
| `Shard: <id>` + a directory | pin / hardener | work only on that shard (gauntlet-core section 4a), then the steps below |
| `… (confirm)` | pin / hardener | after the Leader merged the shards: one complete gate on the merged branch |

## Pin mode (profile `pin`, clean-up requirements)

The clean stage is about to restructure code that has few or no tests. Before it may, the behaviour must be pinned.
Pin **wide and cheap first, deep only where it matters** (Feathers' characterization tests, Falco's approval tests):

1. **Golden masters at the highest stable boundary.** Drive the product the way users do — the CLI commands, the
   public API, the report or file it writes — over **many inputs** (option combinations, the example fixtures, edge
   inputs: empty, invalid, boundary values) and approve the **whole output** as a snapshot committed next to the test
   (Node: `t.assert.snapshot(...)` / `node --test --test-update-snapshots` once; Python: approved files or
   `syrupy`; C/C++: expected-output files compared by the test). Normalise only what really varies between runs
   (timestamps, durations, absolute and temp paths, PIDs) and say what in the test. One such test pins hundreds of
   lines; a table of inputs × one snapshot each is the cheapest way to raise the mutation score of a whole module.
2. **Then let mutation show what is still loose**, tier by tier. Output and formatting code is usually pinned by
   step 1 already. Add targeted unit tests with exact assertions only where survivors remain in a tier that misses
   its target — typically the core decision logic.
3. Assert what the code **does**, even where it looks wrong. Fixing it is not your job and would break equivalence;
   write the suspicious behaviour into the result's `next:` for the human.
4. **Keep slow end-to-end tests in small files**, one boundary per file. Mutation testing selects test *files*
   by the lines they execute; one big file that drives the whole CLI is selected for every mutant and costs its full
   run each time. Many small files let each mutant run only the one that matters. Prefer in-process calls of the
   same boundary (the command's function with a fixture project) over spawning a process when both pin the output.
5. Do not refactor production code beyond the smallest seam (a parameter, an exported helper); the clean stage
   restructures with your tests as its safety net. The snapshots you approve are frozen from then on
   (gauntlet-core section 5): later stages may never regenerate them.

Equivalence cases are the same idea across versions (the original at base against this branch); approval tests are
the golden master inside the test suite, so they also kill mutants. Tier targets (gauntlet-core section 4): a tier
with a number must reach it; a `"ratchet"` tier only must not drop.

## Plan, shards, confirm (big runs)

A stage with hundreds of survivors is too much for one session. The Leader splits it:

1. **Plan** (`… (plan)`): run `node .gauntlet/gauntlet.mjs gate --profile <p>` **once**. Do not loop `mutate` until it
   is complete: the plan only needs to know where the open work is, and untested mutants are open work that each
   shard tests on its own files (one complete run of a code base whose code only slow end-to-end tests reach can take
   hours). In pin mode, when tiers have `"ratchet"` targets and this run's mutation is complete (no NOT_RUN), record
   them now: `node .gauntlet/gauntlet.mjs baseline --mutation`; otherwise the confirm run records them. If the gate
   passes → PASS, no shards. Otherwise `node .gauntlet/gauntlet.mjs shards --profile <p>`, commit (the plan `.gauntlet/shards.json` is a hand-off: the shards are opened from the committed branch), and finish
   with FAIL and the `shards:` line (gauntlet-core section 6). Do not fix anything in a plan run.
2. **Shards**: one agent per shard, in parallel, each in its own worktree (gauntlet-core section 4a), looping
   `next --profile <p>` until DONE / BUDGET.
3. **Confirm** (`Stage: … (confirm)`): the Leader merged the shards. Run `gate --profile <p>` on the merged branch;
   in pin mode run `baseline --mutation` again (the baseline only rises). PASS if the gate passes; otherwise FAIL with
   what is left (the Leader may plan another, smaller round of shards).

## Handling surviving mutants

| Status | Meaning | What to do |
|---|---|---|
| `SURVIVED` boundary (`<`→`<=`, `5`→`6`) | a boundary test is missing | add rows to the existing table: exactly at the boundary, boundary ±1 |
| `SURVIVED` logic (`&&`→`\|\|`, negated condition) | the "other half" of a condition is untested | add rows so each sub-condition is true and false on its own |
| `SURVIVED` return value (`true`→`false`) | the return value is never asserted | assert the return value / exit code in existing cases |
| `NO_COVERAGE` | the line never runs | add a test that runs it; if it really is unreachable, it is dead code — delete it (say so in the summary) |
| `NOT_RUN` | the run hit `mutation.maxMinutes` before this mutant | nothing to fix: the next round tests it |
| `TIMEOUT` | the mutant caused an endless loop; counts as killed | nothing |
| `COMPILE_ERROR` | the mutant does not compile; ignored | nothing |

Tests are table-driven (gauntlet-core section 8): **first add a row to an existing table** — one mutant is not worth a
new test function; several survivors of one function are usually killed by one table.

**Prefer unit tests over more acceptance scenarios.** If a survivor exposes behaviour the requirement never mentions
(e.g. a crash on empty input), add a unit test and also note in the result's `next:` that the requirement may be
missing a scenario; the spec stage can add it if needed.

## Run-time checks (sanitizers)

The `hardener` gate also runs all tests under AddressSanitizer / UndefinedBehaviorSanitizer (CUDA tests also under
compute-sanitizer), catching "tests pass but memory is out of bounds, used after free, integer overflow, GPU
out-of-bounds access or races". Every report is a real bug:

- fix it at the first production-code location in the report, then add a test that reproduces it reliably (fails
  under the sanitizer before the fix, passes after);
- never turn the sanitizer off, skip or delete the test that triggers it, or dodge detection with `#ifdef`;
- "not run" (toolchain unsupported, compute-sanitizer not found) is not your failure: copy the reason into the
  result; the evidence pack asks a human to confirm.

## Accepted mutants: equivalent or low-value

Some mutants have exactly the same observable behaviour as the original (e.g. a guard whose two paths print the same
error). In order:

1. First try to **refactor** so the mutant is no longer equivalent (it often points at redundant code).
2. Only if that fails, add it to `.gauntlet/mutation-accepted.json`:
   ```json
   [
     { "file": "src/app/cli.cpp", "op": "4 -> 5", "source": "arg.size() <= 4",
       "reason": "The length guard only protects std::stoi from overflow; 5 digits also exceed 3999, both paths print the same output, so the behaviour is equivalent." }
   ]
   ```
   `reason` must say concretely why both versions behave the same observably. These entries are **highlighted
   separately** in the evidence pack for a human to check — abuse gets rejected and sent back.

**Low-value mutants** change behaviour, but nothing a test should pin — like a code-review comment a reviewer marks
"not useful" (Google surfaces surviving mutants exactly that way). Only two cases qualify:

- the **wording** of a message (an error text, a hint) whose exact words no requirement or scenario fixes — the
  message's presence and its exit code still need a test;
- a **log line** the arid patterns (`mutation.arid`) missed, e.g. a multi-line logging call.

```json
{ "file": "src/app/cli.js", "op": "\"bad input\" -> \"\"", "source": "usage: roman <n>", "kind": "low-value",
  "reason": "Wording of the usage hint; the CLI scenario asserts that a usage line is printed and the exit code is 2." }
```

Never for a condition, a comparison, a number, a return value, or anything a verdict, a calculation or a file format
depends on. The evidence pack lists low-value entries apart from equivalent ones; the human rejects what does not
fit.

## Rules

- Do not change production behaviour; small structural changes for testability (e.g. injecting a dependency) are
  fine as long as the cleaner gate still passes.
- Never delete or weaken existing assertions; never raise thresholds.
- Tests must mean something: one behaviour per test (or per table row), names describe behaviour
  (`RejectsNumbersAbove3999`); no "magic assertions" that exist only to kill a mutant.
- Mutation operators: comparison / arithmetic / logical operators, `true/false`, negated conditions, constant +1, …
  (details in the adapter skill).
