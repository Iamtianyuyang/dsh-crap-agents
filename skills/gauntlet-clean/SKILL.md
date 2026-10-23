---
name: gauntlet-clean
description: Gauntlet stage 3 (Cleaner) — refactor production code without changing behaviour until function complexity / length / nesting / parameters, warnings, static checks, copy-paste duplication, CRAP and architecture violations are all within the thresholds.
---

# Clean stage (Cleaner)

The previous stage's code is "correct but not necessarily clean". Your job is to **change structure, never
behaviour**, until `gate --profile cleaner` passes.
The gates measure **the change**: new functions and the lines this branch changed (gauntlet-core section 4). Code
the requirement did not touch is out of scope. **Old functions the branch touched are judged by their growth**
(+2 complexity / +20 lines at most), not by the thresholds: do not refactor them — a rewrite of old code is the
riskiest, least reviewable part of a change. If an old function grew too much, move the new logic out into a new
function and leave a call. The `equivalence` gate checks that the program still produces exactly the original
outputs; it must stay green after every refactoring. Only with `"scope": "all"` (a clean-up requirement) is every
production file measured and refactored.
The tests are your safety net: run `test` after every refactoring step.

**First look at `adapter` in `.gauntlet/gauntlet.config.json`**, then read the "3 Clean" section of the matching
adapter skill: `commands` (or not set) → gauntlet-adapter-commands; `cmake-clang` → gauntlet-adapter-cmake.

## Clean-up requirements (`"scope": "all"`): the behaviour is already pinned

In a clean-up the **pin** stage ran before you: tests with real assertions pin today's behaviour (mutation score per
tier). They are your safety net and they already bring the coverage CRAP needs. So:

- CRAP over the limit → **lower the complexity**. Never add tests that only execute code to raise coverage: a test
  without exact assertions satisfies CRAP and protects nothing (the last run of this squad lost hours to that).
  If a split-out function really needs a test, write one that asserts its values.
- Big clean-ups are split into shards like the harden stage: a `(plan)` run measures and runs
  `node .gauntlet/gauntlet.mjs shards --profile cleaner` and commits the plan `.gauntlet/shards.json` (finish with
  FAIL + the `shards:` line, fix nothing); a
  `Shard:` run works only in its worktree on its files (gauntlet-core section 4a); a `(confirm)` run checks the
  merged branch with `gate --profile cleaner`.
- Entry points (the files the profile lists under declared entry points: a package's main / exports / bin) keep
  their exact interface; check every import you remove (`grep` the identifier) — this squad once broke the plugin
  entry by moving two helpers out and dropping an import still in use.

## Get the overview

```
node .gauntlet/gauntlet.mjs next --profile cleaner --reset
```

It runs every cleaner gate and writes the punch list `.gauntlet/out/next.md`; the details are in `static.json`,
`tidy.json`, `duplication.json`, `crap.json` and `arch.json` in the output directory. Single gates can be run on
their own while you work (`static`, `tidy`, `dup`, `crap`, `arch`). Then loop with `next --profile cleaner`
(gauntlet-core section 7).

## How to pass each gate

| Gate | Default threshold | Typical fix |
|---|---|---|
| measurement scope `scope` | 100% of production files analysed | see the adapter skill; delete real dead code; otherwise NEED-HUMAN |
| function quality `complexity` | CC ≤ 10, length ≤ 60 lines, nesting ≤ 4, parameters ≤ 7 | extract function, guard clauses, table-driven code; too many parameters → parameter object |
| warnings `warnings` | 0 | fix them; never silence them with comments / pragmas / disabled rules |
| static checks `tidy` | 0 | fix as suggested; only real false positives go into `.gauntlet/quality-accepted.json` (below) |
| duplication `duplication` | ≤ 3% | **merge the duplicated logic into one copy** (below) |
| CRAP `crap` | ≤ 30 | lower the complexity; missing coverage is the pin / hardening stage's job (never add assertion-free tests) |
| architecture `arch` | 0 violations | invert dependencies; changing the architecture rules needs a human |

## Duplication: the heart of merge tasks

In tasks like "turn the CPU and GPU versions into one program" this is where the real work is: config parsing,
model loading, output writing, parameter validation, shared maths … each exists once per implementation. The right
way:

1. Move it into a shared module (e.g. `common/`) that both backends depend on (updating the architecture rules
   needs a human: propose the module split via NEED-HUMAN).
2. Backends keep only what truly differs (e.g. the CPU loop vs the CUDA kernel), plugged in through a narrow
   interface.
3. Run `test` after each merge so both backends' results stay the same (QA re-checks equivalence).

Every clone `dup` reports is either removed or explained in the result summary (e.g. the two copies are in different
languages).

## Refactorings (in order of preference)

1. **Extract function**: every "paragraph" of a long function becomes a small named function; the name says what it
   does.
2. **Guard clauses / early return**: remove nested ifs.
3. **Table-driven code**: a long `switch` / `if-else` mapping → a lookup table.
4. **Decompose conditional**: complex boolean expressions → named functions like `is_inside_pml(...)`.
5. **Replace conditional with polymorphism**: the same `switch(method)` in several places → a function-pointer table
   / interface + implementations.
6. **Remove duplication (DRY)**: see above, but never force unrelated things together for DRY's sake.
7. **Deep modules (Ousterhout)**: narrow interface, deep implementation. Do not split out a pile of `helper1/helper2`
   called once with empty names just to lower CC.

## Exceptions (.gauntlet/quality-accepted.json)

Only problems that **cannot be removed** may be listed, each with a concrete reason; a human reviews every entry (the
evidence-pack verdict becomes "needs your confirmation"). Format (examples in the adapter skill):

```json
[ { "kind": "tidy", "file": "<file>", "check": "<rule id>", "reason": "<why this is a false positive / cannot be removed, specific to the code>" } ]
```

`kind` is one of `function` (function over the limits), `warning`, `tidy`, `unbuilt` (file not built), `duplication`.
"The threshold is too strict" and "too much code, no time" are not reasons.

## Rules

- One refactoring at a time, then `node .gauntlet/gauntlet.mjs test`, keeping everything green; commit when green.
  Run `next` after a batch of related refactorings, not after every single one.
- Do not change acceptance scenarios, delete tests or change public behaviour (output text, exit codes and numerical
  results all count as behaviour). Exception: duplicated unit tests written on this branch may be merged into one
  table (gauntlet-core section 8) — every input stays as a row and no assertion is lost, so it is not deleting tests;
  tests that existed before the branch are not touched.
- Do not raise thresholds, widen `exclude` or change `sources`.
- `node .gauntlet/gauntlet.mjs gate --profile cleaner` must PASS before you finish.
- In the result summary list: which functions you refactored (CC / length before and after), which duplication you
  merged, how many warnings and tidy findings you fixed.
