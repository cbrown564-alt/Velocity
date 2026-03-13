# EVAL-01 Capability Gap Review

## Strategic Read

EVAL-01 shows that Velocity can produce a strong end-to-end artifact for a small, friendly health dataset through the MCP path, but not yet with the smoothness implied by `pattern_7`. The successful run required one product fix mid-flight and one runtime workaround, so the real outcome is: the core capability is present, but the workflow is still fragile.

## Major Findings

### 1. Missing deck-commit tool in MCP

- Class: Rough-edge fix
- Judgment: The engine already had `commitDeck()`, but the MCP surface and docs did not. That made `velocity_export_session` silently incomplete for the normal agent workflow.
- Action taken in this run: Added `velocity_commit_deck`, added MCP/unit/e2e coverage, and updated the quickstart/playbook so session export now reflects the built deck.

This was not a thesis-level failure. It was a workflow mismatch between the engine and the published MCP surface.

### 2. Deck build size / serialization ceiling

- Class: Interface or architecture re-engineering
- Judgment: This is more than a docs problem. An 8-slide chart-heavy deck with a multi-variable impact slide hit default-heap OOM, and the higher-heap retry then failed with `Invalid string length` at the MCP response boundary.
- Why this matters: The product is returning the entire `BuiltDeck` payload through JSON over stdio. That is workable for small decks, but it is not a stable long-term contract if moderately richer specs can exceed memory or serialization limits on a 271-row dataset.

Incremental cleanup may help, but the deeper fix is probably architectural:

- stream slide results instead of returning one giant deck blob
- add a server-side deck handle / artifact ID flow
- reduce the size of `BuiltDeck` over MCP
- separate “build for export” from “return full processed data to the client”

### 3. Discovery still weak for demographic navigation

- Class: Capability expansion
- Judgment: Search works well for topical queries like sleep and mental health, but still struggles with category-level navigation such as “find me the demographic breaks.”
- Evidence from this run: the demographics query surfaced `stressmonth`, `impact1`, and `impact2` instead of obvious break variables like `sex`, `age3gp`, `marital`, and `edlevel`.

This looks like the semantic-layer option ladder's “better heuristics and affordances” tier, not a need for a radically new retrieval system.

### 4. Product guidance is still too weak around “good analysis”

- Class: Rough-edge fix with some product-defaults work
- Judgment: The system did not warn that `weight` is body weight rather than sample weight, and suggestions leaned too heavily toward sex comparisons.
- Evidence from this run: the brief warned about the weight pitfall, but the product surface itself did not actively steer the agent away from it.

This is a defaults problem, not a scope problem.

## Sufficiency Assessment

For small, well-labeled survey datasets, the current product is sufficient in principle to support an agent-authored deck. That thesis is still intact.

What is not yet validated is the stronger claim that MCP is already a low-friction, benchmark-ready operating surface for this task shape. EVAL-01 says “nearly, but not yet.”

## Recommended Next Investments

1. Finish hardening the MCP round-trip surface around deck/session workflows.
2. Redesign large `buildDeck` responses so richer decks do not depend on giant JSON payloads.
3. Improve semantic discovery for demographic and break-variable lookup.
4. Add defaults or warnings around common false positives such as body-weight variables.
