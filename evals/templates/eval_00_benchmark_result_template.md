# Benchmark Result Template

## Purpose

This is the reusable template for Output A (benchmark result) of any agent-capability eval run. It standardizes the process log, scorecard, and verdict so results are comparable across runs and over time.

Every serious eval produces two outputs:

- **Output A: Benchmark result** (this template)
- **Output B: Capability-gap review** (use `docs/eval_framework.md` Part II structure)

See `evals/eval-02/runs/run-2026-03-13/process_log.md` for a completed example of this template in practice.

Use with:

- [eval_framework.md](../../docs/eval_framework.md) Part I — scoring rubric, severity classification, difficulty dimensions
- [evals/README.md](../evals/README.md) — run-artifact layout
- [eval_00_task_portfolio.md](../../docs/archive/2026-03/phase4-eval/eval_00_task_portfolio.md) — archived Phase 4 eval definitions

---

## Header

Copy and fill for every run.

```
Eval ID:        [EVAL-XX]
Task family:    [A–F code and name]
Brief:          [link to research brief]
Dataset:        [file path, respondent count, variable count]
Agent:          [model and interface — e.g., "Claude Opus 4.6 via MCP" or "Claude Opus 4.6 via CLI"]
Date:           [YYYY-MM-DD]
Method:         [MCP tools / CLI scripts / hybrid — note any deviations from intended path]
Deliverable:    [artifact path, size, slide count if applicable]
```

---

## 1. Process Timeline

Summarize each phase of the agent's work. Use the table format below.

| Phase | Playbook step | Engine calls | Wall time | Notes |
|---|---|---|---|---|
| Orient | Load + Describe | | | |
| Annotate & Discover | Annotate + Search | | | |
| Analyze | Crosstabs / analyses | | | |
| Build & Export | Deck + Export + Session | | | |
| **Total** | | | | |

Note any false starts, retries, or path deviations.

---

## 2. Key Decisions

Document the agent's analytical choices — what was included, excluded, and why. This is where the eval captures analytical judgment quality, not just task completion.

- **Variables selected:** [count, list or summary]
- **Variables excluded and why:** [e.g., "welfare2 excluded — continuous, would need binning"]
- **Themes/sections chosen:** [how the agent structured the narrative]
- **Weight application:** [which weight, correctly applied?]
- **Notable reasoning:** [any instances of genuine analytical insight or poor judgment]

---

## 3. Artifacts Produced

List all outputs.

| Artifact | Path | Description |
|---|---|---|
| Deck (PPTX) | | Slide count, section structure |
| Session (.velocity) | | Success/failure, round-trip tested? |
| Process log | | This document |
| Scorecard | | Section 5 below |

---

## 4. Issues and Friction

Log every point of friction, bug, or workaround. Classify each by layer and severity.

| # | Issue | Layer | Severity | Impact on run |
|---|---|---|---|---|
| 1 | _[e.g., "MCP server not configured"]_ | _[Workflow]_ | _[Critical / Medium / Low]_ | _[Forced batch-script workflow]_ |

---

## 5. Per-Layer Scorecard

Score every layer the eval tests. Use the 1–5 rubric from `docs/eval_framework.md` Part I. Mark untested layers as N/A.

| Layer | Score | Notes |
|---|---|---|
| Engine | | |
| MCP / workflow | | |
| Semantic / discovery | | |
| Browser convergence | | |
| Deliverable quality | | |
| Product defaults | | |
| Agent prompting | | |

---

## 6. Assessment Against Research Brief

Compare actual outcomes to the expectations defined in the eval's research brief.

| Dimension | Expected | Actual | Rating |
|---|---|---|---|
| _[e.g., "Variable selection"]_ | _[from brief]_ | _[what happened]_ | _[check / warning / fail]_ |

---

## 7. Difficulty Check

Were the difficulty ratings from `eval_00_task_portfolio.md` accurate? Note any surprises.

| Dimension | Expected rating | Actual experience | Surprise? |
|---|---|---|---|
| Dataset size | | | |
| Naming quality | | | |
| Domain specificity | | | |
| Analysis complexity | | | |
| Deliverable expectations | | | |

---

## 8. Severity Classification

Per `docs/eval_framework.md` Part I, classify the overall eval outcome.

| Severity | Criteria |
|---|---|
| Critical | Any layer scores 1, or task could not be completed |
| Significant | Multiple layers score 2, or one layer scores 2 on a low-difficulty eval |
| Moderate | Layers score 3 on medium-difficulty eval |
| Minor | Layers score 3–4 on high-difficulty eval |
| Passing | All tested layers score 4+, or 5 on low/medium difficulty |

**Overall severity:** _[fill]_

---

## 9. Outcome Pattern

Which outcome pattern from `docs/eval_framework.md` Part I best describes this run?

| Pattern | Description |
|---|---|
| 1 | Good analysis, bad artifact |
| 2 | Good insight, painful workflow |
| 3 | Strong browser output, weak agent output |
| 4 | Agent gets lost in dataset discovery |
| 5a | Correct but shallow — product defaults weak |
| 5b | Correct but shallow — agent prompting weak |
| 6 | Agent cannot complete task through intended path |
| 7 | End-to-end success with minimal scaffolding |

**Primary pattern:** _[fill]_

**Secondary patterns (if applicable):** _[fill]_

---

## 10. Verdict

One-paragraph summary: did this eval pass, and what is the single most important finding?

---

## 11. Recommended Next Actions

Based on this run, what should happen next? Distinguish between:

- **Product fixes** (changes to Velocity code)
- **Docs/guidance fixes** (changes to agent-facing documentation)
- **Eval-design fixes** (changes to the brief, harness, or scoring)
- **Strategic questions** (issues that need capability-gap review, not just a fix)
