# Headless Core Architecture

The analysis engine is extracted into browser-independent modules under `src/core/`. This allows the same statistical logic to run in the browser (via Web Worker + DuckDB-WASM) and on the command line (via Node.js + native DuckDB).

## 1. Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                      │
│  ┌──────────────┐    ┌────────────┐    ┌──────────────────────────┐  │
│  │   React UI   │◄──►│  Zustand   │◄──►│   analysisWorker.ts      │  │
│  │  (Main Thrd) │    │   Store    │    │   (thin shell)           │  │
│  └──────────────┘    └────────────┘    └───────────┬──────────────┘  │
│                                                     │                 │
│                                        ┌────────────▼─────────────┐  │
│                                        │  DuckDBWasmAdapter       │  │
│                                        └────────────┬─────────────┘  │
└─────────────────────────────────────────────────────┼────────────────┘
                                                      │
                        ┌─────────────────────────────▼──────────────┐
                        │              src/core/                      │
                        │                                             │
                        │  DatabaseAdapter ◄─── interface             │
                        │       │                                     │
                        │  ┌────▼──────────┐   ┌──────────────────┐  │
                        │  │ crosstabRunner │   │ variableStatsRnr │  │
                        │  └───────────────┘   └──────────────────┘  │
                        │                                             │
                        │  ┌───────────────┐   ┌──────────────────┐  │
                        │  │ savLoader      │   │ gridDetection    │  │
                        │  └───────────────┘   └──────────────────┘  │
                        │                                             │
                        │  ┌──────────────────┐                      │
                        │  │ scaleNormalizatn │                      │
                        │  └──────────────────┘                      │
                        └─────────────────────────────┬──────────────┘
                                                      │
┌─────────────────────────────────────────────────────┼────────────────┐
│                           NODE.js CLI                                 │
│                                        ┌────────────▼─────────────┐  │
│  ┌──────────────┐                      │  DuckDBNodeAdapter       │  │
│  │ cli/velocity │─────────────────────►│  (@duckdb/node-api)      │  │
│  └──────────────┘                      └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

The core modules have **zero browser dependencies**. They accept a `DatabaseAdapter` and return plain objects. The adapter pattern is the single seam between platform-specific DuckDB runtimes and portable analysis logic.

## 2. The DatabaseAdapter Interface

All database access flows through this interface, defined in `src/core/DatabaseAdapter.ts`:

```typescript
interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

interface DatabaseAdapter {
  query(sql: string): Promise<QueryResult>;
  execute(sql: string): Promise<void>;
  insertArrowBuffer(tableName: string, buffer: Uint8Array): Promise<void>;
  getTableNames(): Promise<string[]>;
  close(): Promise<void>;
}
```

Two implementations exist:

| Adapter | Location | Runtime | Backing |
|:--------|:---------|:--------|:--------|
| `DuckDBWasmAdapter` | `src/adapters/DuckDBWasmAdapter.ts` | Browser Worker | `@duckdb/duckdb-wasm` `AsyncDuckDBConnection` |
| `DuckDBNodeAdapter` | `src/adapters/DuckDBNodeAdapter.ts` | Node.js | `@duckdb/node-api` in-memory instance |

### Adapter-Specific Extensions

- **DuckDBWasmAdapter** adds `insertArrowTable(table, name)` for Arrow IPC ingestion and `getRawConnection()` for WASM-specific operations (OPFS persistence, keepalive).
- **DuckDBNodeAdapter** adds `loadCSV(filePath, tableName)` which calls `read_csv_auto()` for direct file loading. Created via async factory: `DuckDBNodeAdapter.create()`.

## 3. Analysis Runners

Runners are pure async functions that take an adapter and return results. They contain no platform-specific code.

### 3.1 Crosstab Runner

**Location:** `src/core/analysis/crosstabRunner.ts`

```typescript
function runCrosstab(
  adapter: DatabaseAdapter,
  options: CrosstabQueryOptions & { includeDistributions?: boolean },
  context: CrosstabContext
): Promise<any[]>
```

**`CrosstabContext`** provides variable metadata so the runner can resolve grids, detect scale variables, and apply value labels:

```typescript
interface CrosstabContext {
  variables: Record<string, Variable>;
  variableSets: Record<string, VariableSet>;
}
```

**Pipeline:**

1. **Grid expansion** — If a row variable belongs to a `VariableSet` of type `grid`, the runner generates synthetic pivot columns and rewrites the query to UNPIVOT them.
2. **Scale detection** — Nested numeric variables are treated as measures (mean/stdDev) rather than nominal categories.
3. **SQL generation** — Delegates to `queryBuilder.ts` via `buildCrosstabQuery()`.
4. **Histogram computation** — When `includeDistributions` is true, generates 20-bin grouped histograms for violin/ridgeline charts.
5. **Significance testing** — Computes t-scores, p-values, and effective sample sizes (ESS) per cell. Marks cells as `high_95`, `low_95`, `high_80`, or `low_80`.

### 3.2 Variable Stats Runner

**Location:** `src/core/analysis/variableStatsRunner.ts`

```typescript
function getVariableStats(
  adapter: DatabaseAdapter,
  column: string,
  variableType?: 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date',
  binCount?: number
): Promise<VariableStatsResult>
```

**Output structure:**

| Field | Type | Description |
|:------|:-----|:------------|
| `frequencies` | `{value, label, count}[]` | Top 10 values by count |
| `missingCount` | `number` | NULL / missing count |
| `totalCount` | `number` | Total row count |
| `numeric` | `object` (optional) | Box plot stats, histogram bins, outliers |

The `numeric` block includes min, max, mean, median, stdDev, quartiles (Q1/Q3), IQR fences, whisker bounds, outlier values, and histogram bins.

## 4. Ingestion Pipeline

### 4.1 SAV Loader

**Location:** `src/core/ingestion/savLoader.ts`

Transforms raw SAV parser output into Velocity's canonical `Variable[]` and `VariableSet[]`. The SAV parser itself (ReadStat-WASM) is platform-specific and lives outside core — only the metadata processing is in core.

```typescript
function processMetadata(data: ParsedSavData): ProcessedSavResult
```

**Pipeline:**

1. Map raw metadata → `Variable` objects with type inference (value labels → nominal, no labels + numeric → scale).
2. Fill endpoint-labeled scale gaps via `scaleNormalization.ts`.
3. Build `VariableSets` from explicit SPSS Multiple Response Set definitions.
4. Detect implicit grids via `gridDetection.ts` heuristics.
5. Generate synthetic grid variables for UNPIVOT queries.

### 4.2 Grid Detection Heuristics

**Location:** `src/core/gridDetection.ts`

Detects grid/multi-response variable groups that SPSS did not explicitly declare:

- **By position:** Consecutive variables (index gap ≤ 2) with matching value label sets.
- **By naming:** Shared prefix with sequential numeric suffixes (e.g., `Q5_1`, `Q5_2`, `Q5_3`).
- **Numeric grids:** Position proximity + label similarity (Jaccard on word tokens) + shared min/max/cardinality.

Also exports utility functions: `detectImplicitScale()` for distinguishing continuous from categorical numeric data, `inferPositiveValue()` for binary scales, and `isDateFormat()` for SPSS format strings.

### 4.3 Scale Normalization

**Location:** `src/core/scaleNormalization.ts`

Handles the common SPSS pattern where only scale endpoints are labeled (e.g., 1 = "Strongly Disagree", 10 = "Strongly Agree" with 2–9 unlabeled). Scans actual data values to confirm the range, then fills missing labels with numeric strings and sets the variable type to `scale`.

```typescript
function fillEndpointLabelGaps(
  variables: Variable[],
  rows: any[][],
  findColumnIndex: (variableName: string) => number
): void
```

This mutates the `variables` array in-place.

## 5. The Worker (Thin Shell)

After extraction, `src/services/analysisWorker.ts` (~549 lines, down from 1575) contains only:

- **DuckDB-WASM initialization** (bundle fetch, OPFS path configuration)
- **OPFS persistence** (save/load database to Origin Private File System)
- **Message handler** (`onmessage`) that dispatches `WorkerRequest` types to core runners
- **Keepalive** (periodic pings to prevent worker termination)

All business logic — crosstabs, stats, ingestion, grid detection — is imported from `src/core/`.

## 6. CLI

**Location:** `cli/velocity.ts`

A Node.js entry point that wires `DuckDBNodeAdapter` to the same core runners the browser uses.

| Command | Description |
|:--------|:------------|
| `load <file>` | Load CSV, display row count and schema |
| `schema <file>` | Output JSON column schema |
| `query <file> --rows a,b [--cols c] [--weight w] [--format json\|table]` | Run a crosstab |
| `stats <file> <column> [--type nominal] [--bins 10]` | Variable frequency/numeric stats |
| `sql <file> "<SQL>"` | Raw SQL query |

```bash
npx tsx cli/velocity.ts query data.csv --rows Gender,AgeGroup --cols Region --format table
```

The CLI currently supports CSV only. SAV support requires a Node-compatible SAV parser (see §8.1).

## 7. Golden Tests

**Location:** `tests/golden/`

Snapshot regression tests that load known fixtures through `DuckDBNodeAdapter` → core runners and compare JSON output against expected baselines. Any drift in statistical output fails the test.

```
tests/golden/
├── fixtures/simple_crosstab.csv
├── expected/*.json
└── golden.test.ts
```

Run with `npm run test:run`.

## 8. Future Work

### 8.1 SAV Support in CLI

`savLoader.ts` is ready but needs a Node-compatible SAV parser. Options: ReadStat native addon, ReadStat-WASM with Node polyfills, or a pure-JS parser.

### 8.2 Expanded Golden Tests

Add fixtures for: weighted crosstabs with significance, grid expansion, filtered queries, edge cases (empty cells, all-missing columns), and large datasets for performance baselines.

### 8.3 Adapter Parity Testing

Run identical golden fixtures through both `DuckDBWasmAdapter` (in Node via `@duckdb/duckdb-wasm`) and `DuckDBNodeAdapter` to catch adapter-level divergences.

### 8.4 Export Pipeline

Move PowerPoint/Excel export into `src/core/export/` for headless report generation.

### 8.5 Plugin Architecture

The adapter + runner pattern supports pluggable analysis modules via an `AnalysisRunner<TConfig, TResult>` interface. New analysis types (regression, factor analysis) work in both browser and CLI without modification.

### 8.6 Streaming Results

Add `queryStream()` to `DatabaseAdapter` for large result sets that shouldn't be buffered entirely in memory.
