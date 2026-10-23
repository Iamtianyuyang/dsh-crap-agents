---
name: gauntlet-core
description: Shared rules of the Gauntlet pipeline (required reading for every Gauntlet squad member) — installing the tools, gate commands, branch protocol, result format, the incremental loop and what is forbidden. Read it before any Gauntlet work.
---

# Gauntlet shared rules (DeepSeek Harness edition)

This pipeline follows Uncle Bob (Robert C. Martin): **humans do not read AI-written code, they read evidence.**
Trust in the code comes from layered gates: acceptance tests → unit tests → CRAP (complexity × untested)
→ mutation testing → architecture boundaries → QA.

You are one **stage sub-agent** of the Gauntlet squad. The Leader (orchestrator) hands the requirement to 7 sub-agents,
one stage each; you do only the stage you were given: follow the task prompt and your stage skill, iterate until the
gates pass, then hand the result back to the Leader. You cannot see the conversation between the Leader and the user
and you never ask the user directly — anything a human must decide goes back to the Leader as NEED-HUMAN (section 6).
*What* a stage does is in its stage skill; *which tools and how* is in the adapter skill.
Read only the files relevant to the current work — the longer the context, the more mistakes ("lost in the middle").

## 1. Where the requirement comes from

The requirement is **the user's original request**; the Leader pastes it verbatim into your task prompt (together with
the branch, your stage and the rework note). Before starting, make sure you understand the goal, inputs/outputs,
boundaries, and whether behaviour must match an existing program (refactor / port / merge tasks).
If anything is unclear, finish with NEED-HUMAN — do not guess.

In the repository, first read the project profile `.gauntlet/GAUNTLET.md` (written by the stage-0 survey: how to
build / test / run, code map, conventions, pitfalls). If the profile contradicts what you see, finish with FAIL and
say so; the Leader sends the work back to stage 0. Do not carry on from memory.

## 2. Repository and branch protocol

1. You work in the target repository; the Leader has created and checked out `gauntlet/<short-name>` (it is in the
   task prompt). Confirm with `git status`. The default branch is `base:` in `.gauntlet/GAUNTLET.md` or the remote's
   default branch; "changed lines" in the gates are computed against it.
2. Commit messages carry a stage tag, e.g. `[code] add roman parser`, `[clean] extract scorer`.
3. **Commit every time the tests go green.** You can be interrupted at any moment (cancelled, token limit, dsh
   restart) and uncommitted work is lost. When you are dispatched again, run `git status` / `git log --oneline`
   first and continue from there.
4. **Never** `git push` or open a PR — the Leader pushes after the user approves. **Never** commit on the default
   branch, **never** force-push.

## 3. Tools (.gauntlet/) and shells

### Install / update

The plugin ships the tool kit; the environment variable `DSH_GAUNTLET_KIT_DIR` points to it (your persona shows
how to write it in your shell). Install it into the target repository (once, offline):

- PowerShell: `node "$env:DSH_GAUNTLET_KIT_DIR/install-kit.mjs" .`
- bash: `node "$DSH_GAUNTLET_KIT_DIR/install-kit.mjs" .`

If the repository already has `.gauntlet/gauntlet.mjs` (installed and committed earlier), just use it; the stage-0
survey commits it. Only when the variable is empty (the plugin did not load) look for an existing `.gauntlet/`;
if there is none, finish with NEED-HUMAN.

Then check the toolchain: `node .gauntlet/gauntlet.mjs doctor`

Which tools are needed depends on the adapter (see the adapter skill). Both adapters **require** the code-graph tool
codebase-memory-mcp (the `code graph` line of `doctor`; `next`, `mutate` and `graph` stop with an error without it).
When a tool is missing, do **not** work around the gate and do **not** install it yourself (it will be denied):
finish with NEED-HUMAN and give the exact install command (section 6). For the code graph that is
`npm install -g codebase-memory-mcp`.

### Three shells (keep them apart, especially on Windows)

| Who runs the command | Windows | Linux / macOS |
|---|---|---|
| You (your shell tool) | PowerShell | bash |
| `commands` in `.gauntlet/gauntlet.config.json` (the kit hands them to the system shell) | **cmd.exe** | /bin/sh |
| `run` in `.gauntlet/demo/*.json` | Git Bash (cmd.exe if missing) | /bin/sh |

- Commands in the skills are **one-line** `node .gauntlet/gauntlet.mjs …` or `git …` and work as-is in any shell.
  Do not add shell-specific syntax (`\` continuations, `2>/dev/null`, `$(…)`, `find`, `grep`, …); platform logic
  lives inside the kit commands.
- Commands written into `commands` must run in cmd.exe: double quotes, no bash-only syntax. Run them for real
  (`test`, …) before relying on them.
- Every configured build / test / lint command, and every ctest test, is killed after `commandTimeoutMin`
  (default 60) minutes. A timeout fails the gate with "⏱ … killed": find the hanging test instead of retrying.

### Where files go: only into `.gauntlet/`

Apart from production code and the project's own tests, **everything** Gauntlet writes lives in the single folder
`.gauntlet/`; nothing else appears at the repository root:

| Content | Location | Committed |
|---|---|---|
| Tool kit | `.gauntlet/gauntlet.mjs`, `.gauntlet/lib/`, … | yes |
| Config / machine overrides | `.gauntlet/gauntlet.config.json` / `.gauntlet/gauntlet.local.json` | yes / no |
| Project profile | `.gauntlet/GAUNTLET.md` | yes |
| Rule files | `.gauntlet/architecture.json`, `.gauntlet/quality-accepted.json`, `.gauntlet/mutation-accepted.json`, `.gauntlet/baseline.json` | yes |
| Acceptance scenarios | `.gauntlet/features/*.feature` (cmake-clang step definitions in `.gauntlet/acceptance/steps/`) | yes |
| QA, demo scripts | `.gauntlet/qa/`, `.gauntlet/demo/` | yes |
| Tutorials, architecture diagrams | `.gauntlet/docs/` | yes |
| Build, output (reports, evidence pack) | `.gauntlet/build/`, `.gauntlet/out/` | no |
| Your own scratch files (logs, drafts, baseline builds) | `.gauntlet/tmp/` | no |

Two files at the root are maintained by the kit itself, each in its own marked block: `.gitignore` (build / output
directories) and `.cbmignore` (keeps the kit's own code out of the code graph). Commit them; never edit those blocks.

In Gauntlet sessions `survey` / `init` use this layout by default (`GAUNTLET_LAYOUT=home`). Never create
`gauntlet-out/`, `qa/`, `features/`, `demo/`, `docs/`, `tmp/` or similar at the root or anywhere else, and never
write outside the repository or into system temp directories. Old repositories with `gauntlet.config.json` at the
root are migrated into `.gauntlet/` by stage 0 (gauntlet-survey, "Moving into .gauntlet/").

If the requirement itself says "intermediate files go into tmp" or similar, the build directory, output directory,
generated files and your scratch files must all be under that directory (`init --workdir tmp`).

## 4. Gate commands (the only way to decide you are done)

**The gates measure the change, not the repository** (`"scope": "changes"`, the default). The change set is what this
branch changed against base (git diff), and the code graph tells which tests can reach it:

- static analysis, clang-tidy and cppcheck run on the changed production files only (for C/C++ also the translation
  units that include a changed header); duplication, CRAP and architecture count only findings on changed lines or
  inside changed functions; coverage means "changed lines are covered"; mutation testing mutates changed lines;
- anything outside the change set is shown as out of scope and never fails a gate — you do not clean up code the
  requirement did not touch;
- tests are **selected by the graph**: each mutant runs only the test files that reach its file, and a focused `next`
  round runs only the tests that reach the change (plus test files changed on the branch). The run that confirms
  DONE and `gate --profile full` use the whole suite.

**Old functions are judged by how much the branch grew them.** A function that already existed at base and that you
changed may grow by at most `legacy.complexityGrowth` (default +2) cyclomatic complexity and `legacy.linesGrowth`
(default +20) lines, and may not nest deeper or take more parameters. Within that it passes even if it was already
over the thresholds — do not refactor it. Anything bigger goes into a **new** function (judged by the thresholds) and
the old one only calls it.

**Equivalence**: in a project that declared "outputs must not change" (it has `equivalence.cases`), when the branch
changes production code that existed at base, the `equivalence` gate (cleaner, hardener and full profiles) builds the
original at base and this branch with the release build, runs the cases on both and compares every output
(bit-identical unless the project set a tolerance). A difference means the change altered protected behaviour — find
it and restore it. Only a difference the requirement itself asks for may stand, and only through an entry in
`.gauntlet/equivalence-accepted.json` that the spec stage drafted and a human confirmed.

`"scope": "all"` (a clean-up requirement: every production file is measured) and ratchet mode (section 6) are set by
the survey when the requirement calls for them.

**Tiered mutation targets** (clean-up requirements, `tiers` in the config, confirmed by the human at the survey
checkpoint): each production file belongs to the first tier whose `paths` match it, and each tier has its own
`mutationScoreMin` — a number, or `"ratchet"` = not below the score recorded with `baseline --mutation` (it only
rises). `mutate`, the gate, `next` and the evidence pack judge per tier; survivors in a tier that already meets its
target are not on the punch list. Record the baseline only from a complete run, and only where your stage skill says.

**First look at `adapter` in `.gauntlet/gauntlet.config.json`**; it decides how the gates build, test and analyse:

| adapter | For | Toolchain notes (all the how-to lives here) |
|---|---|---|
| `commands` (also when no adapter is set) | any project: its own build / test / lint commands + standard reports | **gauntlet-adapter-commands** skill |
| `cmake-clang` | optional deep analysis: the project already builds with CMake and compiles with clang as-is | **gauntlet-adapter-cmake** skill |

Stage skills say *what* to do; for *which tools and how*, read only **your stage's section** of the matching adapter
skill and skip the other adapter skill.

The paths `.gauntlet/qa/`, `.gauntlet/architecture.json`, `.gauntlet/quality-accepted.json`,
`.gauntlet/mutation-accepted.json` and `.gauntlet/GAUNTLET.md` in the skills are **defaults**; a project can move
them via `paths` in `.gauntlet/gauntlet.config.json` (e.g. `"paths": { "qa": ".gauntlet/handoffs" }`) — the config wins.
The commands below are the same for both adapters; only the underlying tools differ.

| Command | What it does |
|---|---|
| `spec` | Parse `.gauntlet/features/*.feature` (under cmake-clang also lists unimplemented steps) |
| `test` | Build + run all tests + collect coverage; the commands adapter also checks every scenario has a passing acceptance test |
| `static` | **Every** function of every production file: cyclomatic complexity / length / nesting / parameters, warnings, files not analysed |
| `tidy` | Static checks |
| `cppcheck` | Second static analyser (built into cmake-clang, runs when installed) |
| `sanitize` | Run-time checks: AddressSanitizer / UndefinedBehaviorSanitizer over all tests, compute-sanitizer for CUDA tests |
| `dup` | Copy-paste detection: 100+ identical consecutive tokens count as one clone |
| `crap` | CRAP and coverage per function (run `test` first) |
| `arch` | Module dependency direction and cycles (`.gauntlet/architecture.json` or `commands.arch`) |
| `mutate` | Mutation testing on changed lines (`--all` for every production line). Each mutant runs only the test files that **executed its line** (per-test coverage; commands adapter with `commands.testSelect`, falling back to the tests the code graph connects to its file; cmake-clang: ctest via the File API), fast test files first, and mutants run in parallel sandboxes (`mutation.jobs`). Killed results of unchanged functions are reused; survivors are reused while neither the production code nor the **test files that reach them** changed. One run stops after `mutation.maxMinutes` (default 45): the rest is NOT_RUN, the score is shown as "incomplete", and the next run continues. `gate --profile full` audits a sample of the reused results on the whole suite; `--fresh` re-tests everything |
| `compare <expected> <actual>` | Frame-by-frame binary comparison of two files (ad hoc; the gate uses `equivalence`) |
| `equivalence [--force]` | Build the original (base) and this branch with the release build, run `equivalence.cases` on both, compare every output |
| `release` | The release build (`commands.release`): the binary QA and the demos run — never the coverage-instrumented one |
| `diagram <candidate.json>` | Validate and render an architecture diagram with Archify (every box/arrow must cite real source) |
| `gate --profile <p>` | **Your acceptance criterion**: runs the stage's gates, writes `gate.json`. Gates that read only production code (static, tidy, cppcheck, dup, arch) reuse their last result while production code and config are unchanged (shown as `♻`) |
| `next --profile <p>` | Runs the gates, writes a prioritised punch list and decides whether to continue (section 7) |
| `shards --profile <p>` | Splits a stage's open items by module into shards with disjoint production files (section 4a) |
| `baseline --mutation` | Records the `"ratchet"` tiers' scores from the last complete mutation run (only rises) |
| `graph [file…]` | Code graph (codebase-memory-mcp, **required**): which test files reach these production files. Use it to find the table a new test row belongs in, instead of reading the whole test tree |

Every command is `node .gauntlet/gauntlet.mjs <command>`. Gates per profile:

| profile | Gates |
|---|---|
| `specifier` | scenario syntax |
| `coder` | + build, all tests |
| `pin` | build, all tests, coverage, mutation (per tier), equivalence — **no** complexity gates: pins existing behaviour before a clean-up refactors it |
| `cleaner` | + measurement scope, function quality, warnings, static checks (incl. cppcheck), duplication, CRAP, architecture, equivalence with the original program |
| `hardener` | + coverage, run-time checks (sanitizers), mutation testing |
| `full` | + QA, requirement constraints |

It passes only when the last line of the output is `GATE <profile>: PASS`.

## 4a. Working on a shard (several agents on one stage)

A big stage (pin, clean, harden in a clean-up) is split into **shards**: groups of production files that do not
overlap, each sized for one session. Several agents work on them at the same time. If your task has a `Shard:` line:

- Work **only in the shard's directory** the task names (a git worktree on its own branch beside the repository).
  `cd` there first; every command runs there.
- `next --profile <p> --reset` there judges **only your shard's files** (the scope line says `分片 <id>`): its
  static analysis, CRAP, coverage and mutation cover exactly those files, whole, by the full thresholds.
- Change **only your shard's production files**. Put new tests in **new test files named after your shard's module**
  (e.g. `tests/<module>-<topic>.test.mjs`), so parallel shards never edit the same file. Add a row to an existing
  shared test file only when nothing else works, and say so in the result.
- Commit on the shard's branch after every batch. **Do not merge, rebase or push** — the Leader merges all shards.
- Finish with the result block as in section 6, with `shard: <id>` under `stage:`. A shard that cannot finish
  (STALLED / BUDGET / context) still commits what it has and says what is left.

## 5. Forbidden (any one of these voids the stage)

- Editing `.gauntlet/architecture.json`, `.gauntlet/gauntlet.config.json` (especially `sources`, `exclude`,
  `thresholds` — **narrowing what is measured or loosening a threshold is cheating**), `.gauntlet/qa/constraints.json`
  or the tool code under `.gauntlet/`. (Exceptions: stage 0 drafts config / architecture rules and stage 1 drafts
  `.gauntlet/qa/constraints.json`, always marked "needs human confirmation".)
- Creating, rebuilding or loosening the ratchet baseline `.gauntlet/baseline.json` (`baseline` / `baseline --reset`,
  hand-editing values). Only the stage-0 survey drafts it (human-confirmed); afterwards only `baseline --tighten`
  (which only tightens) may run.
- Hiding problems in `.gauntlet/quality-accepted.json` / `.gauntlet/mutation-accepted.json`. They hold only
  exceptions that **truly cannot be removed**, each with a concrete reason; the evidence pack lists every entry for
  human review and the verdict becomes "needs your confirmation". A `"kind": "low-value"` mutant entry is only for
  the wording of a message or a log line the arid patterns missed (gauntlet-harden) — never for a condition, a
  comparison, a number, a return value or anything a verdict depends on.
- Declaring a requirement "out of scope" or "not verified this time". If it cannot be done, finish with NEED-HUMAN.
- Deleting, skipping or commenting out existing tests or acceptance scenarios; weakening assertions to pass.
- Regenerating or editing approved snapshots / golden-master files (`--test-update-snapshots`, rewriting an
  `.approved` file, …) after the stage that created them. A snapshot that no longer matches means behaviour changed:
  find out why and restore it. Only the pin stage creates them; a requirement that changes an output goes through the
  spec stage like an equivalence exception.
- Changing the meaning of `.gauntlet/features/*.feature` (outside the spec stage only typo fixes, and say so).
- Changing `equivalence` (cases, tolerances) or `commands.release` after the survey, or making a case skip the
  outputs that differ; adding entries to `.gauntlet/equivalence-accepted.json` outside the spec stage.
- Detecting the test environment with `#ifdef`, macros or special branches.
- Claiming a pass without pasting the gate output.

## 6. Finishing a stage (result format)

When the stage ends, return this `GAUNTLET-RESULT` block as your final output to the Leader (it is the result of
this invocation). Commit first.

```
GAUNTLET-RESULT: PASS          # or FAIL / NEED-HUMAN
stage: 2-code
profile: coder
branch: gauntlet/<short-name> @ <short commit hash>
gates: spec ✅ build ✅ tests ✅ (25/25)
loop: rounds=<next rounds> distance=<first distance> -> <last distance>
summary: one or two sentences on what you did
next: hints for the next stage (optional)
```

A shard adds `shard: <id>` under `stage:`. A **plan** run (the task says `(plan)`, see the stage skill) that leaves work
for shards ends with `GAUNTLET-RESULT: FAIL` and adds `shards: <n> (<total> items) — s1: <files/label>; s2: …` so the
Leader can open them; a plan run whose gate already passes ends with PASS and no shards.

- **PASS** → every gate meets its threshold. The Leader passes the human checkpoint and dispatches the next stage.
- **FAIL** (`next` reported STALLED: the distance to the thresholds did not shrink for several rounds) → paste the
  failing gates and the key points of next.md; the Leader decides where the rework goes.
- **NEED-HUMAN** (`next` reported BUDGET: the stage's round or time budget is used up) → paste next.md's budget line,
  the remaining distance and the progress per round; a human decides whether to continue, split the requirement or
  change the scope.
- **NEED-HUMAN** (ambiguous requirement / missing tool / architecture change / a rule would have to be loosened)
  → state the concrete problem and options A/B; the Leader asks the user and waits.
  - **Denied operations**: as a delegated sub-agent, anything that needs approval (installing tools, downloading,
    writing outside the repository, …) is denied automatically. Do not retry or rephrase around it: in the summary
    give the **exact command** (one line, which directory, which shell) and why it is needed; the Leader asks the
    user, runs it, and dispatches your stage again.

### Ratchet mode (`"ratchet": { "enabled": true }` in `.gauntlet/gauntlet.config.json`)

The older alternative to change scope, kept for projects that already use it. `.gauntlet/baseline.json` records the
quality debt that existed when Gauntlet was introduced:

- Debt in the baseline (offending functions, under-covered files, old warnings, old clones, …) passes **as long as it
  does not get worse** and does not show up in the punch list;
- anything not in the baseline (new functions, warnings, clones) must meet the thresholds; **changed lines** must
  meet the coverage threshold;
- mutation testing mutates changed lines only;
- an old function you touch may get a bug fix, but must not become longer, more complex or less tested — `next`
  reports "worse than baseline".

## 7. The loop: stop when the metrics pass, hand over when the budget is spent

A stage is complete when its metrics meet the thresholds (CRAP, complexity, coverage, mutation score, …). Each
stage's loop also has a **budget** — `loop.maxRounds` rounds and `loop.maxHours` hours of *active* time (default
20 rounds / 4 hours; time spent waiting for a human does not count). When it is used up you stop and hand over
instead of running on. Drive the loop with `next`:

- First time in this stage (starts a new loop): `node .gauntlet/gauntlet.mjs next --profile <your profile> --reset`
- After each batch of fixes: `node .gauntlet/gauntlet.mjs next --profile <your profile>`
- When re-dispatched after an interruption, do **not** `--reset`; continue the existing loop.

| Exit code | Verdict | What you do |
|---|---|---|
| 0 | DONE | every gate passes → finish with PASS (section 6) |
| 1 | CONTINUE | fix the top of the punch list (`.gauntlet/out/next.md`; fix related items together), run `next` again |
| 3 | STALLED | the distance did not shrink for several rounds → stop, finish with FAIL / NEED-HUMAN, put next.md's key points in the summary |
| 4 | BUDGET | still improving but the stage's round / time budget is spent → stop, finish with NEED-HUMAN, paste next.md's budget line and the remaining list |

"Distance" = number of open items + how far each measured value exceeds its threshold, so bringing one function from
CRAP 182 down to 40 counts as progress. Do not stop on your own before DONE / STALLED / BUDGET, and never make the
distance smaller by changing thresholds, widening `exclude` or writing accepted files (section 5).

`next` is incremental, so later rounds are much cheaper than the first:

- From the second round on it **re-runs only the gates that failed last round** and only the tests that can reach
  the change (build and tests always run); gates that passed are carried over. When the failing ones pass it
  automatically runs the complete gate on the whole suite once more and only then reports DONE.
- While it runs, the kit writes `.gauntlet/out/progress.json` (step, k/N, the file and function being worked on, an
  estimate of the time left); the user watches it in the workflow panel. You do not need to read it.
- A surviving mutant is re-tested only when the production code or a **test file that reaches it** changed;
  otherwise its last result is reused (marked as reused). So **add test rows to the file next.md names under
  "能到达它的测试" (tests that reach it)**; a row added elsewhere does not get that mutant re-tested.
- "N mutants not tested this round (mutation.maxMinutes)" needs no code change: deal with the listed survivors and
  run `next` again; it continues where the last run stopped.
- Reused results can never turn a gate green: DONE only comes from a complete run, and `gate --profile full`
  audits a sample of every reused result on the whole suite (any disagreement re-tests them all).

**Fix a batch per round, not a single item**: everything open in the same function or file goes in one round.

## 8. Writing tests: table-driven, and stop when it is enough

A test is worth its assertions, not its count. The gates want every behaviour pinned by an assertion (coverage, zero
surviving mutants), not as many tests as possible.

- **Several inputs/outputs of the same function or behaviour are one table + one test** (parameterised):
  JS `for (const [input, want] of cases) test(\`… [${input}]\`, …)` or `test.each`; Python
  `@pytest.mark.parametrize`; GoogleTest `TEST_P` or a loop + `SCOPED_TRACE`; Go
  `for _, tc := range cases { t.Run(tc.name, …) }`; without a framework an array + a loop of assertions.
  Every row carries a name or label, so a failure shows which input broke.
- **To add coverage or kill a mutant, first add a row to an existing table** (the boundary, boundary ±1, the other
  half of a condition); do not write a new test function for one mutant.
- A row is worth keeping only if it asserts something no other row asserts: no duplicate rows on the same path with
  the same assertion.
- Duplicated tests written on this branch may be merged into a table (`test` green before and after; coverage and
  mutation score must not drop); **tests that existed before the branch are never touched** (section 5).
- Acceptance tests stay one per scenario (named after the scenario); a Scenario Outline's Examples already are a
  table — generate them with a loop.
- Never delete assertions to "write less", and never cram unrelated behaviours into one big test (a failure would
  not show what broke).

## 9. Small steps

Uncle Bob: small steps and frequent test runs. Make one small change at a time and run `test` (fast) after each;
commit when green (section 2). Run `next` (the full loop round) after a batch of related fixes, not after every edit.
The longer your context, the more mistakes ("lost in the middle") — read only the files this stage needs.
