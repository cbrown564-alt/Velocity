# Research: DuckDB-Wasm OPFS Persistence

## Objective
To persist DuckDB's internal data file using the Origin Private File System (OPFS) so that users do not need to re-import large datasets (.CSV, .SAV) upon page reload.

## Summary of Work
We implemented logic in the `analysisWorker.ts` to attach an OPFS-backed database using the `opfs://` protocol. While the basic implementation is functional, we encountered significant challenges regarding database corruption and internal state management in DuckDB-Wasm.

## Status
- **Current State**: Implementation present in `analysisWorker.ts` but currently falling back to **in-memory mode** due to a persistent "invalid database file" error in the browser environment.
- **Location**: Implementation details are in [analysisWorker.ts](file:///Users/cobro/Code/Velocity/src/services/analysisWorker.ts) and [implementation_plan.md](file:///Users/cobro/.gemini/antigravity/brain/1bbb4177-2b63-49f3-a279-91315583b3dc/implementation_plan.md).

## Implementation Path & Challenges

### Attempt 1: Direct Attachment
We used `db.open({ path: 'opfs://velocity_data.db' })` during worker initialization.
- **Challenge**: The browser environment (Chrome) reported: `The file "opfs://velocity_data.db" exists, but it is not a valid DuckDB database file!`.
- **Result**: Immediate fallback to in-memory.

### Attempt 2: API Cleanup (`dropFile`)
We attempted to use DuckDB's `db.dropFile(path)` API to clear the corrupted file before retrying.
- **Challenge**: `dropFile` reported success, but the subsequent `db.open` attempt failed with the exact same error, suggesting the file or the worker's internal state was not actually cleared.

### Attempt 3: Recursive OPFS Deletion
We implemented a robust cleanup using the native `navigator.storage` API to recursively delete the `.duckdb` directory and the database file.
- **Observation**: We verified via the browser console that the OPFS root was indeed empty after this cleanup.
- **Result**: Surprisingly, the retry of `db.open` within the same worker instance *still* failed with the "file exists but is invalid" error.

## Hypotheses: Internal Buffering & Tainted Workers
The most likely cause for the failures in Attempt 2 and 3 is **Internal Buffering** within DuckDB-Wasm.
1.  **Stale Handles**: DuckDB-Wasm likely caches file handles or internal metadata once a file path is accessed. 
2.  **Tainted State**: Once a worker encounters an IO error or an "invalid file" error on a specific path, the internal state of that worker becomes "tainted" for that path. 
3.  **Cleanup Isolation**: Deleting the file on disk (OPFS) does not notify the already-initialized WASM instance's internal file system layer, causing it to rely on cached (and corrupted) metadata.

## Recommended Solution
To successfully recover from corruption, the `init()` function should:
1.  Attempt to open the OPFS database.
2.  If corruption is detected:
    -   Perform the recursive OPFS cleanup.
    -   **Terminate the current worker instance.**
    -   Spawn a fresh worker and re-instantiate DuckDB.
    -   Retry the `db.open` call.

## Future Work
-   [ ] Implement the "Reset & Restart" worker logic in `analysisWorker.ts`.
-   [ ] Modify the UI to recognize the `persistedDataFound` response from the worker and restore the state of the analysis (variables, tables).
-   [ ] Investigate if specific browser settings or DuckDB-Wasm versions (e.g., 1.28 vs 1.29) have improved OPFS stability regarding corruption.

---
*Report generated on 2026-01-20*
