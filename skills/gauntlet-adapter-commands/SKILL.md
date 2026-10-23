---
name: gauntlet-adapter-commands
description: Gauntlet toolchain notes — use when adapter in the target repo's .gauntlet/gauntlet.config.json is "commands" or not set (the universal way, any project). How each stage works in a project of any language, compiler, build system or runtime — report contract, toolchain principles, compiler warnings, coverage, acceptance tests named after scenarios, mutation testing, common problems.
---

# The commands adapter (any language)

Stage skills say *what* to do; this skill says *how* in a non-CMake project. Read only your stage's section.

The gates do not know languages, only **standard reports**; the project says how to produce them in `commands`
in `.gauntlet/gauntlet.config.json`:

| Gate | Source |
|---|---|
| `build` | `commands.build` (optional, not needed for interpreted languages); non-zero exit = failure |
| `tests` | `commands.test.run` runs all tests (unit + acceptance) and writes the JUnit XML listed in `junit` |
| `acceptance` | every Gherkin scenario needs a passing test **whose name contains the scenario name** |
| `coverage` / `crap` | the `lcov` or `cobertura` coverage written by `commands.test`; production files the tests never loaded count as 0% |
| `static` (complexity / length / nesting / parameters) | lizard when installed (~30 languages), else the built-in analyser (C-family + Python) |
| `warnings` / `tidy` | SARIF from the checkers in `commands.lint` (`gate: "warnings"` feeds the warnings gate, otherwise the `tidy` gate) |
| `arch` | exit code of `commands.arch` (0 = no violation), optional SARIF |
| `mutate` | built-in engine (C-family + Python), or the report of an external tool in `commands.mutation` (mutation-testing-report-schema) |
| test selection | `commands.testSelect`: the same test command but with a `{files}` placeholder for the test files to run (reports as in `commands.test`). Each mutant and each focused `next` round runs only the files the code graph selects; without it every mutant runs the whole suite |

`{out}` in commands is replaced by the output directory. Without lint / arch configured the gates do not fail, but
the evidence pack lists them as "needs human confirmation" — if the project already has such tools, configure them.
Every command is killed after `commandTimeoutMin` minutes (default 60).

## Toolchain principles (any compiler, any runtime)

Gauntlet neither knows nor needs to know the compiler or framework; it only needs the **reports** above. So:

1. **Use the toolchain as it is**: whatever compiler, compiler wrapper (MPI, cross-compilers, vendor compilers, …),
   build system and way of running (multi-process launchers, GPUs, job schedulers, …) the project uses goes into
   `commands` unchanged. Never switch compilers or change the build to suit Gauntlet.
2. **Compiler warnings**: no SARIF needed. Nearly every compiler prints `file:line:col: warning: …` or
   `file(line): warning …`; add a full-build command to lint with `"parse": "diagnostics"` and it feeds the warnings
   gate: `{ "name": "compiler", "run": "<full build with the project's usual warning flags>", "parse": "diagnostics" }`
3. **Coverage**: prefer the project compiler's own instrumentation, exported to LCOV or Cobertura with any converter.
   If the compiler cannot do it, a **measurement-only** coverage build (another compiler, separate build directory)
   is allowed, but it is a rule change: record it in the profile and the result (`rules: changed`) for a human to
   confirm; test verdicts still come from the project's own compiler.
4. **Tests that need a special environment** (multiple processes, a specific machine, GPU, licences, …): put them
   into `commands.test` as they are; if this environment cannot run them, NEED-HUMAN stating what is missing —
   never skip them.
5. **Run-time checks (C, C++, Fortran, CUDA and other languages without memory checking)**: build a **separate**
   copy with the project compiler's sanitizer flags (and the GPU run-time checker for GPU code) and run the tests;
   write it as `commands.sanitize`: `{ "name": "asan", "run": "<full build with sanitizer flags + run all tests>" }`.
   Gauntlet reads the sanitizer reports from the output. If the compiler has no sanitizers, say so in the profile
   and leave this out.
6. **No way to produce a standard report**: look for an existing converter in the project's ecosystem first; if
   there is none, NEED-HUMAN naming the missing report.

## 0 Survey (Surveyor)

```
node .gauntlet/gauntlet.mjs init --adapter commands   # add --workdir tmp when the requirement wants intermediate files in tmp
```

1. Fill in the draft from survey.md, following the `$examples` in the generated `.gauntlet/gauntlet.config.json`:
   - `sources`: **all** production code (e.g. `["src/**/*.py"]`, `["cmd/**/*.go", "internal/**/*.go"]`), not just
     what this requirement touches;
   - `commands.test`: the project's existing test command plus the flags that write JUnit and coverage, with the
     report paths in `junit` / `lcov` (or `cobertura`);
   - `commands.testSelect`: the same command, running only `{files}` — e.g. `node --test … {files}`,
     `python -m pytest … {files}`, `npx jest … {files}`, `npx vitest run … {files}`. Run it once by hand with one test
     file to prove it works. **CMake projects tested with ctest** use `{ctest}` instead, plus the build directory:
     `"testSelect": { "run": "ctest --test-dir tmp/build --output-junit … {ctest}", "ctestDir": "tmp/build" }` — the kit
     maps the selected test files to ctest test names through CMake's File API and expands `{ctest}` to `-R "<regex>"`.
     If the test runner cannot select at all (`make check`, …), leave it out and say so in the profile: mutation
     testing will be slower;
   - `commands.lint`: the checkers the project already uses (survey.md lists CI commands and existing config files),
     writing SARIF; for compiled languages add the compiler-warnings entry (toolchain principle 2);
   - `commands.release`: the build that ships (no coverage / sanitizer flags), e.g. a separate Release build directory.
     QA, the demos and the `equivalence` gate use it (gauntlet-survey step 7);
   - `commands.arch`: the ecosystem's module-dependency checker, with a drafted rule file: the core domain does not
     depend on IO, dependencies point only towards more stable modules. If the ecosystem has no such tool, leave it
     out and say so in the profile.
2. `node .gauntlet/gauntlet.mjs doctor` must be all green (every command's program exists, every report path is
   declared, the code graph is installed).
3. These are draft rule files: write "rule files drafted: need human confirmation" in the result. You may **not**
   change an existing config or architecture rules; if they need changing, NEED-HUMAN.

## 1 Spec (Specifier)

Write scenarios in business language. Scenario names must be **unique and stable** — the coder's test names must
contain them.

## 2 Code (Coder)

- Use the project's own test framework (named in `.gauntlet/GAUNTLET.md`).
- **Acceptance-test naming contract**: one test per scenario, the test name contains the scenario name, e.g.
  ```js
  test('a spare scores the next roll as bonus', () => { /* drive the CLI entry / public API */ });
  ```
  For a Scenario Outline, one test per Examples row, named with the outline name, in Examples order:
  ```js
  for (const [input, error] of invalid) test(`invalid input is rejected [input=${input}]`, () => { /* ... */ });
  ```
  Many BDD frameworks name tests after scenarios by default; if the project already uses one, use it.
- Unit tests are table-driven too (gauntlet-core section 8), using the framework's parameterisation:
  ```js
  const cases = [['all zeros', Array(20).fill(0), 0], ['all ones', Array(20).fill(1), 20], ['perfect', Array(12).fill(10), 300]];
  for (const [name, rolls, want] of cases) test(`score [${name}]`, () => assert.equal(score(rolls), want));
  ```
- Acceptance tests drive the application boundary (CLI entry function, HTTP handler, public API), not internal
  functions; internal details belong to unit tests.
- The `ACCEPTANCE` part of `node .gauntlet/gauntlet.mjs test` lists scenarios with no matching test or a failing test.
- Humble object: the real entry file only forwards arguments; logic lives in testable functions. Whether an entry
  file is outside `sources` is a human decision — you never change `sources` / `exclude`.

## 3 Clean (Cleaner)

| Gate | How to pass it with this adapter |
|---|---|
| `scope` | file status `unsupported` = the built-in analyser does not know the language: after lizard is installed (`pip install lizard`, a human runs it) re-run; otherwise NEED-HUMAN |
| `warnings` / `tidy` | fix by the rule in the warning / SARIF; only real false positives go into `.gauntlet/quality-accepted.json` (`kind` `warning` / `tidy`, `check` = `tool/rule-id`) |
| `arch` | invert dependencies according to the architecture tool's output; changing the rule file needs a human |

- The built-in complexity analyser is heuristic (finds functions by braces or indentation): if the function
  boundaries in `static.json` are clearly wrong, say so in the result and suggest installing lizard; never contort
  the code to suit the analyser.

## 4 Harden (Hardener)

- By default the built-in mutation engine is used (C-family, Python, Fortran): each mutant runs `commands.build`
  (if any) and the test command. Files in other languages cannot be mutated by it and the gate **fails** listing
  them: ask a human to configure an external mutation tool (`commands.mutation`); never work around it.
  If the tests are slow, ask a human to configure a faster `commands.mutationTest` (no coverage or reports) — you
  may not change it yourself.
- Mutation operators: comparison / arithmetic / logical operators (with spaces on both sides), `true/false`
  (Python `True/False`, `and/or`), `++/--`, negated conditions, integer constant +1.
- With `commands.mutation` (an external tool writing mutation-testing-report-schema), `mutate` runs that tool and
  reads its report; mutants the tool marks `Ignored` are listed as "accepted" for human review.
- Entry-file behaviour: add a smoke test of the real entry point (run it as a child process, assert output and
  exit code).

## 5 QA / 6 Evidence pack

- The real product is run the way the project normally runs it (the "Build, test, run" section of
  `.gauntlet/GAUNTLET.md`); QA documents and demo scripts use the same commands.
- The architecture diagram's `boundaries` use the modules from the architecture tool's rules.

## Common problems

| Symptom | Fix |
|---|---|
| `commands.test.junit 未配置` / the test command produced no JUnit report | add the flag that writes JUnit to the test command, with the same path as `junit` (use `{out}/junit.xml`) |
| `没有覆盖率报告` (no coverage report) | the test command must write LCOV or Cobertura and the path must be in `lcov` / `cobertura` |
| Coverage paths do not match (every production file at 0%) | paths in the report must resolve relative to the repo root or the command's `cwd`; add `cwd` to the command if needed |
| On Windows, single quotes reach the program literally | commands run through cmd.exe: use double quotes |
| A scenario shows "no matching test" | the test name must **contain** the scenario name verbatim (including punctuation); an outline maps to one test per Examples row |
| `⏱ … killed (commandTimeoutMin)` | a test hangs or the suite is far slower than expected: find it; raising `commandTimeoutMin` is a human decision |
