# OPFS Reload Corruption Investigation (DuckDB-WASM)

Created: 2026-02-04  
Updated: 2026-02-05  
Workspace: `/Users/cobro/Code/Velocity`

## Summary

The app was failing to reload previously used datasets in the browser with DuckDB-WASM OPFS persistence enabled. The console showed repeated failures to open OPFS-backed DuckDB databases:

- `exists, but it is not a valid DuckDB database file!`
- repeated attempts on dataset-scoped path, default path, and a “repair” path
- `Buffering missing file: opfs://...`
- corruption detected + quarantine attempt failing with `The object can not be found here.`
- repeated worker respawn / clean-start loop that still could not recover

We investigated the code paths, recent git history, and implemented a more robust recovery approach.

**Update (2026-02-05):** the repo is pinned to `@duckdb/duckdb-wasm@1.29.0`. Official DuckDB-WASM OPFS-backed **database file** persistence landed in `@duckdb/duckdb-wasm@1.30.0` (DuckDB v1.3.2). On older builds, `db.open({ path: "opfs://..." })` can fail with the same “not a valid DuckDB database file” error even on a fresh path. We now gate DuckDB OPFS DB persistence on DuckDB version >= `1.3.2` and rely on OPFS source-file restore as the baseline local-first behavior.

Changes shipped / in progress:

0. **Fix “empty DB on startup” (root cause of “start from scratch”)**  
   We were sometimes creating a *new* dataset-scoped OPFS DB on boot (because `db.open()` in READ_WRITE creates missing files), even when the *real* persisted dataset lived in another OPFS DB file (default/older candidate). That produced `noPersistedData` and forced re-upload.  
   Fix: persistence init now **prefers existing OPFS DB candidates** and **validates** that an opened DB actually contains the persisted `main` table before selecting it.

1. OPFS traversal/cleanup/quarantine is now recursive (handles nested directories like `.duckdb/`).
2. Corruption no longer hard-fails startup; we always fall back to `:memory:` and still return `ready`.
3. The persistence decision tree was extracted into a pure module with fast unit tests.
4. Added a Playwright reload smoke test (boots after reload) and began hardening the OPFS persistence e2e test.
5. Persist the **uploaded dataset file** in OPFS (`dataset.opfsFileKey`) and **auto-rehydrate DuckDB** from it on boot (plus replay a transform log for recodes).

Net result: DuckDB OPFS DB corruption/locks should no longer brick the app; it degrades to in-memory mode with a warning. Local-first behavior remains functional because we can rebuild from the OPFS source file.

For a broader persistence recommendation (local-first strategy, separation of compute vs storage), see:
- `docs/arch_06_local_first_persistence.md`

---

## Original Symptoms (Console Logs)

Observed flow (abridged):

1. Attempt open dataset-scoped OPFS DB:
   - `opfs://velocity_data_v1_dataset_<uuid>.db`
   - fails: `not a valid DuckDB database file`
2. Attempt open default OPFS DB:
   - `opfs://velocity_data_v1_default.db`
   - fails similarly
3. Corruption detected:
   - quarantine attempt fails: `The object can not be found here.`
4. Attempt open repair path:
   - `opfs://velocity_data_v1_dataset_<uuid>_repair_<ts>.db`
   - also fails
5. Worker falls back to memory, UI requests clean start:
   - `Force clean start requested, clearing OPFS ...`
   - `Found OPFS DB entries to clean: []`
6. Loop repeats and ends as unrecoverable:
   - `[DataSlice] Failed to respawn worker: Error: Unable to recover from corruption`

---

## Initial Hypotheses (Ranked)

These were the most likely causes based on the logs and code:

1. **Cleanup/quarantine were not touching the real DB files**  
   The worker logged “Found OPFS DB entries to clean: []” while still seeing DuckDB complain “file exists.” That strongly suggests the files were not at the OPFS root (e.g. in a nested directory like `.duckdb/`) or DuckDB’s OPFS VFS wasn’t aligned with our simplistic deletion logic.

2. **Regression in `cleanOPFS()` behavior**  
   Recent work changed cleanup from “remove everything recursively” to “only delete top-level `velocity_data*.db` files.” If DuckDB uses subdirectories or additional sidecars, this misses them and creates an unrecoverable loop.

3. **DuckDB-WASM internal buffering / tainted state**  
   The recurring “Buffering missing file” warnings and historical notes in the repo suggest DuckDB-WASM can cache OPFS file state and keep reporting “exists” even after external deletion attempts.

4. **Recovery path was hard-failing the app**  
   On corruption, the worker could early-return and `dataSlice` would respawn repeatedly, ultimately setting `persistenceState='error'` and blocking the app rather than continuing in-memory.

---

## What We Found In Code

### Primary code paths

- Worker initialization + OPFS open/recovery:
  - `src/services/analysisWorker.ts`
- Store-driven lifecycle and worker respawns:
  - `src/store/slices/dataSlice.ts`
- OPFS utilities exposed to UI:
  - `src/services/opfsFileManager.ts`

### Key findings

1. `cleanOPFS()` only considered top-level OPFS entries and only deleted `velocity_data*.db` files. If DuckDB stored DBs elsewhere, it would miss them.
2. `quarantineCorruptedDb()` attempted `opfsRoot.getFileHandle(fileName)` using `dbPath.replace('opfs://','')` (root-only). That would fail if the DB lives under `.duckdb/` or another subdirectory, producing the exact warning in the logs.
3. On corruption, the code would try dataset-scoped path, then default, then repair, and then could return a `corruptionDetected` message that led `dataSlice` into a respawn loop. Once “corruption still detected after clean start,” the app would error out rather than continuing in-memory.

---

## Git Archaeology (Recent Relevant Commits)

The most relevant recent change is:

- `b27a68c` — “Add OPFS storage controls”  
  Touches:
  - `src/services/analysisWorker.ts`
  - `src/store/slices/dataSlice.ts`
  - `src/services/opfsFileManager.ts`
  - `src/App.tsx`
  - `src/types/worker.ts`

This commit introduced/changed several OPFS lifecycle behaviors and is the most likely source of the regression around cleanup/quarantine and the app hard-failing on corruption.

Other nearby commits in the log that contextualize OPFS churn:

- `609b83c` / `5860de5` — OPFS lifecycle planning
- `e98cb0c` — worker refactor

---

## Implemented Fixes (Current State)

### 1) Recursive OPFS traversal (shared helper)

We extracted traversal utilities into:

- `src/services/opfsTraversal.ts`

It provides:

- `walkOpfs(root)` — async recursive directory walk
- `resolveOpfsPath(root, path)` — resolve `a/b/c` into parent dir + filename
- `findOpfsFile(root, targetPath)` — locate a file by `opfs://...` or relative path, supporting nested directories

This is now used by both:

- `src/services/analysisWorker.ts`
- `src/services/opfsFileManager.ts`

### 2) Worker cleanup/quarantine now uses recursive traversal

In `src/services/analysisWorker.ts`:

- `cleanOPFS()` recursively removes `velocity_data*` files anywhere under OPFS (not just root).
- `quarantineCorruptedDb()` uses `findOpfsFile()` to locate the corrupted DB even if nested, then copies it to `<name>.corrupt_<timestamp>` in the same directory and removes the original.

### 3) Non-fatal corruption: always boot to `ready`

We changed the init handshake so corruption is treated as a warning and we still send:

- `persistenceStatus`
- `ready`

Even if we also send:

- `corruptionDetected`

This prevents “corruptionDetected => respawn loop => fatal” startup behavior.

In `src/store/slices/dataSlice.ts`, corruption now:

- sets `persistenceState='corrupt'` and `persistenceError`
- does **not** force respawning the worker anymore

### 4) Persistence recovery extracted to a pure module with tests

We extracted the “open desired/fallback/candidate/repair/memory” decision tree into:

- `src/services/opfsPersistence.ts`

The worker calls it via dependency injection (open function, list candidates, quarantine, etc.). This makes it testable without browser OPFS or WASM workers.

Unit tests added:

- `src/services/opfsPersistence.test.ts`

These cover:

- corruption => quarantine => repair fails => memory fallback + corruption flagged
- corruption => candidate DB opens => opfs path selected
- non-corruption open error => memory fallback without corruption flagged
- OPFS unsupported => disabled mode + memory open

---

## Testing Strategy (Goal: Less Browser Reliance)

### What we aimed for

- Move the fragile, browser-specific recovery logic into deterministic unit tests.
- Keep only a minimal Playwright smoke test for end-to-end confidence.

### What we ran (Vitest)

`npm run test:run` was executed.

Observations:

- Our new/modified unit tests passed:
  - `src/services/opfsPersistence.test.ts` ✅
  - `src/services/opfsFileManager.test.ts` ✅ (including the new nested directory test)
- The overall suite currently fails for unrelated reasons:
  - Many store tests error with `storage.setItem is not a function`
  - Several golden/parity tests fail (`rows is not iterable`, `results.find is not a function`, numeric mismatches)

Conclusion: our changes are not the source of current suite failures; the suite has pre-existing instability.

---

## Playwright Work

### 1) Added reload smoke test (passes)

We added a single smoke test to ensure the app boots after reload:

- `tests/e2e/opfs.spec.ts` — `Reload smoke: app boots after reload`

It:

- best-effort clears `localStorage` and OPFS root
- reloads
- asserts the splash header `Velocity.` is visible

User report: ✅ this test passed locally.

### 2) Existing OPFS persistence e2e test (still failing)

Existing test:

- `tests/e2e/opfs.spec.ts` — `OPFS persists dataset across reloads`

Failures observed locally:

- It times out waiting for `Survey Questions` after uploading `test_small.sav`.

We attempted to harden the test by:

- waiting until the upload button is enabled (worker ready)
- dismissing dialogs
- allowing both “dashboard” (Survey Questions visible) and “metadata mode” (Metadata Loaded visible)
- clicking “Load Full Data” if metadata mode is detected

Despite this, the test still times out on:

- `expect(getByText('Survey Questions')).toBeVisible(...)`

### What we learned from the e2e failure

- The upload-to-dashboard transition is not deterministic in e2e right now.
- The UI path can be blocked by an alert/confirm, or by a data-loading failure that leaves the user on splash/metadata without obvious stable selectors.
- The label `Survey Questions` is inside the dashboard sidebar and may not be a good synchronization point (it is not a unique page-level “loaded” indicator).

### Next steps to stabilize e2e

1. **Inspect the trace** from the failure run:
   - `npx playwright show-trace test-results/.../trace.zip`
   This should reveal whether the UI is stuck on splash, metadata, restoring prompt, or has an error.

2. **Add a stable test id / loaded sentinel** to the app shell:
   - e.g. `data-testid=\"app-mode\"` or `data-testid=\"dashboard-ready\"`
   - then wait for that instead of a UI label that can move or change.

3. **Prefer a tiny CSV fixture for the persistence e2e** (optional):
   - Faster ingestion, less WASM variability.
   - If the goal is OPFS DB persistence, CSV is good enough to validate “persist + reload + restore prompt.”

4. **Verify OPFS is truly enabled and available in the test environment**
   - The test currently skips if OPFS isn’t supported.
   - We should also assert `persistenceMode`/`opfsAvailable` in the UI’s “OPFS Storage Health” panel (now present).

---

## Current Status

- The app should no longer be bricked by OPFS corruption; it should fall back to `:memory:` and still load the UI.
- OPFS traversal/cleanup/quarantine are now recursive and shared across worker and UI utilities.
- Persistence recovery logic is unit-tested outside the browser/worker environment.
- A Playwright reload smoke test exists and passes.
- The OPFS persistence e2e test is still failing and needs trace-driven stabilization (likely improved selectors / better “ready” sentinel / smaller fixture).

---

## Files Changed / Added (Tracking)

Added:

- `src/services/opfsPersistence.ts`
- `src/services/opfsPersistence.test.ts`
- `src/services/opfsTraversal.ts`
- `docs/opfs_reload_investigation.md` (this doc)

Modified:

- `src/services/analysisWorker.ts`
- `src/store/slices/dataSlice.ts`
- `src/services/opfsFileManager.ts`
- `src/services/opfsFileManager.test.ts`
- `playwright.config.ts` (port/host env overrides)
- `tests/e2e/opfs.spec.ts` (added reload smoke + hardened OPFS test)
