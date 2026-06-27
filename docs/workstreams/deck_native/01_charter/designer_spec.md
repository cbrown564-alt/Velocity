# Gate 1 Designer Spec: Deck-Native Charter

**Status:** audited; Gate 1 complete  
**Date:** 2026-06-27  
**Designer path:** Claude Opus Designer retry stalled after the trust fix; this Codex-authored fallback spec keeps the workstream moving under the Gate 0 fallback rule.

## 1. Product Contract

`Report Job` is the user-facing durable work object: one client reporting assignment tied to a dataset fingerprint, a client template/binding choice, a deck outline, slide recipes, banner/break choices, filters, weights, recodes, readiness diagnostics, provenance, and export history. It must not contain raw respondent rows.

`Deck Recipe` is the reusable, session-safe report recipe inside a Report Job. It describes deck sections, slide order, slide recipes, template bindings, and deck-level export settings. It is not a rendered PPTX and not a cached query result.

`Slide Recipe` is the smallest executable unit of a deck recipe. It captures variable references, filters, weight, analysis/display options, title/subtitle/notes, and template slot expectations. It should map to existing slide and `DeckSpec` concepts before a new type is introduced.

`Deck Readiness` is a deterministic diagnostic report over a selected deck/export scope. It tells the user whether each selected slide can be exported, what warnings apply, and which blockers must be fixed.

## 2. UX Contract

The first user-facing surface should be the export-review path, not a new application shell. Users already expect to check scope, template, and PPTX output in the export modal, so readiness belongs adjacent to export decisions before any Workspace-level Report Job screen exists.

Analysis Canvas remains the authoring and inspection hub. Variable Manager remains variable organization and cleaning. Workspace can later list Report Jobs, but Gate 2 should not add a broad job-management surface.

Readiness copy should be practical and slide-oriented:

- Export allowed: all selected slides are valid, with optional warnings.
- Export allowed with warnings: template/status issues do not block editable output.
- Export blocked: one or more selected slides reference missing row, column, filter, or weight variables.

## 3. Architecture Contract

Deck readiness computation belongs in `src/core/export/` as a pure function. It should accept plain deck/slide/template/dataset metadata inputs and return plain diagnostics. It must not import React, Zustand, DOM APIs, local storage, DuckDB, or worker/browser APIs.

The UI may call this function over current store state and render the result. The UI should not implement the validation rules itself.

The engine/MCP layer should not be changed for Gate 2 unless the first implementation needs agent-facing readiness. If exposed later, the engine should wrap readiness results in `ResultEnvelope`, and MCP should remain a thin adapter.

Session format should not change in Gate 2. Gate 3 may add deck recipe metadata, but only with backward-compatible session handling and tests.

Dual-state data requirements are indirect in Gate 2: diagnostics must validate variable IDs/names without rewriting value labels or categorical codes.

## 4. Affected Files

Likely Gate 2 files:

- `src/core/export/deckReadiness.ts` (new pure diagnostics module)
- `src/core/export/deckReadiness.test.ts` (new tests)
- `src/components/overlays/ExportModal.tsx` (display readiness in export-review flow)
- `src/components/overlays/ExportModal.test.tsx` (component assertions)

Possible later files, not Gate 2 by default:

- `src/core/session/sessionTypes.ts`
- `src/core/export/slideRecipe.ts`
- `src/engine/DeckBuilder.ts`
- `src/engine/VelocityEngine.ts`
- `mcp-server/handlers/deck.ts`

## 5. Tests Required

Gate 2 should be tests-first:

- Pure unit happy path: selected slides reference existing row/column/filter/weight variables and return export-allowed status.
- Pure unit blocker path: selected slide references a missing row or column variable and returns slide-scoped blockers.
- Pure unit warning path: template binding is missing or incomplete and returns a warning without blocking variable-valid slides.
- Pure unit scope path: unselected invalid slides do not block export of selected valid slides.
- Component test: export modal surfaces ready/blocked/warning states and disables export only when selected slide blockers exist.

## 6. Edge Cases

- Empty deck or no selected slides.
- Slide with no row variables.
- Slide with missing column variable.
- Slide with missing filter variable.
- Slide with missing weight variable.
- Template selected but no mapping/bindings.
- Existing template warning plus variable blocker on the same slide.
- Dataset replacement where IDs drift but labels/names look similar; Gate 2 should report missing references, not auto-heal.
- Hidden or unselected slide with blockers.

## 7. First Slice Recommendation

Proceed with **Deck Readiness Diagnostics**.

Reason: it is the smallest implementation slice that makes the existing PPTX loop safer and more deck-native. It improves review-before-export, prepares Gate 3 recipe persistence and Gate 4 dataset replacement, and avoids premature Workspace redesign or agent drafting.

Gate 2 should implement pure readiness computation first, then a small export modal display. Do not add Report Job persistence, engine APIs, MCP tools, or new Workspace navigation in this slice.

## 8. Gate 1 Good-Enough Criteria

- Product terms are defined without changing runtime contracts.
- Existing primitives are mapped to Report Job / Deck Recipe / Slide Recipe / Deck Readiness.
- Deck Readiness Diagnostics is selected as the first implementation slice.
- Gate 2 acceptance criteria are testable at pure-function and export-modal boundaries.
- Scope remains tied to `PILOT-3`, `PILOT-5`, and `PILOT-6`.
- Risks to session compatibility, export quality, engine boundaries, and UI modes are named.

## 9. Gate 2 Good-Enough Criteria

- A pure readiness function returns deck-level and slide-level status.
- Diagnostics identify missing row, column, filter, and weight variables.
- Template binding issues are represented as warnings unless they truly block export.
- Selected export scope controls whether blockers prevent export.
- Export modal shows the readiness state before export.
- Tests cover happy path, blockers, warnings, and selected-scope behavior.
- `npm run typecheck` and targeted tests pass.

## 10. Evaluator Rubric

Evaluator should fail Gate 1 if:

- The spec expands into a broad Report Job shell before proving readiness value.
- The first slice requires session migration, new engine APIs, or MCP tools without a necessity argument.
- Readiness logic is assigned to React UI instead of pure core.
- Diagnostics cannot be tested without browser state.
- The design undermines Analysis Canvas / Variable Manager / Workspace mode separation.

Evaluator should fail Gate 2 if:

- Export is allowed when selected slides have missing variable blockers.
- Unselected invalid slides block selected valid-slide export.
- Template warnings are confused with variable blockers.
- Core code imports browser/UI dependencies.
- Component tests do not assert user-visible readiness behavior.

## 11. Residual Risks

- Existing slide/store types may not map cleanly to deck recipe terminology; implementation should adapt to current shapes rather than forcing a new model.
- Export modal complexity may grow if readiness UI is too detailed; prefer compact slide-scoped diagnostics.
- Dataset replacement will need stricter matching in Gate 4; Gate 2 should not auto-match renamed variables.
- Agent-facing readiness may be needed for Gate 5, but exposing it through engine/MCP should wait until the core diagnostic shape proves stable.
