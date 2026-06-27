# Gate 2 Designer Spec: Deck Readiness Diagnostics

**Status:** implemented  
**Date:** 2026-06-27  

## UX Contract

Readiness is displayed in the existing export modal, after export options and before detailed review issues. It uses three statuses:

- `Ready`: selected slides can export.
- `Ready with warnings`: non-blocking warnings should be reviewed.
- `Blocked`: selected slides cannot export until blockers are resolved.

The modal remains an Analysis Canvas/export surface. No Variable Manager or Workspace responsibilities move into this UI.

## Core Contract

`buildExportReview` is the pure readiness surface for export scope. It returns:

- `status`
- `canExport`
- selected slide count
- blocked slide count
- warning count
- slide-scoped issues

Dataset replacement assessment can still warn about missing filters/weights, but export readiness blocks missing selected-slide filters/weights because the resulting deck would not match the recipe.

## Test Contract

- Unit tests pin ready, blocked, selected-scope, active-slide override, and missing filter/weight cases.
- Component tests pin the modal readiness summary for a blocked deck.
- Typecheck must pass.

## Edge Cases Covered

- empty/no-row slide blocks export
- missing row variable blocks export
- missing filter and weight variables block export
- invalid unselected slide does not block selected valid slide
- active-slide overrides can repair stale slide state for export review
