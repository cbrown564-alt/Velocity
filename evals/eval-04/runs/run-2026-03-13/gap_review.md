# EVAL-04 Capability Gap Review

## Strategic Read

`EVAL-04` is the first Phase 4 run that shows a genuinely comparable browser and MCP output pair on the same tightly scoped deck task. On `sleep.sav`, both surfaces now reach the same five-slide structure, export a PPTX, and leave behind a portable session artifact. That is meaningful evidence that convergence is no longer just architectural intent for small, controlled deck work.

The remaining gap is narrower than expected. The browser did not win because it had a hidden analytical capability the agent could not reach. It won only on the softer edge of the workflow: last-mile statefulness and editability still feel more native in the browser than in the MCP deck/session loop.

## Major Findings

### 1. Controlled browser-vs-MCP parity is now real on a small deck task

- Class: Benchmark baseline validated
- Judgment: This run upgrades convergence from a claim to a scoped piece of evidence.
- Evidence: both paths exported 5-slide decks and 5-slide / 1-section sessions with the same titles and section name, `Sleep Quality by Demographics`.

This matters because `EVAL-04` was designed to name browser-only advantages. On this tightly bounded task, it found only a small one.

### 2. The main remaining difference is last-mile working-state semantics, not analytical reach

- Class: Interface / convergence work
- Judgment: The browser is still somewhat stronger, but the gap is now about editing semantics rather than about hidden computation.
- Evidence: the browser session exported the last active `problem x marital` table config, while the MCP session exported an empty top-level `tableConfig` even though both sessions carried the same saved slides.

That is a real difference in what “stateful handoff” means across the two surfaces. It is also much more tractable than a missing analysis feature would have been.

### 3. No new blocker fix was required to execute the comparison

- Class: Rough-edge fix already validated
- Judgment: The prior Phase 4 fixes were sufficient to let this run happen through the intended product paths.
- Evidence: `EVAL-04` completed without any new app, engine, or MCP code change.

This is important in its own right. It means the current surface is stable enough to execute at least one convergence comparison cleanly before `S4-EVAL-4` starts the next wave of backlog shaping.

### 4. This is a narrow convergence result, not a universal one

- Class: Scope / thesis caution
- Judgment: The run validates convergence for a controlled deck shape, not for open-ended discovery or more ambiguous authoring work.
- Evidence: the slide assignment was pre-committed and discovery was intentionally not scored.

So the right interpretation is “bounded convergence baseline achieved,” not “all browser-agent divergence is closed.”

## Sufficiency Assessment

For a small, low-ambiguity deck task on `sleep.sav`, the browser and MCP paths are now close enough that the difference can be described precisely. That is enough evidence to close the convergence execution step inside `S4-EVAL-3`.

What is still not validated is whether this parity holds once discovery is ambiguous, the browser is used through literal human interaction, or the deck requires more iterative restructuring. Those are follow-on questions for `S4-EVAL-4`, not reasons to withhold the current result.

## Recommended Next Investments

1. Align browser and MCP session export semantics so the top-level working state is preserved consistently.
2. Decide whether last-mile edit operations should become a more explicit shared engine/session primitive instead of remaining mostly browser-native.
3. Freeze `EVAL-04` as the current narrow convergence baseline, then move the execution stream to `EVAL-05`.
