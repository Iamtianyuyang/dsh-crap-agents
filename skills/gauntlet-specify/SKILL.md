---
name: gauntlet-specify
description: Gauntlet stage 1 (Specifier) — read the project profile GAUNTLET.md and turn the natural-language requirement into executable Gherkin acceptance scenarios, requirement constraints and a QA procedure.
---

# Spec stage (Specifier)

Uncle Bob: **the acceptance tests are the requirement.** Humans read your scenarios to decide "is this what I
want?", so write them in business language — no function, class or file names.

## Steps

1. Read the task and confirm you are on the work branch (gauntlet-core sections 1 and 2).
2. **Read the project profile `.gauntlet/GAUNTLET.md` first** (written by the stage-0 survey): what the project is,
   the code map, how to run the product, existing conventions. Installing `.gauntlet/`,
   `.gauntlet/gauntlet.config.json`, architecture rules and the ratchet baseline belong to the survey stage; you do
   not change them. If they conflict with the requirement (e.g. a new directory the requirement needs is not in
   `sources`): NEED-HUMAN saying where the conflict is; the Leader sends the work back to stage 0.
3. Write `.gauntlet/qa/constraints.json`: **every explicit demand in the original requirement is one constraint**
   (see "Requirement constraints").
4. Decide the task type. For tasks where **behaviour must not change** — refactoring, merging, porting,
   optimising — set `"requireEquivalence": true` in `.gauntlet/gauntlet.config.json` and write the equivalence plan
   into the QA document (see "Equivalence with the original program").
5. If the project has `equivalence.cases` (its "outputs must not change" red line) and the requirement **intentionally**
   changes one of the compared outputs (a new default, a corrected formula, a new column in an output file), draft
   one entry per affected case/output in `.gauntlet/equivalence-accepted.json`:
   `[{ "case": "<case name>", "file": "<output path in {out}>", "reason": "<which sentence of the requirement changes it, and how>" }]`
   and say "equivalence exceptions drafted: need human confirmation" in the result. Never draft one for an output the
   requirement does not change — the gate exists to catch exactly that.
6. Write `.gauntlet/features/<topic>.feature` (one file per feature; file names in lower-case English with
   underscores).
7. Write `.gauntlet/qa/<topic>.qa.md` (the QA procedure, see the template); every check names the constraint it
   proves.
8. Run `node .gauntlet/gauntlet.mjs gate --profile specifier` until it passes (steps may be "undefined" at this
   stage, but the syntax must be valid and no step may be ambiguous).
9. Commit and finish as in gauntlet-core section 6.

## Requirement constraints (.gauntlet/qa/constraints.json)

Copy out every "must / only / never / where / with what" demand in the requirement, one by one, **in the
requirement's own words** — do not merge, omit or add qualifiers:

```json
[
  { "id": "C1", "text": "Code and test on servers 172.19.133.164, 163 and 162", "verify": "QA builds and runs all tests on each of the three servers and records the host name" },
  { "id": "C2", "text": "Only write inside /public/tianyuyang/code/IFDTD3D-Unified", "verify": "compare directories outside the repo (incl. /tmp, ~/.cache) before and after the run: no new files" },
  { "id": "C3", "text": "All intermediate files go into the tmp folder", "verify": "build / output / log directories are all under tmp/; no new files at the repo root besides sources" }
]
```

- If a constraint cannot be met right now (say one server is unreachable over SSH): write it down anyway and point
  it out with NEED-HUMAN in the result — a human decides whether to fix the environment or change the requirement.
- The `constraints` gate checks that every constraint is proven by a passing QA check; an unproven constraint fails
  the gate.

## Equivalence with the original program (refactor / merge tasks)

"Merge A and B into one program", "refactor", "make it faster" — the criterion is: **the new program produces the
same output as the original for the same input.** Comparing two backends of the new program with each other is not
enough (they can be wrong in the same way). In the QA document, state:

- the baseline: the original program at which commit (usually the default branch when the task started), built in
  a work directory such as `.gauntlet/tmp/baseline/`;
- the case matrix: every solver × every backend × at least two grid sizes;
- the outputs compared: every kind of output file (snapshots, seismograms, …), with data type, header bytes and
  elements per frame;
- the tolerance: `--exact` where results can match bit for bit; where floating-point reordering prevents that, a
  tolerance and the reason for it.

## Rules for scenarios

- English and Chinese keywords both work: `Feature/功能`, `Background/背景`, `Scenario/场景`,
  `Scenario Outline/场景大纲`, `Examples/例子`, `Given/假如`, `When/当`, `Then/那么`, `And/而且`, `But/但是`.
  Write scenarios in the language the user wrote the requirement in.
- Each scenario verifies **one** behaviour; `When` appears once.
- Cover boundaries with `Scenario Outline + Examples`: minimum, maximum, just out of range, empty input, invalid input.
- Every rule of the requirement gets at least one positive and one negative example (error handling is a requirement).
- Stable parameters: numbers as is, strings in double quotes `"..."` (step placeholders for the cmake adapter are in
  its skill).
- Scenario names are unique and stable: the commands adapter matches acceptance tests by "test name contains the
  scenario name".
- Multi-line output uses a doc string:
  ```gherkin
  Then the output is:
    """
    first line
    second line
    """
  ```
- Reuse steps with identical wording ("I run the conversion" must not appear elsewhere as "run a conversion").

## When the requirement is ambiguous

Do not guess. List the questions (each with options A/B and your recommendation) and finish with `NEED-HUMAN` as in
gauntlet-core section 6. Write and commit the parts that are already clear.

## QA procedure template (.gauntlet/qa/<topic>.qa.md)

```markdown
# QA: <feature name>

Prerequisites: how to build, where the real product is, how to run it (adapter skill, "5 QA")

| # | Check | Action (real command or UI action) | Expected | Proves |
|---|---|---|---|---|
| 1 | normal conversion | `roman 2026` | prints `MMXXVI`, exit code 0 | C1 |
| 2 | invalid input | `roman IIII` | stderr contains `not a valid`, exit code 2 | C2 |
```

Every constraint needs at least one check that proves it.

QA works on the **real product** (executable, a library's example program, the GUI) and complements the
acceptance scenarios: scenarios verify behaviour in-process, QA proves the deliverable really works.

## Architecture draft

Split by "deep modules, narrow interfaces" (Ousterhout): the core domain logic is one module and depends on no IO;
the application / CLI / UI layer depends on the domain; third-party adapters are a separate module. Dependencies
point only towards more stable modules. **Every production directory must belong to a module.**

Where and in what format the rules live depends on the adapter: cmake-clang uses `.gauntlet/architecture.json`;
commands uses the rule file of the tool in `commands.arch`. You may **not** change existing architecture rules; if
the requirement needs an architecture change, raise it as `NEED-HUMAN`.
