# Gate 4 Planner Brief: Dataset Replacement Review

**Status:** complete  
**Date:** 2026-06-27  
**Depends on:** Gate 2 readiness diagnostics and Gate 3 recipe persistence  

## User Job

When refreshing a deck with a replacement dataset or new wave, a researcher needs to know which selected slides still work and which slide-level recipe references need attention.

## Scope

- Add pure replacement review diagnostics.
- Group blockers and warnings by slide.
- Respect selected slide scope.
- Preserve dataset replacement warnings for missing filters/weights while blocking unresolved row/column recipe references.

## Non-Goals

- no automatic variable remapping
- no UI replacement wizard
- no engine/MCP exposure
- no session migration

## Acceptance Criteria

- invalid unselected slides do not block selected valid slides
- selected blockers are grouped by slide
- filter/weight drift produces replacement warnings, not blockers
- targeted tests and typecheck pass
