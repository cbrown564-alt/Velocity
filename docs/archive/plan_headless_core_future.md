# Headless Core: Future Work Implementation Plan

Expands each item from `arch_03_headless_core.md` §8 into actionable implementation guides.

---

## 8.1 SAV Support in CLI

### Problem

The CLI currently only supports CSV via `INSERT INTO ... FROM read_csv(...)`. SAV (SPSS) files require parsing binary format to extract both data and metadata (variable labels, value labels, missing values, variable sets).

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. DuckDB `read_stat` extension** | Single SQL call; fast; maintained by DuckDB team | Only loads *data* — no value labels, variable sets, or missing-value specs. Would still need a metadata parser. |
| **B. jsavvy (already in `package.json`)** | Pure JS; already a dependency; extracts full SPSS metadata | Slower than native; must buffer entire file; maturity/edge-case coverage unknown at scale |
| **C. ReadStat native addon** | Battle-tested C library; fast | Requires native compilation; complicates CI and distribution |
| **D. ReadStat-WASM in Node** | No native compilation; same binary as browser path | WASM overhead in Node; needs polyfills for WASI or Emscripten FS |

### Recommendation

**Hybrid: jsavvy for metadata + DuckDB `read_stat` for data ingest.**

- Use jsavvy (already depended on) to parse the SAV header and extract `Variable[]`, `VariableSet[]`, `valueLabels`, and `missingValues` — the same path `savLoader.ts` already uses in the browser.
- Use DuckDB's `read_stat` extension (`INSTALL read_stat; LOAD read_stat; CREATE TABLE survey AS SELECT * FROM read_sav('file.sav')`) for fast columnar data ingest.
- This avoids duplicating data loading in JS while getting full metadata fidelity.

If `read_stat` is unavailable or unreliable for a given file, fall back to jsavvy for both data and metadata (the current browser path).

### Implementation Steps

1. **Verify `read_stat` availability in `@duckdb/node-api`:**
   ```sql
   INSTALL read_stat; LOAD read_stat;
   SELECT * FROM read_sav('/path/to/test.sav') LIMIT 5;
   ```
   If this fails, skip to step 5 (jsavvy-only path).

2. **Add `loadSav()` to `DuckDBNodeAdapter`** (or a new `src/core/ingestion/savIngestion.ts`):
   - Accept a file path string.
   - Run `CREATE TABLE survey_data AS SELECT * FROM read_sav(?)`.
   - In parallel, read the same file with jsavvy to extract metadata.
   - Pass metadata through existing `savLoader.ts` → `buildVariables()` pipeline.

3. **Wire into CLI** (`cli/velocity.ts`):
   - In the `load` command, detect `.sav` extension and call `loadSav()` instead of the CSV path.

4. **Add golden test fixture:** A small `.sav` file (5 variables, 20 rows) with value labels, missing values, and a grid set. Assert metadata and data match expected snapshots.

5. **jsavvy-only fallback:** If `read_stat` is not viable, use jsavvy to produce an Arrow IPC buffer (via the existing browser code path adapted for Node buffers) and call `adapter.insertArrowBuffer()`.

---

## 8.2 Expanded Golden Tests

### Current State

Golden tests exist in `tests/golden/` and run fixtures through `DuckDBNodeAdapter` → core runners, snapshotting outputs.

### Fixtures to Add

| Fixture | Purpose | Key assertions |
|---|---|---|
| **weighted_crosstab.csv** + config | Weighted crosstab with rim weighting | Weighted counts, weighted %, base sizes |
| **significance_test.csv** + config | Crosstab with significance testing | p-values, letter markers (A/B/C), effect sizes |
| **grid_expansion.csv** + metadata | Multi-response grid variable set | Grid rows expand correctly; counts per sub-variable |
| **filtered_query.csv** + filter | Crosstab with active filter | Filtered base sizes; excluded rows absent |
| **empty_cells.csv** | Sparse data with empty cross-cells | Zero cells rendered; no division-by-zero errors |
| **all_missing_column.csv** | Column where every value is system-missing | Graceful handling; missing count = N |
| **large_perf_baseline.csv** | 100k rows, 50 variables | Execution time recorded (not asserted, just logged for regression tracking) |

### Implementation Steps

1. Create fixture files in `tests/golden/fixtures/`.
2. For each fixture, create a companion `.config.json` specifying the analysis config (rows, columns, weight, filter, expected output file name).
3. Add a parameterized test that iterates over all `fixtures/*.config.json`, runs the analysis, and compares to `*.expected.json` snapshots.
4. Use `toMatchSnapshot()` or file-based comparison — file-based is preferred for diffability.
5. For the performance baseline, record `process.hrtime()` duration and write to `tests/golden/perf_log.jsonl` (append-only). No hard assertion, but CI can flag regressions via trend analysis.

---

## 8.3 Adapter Parity Testing

### Goal

Prove that `DuckDBWasmAdapter` (browser) and `DuckDBNodeAdapter` (CLI) produce identical results for all analyses.

### Design: Dual-Adapter Test Harness

```
tests/parity/
├── runParity.ts          # Harness: runs each fixture through both adapters
├── adapters/
│   ├── wasm.ts           # Instantiates DuckDBWasmAdapter in Node (via @duckdb/duckdb-wasm)
│   └── node.ts           # Instantiates DuckDBNodeAdapter
└── fixtures/             # Shared with golden tests
```

### Key Challenge

`@duckdb/duckdb-wasm` in Node requires:
- A WASM binary (shipped in the npm package under `dist/`)
- A Web Worker polyfill or direct instantiation via `AsyncDuckDB` without a worker

Use `@duckdb/duckdb-wasm`'s Node.js bundle (`@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs`) or instantiate the async API with a `worker_threads`-based worker.

### Implementation Steps

1. **Create `tests/parity/adapters/wasm.ts`:** Instantiate `@duckdb/duckdb-wasm` in Node using the Node-compatible entry point. Return a `DatabaseAdapter`.
2. **Create `tests/parity/adapters/node.ts`:** Instantiate `DuckDBNodeAdapter`. Return a `DatabaseAdapter`.
3. **Create `tests/parity/runParity.ts`:**
   - For each golden fixture, load the same CSV into both adapters.
   - Run the same analysis (crosstab or variable stats) via the core runners.
   - Deep-compare results. Allow floating-point tolerance (1e-10) for weighted calculations.
4. **Integrate into CI:** Run parity tests as a separate test suite (`npm run test:parity`).
5. **Document known divergences** (if any) in a `tests/parity/KNOWN_DIVERGENCES.md`.

---

## 8.4 Export Pipeline

### Goal

Headless generation of PowerPoint and Excel reports from analysis results, usable from both browser and CLI.

### Options

| Library | Format | Size | Node + Browser |
|---|---|---|---|
| **PptxGenJS** | .pptx | ~200KB | Yes (pure JS) |
| **ExcelJS** | .xlsx | ~800KB | Yes (pure JS, streams in Node) |

Both are pure JS with no native dependencies — ideal for the dual-platform constraint.

### Module Structure

```
src/core/export/
├── index.ts                 # Public API: exportPptx(), exportXlsx()
├── pptxExporter.ts          # PptxGenJS wrapper
├── xlsxExporter.ts          # ExcelJS wrapper
├── templates/
│   ├── defaultSlide.ts      # Default PPTX slide layout (title, table, footer)
│   └── defaultSheet.ts      # Default XLSX sheet layout
└── types.ts                 # ExportConfig, SlideConfig, SheetConfig
```

### Public API

```typescript
interface ExportConfig {
  title: string;
  analyses: AnalysisExportItem[];  // Each becomes a slide/sheet
  branding?: { logo?: Uint8Array; colors?: Record<string, string> };
}

interface AnalysisExportItem {
  label: string;
  result: CrosstabResult | VariableStatsResult;
  options?: { showSignificance?: boolean; decimalPlaces?: number };
}

// Returns binary content (Uint8Array) — caller decides how to save
function exportPptx(config: ExportConfig): Promise<Uint8Array>;
function exportXlsx(config: ExportConfig): Promise<Uint8Array>;
```

### Implementation Steps

1. `npm install pptxgenjs exceljs`
2. Create `src/core/export/types.ts` with the interfaces above.
3. Implement `pptxExporter.ts`:
   - Map each `AnalysisExportItem` to a slide.
   - Render crosstab as a PptxGenJS table with cell formatting (significance letters in superscript, weighted bases in footer row).
   - Apply branding colors from config or fall back to design system tokens.
4. Implement `xlsxExporter.ts`:
   - Map each item to a worksheet.
   - Use ExcelJS styling for header rows, number formatting, conditional formatting for significance.
5. Create `src/core/export/index.ts` re-exporting the public API.
6. Wire into CLI: `velocity export --format pptx --output report.pptx`
7. Wire into browser: Export button in UI calls the same function, then triggers `Blob` download.
8. Golden tests: Snapshot the binary output (or at minimum, assert file size > 0 and valid ZIP header `PK\x03\x04`).

---

## 8.5 Plugin Architecture

### Goal

Allow new analysis types (regression, factor analysis, cluster analysis) to plug into the system without modifying core code.

### Interface Design

```typescript
// src/core/analysis/AnalysisRunner.ts

interface AnalysisRunner<TConfig, TResult> {
  /** Unique identifier, e.g. "crosstab", "regression", "factor" */
  readonly id: string;

  /** Human-readable name for UI display */
  readonly label: string;

  /** JSON schema describing TConfig (for UI form generation) */
  readonly configSchema: Record<string, unknown>;

  /** Execute the analysis */
  run(adapter: DatabaseAdapter, config: TConfig): Promise<TResult>;

  /** Optional: validate config before execution */
  validate?(config: TConfig): string[];  // Returns error messages, empty = valid
}
```

### Registration & Discovery

```typescript
// src/core/analysis/registry.ts

class AnalysisRegistry {
  private runners = new Map<string, AnalysisRunner<unknown, unknown>>();

  register(runner: AnalysisRunner<unknown, unknown>): void;
  get(id: string): AnalysisRunner<unknown, unknown> | undefined;
  list(): Array<{ id: string; label: string }>;
}

// Singleton instance
export const analysisRegistry = new AnalysisRegistry();
```

### Implementation Steps

1. Define `AnalysisRunner` interface in `src/core/analysis/AnalysisRunner.ts`.
2. Create `src/core/analysis/registry.ts` with the `AnalysisRegistry` class.
3. Refactor `crosstabRunner.ts` to implement `AnalysisRunner<CrosstabConfig, CrosstabResult>` and self-register:
   ```typescript
   analysisRegistry.register(crosstabRunner);
   ```
4. Do the same for `variableStatsRunner.ts`.
5. Update the worker's message dispatcher to look up runners by ID from the registry instead of hardcoded `switch` cases.
6. Update the CLI to accept `--analysis <id>` and resolve from the registry.
7. Document the plugin contract in a `docs/guide_plugin_authoring.md` (when a third-party or future analysis is actually built).

---

## 8.6 Streaming Results

### Problem

`query()` returns all rows in memory. For large exports or data previews (100k+ rows), this causes memory spikes.

### Design

Add `queryStream()` to `DatabaseAdapter`:

```typescript
interface DatabaseAdapter {
  // ... existing methods ...

  /** Stream query results in chunks */
  queryStream(sql: string, options?: StreamOptions): AsyncIterable<QueryResult>;
}

interface StreamOptions {
  /** Rows per chunk (default: 10_000) */
  chunkSize?: number;
}
```

Each yielded `QueryResult` contains one chunk of rows with the same `columns` array.

### Implementation Strategy

**Node adapter (`DuckDBNodeAdapter`):**
- Use DuckDB's native streaming result API if available in `@duckdb/node-api`.
- Fallback: Issue `SELECT ... LIMIT ? OFFSET ?` queries in a loop, yielding each batch. Stop when `rowCount < chunkSize`.

**WASM adapter (`DuckDBWasmAdapter`):**
- `@duckdb/duckdb-wasm` supports `AsyncDuckDB.query()` returning Arrow tables. Use Arrow's record batch iteration to yield chunks.
- Fallback: Same LIMIT/OFFSET approach.

### Implementation Steps

1. Add `queryStream()` to the `DatabaseAdapter` interface (with a default implementation that falls back to single `query()` for backwards compatibility).
2. Implement in `DuckDBNodeAdapter`:
   - Check if `@duckdb/node-api` exposes a streaming/cursor API.
   - If yes, wrap it as an async generator.
   - If no, implement LIMIT/OFFSET pagination.
3. Implement in `DuckDBWasmAdapter`:
   - Use Arrow record batch iteration if available.
   - Otherwise LIMIT/OFFSET.
4. Add to the export pipeline: `xlsxExporter` can write rows incrementally using ExcelJS's streaming writer (`workbook.xlsx.write(stream)`).
5. Add to CLI: `velocity sql "SELECT ..." --stream` pipes chunks to stdout as NDJSON.
6. Test: Golden test with a 50k-row fixture asserting that streaming produces identical aggregate results to non-streaming, and peak memory stays below a threshold.
