# Large SAV UI Ingestion: Status, Pathways, and Implementation Plan

**Date:** February 3, 2026

## Summary
Velocity can parse SPSS `.sav` files in the browser using `@velocity/readstat-wasm` and load data into DuckDB-WASM via Arrow. For large files, the current full-load path can exceed browser/worker memory limits and crash the tab. We now have UI guardrails plus metadata-only and row-sample modes to mitigate OOM while preserving variable heuristics. This report documents the current status, the viable solution pathways, and a staged implementation plan.

---

## Current Status

### 1) Full ingestion path (existing)
**Location:** `src/services/analysisWorker.ts` → `loadSAV`
- Reads entire file into memory.
- WASM parser (`parseSavFile`) builds all rows in JS.
- Worker pivots row-major to column-major arrays.
- Constructs an Arrow table and bulk inserts via `conn.insertArrowTable`.

**Behavior on large files:**
- High peak memory due to multiple full copies (WASM data + JS rows + column arrays + Arrow vectors).
- Large datasets (e.g. WVS 176MB) can crash the UI.

### 2) Metadata-only path (new)
**Location:**
- `packages/readstat-wasm/src/readstat_wasm.c` → `parse_sav_metadata`
- `packages/readstat-wasm/ts/index.ts` → `parseSavMetadata`
- `src/services/analysisWorker.ts` → `loadSAVMetadata`

**Behavior:**
- Parses metadata without reading values.
- No DuckDB insertion.
- Allows UI to show variables safely for large files.

### 3) Row-sample metadata path (new)
**Location:**
- `packages/readstat-wasm/src/readstat_wasm.c` → `parse_sav_sample`
- `packages/readstat-wasm/ts/index.ts` → `parseSavSample`
- `src/services/analysisWorker.ts` → `loadSAVSample`

**Behavior:**
- Parses metadata and only the first N rows (default 1000).
- Preserves heuristic improvements (grid detection, type inference).
- Avoids full data load into DuckDB.

### 4) UI guardrails (new)
**Location:** `src/App.tsx`
- Warn at **50MB**: prompt user before full ingestion.
- Force sample mode at **200MB**.
- Metadata screen includes sample row count and option to “Load Full Data.”

---

## Known Risks & Limitations

1. **OOM persists for large full loads**
   - Full ingestion still uses multiple in-memory copies and can crash.

2. **Metadata-only/sample mode disables analysis**
   - No DuckDB data means no queries/analysis until user loads full data.

3. **Heuristics can be incomplete**
   - Sampling helps but still may miss rare patterns or sparse grid detection.

4. **WASM rebuild required**
   - `parse_sav_metadata` and `parse_sav_sample` require rebuilding the WASM bundle.

---

## Potential Pathways

### Path A: Guardrails + Sample (current short-term)
- User gets a safe preview.
- Explicit opt-in for full load.
- Suitable for most UI testing and reduces crash frequency.

### Path B: Chunked ingestion into DuckDB (mid-term)
- Use Arrow IPC streaming batches and `insertArrowFromIPCStream`.
- Stream records in chunks; release each chunk to reduce peak memory.
- Requires new parser output format or chunked row access from WASM.

### Path C: OPFS-backed file IO (mid-term)
- Store `.sav` in OPFS and read from file handles to reduce JS memory copies.
- Would pair well with chunked ingestion or streaming parser.

### Path D: DuckDB `read_stat` in WASM (long-term)
- If a wasm-safe `read_stat` extension is viable, it could bypass JS row copies.
- Highest effort, but likely the most stable for large files.

---

## Clear Implementation Plan

### Phase 1 — Stabilize UI Guardrails (1–2 days)
1. **Confirm WASM rebuild instructions**
   - Add a brief note in docs or release checklist that `packages/readstat-wasm` must be rebuilt after C changes.
2. **Add sample-size control (optional)**
   - UI option to set sample rows (default 1000).
3. **Log sample stats**
   - In metadata mode, show the actual sample row count and any heuristic warnings.

### Phase 2 — Improve Heuristic Reliability (2–4 days)
1. **Sampling strategy**
   - Switch from “first N rows” to “spread sample” (e.g., every k-th row) to reduce skew.
2. **Heuristic confidence indicator**
   - Show a small “heuristics based on sample” badge in the UI.

### Phase 3 — Chunked Ingestion Spike (1–2 weeks)
1. **Proof-of-concept**
   - Build Arrow record batches from sample-sized chunks.
   - Insert via `insertArrowFromIPCStream` or iterative `insertArrowTable` if possible.
2. **Measure memory usage**
   - Compare peak memory between full-load and chunked-load on WVS.
3. **Add threshold-based fallback**
   - Auto-switch to chunked mode above a size threshold.

### Phase 4 — OPFS + Persistent Files (1–2 weeks)
1. **Write file to OPFS on upload**
   - Avoid holding entire file in RAM.
2. **Parser integration**
   - Replace buffer-based parsing with read handle streaming when feasible.

---

## Acceptance Criteria
- **Large file preview:** loading a 200MB+ SAV does not crash the UI and shows variable metadata + sample row count.
- **User choice:** the UI clearly warns before full ingestion and allows opt-in.
- **Heuristics:** sample mode preserves grid detection for most real-world surveys.

---

## Notes for Developers
- After updating the C shim, rebuild WASM:
  - `cd packages/readstat-wasm`
  - `make all`
- Sample parsing returns `READSTAT_ERROR_USER_ABORT` when it stops early; this is treated as success in `parseSavSample`.

