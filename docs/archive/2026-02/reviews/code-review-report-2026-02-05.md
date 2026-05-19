# Code Review Report - 2026-02-05

## Highest-Impact Findings (Ordered)

1. **[P0][Fix] Persistence layer is bound to the wrong storage object in this runtime.**  
`/Users/cobro/Code/Velocity/src/store/index.ts:62` uses `createJSONStorage(() => localStorage)`, which binds to `globalThis.localStorage` (not `window.localStorage`). In this environment that object exists but has no `setItem`, causing `storage.setItem is not a function` across store tests.  
Primary impact: broad state-write failures and unreliable persistence behavior.  
Also tied to: `/Users/cobro/Code/Velocity/src/store/persistence.test.ts:18`.

2. **[P0][Replace] Worker message protocol is collision-prone and can route wrong responses.**  
Both SQL queries and crosstab analysis emit identical `type: 'queryResult'` responses (`/Users/cobro/Code/Velocity/src/services/analysisWorker.ts:1028`, `/Users/cobro/Code/Velocity/src/services/analysisWorker.ts:1041`), with no request ID (`/Users/cobro/Code/Velocity/src/types/worker.ts:112`). Consumers match only by type (`/Users/cobro/Code/Velocity/src/store/slices/analysisSlice.ts:139`, `/Users/cobro/Code/Velocity/src/store/slices/drillDownSlice.ts:149`, `/Users/cobro/Code/Velocity/src/store/slices/drillDownSlice.ts:165`).  
Primary impact: stale/incorrect table data, drill-down misbinding, race bugs under concurrent actions.

3. **[P1][Fix] Workspace dataset identity is inconsistent; imported project links can break.**  
Datasets get new IDs on insert (`/Users/cobro/Code/Velocity/src/store/slices/workspaceSlice.ts:79`), while app logic updates/activates by analysis dataset ID (`/Users/cobro/Code/Velocity/src/App.tsx:718`, `/Users/cobro/Code/Velocity/src/App.tsx:724`). Import adds datasets without preserving IDs (`/Users/cobro/Code/Velocity/src/App.tsx:857`) but projects retain old dataset IDs (`/Users/cobro/Code/Velocity/src/App.tsx:876`).  
Primary impact: broken workspace open/update behavior and project-dataset link integrity.

4. **[P1][Fix] Dataset reopen flow is explicitly incomplete.**  
`/Users/cobro/Code/Velocity/src/App.tsx:750` and `/Users/cobro/Code/Velocity/src/features/workspace/hooks/useWorkspace.ts:206` mark core reopen behavior as TODO (OPFS key not persisted).  
Primary impact: workspace behaves like metadata catalog rather than true reopenable dataset library.

5. **[P1][Fix] `runCrosstab` contract changed, but callers/tests were not fully migrated.**  
Producer now returns object `{ rows, tableStats }` (`/Users/cobro/Code/Velocity/src/core/analysis/crosstabRunner.ts:566`), but major tests still treat result as array (`/Users/cobro/Code/Velocity/tests/golden/golden.test.ts:85`, `/Users/cobro/Code/Velocity/tests/golden/spss_parity.test.ts:48`).  
Primary impact: regression gate is effectively broken (51 failed tests), and parity checks include false negatives from unsorted nested rows (`/Users/cobro/Code/Velocity/tests/parity/runParity.test.ts:138`).

6. **[P1][Fix] Merge flow has a direct runtime crash path.**  
`/Users/cobro/Code/Velocity/src/hooks/useMergeOrchestration.ts:26` selects `state.variables` (not present in store), then calls `.find` (`/Users/cobro/Code/Velocity/src/hooks/useMergeOrchestration.ts:50`).  
Primary impact: category merge UX can throw at runtime.

7. **[P2][Improve] Type-safety gate is weak; build success currently masks correctness issues.**  
`/Users/cobro/Code/Velocity/tsconfig.json` is non-strict and permissive (`allowJs`, no strict mode), and the codebase has heavy `any` usage. `npx tsc --noEmit` currently reports real breakages (including `/Users/cobro/Code/Velocity/src/hooks/useMergeOrchestration.ts:26`, `/Users/cobro/Code/Velocity/tests/golden/golden.test.ts:85`, `/Users/cobro/Code/Velocity/vitest.config.ts:5`).  
Primary impact: regressions land undetected until runtime/tests.

8. **[P2][Improve/Add] Frontend bundle and app composition are high-risk for performance/maintainability.**  
`/Users/cobro/Code/Velocity/src/App.tsx` is 1752 LOC and import-heavy from top-level (`/Users/cobro/Code/Velocity/src/App.tsx:1`), and production build emits a 2.17MB main chunk with large-chunk warnings.  
Primary impact: slower startup and higher change risk; code-splitting and feature-shell decomposition should be prioritized.

## Validation Signals Collected

1. `npm run test:run`: 51 failed / 267 total (major failures in persistence + golden/parity).  
2. `npm run build`: passes, but with large-chunk warnings.  
3. `npx tsc --noEmit`: fails with multiple type/config issues.

## Open Questions / Assumptions

1. Should `runCrosstab` be standardized as object return (`{ rows, tableStats }`) everywhere, or reverted to array for compatibility?  
2. Is workspace meant to support full dataset reopening now (not just metadata), or is that intentionally deferred?  
3. Do you want strict TypeScript (`strict: true` + separate test tsconfig) enforced as a CI gate immediately?

## Suggested Execution Order

1. Fix storage binding + add safe storage fallback.  
2. Introduce request IDs for worker requests/responses and migrate analysis/drilldown handlers.  
3. Normalize workspace dataset IDs (preserve provided IDs) and fix import/open flows.  
4. Complete `runCrosstab` contract migration and restore golden/parity suites.  
5. Fix merge hook crash path and add targeted tests.
