# Bug Report: CSV Row Count is 0

**Status:** 🟢 Fixed  
**Priority:** Medium  
**Discovered:** 2026-01-19  
**Milestone:** 1.8

---

## Summary

When loading CSV files (or using "example data" which uses the CSV path), the application displays "0 rows" even though the data is loaded into DuckDB and queries return results.

## Symptoms

1. Load example data (or upload any CSV)
2. Variable list populates correctly
3. DataTable displays "N = 0 Respondents"
4. Status bar shows `filename.csv (0 rows)`

## Root Cause

In `src/store/index.ts`, the `loadCSV` function hardcodes the `rowCount` to 0 and never updates it from the worker response.

```typescript
// src/store/index.ts (lines 242-246)
set({
    dataset: {
        id: crypto.randomUUID(),
        name: fileName,
        rowCount: 0, // <--- ISSUE: Hardcoded to 0
        variables,
        source: 'csv',
    },
});
```

Unlike `loadSAV`, which receives `response.rowCount` from the worker, the `loadCSV` worker response (of type `schema`) only returns column definitions, not the row count.

## Proposed Fix

1. Update `analysisWorker.ts` `loadCSV` handler to return row count in the `schema` response (or a separate `loaded` response).
2. Update `store/index.ts` to use the returned row count.

## Workaround

None (data is usable, but row counts are incorrect in UI).
