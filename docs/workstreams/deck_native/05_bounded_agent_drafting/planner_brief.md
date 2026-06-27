# Gate 5 Planner Brief: Bounded Agent Drafting

**Status:** complete  
**Date:** 2026-06-27  
**Depends on:** Gate 2 readiness, Gate 3 recipe persistence, Gate 4 replacement review  

## User Job

When an agent proposes a deck, the researcher needs an inspectable plan with manual approval adjacent to each action before any slides are built, committed, or exported.

## Scope

- Add a non-mutating engine method to draft deck actions from a `DeckSpec`.
- Require approval on every proposed action.
- Preserve notes/caveats in proposed slide actions.
- Expose the draft plan through a thin MCP handler.

## Non-Goals

- no unsupervised auto-commit
- no automatic deck generation prompt language
- no broad chat analyst surface
- no new UI approval queue

## Acceptance Criteria

- engine returns a `ResultEnvelope`
- proposed actions require approval
- method does not mutate session slide state
- MCP handler delegates to engine without business logic
- targeted tests and typechecks pass
