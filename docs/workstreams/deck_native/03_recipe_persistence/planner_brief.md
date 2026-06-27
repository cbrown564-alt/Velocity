# Gate 3 Planner Brief: Persistent Deck Recipe Metadata

**Status:** complete  
**Date:** 2026-06-27  
**Depends on:** Gate 1 charter and Gate 2 readiness diagnostics  

## User Job

When a researcher saves or shares a Velocity session, the deck should carry a durable recipe that can be inspected, replayed, and assessed on a future dataset without storing respondent rows.

## Scope

- Add additive session-safe `deckRecipe` metadata.
- Derive recipe metadata from existing sanitized slides and sections.
- Preserve backward compatibility for sessions without `deckRecipe`.
- Surface stale deck-recipe slide references as import diagnostics.

## Non-Goals

- no respondent row persistence
- no session version bump unless a breaking change is introduced
- no engine/MCP tool exposure
- no UI recipe inspector yet

## Acceptance Criteria

- session export includes deck recipe metadata
- import returns deck recipe metadata
- old sessions without deck recipe still import by deriving from slides
- stale recipe slide IDs are diagnosed
- session tests and typechecks pass
