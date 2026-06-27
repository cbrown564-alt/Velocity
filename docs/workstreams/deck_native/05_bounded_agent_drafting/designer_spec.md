# Gate 5 Designer Spec: Bounded Agent Drafting

**Status:** implemented  
**Date:** 2026-06-27  

## Contract

`VelocityEngine.draftDeckPlan(spec)` returns `ResultEnvelope<DeckDraftPlan>`.

The draft plan contains:

- `approvalRequired: true`
- action list
- per-action `requiresApproval: true`
- section and slide labels
- slide specs with notes preserved
- caveats
- provenance source `agent_draft`

This method does not build, commit, or export. Existing `buildDeck`, `commitDeck`, and `exportDeck` remain the materialization path where generated slides carry analysis provenance through `BuiltSlide.result`.

## MCP Contract

`velocity_draft_deck_plan` is a thin handler over `engine.draftDeckPlan(spec)`. Agents should call it before `velocity_build_deck` when proposing a deck for human review.

## Tests

- engine test asserts approval-required actions, preserved notes/caveats, provenance envelope, and no slide mutation
- MCP test asserts handler delegates to engine with the raw spec
- `typecheck:all` passes
