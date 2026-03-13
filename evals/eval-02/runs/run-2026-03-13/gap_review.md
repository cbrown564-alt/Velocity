# EVAL-02 Capability Gap Review

## Strategic Read

EVAL-02 is a meaningful step forward for the Phase 4 thesis. The BSA benchmark now runs through the intended MCP path, including weighted analysis, deck export, deck commit, and session handoff. That removes the biggest ambiguity from the earlier direct-engine run. What remains unresolved is the semantic-layer claim: Velocity can execute the work once good variables are chosen, but it still does not guide large-survey discovery well enough on its own.

## Major Findings

### 1. MCP deck and session round-trip now holds on a large survey

- Class: Rough-edge fix validated
- Judgment: This run confirms that the session-round-trip work from `S4-EVAL-2` plus the `velocity_commit_deck` addition from `EVAL-01` are sufficient for a more demanding dataset.
- Evidence: 13-slide deck exported successfully; `session.velocity` contains all 13 slides and 3 sections.

This matters because it upgrades BSA from “good engine demo” to “real MCP benchmark artifact.”

### 2. Discovery is still the bottleneck on high-dimensional surveys

- Class: Capability expansion
- Judgment: The engine and export surfaces are now ahead of the semantic layer for this task shape.
- Evidence: The top search result for the NHS query was `ImpHSafe`, for trust it was `Himp`, and for demographics it was `TVNews`. The correct variables were still reachable, but not ranked the way an agent needs at 654-variable scale.

This is the central result of EVAL-02. The task did not fail because the engine is weak. It nearly failed at the point where the product should be helping the agent choose from a huge variable inventory.

### 3. Product defaults are still too passive once search goes noisy

- Class: Rough-edge fix plus product-defaults work
- Judgment: After search, the system still leaves too much analytical triage to the operator.
- Evidence: The final deck was strong, but theme narrowing and break-variable choice depended on disciplined manual curation rather than on obvious product guidance or recommendations.

The next layer above search should help more. Suggested breaks, theme bundles, or “good starting cuts” would reduce the burden substantially.

### 4. The earlier chi-square concern appears to be contract clarity, not engine correctness

- Class: Rough-edge / docs clarification
- Judgment: The BSA crosstabs do expose the chi-square value and p-value. The earlier confusion came from looking for `tableStats.chiSquare.statistic` instead of the actual `tableStats.chiSquare.chiSquare`.
- Evidence: Re-checking `EUVOTWHO × RAgeCat` produced `chiSquare: 127.609...`, `df: 28`, and `pValue: 1.13e-14`.

This is good news because it removes one suspected engine issue from the benchmark narrative.

## Sufficiency Assessment

For large, well-labeled social survey datasets, the product is now sufficient to support an agent-authored deck through MCP when the operator can steer discovery. That is a stronger claim than before this run.

What is still not validated is the stronger thesis that discovery itself is mature enough for large-survey benchmarking. EVAL-02 says the execution stack is ready before the semantic layer is.

## Recommended Next Investments

1. Improve semantic search ranking for category-level and break-variable queries.
2. Add higher-level discovery affordances such as recommended demographics, party, class, or age breaks once a topic variable is selected.
3. Clarify stats-object examples so agents read chi-square fields correctly.
4. Freeze this run as the current MCP baseline for large-survey deck and session generation.
