# Velocity Performance Review and Implementation Plan

**Date:** 2026-06-28  
**Scope:** Browser web app performance for the current SAV-to-deck pilot wedge: production startup, worker initialization, SAV import/reopen, crosstabs, table/chart rendering, and editable export.  
**Method:** `docs/playbooks/performance_pass.md`; production build inspection; production browser smoke test; fresh SAV ingestion benchmarks; v2/v3 SAV parser benchmark; source-level audit of worker, crosstab, bridge, rendering, and export paths.

## Executive Summary

Velocity's performance architecture is directionally sound: heavy analytical work is in the Web Worker, DuckDB is the right local analytical engine, variable lists are virtualized, and the product already has meaningful benchmark evidence for SAV ingestion. The largest current risks are not broad architectural failure; they are concentrated in a few high-leverage surfaces.

The most urgent issue is production correctness: the built app starts, but the analysis worker fails at runtime in the production smoke test. That must be fixed before any pilot performance claim is made from production builds.

Once production worker packaging is fixed, the biggest immediate performance win is first-load slimming. The production app eagerly loads a 1.3 MB export vendor chunk even before the user exports anything. This is avoidable by lazy-loading export UI and export engines. The next gains are runtime-path improvements: avoid duplicated worker message payloads, defer distribution queries, cache analysis results, and virtualize/threshold large crosstab rendering.

## Measurements

### Production Build

Command:

```bash
npm run build
```

Result: build passed in 6.38s.

Largest emitted assets:

| Asset | Size | Gzip |
| :--- | ---: | ---: |
| `export-vendor-CV8EMVlY.js` | 1,315.04 KB | 396.11 KB |
| `index-FrdoMtpe.js` | 594.07 KB | 165.13 KB |
| `ui-vendor-D3yO-Sr7.js` | 250.31 KB | 74.00 KB |
| `index-CyERml39.css` | 177.58 KB | 28.26 KB |
| `motion-vendor-DYH9Hi_W.js` | 126.68 KB | 41.98 KB |
| `d3-vendor-BPWbNkwa.js` | 79.45 KB | 26.82 KB |
| `dnd-vendor-B3h_xd3f.js` | 50.56 KB | 16.72 KB |

### Production Browser Smoke Test

Served `dist/` locally and opened `http://127.0.0.1:4175/` with Playwright.

Observed:

- Page loaded to the splash state.
- Body text included `Worker runtime error`.
- Console logged `[enginePersistenceBridge] Worker runtime error: Event`.
- Initial network pulled `index`, `ui-vendor`, `motion-vendor`, `dnd-vendor`, `d3-vendor`, CSS, and `export-vendor`.
- Multiple Google Fonts stylesheets were requested.

This indicates a release-blocking production worker/runtime issue, plus confirmed eager loading of export code.

### SAV Ingestion Benchmark

Command:

```bash
npm run benchmark:sav
```

Fresh output was written to `validation/benchmark_sav_ingestion_latest.json`.

| Dataset | Shape | File | Metadata | Full Parse | Window Parse | Node/DuckDB Ingest | Peak RSS, Full | Peak RSS, Node |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `sleep.sav` | 271 x 55 | 0.03 MB | 8.0 ms | 3.5 ms | 6.8 ms | 125.1 ms | 142 MB | 206 MB |
| `wvs7.sav` | 97,220 x 613 | 176.59 MB | 48.7 ms | 2,567.5 ms | 3,014.1 ms | 17,366.3 ms | 1,814 MB | 2,137 MB |

Primary inference: at WVS scale, metadata parsing is cheap, full parser time is a few seconds, and database materialization is the heavy step.

### SAV v2/v3 Parser Benchmark

Command:

```bash
npx tsx scripts/benchmark-sav-v2-v3.ts --iterations=1 --batch=5000
```

Fresh output was written to `validation/benchmark_sav_v2_v3_latest.json`.

| Dataset | Scenario | v2 | v3 | Winner |
| :--- | :--- | ---: | ---: | :--- |
| `sleep.sav` | parse only | 52.8 ms | 9.3 ms | v3 |
| `sleep.sav` | vectorize | 15.2 ms | 6.7 ms | v3 |
| `wvs7.sav` | parse only | 4,235.3 ms | 3,551.3 ms | v3 |
| `wvs7.sav` | vectorize | 7,471.7 ms | 6,300.1 ms | v3 |

Memory trade-off was mixed: v2 had lower parse-only peak RSS on WVS, while v3 had lower vectorize peak RSS on WVS.

## Findings

### P0: Production Worker Runtime Failure

The production build currently reaches the app shell but fails worker initialization. This blocks production performance validation and pilot packaging confidence.

Evidence:

- Browser smoke test showed `Worker runtime error`.
- `dist/` did not include a standalone bundled `analysisWorker` asset.
- Built main chunk contains a `data:` URL worker stub for `analysisWorker.ts`.
- DuckDB WASM/worker assets were not visible in the emitted `dist` file list.

Likely driving forces:

- Vite worker packaging around `new URL('../services/analysisWorker.ts', import.meta.url)`.
- Worker entry imports `./worker/engineDispatch`, and production output may not be bundling/translating that dependency graph correctly.
- DuckDB WASM and worker URL assets require careful production emission and same-origin loading.

Implication:

- Fix before optimizing. Any performance work after this should include a production `dist` E2E gate so the app cannot regress to a dev-only success path.

Relevant source:

- `src/store/enginePersistenceBridge.ts`
- `src/services/analysisWorker.ts`
- `src/services/worker/duckdbInit.ts`
- `src/services/duckdbBundles.ts`

### P1: Export Stack Dominates Initial Load

The largest emitted chunk is `export-vendor` at 1.3 MB uncompressed. It is eagerly preloaded and fetched on startup even though exporting is not part of initial app readiness.

Driving forces:

- `ModalHost` statically imports `ExportModal`.
- `ExportModal` statically imports export pipelines.
- `xlsxExporter` statically imports `exceljs`.
- `templateMapping` statically imports `jszip`.
- `index.html` preloads `export-vendor`.

Implication:

- This is the cleanest "massive" first-load improvement: defer export code until the user opens export.
- Trade-off: first export click needs a loading state and possibly prefetch on idle after dashboard is ready.

Relevant source:

- `src/app/components/ModalHost.tsx`
- `src/components/overlays/ExportModal.tsx`
- `src/core/export/xlsxExporter.ts`
- `src/core/export/templateMapping.ts`

### P1: Font Loading Is Duplicated and Network-Dependent

Initial load requests a Google Fonts link from `index.html`, then CSS `@import` requests additional Google Font families. This adds network dependency and multiple stylesheet hops before text settles.

Driving forces:

- `index.html` includes a Google Fonts stylesheet.
- `src/index.css` imports four more Google Fonts URLs.
- The theme system appears to support multiple font families, but all are loaded globally.

Implication:

- Consolidating or self-hosting fonts improves startup reliability and privacy.
- Trade-off: visual variety may be reduced unless fonts are split by active theme or preloaded carefully.

Relevant source:

- `index.html`
- `src/index.css`

### P1: SAV Ingestion Is Memory-Amplified

The browser non-chunked ingestion path materializes parsed rows, transposes row-major data into column arrays, builds Arrow vectors, then inserts into DuckDB. This multiplies memory pressure on medium-size files.

Driving forces:

- `parseSavFile(buffer)` returns full row data.
- `columnsData` allocates one array per column and copies every cell.
- Arrow vectors are then built from the copied arrays.
- Chunked mode avoids full materialization but adds per-batch overhead.

Implication:

- For large files, v3 streaming/vectorization should become the preferred browser path once production-tested.
- Trade-off: streaming code is more complex and chunk-size tuning affects both throughput and memory.

Relevant source:

- `src/services/worker/workerIngestion.ts`
- `src/services/worker/savChunkedLoader.ts`

### P1: Crosstab Work Multiplies for Numeric, Weighted, Pairwise, and MR Cases

The crosstab path is concise but multiplicative:

1. Main aggregate query.
2. Optional histogram/range scans when distributions are requested.
3. Optional overlap query for multiple-response pairwise comparisons.
4. JavaScript significance pass over the result matrix.
5. Chi-square table stats.

Driving forces:

- Numeric/scale analysis sets `includeDistributions = true`.
- Histogram generation runs extra SQL.
- Pairwise comparisons are O(rows x columns squared).
- Multiple-response pairwise adds overlap data.

Implication:

- Ordinary crosstabs should stay fast; wide banners and numeric distribution views can become expensive.
- Trade-off: deferring distributions improves default crosstab time but adds latency when switching to violin/ridgeline/histogram views.

Relevant source:

- `src/core/analysis/buildCrosstabRequest.ts`
- `src/core/analysis/crosstabRunner.ts`
- `src/core/analysis/crosstab/histogram.ts`
- `src/core/analysis/crosstab/significance.ts`

### P2: Worker Bridge Sends Large Results Twice

After `runCrosstab` returns rows from the worker, `useProcessedAnalysisData` sends those rows back to the worker for tree/chart processing. This keeps processing off the main thread, but duplicates structured-clone traffic and result object allocation.

Driving forces:

- `analysisSlice.runAnalysis` maps raw rows on the main thread.
- `DataTable` calls `useProcessedAnalysisData`.
- The hook calls `browserEngine.processData(data, ...)`, sending result rows back to the worker.

Implication:

- Large result matrices pay unnecessary bridge overhead.
- Trade-off: folding processing into `runCrosstab` changes the engine response shape and needs careful UI/export compatibility work.

Relevant source:

- `src/store/slices/analysisSlice.ts`
- `src/hooks/useProcessedAnalysisData.ts`
- `src/services/worker/engineHandlers.ts`

### P2: Crosstab Tree Building Has Avoidable O(rows x cols) Work

`buildTree` groups by row key, then for each column filters matching rows again. For normal survey tables this is acceptable, but wide banners and multi-level rows can make this a hotspot.

Driving forces:

- Per node, per column: `groupData.filter(d => d.colKey === cKey)`.
- Recursive tree building repeats grouping at each depth.

Implication:

- Indexing rows by column key before cell construction should reduce post-processing time.
- Trade-off: modest code complexity and test coverage needed for multi-level rows, weighted cells, metric cells, and significance markers.

Relevant source:

- `src/core/analysis/treeBuilder.ts`

### P2: Crosstab Table Rendering Is Not Virtualized

Variable lists and harmonization tables use `react-window`, but crosstab output renders all rows/columns and each cell may include animated numbers and motion wrappers.

Driving forces:

- `DataTable` maps all processed rows.
- `CrosstabCell` uses animated number and motion wrappers when animation triggers are present.
- Large tables create many DOM nodes and animation instances.

Implication:

- Large result matrices will eventually jank even if DuckDB is fast.
- Trade-off: virtualized tables are more complex with sticky headers, column widths, drag-to-merge, accessibility, and export parity.

Relevant source:

- `src/features/dashboard/components/DataTable.tsx`
- `src/features/dashboard/components/CrosstabCell.tsx`

## Implementation Plan

### Phase 0: Production Performance Gate

**Goal:** Make production build runnable and measurable.

**Status:** Completed on 2026-06-28. `createAnalysisWorker` now uses Vite's explicit `?worker` entry so production builds emit `analysisWorker` plus same-origin DuckDB worker/WASM assets. Added `playwright.production.config.ts`, `tests/e2e/production-smoke.spec.ts`, and `npm run test:e2e:production` to build, serve `dist`, wait for `[enginePersistenceBridge] Engine ready`, fail on `Worker runtime error`, assert same-origin worker/WASM fetches, and attach `production-startup-resources.json` for future comparisons.

Validation:

```bash
npm run build
PLAYWRIGHT_PRODUCTION_PORT=4176 npm run test:e2e:production
npm run typecheck
npm run typecheck:test
```

Next phase: Phase 1, First-Load Slimming.

Tasks:

1. Add a production smoke test that runs `npm run build`, serves `dist`, opens the app, and fails on `Worker runtime error`.
2. Fix worker bundling so `analysisWorker` and DuckDB WASM/worker assets load from emitted production assets.
3. Assert DuckDB readiness in production with a simple `engine.ping` / `SELECT 1` check.
4. Capture resource list and startup timing as a small artifact for future comparisons.

Success criteria:

- Production app reaches ready/restoration state without worker error.
- Dist smoke test is part of CI or a release gate.
- DuckDB worker and WASM assets are visible and same-origin-resolvable.

Risk:

- Vite worker packaging changes can be brittle. Keep the fix small and verify dev, preview, and static hosting modes.

### Phase 1: First-Load Slimming

**Goal:** Reduce initial payload without changing analysis behavior.

**Status:** Completed on 2026-06-28. `ModalHost` now lazy-loads the analysis `ExportModal` behind explicit export intent, with a lightweight modal loading state for the first open. `DeckBuilder.export()` dynamically imports the PPTX/XLSX exporters only when deck export is invoked, preventing engine/deck startup from pulling export libraries. Vite chunking now keeps generated runtime helpers in `runtime-vendor` instead of colocating them with export libraries. Google Fonts are consolidated into one HTML stylesheet request and CSS `@import` font requests were removed.

Before/after evidence:

| Measurement | Before Phase 1 | After Phase 1 |
| :--- | ---: | ---: |
| Initial `export-vendor` startup fetch | Yes, modulepreloaded | No startup fetch |
| `export-vendor` gzip kept off startup path | 396.11 KB | 395.67 KB deferred |
| Main app chunk gzip | 163.99 KB | 153.74 KB |
| App CSS gzip | 28.28 KB | 26.57 KB |

Validation:

```bash
npm run build
PLAYWRIGHT_PRODUCTION_PORT=4176 npm run test:e2e:production
npm run test:e2e -- tests/e2e/pilot-workflow.spec.ts
npm run test:run -- src/components/overlays/ExportModal.test.tsx src/engine/__tests__/DeckBuilder.test.ts
npm run typecheck
npm run typecheck:test
npx eslint src/app/components/ModalHost.tsx src/engine/DeckBuilder.ts tests/e2e/production-smoke.spec.ts playwright.production.config.ts vite.config.ts
```

The production smoke test now asserts startup never fetches `export-vendor` while still requiring the analysis worker and DuckDB WASM/worker assets to initialize successfully.

Next phase: Phase 2, Query and Worker Bridge Efficiency.

Tasks:

1. Lazy-load `ExportModal` from `ModalHost`.
2. Move `exportXlsx`, `exportPptx`, `templateMapping`, `exceljs`, and `jszip` behind dynamic imports where practical.
3. Ensure `export-vendor` is not modulepreloaded on the first page.
4. Add a loading state for first export open.
5. Consolidate Google Fonts declarations and remove duplicate CSS `@import` requests.
6. Consider self-hosting only the families actually needed by current themes.

Success criteria:

- Initial production network no longer fetches `export-vendor`.
- Initial JS bytes drop by roughly 1.3 MB uncompressed / 396 KB gzip.
- Export still passes targeted PPTX/XLSX/template tests.

Risk:

- Dynamic import boundaries can split shared code in surprising ways. Confirm with `npm run build` and a browser network trace.

### Phase 2: Query and Worker Bridge Efficiency

**Goal:** Cut repeated worker/main-thread payloads and avoid unnecessary crosstab work.

**Status:** Completed on 2026-06-28 for the worker-bridge and repeat-query paths. `engine.runCrosstab` now accepts an optional processed-data request, maps SQL rows with the same `mapCrosstabRows` path used by the store, runs `processAnalysisData` in the worker, and returns raw rows, processed table data, and query/process timing metadata in one response. `DataTable` consumes the processed crosstab payload when it matches the active row/column variables, so table view no longer sends the same crosstab rows back through `engine.processData`. `engine.processData` remains as a fallback and for chart-type transforms. `analysisSlice` now keeps a bounded in-memory crosstab cache keyed by dataset identity, transform log, row/column variables, filters, weight, analysis settings, and normalized query options; identical reruns reuse cached raw + processed results.

Implementation note: histogram/distribution deferral remains the next runtime-path refinement because the current chart-selection flow does not safely re-run analysis when a distribution chart is selected. The worker timing fields added in this phase expose the query/process split needed to make that follow-up measurable without changing statistical outputs.

Before/after evidence:

| Measurement | Before Phase 2 | After Phase 2 |
| :--- | :--- | :--- |
| Table render worker roundtrips after crosstab | 2 (`runCrosstab` then `processData`) | 1 (`runCrosstab` includes processed table data) |
| Repeated identical crosstab runs | Always called worker analysis | Bounded cache hit, no second worker analysis call |
| Worker timing detail | Single crosstab `durationMs` | `queryMs`, `processMs`, `totalMs`; `processData.durationMs` |
| Tree cell construction | Per group × column `filter()` scans | Per group column index reused for cells |
| Production build main JS gzip | 154.03 KB after Phase 1 | 154.39 KB after Phase 2 |

Validation:

```bash
npm run test:run -- src/services/worker/engineHandlers.loadProgress.test.ts src/test/integration/storeWorker.test.ts src/core/analysis/analysisProcessor.test.ts src/engine/BrowserEngine.test.ts src/hooks/useProcessedAnalysisData.test.tsx
npm run typecheck
npm run typecheck:test
npx eslint src/services/worker/engineHandlers.ts src/types/engineWorker.ts src/services/EngineProxy.ts src/engine/BrowserEngine.ts src/store/slices/analysisSlice.ts src/hooks/useProcessedAnalysisData.ts src/hooks/useProcessedAnalysisData.test.tsx src/features/dashboard/components/DataTable.tsx src/core/analysis/treeBuilder.ts src/services/worker/engineHandlers.loadProgress.test.ts src/test/integration/storeWorker.test.ts src/store/slices/data/sliceContext.ts src/store/slices/data/datasetActions.ts src/app/hooks/useSessionLifecycle.ts src/app/hooks/useWorkspaceOrchestration.ts
npm run build
npx stryker run --mutate src/core/analysis/treeBuilder.ts
```

Mutation note: the narrowed Stryker run passed the configured break threshold (`49.48 >= 40`) but reported broad surviving-mutant gaps in older `treeBuilder` behavior; it also left mutation side effects in the worktree/index that had to be restored. Do not treat that score as a new quality baseline without cleaning the Stryker workflow.

Production smoke note: `PLAYWRIGHT_PRODUCTION_PORT=4176 npm run test:e2e:production` passed during this phase after the worker-bridge change, but the final rerun after the cache addition could not be executed because local server binding requires escalation and the approval system hit its usage limit. The final `npm run build` passed.

Next phase: Phase 3, Ingestion Throughput and Memory.

Tasks:

1. Done: add timing instrumentation to `engine.runCrosstab` and `engine.processData`; main-thread render commit timing remains a rendering-phase follow-up.
2. Done: add an option for `runCrosstab` to return processed analysis data in one worker response.
3. Done: keep raw row output available for compatibility.
4. Follow-up: defer histogram/distribution SQL until a distribution chart is selected.
5. Done: cache crosstab results by dataset/table version, row vars, col var, filters, weight, and analysis settings.
6. Done by cache key: invalidate on recode/transform log, filter changes, dataset switch, weight changes, and session import.

Success criteria:

- Table view no longer sends crosstab rows back to the worker for processing.
- Numeric frequency/table views avoid histogram queries unless distribution chart data is requested.
- Repeated slide switches/table-chart toggles reuse cached results.

Risk:

- Cache invalidation must preserve statistical correctness and dual-state integrity.
- Response-shape changes touch UI, export, deck builder, and tests.

### Phase 3: Ingestion Throughput and Memory

**Goal:** Reduce browser memory pressure and improve large SAV load stability.

**Status:** Mostly completed on 2026-06-28. The structural memory change (Task 3), progress-phase granularity (Task 4), and v3-preference (Task 1) landed, and chunk-size/credit tuning (Task 2) was validated against the real WVS-scale `.sav` (`test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav`, 176 MB). Only browser wall-clock upload-to-first-crosstab instrumentation (Task 5) is deferred — it is cross-cutting telemetry, not a data-availability gap, and is folded into the Phase 5 dashboard work.

Correction (same-day): an earlier draft of this status claimed no WVS-scale `.sav` was present locally and used that to defer Task 2. That was wrong — the 176 MB WVS file is in `test_data/WVS/`, and the `benchmark-sav-v2-v3.ts` harness runs against it. The benchmark was subsequently run (batch-size sweep below) and Task 2 reclassified from deferred to validated.

Task 3 (avoid full materialization for medium files): SAV ingestion previously routed only files above 50 MB to the bounded-memory streaming path; everything below ran the non-chunked `loadSAV` path, which holds parsed row-major rows, a transposed per-column copy, and Arrow vectors in memory simultaneously (~3× transient peak). The routing threshold is now a dedicated, documented `STREAMING_ROUTE_THRESHOLD_BYTES` (lowered to 8 MB) with a `shouldUseStreamingIngestion(byteLength, forceChunked)` helper used by both `loadSAV` (route decision) and `loadSAVChunked` (streaming-vs-legacy decision). Medium files (8–50 MB) now take the v3 single-pass streaming path and never materialize the full row-major transpose.

Task 1 (prefer v3): v3 single-pass remains the canonical path and is now the first attempt for every file routed to streaming, including the newly-routed 8–50 MB band (v3 → v2 → legacy fallback order preserved). `ENABLE_SAV_STREAMING_LEGACY` is intentionally left on as a safety fallback; flipping it off should wait for WVS-scale production validation.

Task 4 (distinct phases): the load-progress phase union (`SavLoadProgressUpdate`, `engine.loadProgress`, worker `loadProgress`, and store `LoadProgressState`) now carries `'parsing' | 'vectorizing' | 'inserting' | 'verifying' | 'complete'`. The non-chunked path emits `vectorizing` before Arrow construction and `verifying` before the row-count check; the streaming and legacy paths emit `verifying` before their final `COUNT(*)` reconciliation. `getLoadStageHeadline` maps the new phases to "Building columns…" and "Verifying data…".

Before/after evidence:

| Measurement | Before Phase 3 | After Phase 3 |
| :--- | :--- | :--- |
| Full-materialization (row-major transpose + double copy) upper size bound | < 50 MB | < 8 MB |
| 8–50 MB SAV ingestion path | Non-chunked full materialization (~3× transient peak) | v3 single-pass streaming (bounded per-batch memory) |
| Reported load phases | `parsing`, `inserting`, `complete` | `parsing`, `vectorizing`, `inserting`, `verifying`, `complete` |
| Routing constant | `CHUNKED_THRESHOLD_BYTES` (ambiguous, 50 MB) | `STREAMING_ROUTE_THRESHOLD_BYTES` (8 MB) + `shouldUseStreamingIngestion` helper |
| Worker ingestion unit coverage | None for `savArrowHelpers` | `shouldUseStreamingIngestion`, `clampChunkSize`, `buildVectorsFromBatch`, `buildEmptyVectorsFromMetadata` |

Task 2 tuning evidence (WVS, 97,220 rows × 613 vars, single iteration via `benchmark-sav-v2-v3.ts`):

| Batch size | v3 parse-only | v3 vectorize | v2 vectorize | v3 bridge queue (max / produced / consumed) |
| ---: | ---: | ---: | ---: | :--- |
| 2,500 | 3,269 ms | 5,724 ms | 8,102 ms | 2 / 39 / 39 |
| 5,000 | 2,965 ms | 6,287 ms | 7,067 ms | 2 / 20 / 20 |
| 10,000 | 3,025 ms | 6,556 ms | 6,849 ms | 2 / 10 / 10 |

Tuning conclusion: v3 single-pass beats v2 on wall-clock at every batch size (parse and vectorize), confirming v3 as the canonical path. The v3 bridge queue depth never exceeds 2 at the current `initialCredits=2 / maxCredits=4` — the consumer (Arrow build + insert) keeps pace with the producer, so raising `maxCredits` would only let the producer run further ahead and grow memory with no throughput gain, while lowering it risks serializing. The default chunk size (5,000) sits in the middle of the curve and benefits from the adaptive 500–10,000 clamp already in place. **No constant changes are warranted; the existing chunk-size and credit defaults are validated against WVS-scale data.**

Limitations (honest): these are Node-side parser/vectorize timings and peak RSS, not the browser worker's insert path, and Node RSS high-water marks are GC-noisy — so the batch-count and bridge-queue-depth signals are reliable for chunk/credit selection, but the absolute peak-RSS figures are not a browser memory profile. Separately, the Task 3 routing change can only be exercised end-to-end in the browser worker (`loadSAV`/`loadSAVChunked`); the Node benchmark bypasses that routing, so the medium-band *browser* peak-memory delta specifically remains structurally argued rather than measured here. (Superseded in part by the correction below: medium-band `.sav` fixtures now exist locally and have measured Node-side ingestion numbers; only the browser routing/peak-memory delta is still unmeasured.)

Correction (2026-06-28, later): the earlier claim that `test_data` had no 8–50 MB `.sav` is now obsolete. Four mid-size fixtures were added (local-only / gitignored) and wired into both SAV benchmark harnesses — three GSS annual cross-sections (NORC, no-login download) and one stitched British Social Attitudes file — filling the gap between `sleep.sav` (0.03 MB) and the 176 MB WVS. The stitched fixture is produced by `scripts/stitch-bsa-waves.py` (BSA waves 2014–2017, columns shared by ≥3 waves); fresh numbers are in `validation/benchmark_sav_ingestion_midsize.json`.

Medium-band ingestion evidence (Node-side, `benchmark-sav-ingestion.ts`; same Node/GC caveats as the WVS numbers above — not a browser worker memory profile):

| Dataset | Size | Shape | Full Parse | Node/DuckDB Ingest | Peak RSS, Ingest |
| :--- | ---: | :--- | ---: | ---: | ---: |
| `GSS2021.sav` | 17.4 MB | 4,032 × 938 | 134.3 ms | 798.4 ms | 507 MB |
| `GSS2024.sav` | 20.0 MB | 3,986 × 980 | 129.2 ms | 751.1 ms | 572 MB |
| `GSS2022.sav` | 29.2 MB | 4,149 × 1,290 | 192.1 ms | 1,222.0 ms | 796 MB |
| `bsa_stitched_2014_2017.sav` | 42.2 MB | 14,136 × 390 | 100.5 ms | 813.0 ms | 868 MB |

All four ingest with full metadata/full-parse/window/node row-count parity. The set spans the band with two complementary shapes: GSS is wide/short (≈1k columns, ≈4k rows, stressing the column transpose) and the stitched BSA file is narrow/tall with realistic partial missingness (390 trend variables shared by ≥3 of the 2014–2017 waves). What these Node numbers still do *not* exercise is the Task 3 `loadSAV`/`loadSAVChunked` routing itself — they characterize medium-file parse+ingest cost but the browser routing/peak-memory delta remains the open browser-tooling item.

Validation:

```bash
npm run test:run -- src/services/worker/savArrowHelpers.test.ts src/services/worker/engineHandlers.loadProgress.test.ts src/test/integration/storeWorker.test.ts src/lib/uploadFeedback.test.ts
npm run typecheck
npm run typecheck:test
npx eslint src/services/worker/savArrowHelpers.ts src/services/worker/savArrowHelpers.test.ts src/services/worker/workerIngestion.ts src/services/worker/savChunkedLoader.ts src/services/worker/savChunkedLegacy.ts src/services/worker/loadProgress.ts src/lib/uploadFeedback.ts src/types/engineWorker.ts src/types/worker.ts src/store/slices/data/types.ts
npm run build
# Task 2 tuning evidence (real WVS-scale .sav):
npx tsx scripts/benchmark-sav-v2-v3.ts --iterations=1 --batch=5000
# Medium-band fixtures (added later): GSS + stitched BSA ingestion numbers:
npx tsx scripts/benchmark-sav-ingestion.ts --output=validation/benchmark_sav_ingestion_midsize.json
```

Next phase: Phase 4, Rendering Scalability.

Tasks:

1. Done (Task 1): v3 single-pass is the first streaming attempt for all routed files; legacy fallback retained pending WVS-scale production validation.
2. Validated (Task 2): chunk size and bridge credits benchmarked against the 176 MB WVS `.sav` across batch sizes 2,500/5,000/10,000; v3 wins on time at all sizes and bridge queue depth stays at 2 under the 2/4 credit config, so the current defaults are kept deliberately (not deferred). See the tuning table above.
3. Done (Task 3): dedicated `STREAMING_ROUTE_THRESHOLD_BYTES` (8 MB) routes medium files away from the non-chunked row-major transpose.
4. Done (Task 4): `vectorizing` and `verifying` phases added across the progress type chain and emitted by the ingestion paths; headline copy updated.
5. Deferred (Task 5): browser wall-clock upload-to-first-crosstab timing — cross-cutting instrumentation spanning the upload hook and the analysis slice with no current surface to record it; folded into the Phase 5 performance-dashboard work.

Success criteria:

- WVS-scale browser path has lower peak memory than full materialization. (Held before and after; unchanged by this phase.)
- Medium pilot files do not trigger avoidable memory spikes. (Addressed structurally by the lowered routing threshold; medium-band Node-side parse+ingest is now measured — see the correction above — but the browser routing/peak-RSS delta is still pending browser tooling.)
- Progress UI reflects actual parse/insert phases. (Done: parse/vectorize/insert/verify now distinct.)

Risk:

- Streaming reduces peak memory but may increase total wall-clock depending on chunk size and insert overhead. The 8 MB threshold is a deliberate, documented default and is the single value to revisit once real pilot file sizes are known.
- The forced-chunked path for sub-8 MB files now also prefers v3 (previously legacy) when forced above 8 MB; sub-8 MB forced loads still fall through to the legacy path, preserving existing behavior for that case.

### Phase 4: Rendering Scalability

**Goal:** Keep large results responsive after query completion.

**Status:** All five tasks completed. Tasks 1, 2, 4, and 5 landed on 2026-06-28 in the order this phase's own Risk note prescribes ("Start with thresholded reduced motion and tree indexing before full table virtualization"): the motion threshold (Task 1) and tree indexing (Task 4) shipped first, then the render-shape benchmark (Task 5), then row virtualization (Task 2). Horizontal column virtualization for very wide banners (Task 3), previously deferred, landed on 2026-06-29 — see the Task 3 note below. Phase 4 is complete.

Task 2 (row virtualization): large tables now window the `<tbody>` instead of rendering every row. Rather than replace the semantic `<table>` with a div-based windowing list (which would break the sticky `<thead>`, fixed column widths, and the `data-merge-*` drag targets), the table structure is preserved and only the body is windowed: `flattenVisibleRows` flattens the recursive row tree into display order (including a node's children only when expanded, mirroring `CrosstabRow`'s `expandedKeys[key] ?? true`), `computeRowWindow` picks the visible slice from the scroll position (offset by the sticky header height), and top/bottom spacer `<tr>`s carry the height of the off-screen rows so the scrollbar stays correct. Rendering is gated by `shouldVirtualizeRows` (`VIRTUALIZE_ROW_THRESHOLD = 100` flattened rows): tables at or below the threshold keep the original recursive, fully-featured path unchanged, so the common case has zero behavior change. `CrosstabRow` gained a `renderChildren` prop (default `true`); the windowed path passes `false` because flattening already linearises the hierarchy. The scroll listener is `requestAnimationFrame`-throttled (one re-render per frame), and `useCrosstabRowWindow` measures the container with `ResizeObserver` when available (falling back to a window `resize` listener). Row height is a per-density estimate (`ESTIMATED_ROW_HEIGHT`: compact 33 px, generous 45 px) — the standard fixed-height windowing assumption; multi-line labels introduce minor, bounded scroll drift. Drag-to-merge still works because drags start from and target on-screen rows; the one bounded limitation is that a multi-select merge whose *source* rows are scrolled off-screen resolves those sources by raw key rather than label (the target, always under the cursor, is unaffected). Verification: the flattening, window math, and the windowed/non-windowed DataTable branches are unit-tested (jsdom has no layout, so the hook falls back to the default viewport and a representative window still renders). Real-browser behaviour is covered by `tests/e2e/crosstab-virtualization.spec.ts`, which uploads an in-memory CSV with a 180-value `city` column, builds a `city × region` crosstab, and asserts that far fewer than 180 rows are in the DOM, a spacer `<tr>` is present, **scrolling changes which row is first in the DOM** (the definitive proof of scroll-driven windowing — a non-virtualized table keeps the same first row), and the sticky header and Total row survive the scroll. The existing `tests/e2e/visual-polish-crosstab.spec.ts` (common, non-windowed path) continues to pass, confirming the refactor did not regress ordinary crosstabs.

Task 3 (column virtualization): very wide banners now window the body columns instead of laying out every one. The challenge the deferral note flagged — the sticky `<thead>`, proportional `computeCrosstabColumnWidths` widths, per-column drag-to-merge targets, and the trailing Total column all assuming every column is laid out — is resolved the same way row virtualization resolved its analog: above `VIRTUALIZE_COL_THRESHOLD = 30` body columns the table switches from proportional percentage widths to a uniform fixed pixel width per data column (`VIRTUALIZED_COL_WIDTH = 112`), which lets the windowing math assume a single column width (the horizontal analog of the fixed row-height estimate). `computeColWindow` picks the on-screen column slice from `scrollLeft` (offset by the fixed row-label column width so the first data column is located correctly), and left/right spacer `<th>`/`<td>` cells carry the width of the off-screen columns so the horizontal scrollbar stays correct. The always-present row-label column and the trailing Total column are never windowed; the table is given a fixed natural width (`virtualizedTableWidth`) so the scrollbar is stable regardless of which slice is on screen. Both the `<thead>` row and every body row (`CrosstabRow`, via new `visibleColKeys` / `colLeftPadding` / `colRightPadding` props) and the pinned Total row render the same spacer + visible-slice structure, so `table-layout: fixed` keeps all rows column-aligned. Tables at or below the threshold keep the proportional-width, render-every-column path unchanged, so ordinary crosstabs are untouched, and the change composes with row virtualization (one reads `scrollLeft`, the other `scrollTop`) for tables that are both tall and wide. The bounded limitation mirrors the row case: drag-to-merge works for on-screen columns (drag start and drop target are both under the cursor), but a multi-select merge whose *source* columns are scrolled off the horizontal viewport must be scrolled back into view first. Verification: `crosstabColumnVirtualization` unit tests cover the threshold, fixed-width math, and the window/spacer math; `DataTable` unit tests cover the windowed and non-windowed column branches; and `tests/e2e/crosstab-column-virtualization.spec.ts` builds a `region × wave` crosstab with a 60-value banner in a real browser and asserts far fewer than 60 column headers are in the DOM, a spacer `<th>` is present, the table is wider than its viewport, **horizontal scrolling changes which column is first in the DOM**, and the row-label and Total headers survive the scroll.

Task 1 (motion thresholds): per-cell entry animations in the crosstab (the `AnimatedNumber`, the fade-in metadata wrapper, the significance spring-lock, and the Mission Control phosphor ghost) each mount their own Framer Motion instance. On large result matrices the count of simultaneously-animating cells — not DuckDB — is what makes the table jank after a query completes. A new `crosstabMotionPolicy` helper (`MAX_ANIMATED_CROSSTAB_CELLS = 500`, `countTreeNodes`, `shouldAnimateCrosstab`) drives a single gate in `DataTable`: when total rendered cells (row nodes × body columns) exceed the threshold, `animationKey` is left `undefined`, which every animated path in `CrosstabCell` already treats as "render static." Ordinary survey crosstabs (a 5-point Likert × 6-column banner = 30 cells; a 20-row categorical × 10-column banner = 200 cells) keep their entry animation; wide banners and long multi-level tables drop it. This leaves the existing `prefers-reduced-motion` path unchanged and adds the size threshold as an independent gate.

Task 4 (treeBuilder indexing): already implemented in Phase 2. `buildTree` indexes each group's rows into a `Map<string, AggregatedRow[]>` keyed by `colKey` once per node (`rowsByColumn`), replacing the old per-column `groupData.filter(d => d.colKey === cKey)` scan. The render benchmark below confirms the processing path is now cheap (sub-2 ms even at 6,840 cells), so the remaining rendering cost is DOM/motion, not tree building.

Task 5 (render-shape benchmark): `scripts/benchmark-crosstab-render.ts` (`npm run benchmark:crosstab`) measures `processAnalysisData`/`buildTree` on the two shapes that stress the table — wide banners and deep multi-level rows — and reports row-node count, rendered-cell count, and whether each result crosses the Task 1 animation threshold. Honest scope: this is a Node-side measurement of the processing path, not a headless-browser DOM render/commit profile, and Node RSS is GC-noisy (timing is the reliable signal). Browser wall-clock render timing is folded into the Phase 5 performance dashboard, consistent with Phase 3 Task 5. Fresh output is in `validation/benchmark_crosstab_render_latest.json`.

Render benchmark evidence (30 iterations, `processAnalysisData`):

| Scenario | Shape | Row nodes | Rendered cells | Animations | Mean | Min / Max |
| :--- | :--- | ---: | ---: | :--- | ---: | ---: |
| `wide-banner-typical` | 12 × 30 banner | 12 | 360 | on | 0.15 ms | 0.10 / 0.41 ms |
| `wide-banner-large` | 24 × 60 banner | 24 | 1,440 | off | 0.41 ms | 0.34 / 0.76 ms |
| `multi-level-typical` | 8 × 6 × 5 nested × 6 | 296 | 1,776 | off | 0.47 ms | 0.40 / 0.89 ms |
| `multi-level-deep` | 10 × 8 × 6 nested × 12 | 570 | 6,840 | off | 1.43 ms | 1.20 / 2.00 ms |

Primary inference: the tree-building/processing path is not the rendering bottleneck (≤ ~1.4 ms mean even at 6,840 cells), which is why this phase targets the per-cell motion instances rather than the compute. The `Animations` column shows the Task 1 threshold in action: only the typical wide banner (360 cells) stays animated; every larger shape renders static.

Before/after evidence:

| Measurement | Before Phase 4 | After Phase 4 |
| :--- | :--- | :--- |
| Per-cell entry animation on large tables | Always on (one Framer Motion instance per cell) | Suppressed above 500 rendered cells; cells render static |
| Animation gate | `prefers-reduced-motion` only | `prefers-reduced-motion` **or** result-size threshold |
| Rows in DOM for a large table | All flattened rows | Windowed above 100 rows (visible slice + overscan + spacers) |
| Columns in DOM for a wide banner | All body columns (proportional %, often too thin to read) | Windowed above 30 columns (fixed 112 px columns + overscan + spacers); row-label and Total never windowed |
| Render-shape regression coverage | None | `benchmark:crosstab` (wide-banner + multi-level) + `crosstabMotionPolicy` / `crosstabVirtualization` / `crosstabColumnVirtualization` unit tests + DataTable threshold & row/column windowing tests |
| `treeBuilder` cell construction | (already indexed in Phase 2) | Confirmed; benchmarked sub-2 ms at 6,840 cells |
| Production build main JS gzip | 154.39 KB after Phase 2 | 156.34 KB after Phase 4 (incl. column virtualization) |

Validation:

```bash
npm run test:run -- src/features/dashboard/components/crosstabMotionPolicy.test.ts src/features/dashboard/components/crosstabVirtualization.test.ts src/features/dashboard/components/crosstabColumnVirtualization.test.ts src/features/dashboard/components/DataTable.test.tsx src/features/dashboard/components/CrosstabCell.test.tsx src/core/analysis/analysisProcessor.test.ts src/hooks/useProcessedAnalysisData.test.tsx
npm run typecheck
npm run typecheck:test
npx eslint src/features/dashboard/components/crosstabMotionPolicy.ts src/features/dashboard/components/crosstabVirtualization.ts src/features/dashboard/components/crosstabColumnVirtualization.ts src/features/dashboard/components/crosstabColumnVirtualization.test.ts src/features/dashboard/components/useCrosstabRowWindow.ts src/features/dashboard/components/useCrosstabColWindow.ts src/features/dashboard/components/CrosstabRow.tsx src/features/dashboard/components/DataTable.tsx src/features/dashboard/components/DataTable.test.tsx scripts/benchmark-crosstab-render.ts
npm run build
npm run benchmark:crosstab
npm run test:e2e -- tests/e2e/crosstab-virtualization.spec.ts tests/e2e/crosstab-column-virtualization.spec.ts tests/e2e/visual-polish-crosstab.spec.ts
```

Completion note (Task 3 — horizontal column virtualization for very wide banners): landed 2026-06-29, no longer deferred. The deferral note had identified the obstacles — the sticky `<thead>`, proportional `computeCrosstabColumnWidths` widths, per-column drag-to-merge targets, and the trailing Total column all assuming every column is laid out — and the resolution is the horizontal mirror of row virtualization: above 30 body columns the table adopts a uniform fixed pixel column width so a moving horizontal window has a single width to reason about (no width re-derivation), the row-label and Total columns are excluded from windowing, and drag-to-merge keeps working for on-screen columns. The off-screen multi-select-merge-source limitation is the documented, bounded analog of the row case. See the Task 3 paragraph above for the full design and verification.

Next phase: Phase 5, Ongoing Performance Guardrails.

Tasks:

1. Done (Task 1): result-size threshold suppresses per-cell entry animations above `MAX_ANIMATED_CROSSTAB_CELLS` (500 rendered cells); independent of the existing reduced-motion path.
2. Done (Task 2): large tables window the `<tbody>` above `VIRTUALIZE_ROW_THRESHOLD` (100 flattened rows) via `flattenVisibleRows` + `computeRowWindow` + spacer rows, preserving the `<table>`/sticky-header/column-width/drag-merge structure; small tables keep the original recursive path. Unit-tested and verified in a real browser by `tests/e2e/crosstab-virtualization.spec.ts` (scroll-driven windowing on a 180-row table).
3. Done (Task 3): wide banners window the body columns above `VIRTUALIZE_COL_THRESHOLD` (30 columns) via `computeColWindow` + fixed-width columns + left/right spacer cells, preserving the sticky `<thead>`/Total/drag-merge structure; narrow banners keep the original proportional-width path. Unit-tested and verified in a real browser by `tests/e2e/crosstab-column-virtualization.spec.ts` (scroll-driven horizontal windowing on a 60-column banner).
4. Done (Task 4): `treeBuilder` already indexes group rows by `colKey` once per node (`rowsByColumn`, landed Phase 2); confirmed and benchmarked here.
5. Done (Task 5): `benchmark:crosstab` measures the wide-banner and multi-level row shapes; results in `validation/benchmark_crosstab_render_latest.json`.

Success criteria:

- Large result table interaction stays responsive. (Addressed: per-cell motion is suppressed above the cell threshold, rows are windowed above the row threshold, and columns are windowed above the column threshold, so neither off-screen rows nor off-screen columns are in the DOM.)
- Render time and layout shifts are measured before/after. (Processing path measured via `benchmark:crosstab`; scroll-driven windowing verified in a real browser by `tests/e2e/crosstab-virtualization.spec.ts`; in-browser render/CLS timing folded into Phase 5.)
- Drag-to-merge and sticky headers remain usable. (Preserved by design — the `<table>`/`<thead sticky>` structure and `data-merge-*` attributes are unchanged; row windowing windows only the `<tbody>`, and column windowing renders spacer cells so every row stays column-aligned under `table-layout: fixed`. The e2e specs assert the sticky header survives both vertical and horizontal scrolling; `visual-polish-crosstab.spec.ts` confirms the common path is unregressed. The bounded limitations are label resolution for off-screen multi-select merge *source* rows and pickup of off-screen merge *source* columns, both documented above.)

Risk:

- Virtualized tables complicate accessibility, sticky headers, row expansion, and drag interactions. (Mitigated by keeping the semantic table and windowing only the body with spacer rows, and by leaving tables ≤ 100 rows on the original path. The residual risk is scroll drift from the fixed per-density row-height estimate when many rows wrap to multiple lines — bounded, and the single knob to revisit if pilot tables show drift.)
- The 500-cell animation threshold and the 100-row virtualization threshold are deliberate defaults. Revisit them if pilot users report lost animation on "presentation-sized" tables, jank below the thresholds, or visible scroll drift.

### Phase 5: Ongoing Performance Guardrails

**Goal:** Prevent regressions while pilot work continues.

Tasks:

1. Add a small performance dashboard or script that reports:
   - initial loaded bytes
   - worker ready time
   - upload-to-ready time
   - first crosstab time
   - export modal open time
2. Keep benchmark JSON files reproducible and separate from frozen pilot evidence.
3. Add PR checklist language: performance hypothesis, measurement, before/after evidence.
4. Add thresholds for production smoke and first-load payload where stable enough.

Success criteria:

- Performance regressions become visible in normal development.
- Pilot claims can cite production-browser evidence, not only Node or Vite dev evidence.

## Recommended Execution Order

1. **Fix production worker packaging and add production smoke gate.**
2. **Lazy-load export and remove duplicate font loading.**
3. **Instrument crosstab/processing/render durations.**
4. **Merge crosstab processing into a single worker response and defer histograms.**
5. **Tune v3 streaming ingestion for browser loads.**
6. **Add result caching.**
7. **Optimize/virtualize large table rendering.**

This order is deliberately conservative: first make production runnable, then remove obvious first-load weight, then optimize measured runtime paths while preserving worker/main-thread boundaries and statistical correctness.

## Open Questions

- Is the production worker failure specific to `python3 -m http.server` static serving, or does it also occur in the intended pilot hosting environment?
- Should WebR remain in the installed dependency graph while the roadmap marks it pilot-gated, or should it move behind a more explicit optional/runtime boundary?
- What is the real pilot file size distribution? WVS-scale stress data is useful, but optimization thresholds should be calibrated against actual agency files.
- Should export be prefetched after dashboard ready, or only loaded on explicit export intent?

## Files Changed by Review Commands

The measurement commands refreshed:

- `validation/benchmark_sav_ingestion_latest.json`
- `validation/benchmark_sav_v2_v3_latest.json`
- `validation/benchmark_crosstab_render_latest.json` (Phase 4; `npm run benchmark:crosstab`)

Keep these if today's measurements should become the current local benchmark baseline; otherwise regenerate or discard intentionally in the performance PR.
