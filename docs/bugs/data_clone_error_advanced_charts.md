# Bug Report: DataCloneError in Analysis Worker (Advanced Charts)

## Description
When loading a numeric variable (which triggers a metric analysis), the application crashes with a `DataCloneError` in the Analysis Worker.

```
[Worker] Error: DataCloneError: The object can not be cloned.
postMessage
(anonymous function) — analysisWorker.ts:1397
```

## Implementation Context
We recently implemented backend support for Violin/Ridgeline charts. This involved two parallel changes:

1.  **`queryBuilder.ts`**: We added `histogram(${col}) as distMap` to the generated SQL for metric analyses.
2.  **`analysisWorker.ts`**: We implemented a *secondary*, manual histogram query (using `FLOOR`/`LEAST`) to ensure consistent binning across groups.

## Root Cause Analysis
The error is caused by **item 1**.

The `histogram()` function in DuckDB returns a `MAP` type. When this results comes back to JavaScript via `apache-arrow` (used by duckdb-wasm), it is represented as a complex Arrow Map object (or a Proxy to one).

When `analysisWorker.ts` attempts to send `rows` back to the main thread via `postMessage()`, the structured clone algorithm fails because it cannot verify or clone these complex Arrow Map objects contained within the `distMap` field of each row.

Even though `analysisWorker.ts` calculates its own clean `histogramBins` (from item 2) and attaches them to the row, the original `distMap` field remains on the row object (from item 1), causing the crash.

## Assumptions Made
*   We assumed `row.toJSON()` on the Arrow result would convert the DuckDB Map into a standard JavaScript Object or Array that is serializable.
*   We assumed strictly relying on the manual binning in `analysisWorker.ts` would supersede the need for `queryBuilder.ts` changes, but we left the `queryBuilder.ts` change in place, resulting in the toxic `distMap` payload.

## Steps to Fix
1.  **Revert** the change in `src/services/queryBuilder.ts` that adds `, histogram(${col}) as distMap`.
2.  Rely entirely on the manual binning logic already present in `src/services/analysisWorker.ts` (lines ~1015-1117), which correctly formats data as simple `{ x0, x1, count }` objects that are safe to clone.
