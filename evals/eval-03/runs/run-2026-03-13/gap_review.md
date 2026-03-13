# EVAL-03 Capability Gap Review

## Strategic Read

`EVAL-03` validates that Velocity's browser handoff thesis is now materially real on a small dataset: an MCP-authored session can be opened in the browser, refined incrementally, and re-exported as a portable session artifact. The run also exposed the next browser-specific seam. Before this fix, the browser export path silently dropped the semantic block even though the session format and engine path already supported it.

The result is encouraging, but not yet a clean `Pattern 7`. Import still reports four unresolved variables/variable sets on the matching `sleep.sav` baseline, and semantic state is preserved more reliably than it is inspectable.

## Major Findings

### 1. Browser handoff is now real enough to advance the portfolio

- Class: Rough-edge fix validated
- Judgment: The core session handoff claim is now supported by evidence, not just by architecture docs.
- Evidence: the browser imported the 9-slide `EVAL-01` session, accepted three additive refinements, and re-exported a 10-slide session with the same 3 sections.

This matters because it is the first follow-on eval that directly demonstrates the intended-path value of the `velocity_commit_deck` contract change from `EVAL-01`.

### 2. Browser export was dropping semantic state until this run's blocker fix

- Class: Rough-edge fix
- Judgment: This was a real product blocker, not an eval harness artifact.
- Evidence: the app-level import/export glue in [src/App.tsx](/Users/cobro/Code/Velocity/src/App.tsx) did not carry the optional `semantic` block at all. The fix preserved imported semantic state across browser export using [sessionSemanticState.ts](/Users/cobro/Code/Velocity/src/services/sessionSemanticState.ts) and pinned it with [sessionSemanticState.test.ts](/Users/cobro/Code/Velocity/src/services/sessionSemanticState.test.ts).

This is exactly the kind of minimal blocker-driven change `S4-EVAL-3` is allowed to make. It restores the intended path without changing the session format.

### 3. Exact-match imports still produce adjustment diagnostics

- Class: Rough-edge fix
- Judgment: This is no longer catastrophic, but it still weakens the "lossless handoff" claim.
- Evidence: importing the exact `sleep.sav` baseline reported `4 variables could not be resolved` and `4 variable sets were removed`.

The run still succeeded because the slide deck and semantic block survived, but this mismatch should be traced. The likely seam is the browser's variable-set model versus the engine-authored session artifact, not the dataset itself.

### 4. Semantic state is preserved better than it is surfaced

- Class: Interface / product-defaults work
- Judgment: Preservation is now good enough for portability, but inspection is still weak for humans.
- Evidence: the refined session retained `30` annotations and `2` concepts, yet the browser UI still provides no obvious semantic inspection surface after import.

That means the session is technically richer than the browser experience reveals. This is not a format or engine problem anymore; it is a product-surface problem.

## Sufficiency Assessment

For small, controlled sessions, the browser handoff path is now sufficient to support `EVAL-04`. The core handoff primitive is real.

What is still not validated is the stronger claim that the browser import path is already clean, lossless, and self-explanatory for all saved state. `EVAL-03` says the handoff works, but still with visible rough edges.

## Recommended Next Investments

1. Eliminate the unresolved-variable / dropped-variable-set diagnostics on exact-match imports.
2. Add a browser-visible semantic inspection surface after import.
3. Add targeted browser-path coverage for session import/refinement/export so this seam stays protected as the product evolves.
