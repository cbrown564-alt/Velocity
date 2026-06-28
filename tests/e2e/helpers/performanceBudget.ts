/**
 * Phase 5 Task 4 — first-load payload budgets shared by the production smoke
 * test and the performance dashboard.
 *
 * These are deliberately *byte* budgets, not timing budgets. Bytes are
 * deterministic for a given build (so a threshold is stable enough to gate in
 * CI), whereas wall-clock timings vary by machine and are reported, not gated.
 *
 * The numbers carry comfortable headroom above the current production build so
 * ordinary growth does not trip them; they exist to catch a *category* mistake
 * — re-introducing the 1.3 MB export-vendor chunk onto the startup path
 * (Phase 1) or a comparable first-load regression. Update them deliberately,
 * with a `npm run benchmark:perf` measurement, when the baseline legitimately
 * moves.
 *
 * Measurement basis: `transferSize` summed from `PerformanceResourceTiming`
 * over the same-origin `/assets/*.js` requests made before any dataset upload.
 * `vite preview` gzips responses, so `transferSize` here is the compressed
 * over-the-wire size (~387 KB for the current build), close to the gzip figures
 * in the performance review rather than the raw chunk sizes.
 */

/**
 * Ceiling on the summed transfer size of startup JavaScript (`/assets/*.js`
 * fetched before any dataset upload): the main app chunk, the vendor chunks,
 * and the analysis-worker chunk, all of which are part of cold-start load. The
 * DuckDB worker/wasm assets are not served from `/assets` and are budgeted by
 * readiness, not bytes, so they are naturally excluded here.
 *
 * Current production build sums to ~387 KB gzipped. The export-vendor chunk that
 * Phase 1 moved off the startup path is ~396 KB gzipped on its own, so a
 * regression that re-bundles it (or anything comparably large) onto the cold
 * start lands above this 600 KB ceiling. The `exportVendorOnStartup` boolean is
 * the precise guard for that specific chunk; this budget is the category guard
 * for any large first-load regression, with ~55% headroom for ordinary growth.
 */
export const STARTUP_JS_TRANSFER_BUDGET_BYTES = 600_000;

/** Human-readable budget for assertion messages. */
export function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}
