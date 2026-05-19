# Local-First Persistence: OPFS + DuckDB-WASM Deep Dive

Created: 2026-02-04  
Updated: 2026-02-05  
Scope: Velocity browser app (DuckDB-WASM + OPFS + Zustand localStorage)

## Executive Summary

Velocity’s “start from scratch on every load” failure has **two overlapping causes**:

Key conclusions:

1. **App-level bug (fixed):** we were sometimes **creating a new empty OPFS DuckDB DB** (dataset-scoped path) on startup instead of opening the **existing DB that actually contains data** (default or prior candidate DB). This makes `checkPersistedData()` report “no data,” forcing users back to upload.
2. **Library-level constraint (historical):** older builds pinned to `@duckdb/duckdb-wasm@1.29.0`, which predated official OPFS-backed **database file persistence** (added in `@duckdb/duckdb-wasm@1.30.0`). The repo now uses `@duckdb/duckdb-wasm@1.33.1-dev18.0`; the current product gap is not version support, but reliable reopen/switch/delete behavior around source files, worker context, and fallback rebuild.
3. **Even on supported versions, OPFS DB persistence is not a perfect “source of truth”** (corruption / access-handle locks / multi-tab contention), so local-first must be **layered**:
   - Persist the **source dataset file** in OPFS and reference it from Zustand/localStorage (`dataset.opfsFileKey`).
   - Persist analysis state + a **transform log** (e.g., recodes) in localStorage.
   - On boot: **fast path** = open OPFS DuckDB DB; **fallback path** = rebuild DuckDB in-memory from the persisted dataset file + transform log.
4. **`@velocity/readstat-wasm` is very unlikely to be directly breaking OPFS** (it compiles with `FILESYSTEM=0` and uses in-memory I/O), but it can contribute **indirectly** via memory pressure / worker crashes during ingestion, increasing the chance of “killed mid-write” corruption — another reason to avoid “DuckDB OPFS DB as sole source of truth.”

## What Was Broken (The Actual “Start From Scratch” Loop)

### Symptom

On reload, the store has dataset metadata (rehydrated from localStorage), but the worker reports:

- `noPersistedData`

So the UI lands back on the splash/upload flow.

### Why it happened

The worker initialization selected a **dataset-scoped OPFS DB path** when a dataset existed in localStorage:

- `opfs://velocity_data_v1_dataset_<uuid>.db`

But the persisted data was frequently written into a **different file** (most commonly the default DB path):

- `opfs://velocity_data_v1_default.db`

This mismatch happens because:

- On a fresh session, there is no `datasetId` at worker init time → worker opens/creates the default DB.
- After upload, we update metadata inside the DB (meta table), but we **never migrate/re-open** the DB under a dataset-scoped file name.
- On next load, `db.open()` in READ_WRITE happily creates the dataset-scoped file if missing → **empty DB** → no `main` table → `checkPersistedData()` returns false.

### Fix (Implemented)

We changed persistence initialization so it:

- **Lists existing OPFS `.db` candidates first**
- Tries to open existing DBs (desired/fallback/candidates) **before creating any new DB**
- **Validates** that an opened DB actually contains the persisted `main` table before selecting it
- Only creates a new DB (desired or repair) when no valid candidate DB exists

Implementation:

- `src/services/opfsPersistence.ts`
- `src/services/analysisWorker.ts` (passes a validation probe and reset hook)
- `src/services/opfsPersistence.test.ts` (unit tests for the decision tree)

This directly targets the “empty DB created on startup” failure mode that caused “start from scratch.”

> Note: older 2026-02 findings about `@duckdb/duckdb-wasm@1.29.0` are historical. The active stabilization target is to make OPFS source-file restore, transform replay, worker context switching, and dataset deletion reliable across sessions.

## OPFS + DuckDB-WASM: Real Failure Modes (Why This Still Needs a Strategy)

Even with the startup selection bug fixed, OPFS persistence can still fail in ways that impact “local-first”:

### 0) Version alignment (OPFS DB persistence landed in DuckDB-WASM 1.30.0)

DuckDB-WASM OPFS-backed **database file** persistence was added in `@duckdb/duckdb-wasm@1.30.0` (DuckDB v1.3.2). Velocity is now above that line (`@duckdb/duckdb-wasm@1.33.1-dev18.0`), but the DuckDB OPFS database should still be treated as a fast-path cache rather than the sole source of truth.

Action:

- Upgrade to the latest stable (as of 2026-02-05, `@duckdb/duckdb-wasm@1.34.0`) and keep `apache-arrow` aligned with DuckDB-WASM’s dependency (still `17.x`).

Reference:
- DuckDB-WASM v1.30.0 release notes (OPFS support): https://github.com/duckdb/duckdb-wasm/releases/tag/v1.30.0  
- NPM package (current latest version): https://www.npmjs.com/package/@duckdb/duckdb-wasm

### 1) OPFS Sync Access Handle locking / multi-tab

DuckDB-WASM can fail to open an OPFS database if an existing access handle is still open for the same file (e.g., another tab/worker still has it). Example error:

- `Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file.`

Reference:
- DuckDB-WASM issue: “OPFS file handler error when clearing browser cache and reloading” (GitHub)  
  https://github.com/duckdb/duckdb-wasm/issues/2111

### 2) Corruption / partial writes

DuckDB-WASM can report:

- `exists, but it is not a valid DuckDB database file!`

If a file is partially written, truncated, or otherwise corrupted (common triggers: reload/close mid-write, worker crash, storage pressure).

Reference:
- DuckDB-WASM issue: “opfs: Error calling db.open” (GitHub)  
  https://github.com/duckdb/duckdb-wasm/issues/1947

### 3) Supply chain incident (upgrade guidance matters)

The DuckDB-WASM project notes a compromised npm package release for `@duckdb/duckdb-wasm@1.29.2` and recommends upgrading past it.

Reference:
- DuckDB-WASM release notes (GitHub)  
  https://github.com/duckdb/duckdb-wasm/releases

## Assessment: Is `@velocity/readstat-wasm` breaking OPFS?

Directly: **very unlikely**.

Reasons:

- The build uses `-s FILESYSTEM=0` (no Emscripten filesystem backend involved).
- The parser reads from an in-memory buffer (custom `mem_*` handlers).
- It does not interact with OPFS APIs.

Indirect risks:

- Peak memory can be very high during ingestion (buffer copy into WASM + JS materialization + Arrow table creation).
- If that causes a worker crash or the user reloads mid-load, the DuckDB OPFS DB can be left in a bad state.

## Recommendation: Keep DuckDB for Compute; Decouple Persistence from the DuckDB OPFS DB

Velocity’s active strategy in `docs/roadmap_00_strategic_guide.md` is local-first stabilization. To make that reliable:

### Keep DuckDB-WASM (high value)

DuckDB is still the best fit for:

- fast aggregations for crosstabs
- complex filtering/join logic
- future growth into larger datasets / more complex analyses

### But do not use the OPFS DuckDB database file as the only persisted artifact

Use a layered approach:

1. **Persist the source dataset** in OPFS (SAV/CSV, or better: a normalized Arrow IPC / Parquet representation).
2. **Persist the analysis “intent/state”** in localStorage (already mostly done via Zustand):
   - variable sets / folders
   - table config / filters
   - derived variable definitions (needs work)
3. On boot:
   - **Fast path:** open OPFS DuckDB DB and restore immediately.
   - **Slow-but-seamless path:** if DB open fails or data is missing, automatically rebuild DuckDB in-memory from the persisted dataset + transformation log.

This ensures the user never has to:

- re-upload a file
- rebuild analysis state by hand

…even if the DuckDB OPFS DB becomes corrupt or locked.

## Next Steps (Concrete)

1. ✅ **Ship the startup DB selection fix** (candidate-first + validation).
2. ✅ **Persist the uploaded dataset file** in OPFS (always, best-effort) and store the OPFS key in Zustand persist (`dataset.opfsFileKey`).
3. ✅ **Add a transform log** and replay it during rebuild (currently covers recodes; extend for other transforms).
4. **Harden OPFS failure UX**:
   - detect “access handle locked” and show “another tab is using this dataset” guidance
   - show a “Rebuild from local file” button when DB restore fails
5. **Complete reopenable workspace behavior:** verify source-file restore, transform replay, active dataset switching, OPFS cleanup on delete, and rebuild fallback with browser smoke coverage.

## References (DuckDB-WASM)

- OPFS access-handle lock issue: https://github.com/duckdb/duckdb-wasm/issues/2111
- OPFS “not a valid database file” report: https://github.com/duckdb/duckdb-wasm/issues/1947
- Release notes (incl. security note): https://github.com/duckdb/duckdb-wasm/releases
- AsyncDuckDB API docs (flush/drop/register OPFS): https://shell.duckdb.org/docs/classes/duckdb_wasm.AsyncDuckDB.html
