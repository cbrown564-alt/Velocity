# Report 03: WVS Wave 7 SAV Ingestion Root Cause and Remediation Plan

**Date:** February 25, 2026  
**Dataset:** `test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav`  
**Observed file size:** ~177 MB (`185,163,494` bytes)

## Summary

Velocity's inability to reliably load `WVS_Cross-National_Wave_7_spss_v6_0.sav` is caused by **two independent issues**:

1. **Parser compatibility failure in `jsavvy`** for this SAV structure (hard failure in Node/CLI/fallback paths).
2. **Memory-heavy ingestion architecture** in browser/WASM full-load mode, which can exceed practical browser limits for large/wide SAV files.

The dataset itself appears functional based on direct ReadStat-WASM parsing in this repo (row/variable counts parse successfully).

## Scope and Method

This investigation included:

- Reviewing historical commits related to SAV ingestion and large-file guardrails.
- Tracing current browser worker and Node/CLI ingestion paths.
- Reproducing parse behavior against this exact WVS Wave 7 file.
- Measuring memory behavior during parse stages.

Environment constraints in this run:

- `Rscript` was not installed, so direct R/haven proof could not be executed here.
- DuckDB `read_stat` extension download was unavailable in this sandbox, so network-dependent extension install failed.

## Reproduction Findings

### A) Dataset-level sanity checks

- SAV magic bytes are valid: `$FL2`.
- ReadStat-WASM metadata parse succeeds:
  - rows: `97,220`
  - variables: `613`
  - numeric vars: `601`
  - string vars: `12`
- ReadStat-WASM full parse succeeds for the same file.

Interpretation: the file is parseable by ReadStat-based tooling and is not simply a corrupt upload.

### B) `jsavvy` failure is deterministic on this file

Direct `jsavvy` schema parse fails with:

`Levels read error. Magic value Expected: 4 Actual: 0`

This error was also reproduced through Velocity CLI when the pipeline falls back to `jsavvy`.

Control test:

- Small files (`test_data/sleep.sav`, `test_small.sav`) parse successfully with `jsavvy`.

Interpretation: this is not a universal `jsavvy` failure; it is triggered by this file's internal structure/records.

### C) Browser "chunked" mode still has large baseline memory pressure

The current `parseSavStreaming()` path calls full `_parse_sav()` first, then emits JS batches.  
That lowers JS-side peak vs one-shot row materialization, but does **not** avoid full in-WASM accumulation during parse.

Observed memory profile (local Node harness using repo WASM build):

- Metadata-only parse: low incremental memory.
- Full parse: process RSS grew to ~`1.6-1.7 GB`.
- `release_rows_up_to()` reduced memory only slightly because core dense arrays remain allocated.

Interpretation: current chunking is partial mitigation; it is not true streaming from parser to DuckDB.

## Root Cause Analysis

## Root Cause 1: `jsavvy` incompatibility for WVS Wave 7 internals

Velocity Node/CLI ingestion still uses `jsavvy` for metadata extraction (and for full fallback).  
When `read_stat` is unavailable/fails, this path becomes critical and fails on this dataset.

Key code references:

- `src/core/ingestion/savIngestion.ts`
  - `jsavvy` import and usage for schema/all parsing.
- `node_modules/jsavvy/dist/index.js`
  - `readScale()` throws when expected marker `4` is missing.

Impact:

- CLI load/schema operations fail for this dataset.
- Any runtime path depending on `jsavvy` as fallback/metadata source is vulnerable.

## Root Cause 2: Dense full-matrix accumulation in WASM parse path

The WASM C shim stores values into global dense arrays for all parsed cells before downstream processing:

- `g_numeric_data` (`double *`)
- `g_string_data` (`char **`)
- `g_is_missing` (`int *`)

Baseline rough footprint for this file:

- cells = `97,220 * 613 = 59,595,860`
- numeric data ~= `59,595,860 * 8` bytes
- missing flags ~= `59,595,860 * 4` bytes
- string pointer array ~= `59,595,860 * 8` bytes
- total baseline (without actual string payloads and overhead) ~= **1.11 GB**

This is before Arrow vectors/tables and runtime overhead, explaining why large-file full ingest is fragile.

Impact:

- Browser worker full load can crash or become unstable on large/wide SAVs.
- Current 50MB warning + 200MB hard metadata cutoff is not sufficient as a universal safety model.

## Historical Context (Git)

Relevant progression:

- `1ce31e7`: initial browser SAV ingestion using `jsavvy`.
- `4a01247`: shift to ReadStat-WASM + Arrow path.
- `7bf0a60`: large-SAV guardrails, sample mode, chunked insertion.

Current state reflects this history: guardrails improved UX, but underlying parser memory architecture remains high-risk for full loads.

## Remediation Options

### Immediate (high priority)

1. **Remove `jsavvy` from critical ingestion paths**
   - For Node/CLI metadata, use ReadStat-backed metadata extraction rather than `jsavvy`.
   - At minimum, catch `jsavvy` parse errors and degrade gracefully (metadata-only notice) instead of hard failure.

2. **Harden fallback ordering**
   - If DuckDB `read_stat` is unavailable, avoid defaulting straight to fragile `jsavvy` full parse for large files.
   - Prefer metadata/sample workflows with explicit user messaging.

3. **Adjust large-file gating**
   - Consider a lower hard cutoff or dynamic risk scoring based on estimated cells (`rows * vars`) from metadata parse.
   - `177 MB` WVS currently falls below the 200MB hard limit but is still high-risk due to width/row count.

### Mid-term

4. **Implement true streaming parser output**
   - Replace full global matrix accumulation in C with row/batch callback buffers and immediate transfer.
   - Eliminate need to retain full `g_numeric_data/g_string_data/g_is_missing`.

5. **Reduce copy layers in JS**
   - Continue reducing row-major->column-major duplication by using builders/IPC chunking where possible.

### Long-term

6. **Prefer native DuckDB `read_sav` path where available**
   - Particularly in Node/CLI, native read path can avoid JS parser fragility.
   - Maintain robust local fallback for offline/no-extension environments.

## Proposed Acceptance Criteria

1. WVS Wave 7 metadata loads successfully in both browser and CLI contexts.
2. CLI does not crash/fail due to `jsavvy` scale-level parsing on this file.
3. Full-load decision uses risk-aware gating (not file-size-only).
4. Full browser load of WVS file either:
   - succeeds within stable memory bounds, or
   - is blocked with explicit and recoverable sample/metadata flow.

## Key Code References

- Browser ingestion:
  - `src/services/analysisWorker.ts`
  - `packages/readstat-wasm/ts/index.ts`
  - `packages/readstat-wasm/src/readstat_wasm.c`
- UI gating:
  - `src/App.tsx`
- Node/CLI ingestion:
  - `src/core/ingestion/savIngestion.ts`
  - `cli/velocity.ts`
- Historical design/report notes:
  - `docs/archive/dec_02_ingestion_strategy.md`
  - `docs/report_02_large_sav_ui_guardrails.md`
  - `docs/archive/impl_01_readstat_wasm.md`

## Appendix: Notable Reproduced Errors

- `jsavvy`: `Levels read error. Magic value Expected: 4 Actual: 0`
- DuckDB extension install in restricted environment:
  - Failed to download `read_stat` extension due to network/sandbox limits.

