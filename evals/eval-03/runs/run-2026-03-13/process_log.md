# Eval 03: Session Handoff Round-Trip — Benchmark Result

Eval ID:        `EVAL-03`
Task family:    `C — handoff`
Brief:          [evals/eval-03/brief.md](../../brief.md)
Dataset:        `test_data/sleep.sav` — 271 respondents, 59 variables
Baseline:       [evals/eval-01/runs/run-2026-03-13/artifacts/session.velocity](/Users/cobro/Code/Velocity/evals/eval-01/runs/run-2026-03-13/artifacts/session.velocity)
Agent:          `Browser session import/refinement/export`
Date:           `2026-03-13`
Method:         `Real browser import against sleep.sav, followed by controlled refinement and browser-side session re-export; a minimal browser-session semantic-preservation fix landed during this run in App glue code`
Primary artifact: [artifacts/session.velocity](/Users/cobro/Code/Velocity/evals/eval-03/runs/run-2026-03-13/artifacts/session.velocity) — 10 slides, 3 sections, semantic block preserved

## 1. Process Timeline

| Phase | Workflow action | Result |
|---|---|---|
| Import baseline | Load `EVAL-01` session into browser with matching `sleep.sav` | Browser opened the session and restored the 9-slide, 3-section deck |
| Validate import | Review session-import diagnostics | Import completed with warnings: `4 variables could not be resolved` and `4 variable sets were removed` |
| Refine | Retitle the lead slide, add one follow-up slide, reorder one existing slide | Lead title updated, new `problem x sex` slide added, daytime-sleepiness slide moved ahead of the energy slide |
| Persist | Re-export the refined browser session | Refined session saved with 10 slides, 3 sections, and the original semantic block (`30` annotations, `2` concepts) intact |

## 2. Controlled Refinements Applied

1. Retitled slide 1 from `Good or Fair Sleep Is Common, but Poor Sleep Is Not Rare` to `Sleep Is Usually Adequate, but Poor Sleep Still Matters`.
2. Reordered the daytime-sleepiness slide so it now appears before the energy-impact slide.
3. Added a follow-up slide titled `Sleep Problems Are Broadly Similar by Sex` with analysis state `problem x sex`.

## 3. What Survived the Round-Trip

| State | Baseline | Refined export | Read |
|---|---|---|---|
| Slides | 9 | 10 | Original deck survived and supported additive refinement |
| Sections | 3 | 3 | Section structure held through import/export |
| Filters | none | none | Null filter state survived intact |
| Weight | none | none | Unweighted state survived intact |
| Semantic annotations | 30 | 30 | Preserved after the browser-session export fix |
| Concepts | 2 | 2 | Preserved after the browser-session export fix |

## 4. What Changed or Broke

| # | Observation | Layer | Severity | Impact |
|---|---|---|---|---|
| 1 | The browser import completed with warnings even on the matching `sleep.sav` baseline: `4 variables could not be resolved` and `4 variable sets were removed` | Browser / session import | Medium | The deck still loaded, but the handoff is not yet perfectly lossless |
| 2 | Browser session export was dropping the semantic block before this run's blocker fix | Browser / session export | High | Semantic annotations and concepts would have been lost on the refined re-export |
| 3 | Headless automation could not reliably drive the inline title editor or timeline DnD hit targets | Eval harness only | Low | The final refinements were applied through the in-page browser store after successful import so the artifact stayed reproducible |

## 5. Assessment Against Brief

| Requirement | Result | Rating |
|---|---|---|
| Browser imports the agent session with matching SAV | Yes | Check |
| Human/browser path can apply additive refinements | Yes | Check |
| Reordered slide persists in exported session | Yes | Check |
| Edited title persists in exported session | Yes | Check |
| Added follow-up slide persists in exported session | Yes | Check |
| Semantic state survives refined re-export | Yes, after blocker fix | Warning |
| Import is fully lossless and diagnostics-free | No | Warning |

## 6. Severity Classification

`Meaningful success with workflow warnings`

This eval validates the core handoff thesis on a small dataset, but it also surfaced a real browser-session blocker and a remaining import-lossiness warning on the exact baseline dataset.

## 7. Outcome Pattern

- **Primary pattern:** `Pattern 2 — Good insight, painful workflow`
- **Secondary pattern:** `Pattern 7 signal — end-to-end handoff is now real once the browser-session semantic export path is fixed`

## 8. Verdict

`EVAL-03` now demonstrates a real handoff loop: the `EVAL-01` session imports in the browser, supports additive refinement, and re-exports as a portable session with the semantic block preserved. That is enough to validate the impact of the Phase 4 session work and the `velocity_commit_deck` contract change.

The run is not yet a perfectly clean `Pattern 7` baseline. Import still raises variable/variable-set adjustment warnings on the same dataset, and the browser still does not expose semantic state in a clearly inspectable UI. Those are now scoped product findings rather than unproven suspicions.

## 9. Recommended Next Actions

- Trace why the browser import path drops `4` variables / `4` variable sets on the exact `sleep.sav` baseline session.
- Surface semantic annotations and concepts in an inspectable browser UI after session import.
- Carry this browser muscle memory directly into `EVAL-04`, keeping the task scope tightly matched across browser and MCP paths.
