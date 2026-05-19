# Phase 4 Synthesis Template

## Purpose

This is the structured template for agent-capability strategic synthesis reports. The original Phase 4 plan is archived at `archive/2026-03/phase4-eval/plan_phase4_agent_capability_validation.md`.

After the task portfolio has been executed and capability-gap reviews written, this template guides the final Phase 4 output: a product decision package that determines what to build next and what to stop assuming.

This template should be copied and filled in once S4-EVAL-4 (Capability Gap Review) is complete.

---

## 1. Thesis Statement

Write the honest product claim that current evidence supports. This is the single most important output of Phase 4.

Examples of what this might look like:

- "Velocity is already credible for agent-led descriptive survey deck creation on well-labeled datasets."
- "Velocity is a strong analytical backend with partial agent-facing workflow support, but not yet a complete agent interface."
- "Velocity's engine and semantic layer are sufficient for single-dataset work; cross-wave and stress scenarios require substantial new capability."

**Thesis:**

> _[Fill after S4-EVAL-4]_

---

## 2. Validated Claims

Claims the eval evidence supports. Each must cite at least one eval result.

| Claim | Supporting evidence | Confidence |
|---|---|---|
| _[e.g., "Engine computes weighted crosstabs correctly"]_ | _[EVAL-02: correct WtFactor application, all slides weighted]_ | _[High / Medium / Low]_ |

---

## 3. Unvalidated Claims

Claims that were assumed entering Phase 4 but that evidence does not yet support — or actively contradicts.

| Claim | Status | Evidence gap or contradiction |
|---|---|---|
| _[e.g., "Semantic search is sufficient for large dataset discovery"]_ | _[Unvalidated / Contradicted]_ | _[EVAL-02: agent brute-forced variable selection despite search]_ |

---

## 4. "Do Not Assume" List

Explicit statements about what the team should stop treating as settled. Each should trace back to an eval finding or capability-gap review.

- _[e.g., "Do not assume session round-trip works end-to-end — EVAL-03 found filter state did not survive export"]_
- _[e.g., "Do not assume chart-first decks are the default agent path — current docs and defaults bias toward tables"]_

---

## 5. Ranked Product Gaps

Gaps discovered during Phase 4, ranked by strategic importance. Each gap should be classified per the four response classes from `docs/eval_framework.md` Part II.

| Rank | Gap | Response class | Affected layers | Source evals |
|---|---|---|---|---|
| 1 | _[e.g., "Presentation category suppression"]_ | _[Rough-edge / Capability expansion / Re-engineering / Scope revision]_ | _[Deliverable, Product defaults]_ | _[EVAL-02]_ |

---

## 6. Recommended Next-Phase Priorities

Based on the ranked gaps and thesis statement, what should Phase 5+ prioritize?

### Must-do before resuming feature expansion

- _[Items that block the thesis statement from being credible]_

### Should-do in next phase

- _[Items that strengthen the thesis but don't block it]_

### Explicitly deferred

- _[Items that are real gaps but not worth addressing before other work]_

### Out of current scope

- _[Items that the eval evidence suggests are beyond the current product boundary]_

---

## 7. Frozen Benchmark Baselines

Eval runs that achieved Pattern 7 (end-to-end success) or are otherwise stable enough to serve as regression baselines for future comparison.

| Eval ID | Task shape | Baseline date | Per-layer scores summary | Artifacts |
|---|---|---|---|---|
| _[EVAL-XX]_ | _[e.g., "Deck creation on small labeled dataset"]_ | _[date]_ | _[e.g., Engine 5, MCP 4, Semantic 4, Deliverable 3]_ | _[link to artifacts]_ |

### Regression rule

Per `docs/eval_framework.md` Part I: any layer dropping by 2+ points on a re-run is a regression that warrants investigation.

---

## 8. Roadmap Implications

How should the implementation tracker (`tracker_00_implementation_status.md`) change based on these findings?

### New work items to add

- _[Items discovered during Phase 4 that need tracker entries]_

### Existing items to re-sequence

- _[Items whose priority or dependencies changed based on findings]_

### Items to remove or descope

- _[Items that Phase 4 evidence suggests are premature or unnecessary]_

---

## 9. Appendix: Per-Eval Summary Table

Quick reference across all Phase 4 evals.

| Eval ID | Task family | Dataset | Overall severity | Key pattern | Key gap |
|---|---|---|---|---|---|
| EVAL-01 | B (deck) | sleep.sav | _[Critical / Significant / Moderate / Minor / Passing]_ | _[Pattern 1–7]_ | _[one-line]_ |
| EVAL-02 | A (discovery) | BSA 2017 | | | |
| EVAL-03 | C (handoff) | _reuse_ | | | |
| EVAL-04 | D (convergence) | sleep.sav | | | |
| EVAL-05 | E (harmonization) | ELSA | | | |
| EVAL-06 | F (stress) | WVS Wave 7 | | | |

---

## Completion Criteria

This synthesis is complete when:

1. The thesis statement is written and the team agrees it is honest.
2. Every claim from the Phase 4 plan's "core questions" section is classified as validated, unvalidated, or contradicted.
3. Every major gap has a response class and a recommended next action.
4. At least one benchmark baseline is frozen.
5. The roadmap implications section contains concrete tracker updates.
6. Downstream feature expansion resumes only after this document exists.
