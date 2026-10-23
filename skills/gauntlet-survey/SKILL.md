---
name: gauntlet-survey
description: Gauntlet stage 0 (Surveyor) — before the spec, learn the target repository (languages, build and test commands, CI, existing quality tools, layout and modules, conventions and pitfalls); install .gauntlet, pick the adapter, fill in and verify .gauntlet/gauntlet.config.json (including graph-selectable tests), decide the measurement scope, build the code graph, and write the project profile GAUNTLET.md that this and every later requirement reuses.
---

# Survey stage (Surveyor)

Every later stage agent starts fresh and knows nothing about this repository. Your job is project research done
**once**: find out how it builds, how it tests, where the code is, what the rules are and what the pitfalls are;
**actually run it**; and write it all into the project profile `.gauntlet/GAUNTLET.md`. Later requirements reuse
it and only refresh it when the repository changed.

You **do not change production code or tests**, and you do not write acceptance scenarios (that is stage 1).

## Steps

1. Read the task and confirm you are on the work branch the Leader created (gauntlet-core sections 1 and 2).
2. **Install / update the tools**: install `.gauntlet/` from the kit as in gauntlet-core section 3 — reinstall even
   if the repository already has one, so the tools follow kit updates (`.gauntlet/VERSION` holds the version).
   Commit any change together with the rest of this stage and write `kit: <old> -> <new>` in the result.
   If the kit source is unreachable (offline) but the repository has `.gauntlet/`, keep using it and say it could
   not be updated; if there is none, NEED-HUMAN as in gauntlet-core section 3. Then:
   ```
   node .gauntlet/gauntlet.mjs survey        # writes survey.md / survey.json into the output directory
   ```
   The last line is the verdict:
   - `UP-TO-DATE`: profile and config exist, no build / CI / quality-config changes since → "Quick check".
   - `REFRESH`: the profile is stale (survey.md lists the changed files) or the config is missing → update only
     what is affected, then "Quick check".
   - `FULL`: no profile → "Full survey".
3. If the repository root has `gauntlet.config.json` (old layout, files spread over the root): do "Moving into
   .gauntlet/" below first, then run `survey` again.

### Moving into .gauntlet/ (once, old-layout repositories only)

Goal: every Gauntlet file lives in `.gauntlet/` (gauntlet-core section 3, "Where files go"); nothing of Gauntlet
remains at the root.

1. `git mv` whichever of these exist: `gauntlet.config.json`, `GAUNTLET.md`, `architecture.json`,
   `quality-accepted.json`, `mutation-accepted.json`, `qa/`, `features/`, `demo/`, `acceptance/steps/` → the same
   names under `.gauntlet/`; `gauntlet-baseline.json` → `.gauntlet/baseline.json`; tutorials the evidence stage
   wrote, `docs/<topic>.md` and `docs/architecture/` → `.gauntlet/docs/` (leave the project's own docs alone).
   `gauntlet.local.json` (not committed) simply moves to `.gauntlet/gauntlet.local.json`.
2. In `.gauntlet/gauntlet.config.json`, delete `outDir`, `buildDir`, `features`, `stepsDir`, `generatedDir`, `paths`
   and `ratchet.baseline` if they still point at old locations (the defaults are the `.gauntlet/` locations);
   replace hard-coded `gauntlet-out/…` in `commands` with `{out}/…`.
   **Only locations change; `sources`, `exclude` and `thresholds` stay exactly as they are.**
3. Change `"cwd": ".."` in demo scripts to `"../.."`; for cmake-clang update `gauntlet_add_acceptance(...)` in
   CMakeLists.txt to the line `init` prints.
4. Remove the old entries under `# gauntlet` in `.gitignore`, run `node .gauntlet/gauntlet.mjs init` (an existing
   config is kept; only the new ignore rules are added), then delete leftover `gauntlet-out/` and `build-gauntlet*/`
   at the root (all generated).
5. Once `node .gauntlet/gauntlet.mjs test` runs, commit together with the profile
   (`[survey] move gauntlet files into .gauntlet/`) and write `rules: changed`.

### Quick check (the profile is still valid)

1. Read `.gauntlet/GAUNTLET.md`, run `node .gauntlet/gauntlet.mjs doctor` (must be all green) and
   `node .gauntlet/gauntlet.mjs test` (must finish and write its reports).
2. Both fine: update only `commit:` in the profile to the current commit (plus any fact that really changed),
   commit, and write `rules: unchanged`.
3. Something fails: the profile is wrong — do the "Full survey".

### Full survey

1. **Read**: survey.md; README / CONTRIBUTING / AGENTS.md / CLAUDE.md and similar docs; the commands CI really runs;
   the build files survey.md lists. Only the parts about building, testing and structure.
2. **Run**: build and run all tests the project's own way once (copy CI's commands where possible); record the
   commands, how long they take and the environment variables they need.
   - If the existing tests already fail on the default branch, or the environment lacks something to run them:
     do not fix it; record it under "Pitfalls" and finish with NEED-HUMAN stating what is missing.
3. **Use the toolchain as it is**: record and configure whatever compiler, wrappers, build system and runtime the
   project uses; never switch compilers or change how it builds (commands adapter skill, "Toolchain principles").
   Use the commands adapter by default; choose cmake-clang only when the project already uses CMake, clang compiles
   it as-is, and deeper analysis is wanted.
4. **Choose the adapter** and configure it (the "0 Survey" section of that adapter skill): `init`, fill in `sources`
   (**all** production code; survey.md has a draft — confirm each directory really is production code), `commands`
   (survey.md has a draft that must be made to really run; the kit hands them to the system shell, cmd.exe on
   Windows — double quotes, no bash-only syntax, see gauntlet-core section 3 "Three shells"), and the architecture
   rule draft (principles in gauntlet-specify, "Architecture draft"). Until:
   ```
   node .gauntlet/gauntlet.mjs doctor      # all green, including "code graph"
   node .gauntlet/gauntlet.mjs test        # finishes and writes test / coverage reports (ACCEPTANCE failing is expected: no scenarios yet)
   ```
   If `doctor` shows ❌ for `code graph`, finish with NEED-HUMAN and hand back
   `npm install -g codebase-memory-mcp`. If it shows ➖ for `testSelect` (commands adapter), configure it now — it is
   what keeps mutation testing proportional to the change (commands adapter skill, "0 Survey").
5. **Scope**: keep the default `"scope": "changes"` — the gates measure what the branch changes, not the whole
   repository, so no repository-wide measurement or baseline is needed. Only when the requirement itself is
   refactoring / cleaning up existing code set `"scope": "all"` (and `"mutation": { "scope": "all" }`), and give the
   reason in the result; the Leader asks the user to confirm. Do not run a whole-repository `gate --profile quality`
   on a large codebase "for information": it costs hours and decides nothing.
   With `"scope": "all"` **tiered mutation targets are required** (`tiers`, gauntlet-core section 4; the gate warns
   without them): one score for ten thousand lines is the wrong goal. Keep the core tier **small** — the files whose
   mistakes would be silent and costly because they decide things (verdicts, numerics, parsing, money, permissions),
   not whole directories — e.g. `mutationScoreMin: 0.8`; everything else (output formatting, reports, UI, glue,
   scripts) `"ratchet"` (must not get worse; golden masters pin it cheaply in the pin stage). Explain each tier in the
   profile; the Leader shows them to the user.
   A clean-up of a large codebase is better done module by module (Uncle Bob's boy-scout rule beats a big clean-up
   sprint): when the requirement covers far more than one module, say so in the result's `next:` and suggest a split
   — the Leader asks the user.
   Mutation skips lines that only log (`mutation.arid`, built-in patterns for logging calls). If the product's user-
   facing output is pinned by golden masters, you may propose adding its output calls (e.g. `^\\s*console\\.log\\(`)
   — that is a rule change the human confirms; say why in the profile.
   For the commands adapter set `commands.mutationTest` to the plain test command with `{files}` and no reporters or
   coverage (e.g. `node --test --test-reporter=dot {files}`): every mutant then runs only the test files that
   executed its line, without instrumentation.
6. **Build the code graph**: `node .gauntlet/gauntlet.mjs graph` (codebase-memory-mcp indexes the code; the hardening
   stage relies on it to skip most mutant re-runs). Record "production files reachable from tests" under "Quality
   today" in the profile. If the share is low (most production files reach no test), add a pitfall: hardening will be
   slower.
7. **Turn the project's red lines into gates.** Read AGENTS.md / CLAUDE.md / CONTRIBUTING / README for rules such as
   "do not change numerical results", "outputs must stay bit-identical", "validate against the baseline". A rule
   written only in the profile is not enforced — every stage after you will treat it as optional. For each one:
   - **Behaviour / numerics must not change** → configure the equivalence gate. Configuring cases is what opts the
     project in: from then on it runs automatically from the clean stage on whenever a branch changes existing
     production code. Projects without such a rule get no cases (most requirements change behaviour on purpose):
     - `commands.release`: the build that ships, without coverage or sanitizer flags (cmake-clang has a default);
       QA and the demos run its binary, never the instrumented one;
     - `equivalence.cases`: one or more real runs of the product that finish in seconds (small model, few steps),
       written so they produce their outputs into `{out}`. Helper scripts go into `.gauntlet/equivalence/` and are
       called through `{kit}`; `{root}` is the tree being run (the original at base, or the branch):
       ```json
       "equivalence": { "cases": [{ "name": "example model, 600 steps",
         "run": "python3 \"{kit}/equivalence/run_example.py\" --exe \"{root}/tmp/build-release/app\" --root \"{root}\" --out \"{out}\"" }] }
       ```
       Default comparison is bit-identical, which is what "must not change" means. Only if the project itself names
       a tolerance, set `tol` — and then also `dtype` / `header` / `frame` matching each output format, or the
       comparison is meaningless.
     - Validate the cases now: `node .gauntlet/gauntlet.mjs equivalence --force` (the original against itself) must
       report EQUIVALENCE: PASS. It also rejects **weak** cases: an output that is all zeros, mostly zeros, or only
       numerical noise (largest value below `minSignal`, default 1e-6) cannot show a change in the program. Run long
       enough that the computation the red line protects really happens (e.g. the wave reaches the receivers and the
       boundary), and compare the outputs that carry it (e.g. the final wavefield, not just a near-empty gather).
       Set `minSignal` only when the project's outputs are legitimately that small, and say why in the profile.
     - **A case must run fixtures that are the same in base and branch**: never the repository's own `.gauntlet/`
       (features, qa, out, config) — the pipeline itself changes those, and a case that reads them can never pass
       after the spec stage (this squad once lost a whole clean round to that). Copy an example or fixture into
       `{out}` and run there.
   - **Every declared entry point needs a load / smoke check.** survey.md lists them ("声明的加载入口": a package's
     main / exports / bin, pyproject scripts). Code that no test imports is invisible to every gate: a removed import
     or a wrong "am I the main module" check passes all tests. For each entry point make sure a test (or an
     equivalence case) loads it the way users do — import the plugin entry with its host modules stubbed, run the
     bin **through a symlink** like a package manager installs it — and write it into the Red lines table.
   - **Other checkable rules** (where files go, forbidden dependencies, …) → the matching gate (`commands.arch`,
     QA constraints, …).
   - Record every red line in the profile's "Red lines" section with how it is enforced (gate name) — or, if it
     cannot be checked by a machine, say so and why. The Leader shows this table to the user.
8. **Watch the clock**: if one full `test` run takes more than ~10 minutes, every mutant pays that cost. Record it
   under "Pitfalls" and in the result's `next:` suggest a faster `commands.mutationTest` (a subset or a run without
   coverage) for a human to approve — you may not set it yourself.
9. **Write the profile** `.gauntlet/GAUNTLET.md` (template below). `base:` is required: survey.md's "branch base"
   gives it; if it says "not found", find out the default branch before writing it, otherwise the change set the
   gates measure cannot be computed (the gates report an error). Commit `.gauntlet/GAUNTLET.md`,
   `.gauntlet/gauntlet.config.json`, the architecture rules, `.cbmignore` (written by `graph`) and
   `.gauntlet/baseline.json` (only in ratchet mode).
   Write `rules: created` (first time) or `rules: changed` (config / architecture rules / baseline changed) in the
   result, plus "rule files drafted: need human confirmation".

## GAUNTLET.md template

The profile is written for **the next agent that starts from nothing**: only facts it needs that are not obvious
from the code; every command is one you actually ran. Whether the profile is stale is judged by **the last commit
that touched GAUNTLET.md** (later build / CI / quality-config changes call for a refresh), so commit the profile
together with config changes.

```markdown
# GAUNTLET.md — project profile

commit: `<short hash when written>`　base: `<default branch>`　updated: <date>　adapter: <commands | cmake-clang>　scope: <changes | all (why)>　test selection: <testSelect / ctest File API / none (why)>

## In one sentence
What this project is and what it delivers (library / CLI / service / GUI).

## Build, test, run (actually run)
| What | Command | Time | Notes |
|---|---|---|---|
| Build | … | … | environment variables, services, data it needs |
| All tests | `node .gauntlet/gauntlet.mjs test` | … | the underlying command |
| Run the product | … | | QA uses this |

## Code map
- Production code: which directories, what each is responsible for; where the entry points are (humble objects).
- Tests: where unit tests live, which framework; where acceptance tests go (new ones follow this).
- Modules and dependency direction: a one-line version matching the architecture rules.

## Existing conventions
- What CI runs and how to reproduce it locally; existing linters / formatters and their config files.
- Naming, error handling, logging, commit-message conventions (only what you actually observed).

## Quality today
- Time of one full test run; code graph: share of production files reachable from tests (from `graph`).
- Only with `"scope": "all"`: the first measurement (offending functions, coverage, warnings, …).

## Red lines
| Rule (where it comes from) | Enforced by |
|---|---|
| e.g. "numerical results must not change" (AGENTS.md) | `equivalence` gate: 1 case, bit-identical |
| e.g. "intermediate files only in tmp/" (AGENTS.md) | config: buildDir / outDir under tmp/; QA constraint |
| e.g. "review by a domain expert" (CONTRIBUTING) | not machine-checkable: human review of the evidence pack |

## Pitfalls
- Machine / server issues, slow tests, flaky tests, secrets that are needed but cannot be committed (names only).
```

## Rules

- Every command in the profile must be one you actually ran; mark guesses "unverified".
- Never write the values of secrets, tokens or passwords; never commit machine-specific config (that goes into
  `.gauntlet/gauntlet.local.json`).
- `sources`: better too much than too little — production code that is left out is never measured. If you are not
  sure something is production code, note it in the profile and ask via NEED-HUMAN.
- An existing `.gauntlet/gauntlet.config.json`, architecture rules or baseline may be changed only when the profile is
  stale and the change is really necessary; list every change in the result (`rules: changed`). Loosening thresholds,
  narrowing `sources` or loosening the baseline is never allowed (gauntlet-core section 5).
- Finish as in gauntlet-core section 6; the summary has one more line than other stages:
  `rules: created | changed | unchanged`. The Leader uses it to decide whether to ask the user.
