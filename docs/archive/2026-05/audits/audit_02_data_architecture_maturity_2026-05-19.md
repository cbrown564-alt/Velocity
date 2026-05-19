# Data Architecture Maturity Review

Date: 2026-05-19

Scope: `analysisWorker.ts`, `worker.ts` / `engineWorker.ts`, `src/core/analysis`, `queryBuilder.ts`, `opfsPersistence.ts`, store slices, and related tests. Read-only audit; no files modified.

## Summary Judgment

The data layer is materially stronger than the February 2026 review. `EngineProxy` plus the `engineWorker` request-ID protocol, the headless `crosstabRunner` / `queryBuilder` core, and tested `initOpfsPersistence` are real wins.

Remaining risk clusters around workspace reopen and per-dataset OPFS behavior, stale analysis without generation guards, the 1836-line worker monolith plus dual protocol residue, and thin integration coverage on the real worker path.

## What Works Well

### Headless Core Seam

Crosstab logic lives in testable modules (`crosstabRunner.ts`, `buildCrosstabRequest.ts`, `mapCrosstabRows.ts`) and is invoked from the worker via `DatabaseAdapter`, rather than duplicated ad hoc in the UI.

### Pure SQL Generation

`queryBuilder.ts` is side-effect-free with solid unit coverage (`queryBuilder.test.ts`, `queryBuilder_numeric_grid.test.ts`). This matches the invariant that the engine computes on raw codes while the UI displays labels.

### Worker Collision Fix

The old worker response-collision P0 is largely fixed on the browser path. `EngineProxy` assigns a UUID per request, tracks pending calls, and routes responses by `requestId`. The worker echoes IDs and serializes engine work on a queue:

```ts
let engineRequestQueue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<EngineWorkerRequest>) => {
  const request = event.data;
  engineRequestQueue = engineRequestQueue.then(() => runQueuedEngineMessage(request));
};
```

### OPFS Init Extraction

`initOpfsPersistence` in `opfsPersistence.ts` handles corruption heuristics, quarantine, candidate fallback, and has focused tests (`opfsPersistence.test.ts`).

### Cleaner Store To Engine Boundary

`analysisSlice` builds requests via `buildCrosstabRequest` and calls `engineProxy.runCrosstab`; results are mapped through `mapCrosstabRows`. `dataSlice` owns worker lifecycle and persistence metadata.

### Typed Protocols And Envelopes

`engineWorker.ts` mirrors the engine API, and `EngineProxy.runCrosstab` wraps `ResultEnvelope` for provenance-friendly consumers.

## Concrete Risks

| Risk | Severity | Evidence |
|---|---:|---|
| Workspace open does not reload data | P1 | Opening a stored dataset updates active state/mode but does not reliably call `loadSAV`, OPFS rehydrate, or switch worker context. `useWorkspace.ts` still documents the reopen gap. |
| Single `main` table plus incomplete per-dataset OPFS switching | P1 | `initWorker` passes `dataset?.id` once at init. `engine.setPersistenceContext` exists in the worker but is not exposed through `EngineProxy` or called from store dataset switching. |
| Schema-only restore mints a new dataset ID | P1 | `restoreFromPersistence` reconstructs schema-only state with `crypto.randomUUID()`, which can break workspace/project identity alignment. |
| Stale analysis results are latent | P2 | `runAnalysis` has no generation/abort token. Worker FIFO reduces current risk, but future parallelism or overlapping failure paths could surface stale tables. |
| Drill-down queries are serialized despite `Promise.all` | P2 | `drillDownSlice` issues two `engineProxy.query` calls in parallel, but worker queue serializes them, so latency is doubled without real concurrency. |
| Crosstab returns `engine.queryResult` | P2 | Request IDs make routing safe, but crosstab and raw SQL sharing the same response type keeps debugging and typing brittle. |
| Duplicate `Filter` types | P2 | `analysisSlice.ts` defines a local `Filter` type separately from the canonical type in `types/index.ts`. |
| Loose row typing at store boundary | P2 | `analysisSlice` casts `response.data.rows as any[]` before `mapCrosstabRows`. |
| Fire-and-forget metadata updates | P2 | `EngineProxy.updatePersistenceMetadata` posts without awaiting success or handling `engine.error`; worker has no success ack. |
| Legacy protocol residue | P2 | `worker.ts` still documents optional `requestId` and old message names while the worker ignores non-`engine.*` messages. |

Partially resolved since the February review: worker response collision on the main UI path, workspace import ID preservation, and the merge hook crash selector.

## Architectural Debt

### Worker Monolith

`analysisWorker.ts` still owns DuckDB lifecycle, OPFS traversal, SAV/CSV load, transformations, harmonization, engine dispatch, and recovery. This is a high blast-radius file and hard to test in isolation.

### Triple Execution Surfaces

- Browser: `EngineProxy` to `analysisWorker` to `crosstabRunner`
- Headless/tests: `VelocityEngine` to the same core
- Legacy types: `worker.ts` alongside canonical `engineWorker.ts`

The convergence is directionally correct but unfinished.

### Persistence Model Not Closed

The layered model is strong on paper:

- Source files in OPFS via `opfsFileManager`
- DuckDB cache via per-dataset path helpers
- Zustand metadata and analysis state
- Rebuild-from-source via transform replay

The incomplete part is workspace reopen and dataset switching.

### Analysis Pipeline Density

`crosstabRunner.ts` mixes SQL orchestration, grid expansion, histograms, and significance. It is powerful but dense, so golden/parity discipline remains essential.

### Store Slice Coupling

`dataSlice` reaches across slices via `(get() as any).runAnalysis` in several places, which weakens modular slice boundaries.

## Highest-Value Fixes

### P0

1. Complete workspace dataset reopen: persist and use `opfsFileKey`, implement open to load/rebuild from OPFS source plus transform log, and set stable dataset identity.
2. Wire per-dataset OPFS DB switching: expose `setPersistenceContext` on `EngineProxy`, and switch or respawn the worker around stable dataset IDs.

### P1

1. Fix schema-only restore identity by using persisted metadata or workspace `activeDatasetId`.
2. Add an analysis generation guard so stale responses are ignored.
3. Keep golden/parity gates explicit for the `{ rows, tableStats }` contract.
4. Add a dedicated crosstab response type such as `engine.crosstabResult`.

### P2

1. Split `analysisWorker.ts` into persistence, ingestion, transforms, and routing modules.
2. Retire or explicitly deprecate `worker.ts`.
3. Add a real worker integration test: init, load small fixture, run crosstab, assert row shape.
4. Unify `Filter` type imports.
5. Batch drill-down count/page SQL.
6. Await or ack `updatePersistenceMetadata`.

## Bottom Line

The data layer is mid-to-upper maturity for a local-first statistical app. The headless core, query builder, request-ID protocol, and OPFS init abstraction are genuine engineering rather than prototype glue. The main gap between “works for one active SAV” and “local-first multi-dataset product” is workspace-scale data lifecycle: reopen, per-dataset cache, and identity across restore/import.
