# Bug: OPFS Corruption Loop in DuckDB-WASM

**Status:** Deferred
**Priority:** Medium
**Created:** 2026-01-21

## Summary

DuckDB-WASM's OPFS persistence encounters a corruption state that cannot be recovered from, even after cleaning all OPFS entries. The worker respawns with `forceCleanStart` but still reports "not a valid DuckDB database file" error.

## Reproduction

1. Load a .SAV file (OPFS persistence works initially)
2. Reload the page multiple times or interrupt during data loading
3. OPFS becomes corrupted
4. Worker detects corruption and attempts cleanup
5. After cleanup, OPFS still reports corruption

## Error Message

```
Opening the database failed with error: {
  "exception_type": "IO",
  "exception_message": "The file \"opfs://velocity_data.db\" exists, but it is not a valid DuckDB database file!"
}
```

## Investigation

### What We've Tried

1. ✅ Cleaning OPFS before DuckDB initialization (prevents cached file handles)
2. ✅ Recursive removal of all OPFS entries (not just named files)
3. ❌ Still fails - DuckDB reports file exists even after deletion

### Hypothesis

DuckDB-WASM may be caching OPFS file system state internally, beyond what we can clear via the OPFS API. The file handle or metadata may persist in DuckDB's internal buffers even after:
- Terminating the worker
- Cleaning OPFS filesystem
- Creating a new worker instance

### Browser Caching

The "Buffering missing file" warnings suggest DuckDB-WASM has its own buffering layer:
```
[Warning] Buffering missing file: opfs://velocity_data.db
```

This buffer may survive worker termination.

## Current Workaround

OPFS is disabled in development (`ENABLE_OPFS = false` in `analysisWorker.ts`). App runs in in-memory mode only.

## Potential Solutions (for later)

1. **Different OPFS path per session**
   - Use `opfs://velocity_data_${sessionId}.db` with rotating session IDs
   - Pro: Avoids corrupted file entirely
   - Con: Leaves orphaned files in OPFS

2. **Complete browser storage clear**
   - Use `navigator.storage.persist()` and `navigator.storage.estimate()`
   - May require user permission prompt
   - Con: Nuclear option, affects other apps

3. **DuckDB in-memory with manual OPFS sync**
   - Run DuckDB in-memory only
   - Manually export/import Arrow/Parquet to OPFS for persistence
   - Pro: More control over persistence lifecycle
   - Con: More complex implementation

4. **Upgrade DuckDB-WASM**
   - Check if newer versions have better OPFS error recovery
   - Current: `@duckdb/duckdb-wasm@1.29.0`

5. **Alternative: IndexedDB via DuckDB**
   - DuckDB-WASM supports IndexedDB backend
   - May have better error recovery than OPFS

## Test Case Needed

When re-enabling, create test:
- Force corruption by interrupting `db.open()`
- Verify cleanup and recovery flow
- Ensure no infinite loop

## References

- Implementation: `src/services/analysisWorker.ts`
- Worker respawn: `src/store/slices/dataSlice.ts` (`respawnWorker()`)
- OPFS cleanup: `cleanOPFS()` function
