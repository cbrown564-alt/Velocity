# ReadStat WASM Implementation Findings

**Date:** January 19, 2026
**Status:** Functional for small/medium files; Memory constrained for large files.

## Overview
We successfully implemented a client-side SPSS (`.sav`) file parser using `libreadstat` compiled to WebAssembly (WASM). This allows the application to read SPSS files directly in the browser without server-side processing.

## Achievements

### 1. WASM Compilation
- Compiled `libreadstat` (C library) to WebAssembly using Emscripten.
- Created a C shim (`readstat_wasm.c`) to bridge JavaScript and C, using a "pull" API (getters) rather than callbacks to minimize boundary crossing overhead.
- Minimized binary size to ~195KB by compiling only necessary SPSS modules.

### 2. Stack Overflow Resolution
- **Issue:** Initial tests crashed with "Out of bounds memory access" on files with compressed data (ZSAV).
- **Cause:** `libreadstat` allocates significant stack space for decompression buffers. The default Emscripten stack (64KB) was insufficient.
- **Fix:** Increased WASM stack size to 5MB (`-s STACK_SIZE=5242880`) in the logic.

### 3. Performance Optimization (Apache Arrow)
- **Issue:** Ingestion into DuckDB was extremely slow (hanging at 99%) due to executing individual `INSERT` statements for every row (97,000+ inserts for the WVS dataset).
- **Fix:** Refactored `analysisWorker.ts` to use **Apache Arrow**.
  - Pivoted row-oriented ReadStat data into column-oriented Arrow Vectors.
  - Constructed an Arrow Table and used `conn.insertArrowTable()` for bulk zero-copy ingestion.
- **Result:** Parsing and ingestion of small/medium files is now near-instant.

## Current Challenges

### 1. Browser Memory Limits (OOM)
- **Symptom:** The page reloads ("Significant Memory Usage") when processing the large WVS dataset (~176MB).
- **Analysis:**
  - The raw file is 176MB.
  - Parsing creates transient JavaScript objects for all 97,000 rows x 600+ columns.
  - Creating the Arrow Table essentially doubles this memory requirement momentarily.
  - Chrome/Safari tab memory limits (often 2-4GB) are hit during this high-peak operation.
- **Conclusion:** Fully client-side parsing of large (>100MB) datasets with dense metadata is pushing the limits of current browser capabilities using a "load-all-then-ingest" strategy.

## Outstanding Questions & Next Steps

1.  **Streaming Ingestion:** Can we pipe data from the WASM parser directly into DuckDB chunk-by-chunk without holding the entire dataset in JS memory?
    *   *Obstacle:* DuckDB-WASM's `insertArrowTable` expects a complete table. We might need to append batches.
2.  **Worker Partitioning:** Should parsing happen in a separate worker from the DB to prevent thread blocking?
3.  **Server-Side Fallback:** For files >50MB, should we upload to a server for processing?

## Recommendation
Proceed with the current implementation for files <50MB (covering most user scenarios) and explore streaming optimization or server-side fallback for "Power User" datasets in the future.
