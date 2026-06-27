# Gate 4 Builder Handoff: Dataset Replacement Review

## 1) Context

- Request/goal: Add pure dataset replacement review diagnostics for deck recipes.
- Scope boundaries (explicit non-goals): no UI wizard, no auto-remap, no engine/MCP API, no session migration.
- Owner role handing off: Codex Builder.
- Next owner role: Gate 4 evaluator/fallback, then Gate 5 builder.

## 2) Changes

- Branch: `main`
- PR/commit refs: not committed.
- Files changed:
  - `src/core/export/slideRecipe.ts`
  - `src/core/export/slideRecipe.test.ts`
  - `src/core/export/index.ts`
  - `docs/workstreams/deck_native/04_dataset_replacement/*`
- What changed and why: added `buildDatasetReplacementReview` with selected-scope behavior, grouped slide reviews, and warning/blocking distinction for replacement review.

## 3) Contracts

- Interfaces/types/schemas touched: additive `DatasetReplacementReview` and `DatasetReplacementSlideReview` exports.
- Backward compatibility impact: none; existing `assessDatasetReplacement` remains.
- Required downstream updates: future UI/agent surfaces can call the pure review function.
- Dual-state model impact (raw codes + labels): no value transformations; function checks variable and variable-set references only.

## 4) Invariant Check

- [x] `src/core/*` remains platform-independent (no React/DOM/browser APIs)
- [x] Heavy compute remains in Worker
- [x] Dependency direction preserved (`core` -> adapters injected; no inverted coupling)
- [x] UX mode/theme token constraints respected (if UI touched)

Notes/evidence:

- Pure function reuses existing slide recipe assessment.
- Selected-scope behavior mirrors Gate 2 export readiness.

## 5) Checks Run

```bash
npm run test:run -- src/core/export/slideRecipe.test.ts
npm run typecheck
```

Results:

- [x] Typecheck
- [ ] Lint
- [x] Unit tests
- [ ] Integration/golden tests (if applicable)
- [x] Manual verification (if applicable)

Lint was not run because this repo has no lint script in `package.json`.

## 6) Risks

- Known issues / edge cases: no UI exists yet to present the grouped replacement review.
- Confidence level: high for pure review semantics.
- Monitoring/follow-up needed: Gate 5 can use this review as an agent-facing guardrail if exposed later.

## 7) Next Actions (for next owner)

- Immediate next step: Gate 5 bounded agent drafting.
- Blockers/dependencies: none.
- Suggested order: inspect `DeckBuilder`/engine deck methods, write engine tests for a bounded draft plan, keep actions human-approvable and provenance-carrying.

## 8) Done Criteria for Next Owner

- Agent can propose a deck plan through intended engine surfaces.
- Proposed actions are bounded and inspectable before application.
- Generated slides carry provenance after build.
- Tests cover the engine/MCP-adjacent contract.
