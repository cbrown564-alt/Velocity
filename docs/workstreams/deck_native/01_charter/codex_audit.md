# Gate 1 Codex Audit: Deck-Native Charter

**Status:** pass with constraints  
**Date:** 2026-06-27  
**Audited artifact:** `docs/workstreams/deck_native/01_charter/designer_spec.md`

## Scope Gate

Result: **in scope, narrow.**

Evidence:

- Roadmap: current critical path is SAV-to-deck pilot validation before Phase 5 expansion.
- Tracker: deck-native work maps to `PILOT-3` PowerPoint loop, `PILOT-5` bounded agent outcomes, and `PILOT-6` paid-pilot evidence.
- Feature matrix: editable PPTX/export loop is kept; broad SPSS replacement, dashboard builder, cloud collaboration, survey imports, WebR/raking, and generic AI chat remain delayed/rejected/pilot-gated.

## Architecture Check

- Pure readiness computation belongs in `src/core/export/`, consistent with `docs/arch_03_headless_core.md`.
- Export modal can render diagnostics, but must not own validation rules.
- No Gate 2 engine API is required. If later exposed, `docs/playbooks/engine_api_change.md` requires `ResultEnvelope` and consumer contract tests.
- No Gate 2 session format change is required. Gate 3 must handle session compatibility separately.
- Dual-state data is preserved because Gate 2 validates variable references and does not rewrite categorical values or labels.

## UI Mode Check

- Readiness belongs in Analysis Canvas/export flow because the user job is review-before-export.
- Variable Manager remains variable organization/cleaning.
- Workspace remains job/dataset entry later; Gate 2 should not add a Workspace Report Job shell.

## Gate 1 Decision

Gate 1 passes with the following constraints:

- First implementation slice is Deck Readiness Diagnostics.
- Gate 2 must start with tests for pure diagnostics before UI wiring.
- Gate 2 must not add engine/MCP/session contracts unless implementation proves they are unavoidable.
- Any UI surface must be compact and export-adjacent.

## Gate 2 Micro-Spec

Input:

- selected slides/export scope
- available variables
- optional template mapping/binding state

Expected output:

- deck-level `ready | warning | blocked`
- slide-level diagnostics
- blocking issues for missing row/column/filter/weight variables
- non-blocking warnings for incomplete template bindings

Must not change:

- raw respondent rows
- categorical code/label metadata
- session format
- engine or MCP contracts
