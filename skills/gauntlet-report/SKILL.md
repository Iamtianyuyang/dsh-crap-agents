---
name: gauntlet-report
description: Gauntlet stage 6 (Reporter) — final full re-verification of the gates, record the demos, write the user tutorial, generate the visual evidence pack (single-file HTML report + dashboard summary), commit on the local branch and hand it to the Leader for the user's review (the Leader pushes and opens the PR after approval). Also produces a partial evidence pack on request when a stage is stuck. Lets a human review in 5 minutes instead of reading code.
---

# Evidence stage (Reporter)

AI writes code far faster than humans can read it. So humans do not read the code; they read your **evidence pack**:
a one-page verdict, demos of real runs, a tutorial they can follow, and machine-made proof of quality.

## Two modes

The task prompt says which one:

- **Final** (default): every earlier stage passed. Re-verify everything; finish with PASS only if `full` passes.
- **Partial** (the prompt says `Mode: partial`): a stage stopped with STALLED / BUDGET and the user wants to see where
  things stand instead of waiting longer. Build the evidence pack from the current state **even though gates fail**,
  so the human can decide with evidence in hand. In partial mode:
  - run `gate --profile full` once and keep its result even if it fails (it is the honest picture);
  - skip what is impossible (no QA report yet → no demos from QA, no tutorial if there is no working feature yet)
    and say so in the result;
  - never run `baseline --tighten`;
  - finish with **NEED-HUMAN** (never PASS), listing the failing gates and the evidence location.

## Steps

1. Confirm you are on the work branch (gauntlet-core).
2. **Re-verify** (do not trust earlier stages' word):
   ```
   node .gauntlet/gauntlet.mjs gate --profile full --title "<requirement title>"
   ```
   **Run it exactly once.** It is the slowest command of the whole pipeline (the whole suite, sanitizers, the
   mutation audit, the equivalence builds). Writing the tutorial, the diagram and the evidence pack afterwards does
   not invalidate it: `gate.json` records the production code it measured, and the evidence pack only asks for a
   re-run if production code changed since. Never re-run it to "refresh" the numbers.
   `full` re-runs every static gate on the change set, runs the whole test suite, and audits a random sample of the
   reused mutation results — kills and survivors — on the whole suite (`mutation.audit`); one disagreement re-tests
   all of them automatically. With tiered targets the evidence pack shows the score per tier; a mutation run that
   did not finish shows "incomplete (n/total)" — never present such a partial score as the mutation score. Do not add `--fresh` "to
   be safe" — it re-runs mutation testing from scratch, hours on a large project.
   Final mode: not PASS → finish with FAIL, paste the failing gates; the Leader decides where to send the work back.
   PASS with ratchet mode on: run `node .gauntlet/gauntlet.mjs baseline --tighten` to lock this change's improvements
   into the baseline (it only tightens) and commit it with the tutorial etc.
3. Record the demos: for every script in `.gauntlet/demo/*.json` run
   `node .gauntlet/gauntlet.mjs demo .gauntlet/demo/<x>.json` (replayable terminal recordings go to
   `.gauntlet/out/evidence/demos/`).
4. QA report: make sure the branch has `.gauntlet/qa/qa-report.json` (committed by the QA stage) with verdict pass;
   if not, finish with FAIL (final mode) or note it (partial mode).
5. Write the user tutorial `.gauntlet/docs/<topic>.md` (committed, useful long-term):
   - what it does (3 points at most)
   - getting started in three steps (build, the most common command, what you see)
   - an input/output rules table (normal + error cases + exit codes)
   - how to call it from scripts or code
   - screenshots may be referenced: `![caption](../qa/media/x.png)`
   Write for "a colleague who will use this feature tomorrow", not for a programmer reading the implementation.
6. **Draw the architecture diagram** with [Archify](https://github.com/tt-a1i/archify): the real structure of the
   delivered code.
   - The first `node .gauntlet/gauntlet.mjs diagram` clones the tool into `tools/archify/` in the output directory;
     before drawing read its `archify/SKILL.md` and `archify/references/repository-authoring.md` (if an archify skill
     is bound, follow that skill).
   - Write the candidate `.gauntlet/docs/architecture/<topic>.architecture.json` (committed, reused next time):
     - `meta.repository`: `git remote get-url origin` (strip user names / tokens) + the full 40-character HEAD commit
       of the current branch (the Leader pushes it after approval, then the link works);
     - every component has `sources` (repo-relative path + line range); draw only components and calls you **saw
       yourself** in the source;
     - draw the modules of the architecture rules as `boundaries` (`.gauntlet/architecture.json` or the rules of the
       `commands.arch` tool); keep backends, shared modules and entry points apart.
   - Validate and render:
     ```
     node .gauntlet/gauntlet.mjs diagram .gauntlet/docs/architecture/<topic>.architecture.json
     ```
     On failure fix the candidate according to the output's `diagnostics` (each comes with a concrete suggestion,
     e.g. spacing too small, source line does not exist) and re-run until PASS. If the diagnostics stop shrinking (the
     same errors keep coming back), finish with FAIL and paste them.
   - **Archify unavailable** (`diagram` says it cannot get Archify, e.g. an offline server): not a failure. Say why in
     the result and skip this step; the evidence pack uses an automatic module-dependency sketch instead and lists
     "no Archify diagram" for human confirmation.
7. Generate the evidence pack:
   ```
   node .gauntlet/gauntlet.mjs evidence --title "<requirement title>" --tutorial .gauntlet/docs/<topic>.md
   ```
   Output: `.gauntlet/out/evidence/index.html` (single-file full report, viewable offline) and
   `.gauntlet/out/evidence/comment.md` (dashboard summary).
8. Deliver: put the dashboard summary from `.gauntlet/out/evidence/comment.md` and the location of
   `.gauntlet/out/evidence/index.html` in the result (plus each demo recording and the `diagrams/*.html` architecture
   diagrams). The Leader hands it to the user to review along the "5-minute review route".
9. Commit (tutorial, demo scripts, architecture candidate, tightened baseline). **Do not push or open a PR**: after
   the user approves, the Leader pushes and opens the PR with `.gauntlet/out/evidence/comment.md` as its body.
10. Return the result as in gauntlet-core section 6 — PASS in final mode, NEED-HUMAN in partial mode — with the
    evidence locations (index.html, comment.md, demos, diagrams) and the last commit.

## What the evidence pack shows automatically

| Part | Source | What the human judges with it |
|---|---|---|
| Gate cards | gate.json etc. | all green or any red, at a glance |
| 5-minute review route | generated | in which order to look |
| Acceptance scenarios (natural language + ✅/❌ per step) | features + run results | is the requirement right |
| Demo recordings / screenshots | demo, media | does it really work |
| User tutorial | .gauntlet/docs/*.md | how to use it later |
| CRAP scatter / bar charts | crap.json | what is complex and untested |
| Mutation testing + accepted equivalent mutants | mutation.json | do the tests really pin the code; did the agent cheat |
| Architecture diagram (Archify, cites real source) | .gauntlet/docs/architecture/*.json | what the code looks like now |
| Measurement scope / code quality / duplication | static.json, tidy.json, duplication.json | was all code measured, is quality acceptable |
| Requirement constraints / equivalence | .gauntlet/qa/constraints.json, .gauntlet/qa/equivalence.json | is every demand proven, does output match the original |
| Module dependency graph | arch.json | any boundary-crossing dependencies |
| Change scope / governance-file changes | git diff | did anyone touch thresholds, architecture, accepted lists |

You do not draw these charts by hand; just make sure the inputs are complete (.gauntlet/qa/qa-report.json, demo
scripts, tutorial).

## Rules

- Do not change production code or tests. If you find a problem, FAIL — do not fix it yourself.
- Evidence must come from real runs in this round; never reuse an old .gauntlet/out.
