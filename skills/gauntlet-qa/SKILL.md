---
name: gauntlet-qa
description: Gauntlet stage 5 (QA) — execute every check in .gauntlet/qa/*.qa.md against the real built product, record a deterministic pass/fail report .gauntlet/qa/qa-report.json (committed to the branch), and write replayable demo scripts .gauntlet/demo/*.json.
---

# QA stage

Acceptance tests verify behaviour in-process; you verify that **what is actually delivered** works — the real
executable, real inputs and outputs, real exit codes. You never change production code or tests.

## Steps

1. Read the task and confirm the branch (gauntlet-core).
2. Build the product the way it ships: `node .gauntlet/gauntlet.mjs release` (no coverage or sanitizer
   instrumentation — instrumented binaries can produce different numbers). Run that binary in every check and in the
   demo script; where it is and how to run it: the project profile and the adapter skill, section "5 QA".
3. Open `.gauntlet/qa/*.qa.md` and **really execute every check**, recording the actual results verbatim.
4. **Prove every requirement constraint in `.gauntlet/qa/constraints.json`** (below). Each constraint needs at least
   one check; the check carries `"constraint": "C1"`.
5. Equivalence with the original program is checked by the `equivalence` gate from the configured cases. If the QA
   document plans further comparisons than those cases cover, do them as golden-sample comparisons (below) and
   record them in `.gauntlet/qa/equivalence.json`.
6. Write `.gauntlet/qa/qa-report.json` (format below) and **commit it** — the next stage runs in another workspace
   and only sees committed files. If any check does not match its expectation, `verdict` is `fail`.
7. Write the demo script `.gauntlet/demo/<topic>.json` (committed; the evidence stage records it) and try it:
   `node .gauntlet/gauntlet.mjs demo .gauntlet/demo/<topic>.json`
8. Finish (gauntlet-core section 6):
   - all pass → PASS
   - failures → FAIL; the summary says which checks failed and what you actually saw; the Leader sends the work
     back to the code stage
   - a constraint cannot be verified (server unreachable, missing tool, …) → NEED-HUMAN. You may **not** write
     "not verified this time / out of scope" and report PASS.

## A known gap is still a fail

A check whose expected result did not happen is `fail` — even when a human already decided to accept the gap (for
example, a mutation score left below its target at an approved budget cap). Record it as `fail`, put the human's
decision in the check's note ("accepted by the human as a known gap, not met"), and leave the constraint it proves
unproved. The `qa` and `constraints` gates then show the gap honestly; the evidence pack is where the human weighs
it. Marking such a check `pass` hides the gap from every gate that reads the report — that voids the stage.

## Keep runs bounded

The product may run for a long time (simulations, large inputs). Use the smallest input that proves the check;
give long runs an explicit time limit in the command you run (the project's own option, or your shell's timeout).
If a run takes far longer than the profile says it should, stop it and record it as a failed check with what you
observed — never wait on it open-ended.

## qa-report.json format

```json
{
  "verdict": "pass",
  "summary": "one-sentence conclusion",
  "environment": { "hosts": ["node03 / 172.19.133.164"], "commit": "<full sha>", "workdir": "..." },
  "checks": [
    { "id": "Q1", "title": "year to Roman numerals", "action": "roman 2026",
      "expected": "MMXXVI, exit 0", "actual": "MMXXVI, exit 0", "status": "pass", "constraint": "C1" }
  ]
}
```

`actual` must be the output you really saw (it may be truncated), never a copy of `expected`. A check that proves
several constraints uses an array: `"constraint": ["C1", "C3"]`.

## Proving requirement constraints

- **Several servers**: build and run all tests on each one; `actual` records the host name (`hostname`) and the
  result. One check per server.
- **Only write into one directory**: `node .gauntlet/gauntlet.mjs leak-check --mark` before running the program and
  `node .gauntlet/gauntlet.mjs leak-check` after (by default it checks the temp and home directories, the repository
  itself does not count; use `--roots` for other places). Only `LEAK-CHECK: PASS` passes. System noise unrelated to
  the program (browser caches, …) may be dropped with `--ignore`, but `actual` must list each ignored item and why.
- **Intermediate files in tmp**: in `git status --porcelain --ignored`, no new ignored or untracked files may
  appear outside `tmp/`.

## Equivalence with the original program (golden samples)

1. Check out and build the baseline inside the work area, e.g.
   `git worktree add .gauntlet/tmp/baseline <baseline commit>`, then build the original program in
   `.gauntlet/tmp/baseline` the way the original project builds.
2. Run the original and the new program on the same input; each case writes to
   `.gauntlet/tmp/equiv/<case>/{old,new}/`. The case matrix follows the QA document: every method × every backend ×
   at least two sizes.
3. Compare and record every output file:
   ```
   node .gauntlet/gauntlet.mjs compare .gauntlet/tmp/equiv/stencil-cpu/old/snap.bin .gauntlet/tmp/equiv/stencil-cpu/new/snap.bin --dtype f32 --header 0 --frame 2097152 --tol 1e-6 --name "stencil · cpu · 128³ · snapshot" --record .gauntlet/qa/equivalence.json
   ```
   Use `--exact` where results match bit for bit. Mismatched NaN/Inf positions always fail.
   **Text output** (logs, CSV, JSON, printed tables, …) uses `--text`: compared line by line, words must match
   (whitespace ignored), every number compared numerically (equal by default; `1.0`, `1.00` and `1.0D+00` count as
   equal; for a tolerance use `--tol <relative>` / `--atol <absolute>` and give the reason):
   ```
   node .gauntlet/gauntlet.mjs compare .gauntlet/tmp/equiv/case1/old/out.csv .gauntlet/tmp/equiv/case1/new/out.csv --text --name "case1 · output table" --record .gauntlet/qa/equivalence.json
   ```
4. Commit `.gauntlet/qa/equivalence.json`; the evidence pack draws every entry as a table and an error bar chart.

## Demo script format (.gauntlet/demo/<topic>.json)

```json
{
  "title": "roman: Arabic ⇄ Roman numerals",
  "cwd": "../..",
  "steps": [
    { "say": "Convert this year to Roman numerals" },
    { "run": "roman 2026" },
    { "say": "Invalid input is rejected with exit code 2" },
    { "run": "roman IIII", "expectCode": 2 }
  ]
}
```

- `cwd` is relative to the script's directory (scripts live in `.gauntlet/demo/`, so `"../.."` is the repo root).
- Commands run in a POSIX shell (Git Bash on Windows, automatically); use `/` in paths. Each step is killed after
  `timeoutSec` (default 30).
- A demo tells a **user story**: the most common use first, then one error case. 3–6 commands are enough.

## GUI / non-CLI projects

If the deliverable is a GUI or a service:
- whatever can be driven from the command line (`--help`, headless mode, HTTP endpoints with `curl`) still goes into
  the demo script;
- take screenshots where possible: PNGs go into `.gauntlet/qa/media/` and are committed (the evidence pack embeds
  them); name the file in the check in qa-report.json.
