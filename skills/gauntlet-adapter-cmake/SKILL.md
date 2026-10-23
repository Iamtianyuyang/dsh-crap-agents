---
name: gauntlet-adapter-cmake
description: Gauntlet toolchain notes — use only when adapter in the target repo's .gauntlet/gauntlet.config.json is "cmake-clang" (optional deep analysis: the project already builds with CMake and compiles with clang as-is). How each stage works in a CMake + clang C/C++/CUDA project — init, .gauntlet/architecture.json, GT_STEP step definitions, CMake skeleton, clang static analysis and clang-tidy, CUDA, common local problems.
---

# The cmake-clang adapter (C/C++/CUDA)

Stage skills say *what* to do; this skill says *how* in a CMake + clang project. Read only your stage's section.

Toolchain (checked by `node .gauntlet/gauntlet.mjs doctor`): required cmake ≥ 3.21, ninja, clang, llvm-profdata,
llvm-cov, git, node and the code graph (codebase-memory-mcp); clang-tidy recommended; nvcc for CUDA projects.
Report missing tools as NEED-HUMAN, saying exactly what is missing.

| Gate | How this adapter measures it |
|---|---|
| `test` | generate acceptance tests (C++ scenario tables + CTest registration) + clang coverage-instrumented build + ctest + `llvm-cov export` |
| `static` | clang parses **every** production translation unit (incl. `.cu`): cyclomatic complexity / length / nesting / parameters, `-Wall -Wextra` warnings, files not parsed |
| `tidy` | clang-tidy: bugprone / performance / the clang static analyser |
| `cppcheck` | cppcheck (runs when installed, `cppcheck.mode`): uninitialised data, out-of-bounds, resource leaks, …, complementing clang-tidy |
| `sanitize` | a separate `<buildDir>-asan` built with ASan + UBSan running all tests; with CUDA, compute-sanitizer (found on PATH or in the CUDA install) runs every test |
| `crap` / `coverage` | llvm-cov branch and region data, only for instrumentable functions (CUDA compiled by nvcc cannot be instrumented) |
| `arch` | checks `#include` dependency direction, cycles and unresolvable project includes against `.gauntlet/architecture.json` |
| `mutate` | built-in engine: change one token → incremental build → ctest; CUDA files are really mutated too |

Every ctest test is killed after `commandTimeoutMin` minutes (default 60); mutation runs use a tighter limit.
Test selection is automatic: CMake's File API maps each ctest test to the sources of its executable, so a mutant (or
a focused `next` round) runs only the ctest tests built from test files that reach the change. Register tests per
executable as usual; nothing to configure.

## 0 Survey (Surveyor)

```
node .gauntlet/gauntlet.mjs init                 # when the requirement wants intermediate files in tmp: init --workdir tmp
```

- Generates `.gauntlet/gauntlet.config.json`, `.gauntlet/architecture.json` (template), `.gauntlet/features/`,
  `.gauntlet/acceptance/steps/`, and prints the `gauntlet_add_acceptance(... STEPS_DIR ... GENERATED_DIR ...)` line to
  add to CMakeLists.txt — copy it as is; all acceptance-test directories live in `.gauntlet/`.
- Adapt `.gauntlet/architecture.json` to this project's modules: **every production directory must belong to a
  module** and `includeRoots` must contain every header directory, or the architecture check fails on
  "unresolvable include". Write "rule files drafted: need human confirmation" in the result.
- No CMakeLists.txt yet: do not write one; that is the coder's job.

```json
{
  "modules": {
    "domain": { "paths": ["src/domain/**"], "mayDependOn": [] },
    "app":    { "paths": ["src/app/**"],    "mayDependOn": ["domain"] }
  },
  "includeRoots": ["src", "include"], "forbidCycles": true, "strict": true
}
```

You may **not** change an existing `.gauntlet/architecture.json`; if the requirement needs an architecture change,
raise it as NEED-HUMAN.

## 1 Spec (Specifier)

Write scenario parameters so step definitions can be reused: numbers as is, strings in double quotes `"..."`.
Step definitions support the placeholders `{int}` `{float}` `{word}` `{string}` (double-quoted string) `{}`.

## 2 Code (Coder)

1. `node .gauntlet/gauntlet.mjs spec` lists undefined steps and suggests `GT_STEP("...")` for each.
2. Without a CMake project, set up the skeleton first (below).
3. Step definitions go into `.gauntlet/acceptance/steps/<topic>_steps.cpp`. Unit tests use the project's
   **existing** test framework, in the project's usual place (see `.gauntlet/GAUNTLET.md`). Gauntlet only needs the
   tests registered with CTest (`add_test()` or the framework's discovery command): it reads CTest's JUnit report
   and depends on no test framework.

### Writing step definitions

```cpp
#include "gauntlet_acceptance.hpp"
#include "app/cli.h"              // drive the application boundary, not internal details

namespace { struct Run { std::vector<std::string> args; std::string out; int code = -1; }; }

GT_STEP("I enter {string}")        { ctx.get<Run>("run").args = {args.s(0)}; }
GT_STEP("I run the conversion")    { auto& r = ctx.get<Run>("run"); /* call the system under test */ }
GT_STEP("the output is {string}")  { GT_EXPECT_EQ(ctx.get<Run>("run").out, args.s(0)); }
GT_STEP("the output is:")          { GT_EXPECT_EQ(ctx.get<Run>("run").out, args.doc_string); }
```

- `ctx.get<T>("key")`: state shared within one scenario (fresh for every scenario).
- `args.s(i)` / `args.i(i)` / `args.d(i)`: the i-th captured argument; `args.doc_string`; `args.table`.
- Assertions: `GT_EXPECT(cond)`, `GT_EXPECT_EQ(actual, expected)`, `GT_EXPECT_THROWS(expr)`, `GT_FAIL("msg")`.
- A step text may match only one definition (ambiguity is an error).

### CMake skeleton (new projects without one)

```cmake
cmake_minimum_required(VERSION 3.21)
project(myapp CXX)
set(CMAKE_CXX_STANDARD 17)
include(.gauntlet/cmake/Gauntlet.cmake)

add_library(myapp_domain src/domain/xxx.cpp)
target_include_directories(myapp_domain PUBLIC src)
add_library(myapp_app src/app/cli.cpp)
target_link_libraries(myapp_app PUBLIC myapp_domain)
add_executable(myapp src/app/main.cpp)          # humble main: only forwards argv
target_link_libraries(myapp PRIVATE myapp_app)

# Unit tests: use the project's framework if it has one; otherwise the simplest is a dependency-free test program
# (non-zero exit = failure), one add_test per program, so the CTest report shows which one failed.
add_executable(unit_domain tests/unit/domain_test.cpp)
target_link_libraries(unit_domain PRIVATE myapp_domain)
add_test(NAME unit.domain COMMAND unit_domain)

gauntlet_add_acceptance(LINK myapp_app
  STEPS_DIR ${CMAKE_SOURCE_DIR}/.gauntlet/acceptance/steps
  GENERATED_DIR ${CMAKE_SOURCE_DIR}/.gauntlet/acceptance/generated)
```

- **Test framework**: if the project has no tests yet, prefer a framework already installed on this machine
  (visible in survey.md / `.gauntlet/GAUNTLET.md`) and register cases with its CTest discovery command for finer
  failure reports. Dependencies downloaded at build time (`FetchContent`, …) break the build on offline servers and
  are a new dependency: a rule change, reported as `rules: changed` for a human to confirm.
- Inject `std::ostream&`, clocks and filesystem interfaces for behaviour; headers hold declarations only; no logic in
  macros.

## 3 Clean (Cleaner)

| Gate | How to pass it with this adapter |
|---|---|
| `scope` | parse failure: fix the compile flags (`static.extraArgs` / `static.cudaPath` in `.gauntlet/gauntlet.local.json`); a source file "not built": wire it into the build, or delete it if it really is dead code; if neither is possible, NEED-HUMAN |
| `warnings` | fix `-Wall -Wextra` warnings; never silence them with pragmas |
| `tidy` / `cppcheck` | fix as suggested; false positives go into `.gauntlet/quality-accepted.json` (`kind` `tidy` / `cppcheck`) |
| `arch` | invert dependencies; extending `includeRoots` needs a human |

- CUDA kernels are measured too: move branches inside kernels into `__device__` functions.
- CPU/GPU merge tasks: move shared logic into a shared module; backends keep only what truly differs (CPU loop vs CUDA
  kernel). A new module must go into `.gauntlet/architecture.json` — ask for human confirmation via NEED-HUMAN.
- Example exceptions (`.gauntlet/quality-accepted.json`):
  ```json
  [
    { "kind": "tidy", "file": "gpu/src/x.cu", "check": "clang-analyzer-core.NullDereference", "reason": "d_buf is only reached after cudaMalloc succeeded on line 40; the analyser does not understand the CUDA API's return contract" },
    { "kind": "unbuilt", "file": "cpu/src/fd_mpi.c", "reason": "MPI variant; the server has no mpicc, a human confirmed it is not built this time" }
  ]
  ```

## 4 Harden (Hardener)

- `mutate --files cpu/src/x.c,gpu/src/y.cu` re-runs only those files while you work; at the end of the stage the
  complete `next` / `gate` run is what counts.
- Code that cannot be instrumented (CUDA compiled by nvcc) is still really mutated and tested; its survivors usually
  mean the GPU path has no tests.
- Survivors in the program entry (main): add a CTest smoke test of the real executable
  (`add_test(NAME ... COMMAND <exe> <args>)` + `PASS_REGULAR_EXPRESSION`); never exclude main.
- On Windows the sanitizer build uses the release CRT and the DLL sanitizer runtime (clang's ASan does not support
  the debug CRT). "Sanitizer runtime not usable on this machine" usually means LLVM is older than the OS: note it in
  the result and under "Pitfalls" in `.gauntlet/GAUNTLET.md`; it is not your failure.

## 5 QA / 6 Evidence pack

- The shipped product is the release build in `<buildDir>-release` (default `.gauntlet/build-release/`), built by
  `node .gauntlet/gauntlet.mjs release` — `buildDir` itself is coverage-instrumented and only for measuring.
- Demo scripts and QA documents call `.gauntlet/build-release/<app> ...` (`tmp/build-gauntlet-release/<app>` with
  `--workdir tmp`).
- The architecture diagram's `boundaries` use the modules in `.gauntlet/architecture.json`.

## Common problems

| Symptom | Fix |
|---|---|
| `undefined: ...` | the step has no definition, or the wording differs (watch punctuation, full-width vs half-width characters, spaces) |
| `ambiguous step` | two `GT_STEP` patterns match: tighten one of them |
| clang reports an STL version mismatch | a local problem: add `-D_ALLOW_COMPILER_AND_STL_VERSION_MISMATCH` in `.gauntlet/gauntlet.local.json` and note it in the result; do not change CMakeLists |
| no `.profraw` files | the tests are not registered with CTest: check `add_test()` (or the framework's discovery) and `gauntlet_add_acceptance` |
| `⏱` / ctest timeout | a test hangs or is far slower than expected: find it; raising `commandTimeoutMin` is a human decision |
