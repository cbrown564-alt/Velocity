# Gate 3 Builder Handoff: Persistent Deck Recipe Metadata

## 1) Context

- Request/goal: Add session-safe deck recipe metadata for Gate 3.
- Scope boundaries (explicit non-goals): no respondent rows, no engine/MCP exposure, no UI recipe inspector, no session version bump.
- Owner role handing off: Codex Builder.
- Next owner role: Gate 3 evaluator/fallback, then Gate 4 builder.

## 2) Changes

- Branch: `main`
- PR/commit refs: not committed.
- Files changed:
  - `src/core/session/sessionTypes.ts`
  - `src/core/session/sessionDeckRecipe.ts`
  - `src/core/session/sessionExporter.ts`
  - `src/core/session/sessionImporter.ts`
  - `src/core/session/sessionImportDiagnostics.ts`
  - `src/core/session/index.ts`
  - session tests
  - template/export test fixtures needed for `typecheck:test`
- What changed and why: session export now includes additive `deckRecipe` metadata; import always returns a sanitized deck recipe; stale deck-recipe slide references are reported in diagnostics.

## 3) Contracts

- Interfaces/types/schemas touched: additive `VelocitySessionFile.deckRecipe`, `ExportSessionInput.deckRecipe`, `SessionStatePatch.deckRecipe`, `SessionImportDiagnosticsSummary.droppedDeckRecipeSlideIds`.
- Backward compatibility impact: backward-compatible additive fields; no session version bump.
- Required downstream updates: optional consumers can read `patch.deckRecipe`.
- Dual-state model impact (raw codes + labels): deck recipes store variable references and copied slide analysis metadata only; no categorical values are transformed.

## 4) Invariant Check

- [x] `src/core/*` remains platform-independent (no React/DOM/browser APIs)
- [x] Heavy compute remains in Worker
- [x] Dependency direction preserved (`core` -> adapters injected; no inverted coupling)
- [x] UX mode/theme token constraints respected (if UI touched)

Notes/evidence:

- New helper `sessionDeckRecipe.ts` is pure and session-local.
- Session export still excludes OPFS/runtime internals and respondent rows.
- Import diagnostics surface stale recipe slide IDs.

## 5) Checks Run

```bash
npm run test:run -- src/core/session/sessionExporter.test.ts src/core/session/sessionImporter.test.ts src/core/session/sessionRoundTrip.test.ts
npm run typecheck
npm run test:run -- src/core/session/sessionExporter.test.ts src/core/session/sessionImporter.test.ts src/core/session/sessionRoundTrip.test.ts src/core/session/sessionImportDiagnostics.test.ts
npm run typecheck:test
npm run test:run -- src/core/export/templateMapping.test.ts src/core/export/__tests__/pptxExporter.semantics.test.ts src/components/overlays/ExportModal.test.tsx
```

Results:

- [x] Typecheck
- [ ] Lint
- [x] Unit tests
- [ ] Integration/golden tests (if applicable)
- [x] Manual verification (if applicable)

Lint was not run because this repo has no lint script in `package.json`.

## 6) Risks

- Known issues / edge cases: `deckRecipe` is persisted/imported but no dedicated UI inspector exists yet.
- Confidence level: high for session persistence and compatibility.
- Monitoring/follow-up needed: Gate 4 should use `deckRecipe` as replacement-review input.

## 7) Next Actions (for next owner)

- Immediate next step: Gate 4 dataset replacement review diagnostics.
- Blockers/dependencies: none.
- Suggested order: write tests against deck recipe replacement assessment, group issues by slide, then expose reusable pure review result.

## 8) Done Criteria for Next Owner

- Replacement review can assess whether a deck survives a replacement dataset.
- Missing/changed variables are grouped by slide.
- Selected unresolved blockers prevent export only for selected slides.
- Diagnostics are understandable without raw internal IDs where possible.
