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

Tasks:

1. Add timing instrumentation to `engine.runCrosstab`, `engine.processData`, and main-thread render commit points.
2. Add an option for `runCrosstab` to return processed analysis data in one worker response.
3. Keep raw row output available only where needed for compatibility.
4. Defer histogram/distribution SQL until a distribution chart is selected.
5. Cache crosstab results by dataset/table version, row vars, col var, filters, weight, and analysis settings.
6. Add explicit cache invalidation for recode, filter changes, dataset switch, weight changes, and session import.

Success criteria:

- Table view no longer sends crosstab rows back to the worker for processing.
- Numeric frequency/table views avoid histogram queries unless distribution chart data is requested.
- Repeated slide switches/table-chart toggles reuse cached results.

Risk:

- Cache invalidation must preserve statistical correctness and dual-state integrity.
- Response-shape changes touch UI, export, deck builder, and tests.

### Phase 3: Ingestion Throughput and Memory

**Goal:** Reduce browser memory pressure and improve large SAV load stability.

Tasks:

1. Prefer v3 single-pass streaming for browser chunked loads after production verification.
2. Tune chunk size and bridge credits against WVS-scale data and a medium pilot file.
3. Avoid non-chunked row-major transpose for files above a lower threshold.
4. Track parse, vectorize, insert, and verify phases separately in progress messages.
5. Record browser wall-clock upload-to-first-crosstab timing, not only Node benchmark timing.

Success criteria:

- WVS-scale browser path has lower peak memory than full materialization.
- Medium pilot files do not trigger avoidable memory spikes.
- Progress UI reflects actual parse/insert phases.

Risk:

- Streaming reduces peak memory but may increase total wall-clock depending on chunk size and insert overhead.

### Phase 4: Rendering Scalability

**Goal:** Keep large results responsive after query completion.

Tasks:

1. Add result-size thresholds for reduced motion and non-animated cells.
2. Virtualize crosstab rows for large row counts.
3. Consider horizontal column virtualization for very wide banners.
4. Optimize `treeBuilder` by indexing group rows by `colKey` once per node.
5. Add browser benchmarks for a wide-banner table and a multi-level row table.

Success criteria:

- Large result table interaction stays responsive.
- Render time and layout shifts are measured before/after.
- Drag-to-merge and sticky headers remain usable.

Risk:

- Virtualized tables complicate accessibility, sticky headers, row expansion, and drag interactions. Start with thresholded reduced motion and tree indexing before full table virtualization.

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

Keep these if today's measurements should become the current local benchmark baseline; otherwise regenerate or discard intentionally in the performance PR.
