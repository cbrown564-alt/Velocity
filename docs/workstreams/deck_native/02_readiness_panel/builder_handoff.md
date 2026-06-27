# Gate 2 Builder Handoff: Deck Readiness Diagnostics

## 1) Context

- Request/goal: Implement Gate 2 Deck Readiness Diagnostics as the first deck-native code slice.
- Scope boundaries (explicit non-goals): no engine/MCP/session contract change; no Workspace shell; no dataset replacement auto-healing; no broad template editor.
- Owner role handing off: Codex Builder.
- Next owner role: Gate 2 evaluator/fallback, then Gate 3 builder.

## 2) Changes

- Branch: `main`
- PR/commit refs: not committed.
- Files changed:
  - `src/core/export/slideRecipe.ts`
  - `src/core/export/slideRecipe.test.ts`
  - `src/components/overlays/ExportModal.tsx`
  - `src/components/overlays/ExportModal.module.css`
  - `src/components/overlays/ExportModal.test.tsx`
  - `docs/workstreams/deck_native/02_readiness_panel/*`
- What changed and why: export review now has explicit `ready | warning | blocked` status; selected-slide missing filter/weight references block export; the export modal displays a compact deck readiness summary before detailed issues.

## 3) Contracts

- Interfaces/types/schemas touched: `ExportReview` adds `status`.
- Backward compatibility impact: additive field only.
- Required downstream updates: none identified; existing call sites continue to use `canExport` and can optionally read `status`.
- Dual-state model impact (raw codes + labels): no categorical values or labels are rewritten; the change validates variable references only.

## 4) Invariant Check

- [x] `src/core/*` remains platform-independent (no React/DOM/browser APIs)
- [x] Heavy compute remains in Worker
- [x] Dependency direction preserved (`core` -> adapters injected; no inverted coupling)
- [x] UX mode/theme token constraints respected (if UI touched)

Notes/evidence:

- Pure readiness logic remains in `src/core/export/slideRecipe.ts`.
- Export modal renders diagnostics but does not own validation rules.
- CSS uses existing semantic status/design tokens.

## 5) Checks Run

```bash
npm run test:run -- src/core/export/slideRecipe.test.ts src/components/overlays/ExportModal.test.tsx
npm run typecheck
npm run test:run -- src/core/export/slideRecipe.test.ts src/components/overlays/ExportModal.test.tsx
```

Results:

- [x] Typecheck
- [ ] Lint
- [x] Unit tests
- [ ] Integration/golden tests (if applicable)
- [x] Manual verification (if applicable)

Lint was not run because this repo has no lint script in `package.json`. Integration/golden tests were not required for this pure diagnostics and component slice.

## 6) Risks

- Known issues / edge cases: template applicability still has its own issue type; the UI combines template issues for status but pure `buildExportReview` intentionally stays slide-recipe focused.
- Confidence level: high for selected export-scope readiness.
- Monitoring/follow-up needed: Gate 4 should revisit dataset replacement severity separately.

## 7) Next Actions (for next owner)

- Immediate next step: Gate 3 persistent deck recipe metadata.
- Blockers/dependencies: none.
- Suggested order: inspect session exporter/importer, add session round-trip tests, then add deck recipe metadata without respondent rows.

## 8) Done Criteria for Next Owner

- Deck recipe metadata survives session export/import.
- Session compatibility is preserved.
- Recipe metadata does not duplicate respondent rows.
- Invalid recipe references still surface diagnostics instead of failing silently.
