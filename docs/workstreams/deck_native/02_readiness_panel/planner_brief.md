# Gate 2 Planner Brief: Deck Readiness Diagnostics

**Status:** complete  
**Date:** 2026-06-27  
**Depends on:** Gate 1 deck-native charter  

## User Job

Before exporting a client deck, a researcher needs to know whether the selected slides are exportable, which slides are blocked, and whether template warnings affect the output.

## Scope

Implement the smallest readiness slice in the existing export-review flow:

- pure export readiness diagnostics over selected slides
- blockers for missing selected-slide row, column, filter, and weight references
- explicit deck readiness status
- compact export-modal readiness summary

## Non-Goals

- no new Workspace Report Job shell
- no session format change
- no engine/MCP API
- no dataset-replacement auto-healing
- no broad template editor

## Acceptance Criteria

- Selected valid slides export.
- Selected slides with missing row/column/filter/weight references block export.
- Unselected invalid slides do not block selected valid slides.
- The export modal shows a readiness status before export.
- Typecheck and targeted tests pass.
