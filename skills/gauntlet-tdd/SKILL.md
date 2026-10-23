---
name: gauntlet-tdd
description: Gauntlet stage 2 (Coder) — implement the feature with TDD (acceptance tests, unit tests and the least production code) until every Gherkin scenario and unit test passes. Test frameworks and how to write the tests are in the current adapter skill (gauntlet-adapter-cmake / gauntlet-adapter-commands).
---

# Code stage (Coder)

One goal only: **make every acceptance scenario and unit test green.** Clean code is the next stage's job, but do
not write a mess on purpose — small functions and good names are free.

**First look at `adapter` in `.gauntlet/gauntlet.config.json`**, then read the "2 Code" section of the matching
adapter skill: `commands` (or not set) → gauntlet-adapter-commands; `cmake-clang` → gauntlet-adapter-cmake. It
explains how to write acceptance tests, which unit-test framework to use and the skeleton for a new project.

## The three laws of TDD (Uncle Bob)

1. Write no production code without a failing test.
2. Write only enough of a test to fail (not compiling counts as failing).
3. Write only enough production code to pass the currently failing test.

The cycle: red → green → small refactor → red again. A few minutes per cycle.

## Steps

1. Read the task and confirm the branch (gauntlet-core sections 1 and 2).
2. `node .gauntlet/gauntlet.mjs next --profile coder --reset` for the overview: which scenarios lack an acceptance
   test, which tests fail.
3. Work scenario by scenario:
   - write this scenario's acceptance test (it drives the application boundary; see the adapter skill) — red
   - when you need a new class / function, write its unit test first (red)
   - write the least production code (green)
   - `node .gauntlet/gauntlet.mjs test` for the overall picture; commit when green
4. Loop with `next --profile coder` (gauntlet-core section 7) until DONE (or finish on STALLED / BUDGET as in
   section 6).
5. Commit and finish (gauntlet-core section 6).

## Design points

- **Acceptance tests drive the application boundary** (CLI entry, HTTP handler, public API), not internal details;
  internal details belong to unit tests.
- **Humble object**: the program entry, real IO and GUI event loops only forward; behaviour lives in testable
  functions (output streams, clocks, the filesystem are injected as parameters). Whether an entry file may be
  excluded from `sources` is a **human** decision — you never change `sources` / `exclude`.
- **New logic goes into new functions; old functions only get the call.** An old function you change may grow by at
  most +2 complexity and +20 lines (gauntlet-core section 4); a bigger addition would force a rewrite of old code.
  Small new functions in a new or existing module keep the change reviewable and are judged on their own.
- Never make production code check "am I running under test?" to pass a test.
- Scenario wording is the requirement: steps / test names match the scenarios verbatim; never change a scenario to
  suit the code.
- Unit tests are table-driven (gauntlet-core section 8): several inputs/outputs of one function are one table + one
  test; TDD's "red again" is usually a new row, not a new test function.
