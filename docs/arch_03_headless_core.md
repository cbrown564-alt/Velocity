# Headless Core Architecture

## Summary of Work

The analysis engine was extracted from `analysisWorker.ts` (1575 lines) into a browser-independent `src/core/` package. A Node.js CLI and golden test infrastructure were built on top.

### What Changed

| Phase | Deliverable | Key Files |
|-------|------------|-----------|
| 1a | Worker types moved to shared location | `src/types/worker.ts` |
| 1b | Grid detection heuristics extracted | `src/core/gridDetection.ts` |
| 1c | Scale gap-filling extracted | `src/core/scaleNormalization.ts` |
| 2 | DatabaseAdapter interface | `src/core/DatabaseAdapter.ts`, `src/adapters/DuckDBWasmAdapter.ts` |
| 3 | Crosstab + stats runners | `src/core/analysis/crosstabRunner.ts`, `variableStatsRunner.ts` |
| 4 | SAV ingestion logic | `src/core/ingestion/savLoader.ts` |
| 5 | Worker wired to core | `src/services/analysisWorker.ts` (549 lines, down from 1575) |
| 6 | Node adapter + CLI | `src/adapters/DuckDBNodeAdapter.ts`, `cli/velocity.ts` |
| 7 | Golden tests | `tests/golden/` (4 snapshot tests) |

### Architecture After Extraction

```
src/core/                          # Browser-independent, pure logic
├── DatabaseAdapter.ts             # Interface: query(), execute(), close(), etc.
├── gridDetection.ts               # Heuristic grid/MR set detection
├── scaleNormalization.ts          # Endpoint-labeled scale gap filling
├── analysis/
│   ├── crosstabRunner.ts          # Crosstab orchestration (sig testing, histograms)
│   └── variableStatsRunner.ts     # Frequency + numeric stats
└── ingestion/
    └── savLoader.ts               # SAV metadata → Variables + VariableSets

src/adapters/
├── DuckDBWasmAdapter.ts           # Browser: wraps DuckDB-WASM AsyncDuckDBConnection
└── DuckDBNodeAdapter.ts           # Node: wraps @duckdb/node-api

cli/velocity.ts                    # CLI entry point (load, schema, query, stats, sql)

tests/golden/                      # Snapshot regression tests
├── fixtures/simple_crosstab.csv
├── expected/*.json
└── golden.test.ts
```

The worker (`analysisWorker.ts`) is now a thin shell: DuckDB-WASM init, OPFS persistence, message handler, and keepalive. All business logic lives in `src/core/`.

### CLI Usage

```bash
npx tsx cli/velocity.ts load <file.csv>
npx tsx cli/velocity.ts schema <file.csv>
npx tsx cli/velocity.ts query <file.csv> --rows col1,col2 [--cols col3] [--weight w] [--format json|table]
npx tsx cli/velocity.ts stats <file.csv> <column> [--type numeric|nominal] [--bins 10]
npx tsx cli/velocity.ts sql <file.csv> "<SQL>"
```

---

## Plan: Building on This Architecture

### Near-term (leverage what exists)

**1. SAV support in CLI**

The CLI currently only loads CSV. The `savLoader.ts` pipeline is ready but needs a Node-compatible SAV parser. Options:
- Compile ReadStat as a native Node addon
- Use ReadStat-WASM in Node (needs minor polyfills for `globalThis.performance`, no DOM)
- Use a pure-JS SAV parser if one exists

Once parsing works, the flow is: parse → `processMetadata()` → `adapter.loadCSV/execute` for data insertion.

**2. Expand golden test coverage**

Current golden tests cover basic crosstabs and stats. Add fixtures for:
- Weighted crosstabs with significance testing (needs `colVar`)
- Grid variable expansion (synthetic variables)
- Filtered queries
- Edge cases: empty cells, single-row data, all-missing columns
- Large datasets (1000+ rows) for performance baselines

**3. CLI batch mode**

Add a `batch` command that reads a JSON config file specifying multiple queries, runs them all against a single loaded dataset, and outputs results. Useful for automated reporting pipelines.

```bash
npx tsx cli/velocity.ts batch <file.csv> --config queries.json --out results/
```

### Medium-term (new capabilities)

**4. Headless test harness for browser parity**

Run the same golden test fixtures through `DuckDBWasmAdapter` in a Node environment (DuckDB-WASM works in Node with `@duckdb/duckdb-wasm`). Compare outputs from both adapters to guarantee parity. This catches adapter-level bugs that golden tests alone would miss.

**5. Export pipeline in core**

Move PowerPoint/Excel export logic into `src/core/export/` so it can run headlessly. The CLI could then produce `.pptx` or `.xlsx` files directly:

```bash
npx tsx cli/velocity.ts export <file.csv> --config analysis.json --format pptx --out report.pptx
```

**6. Plugin architecture for custom statistics**

The `DatabaseAdapter` + runner pattern naturally supports pluggable analysis modules. Define an `AnalysisRunner` interface:

```typescript
interface AnalysisRunner<TConfig, TResult> {
  run(adapter: DatabaseAdapter, config: TConfig, context: CrosstabContext): Promise<TResult>;
}
```

New analysis types (regression, factor analysis, cluster analysis) implement this interface and work in both browser and CLI without modification.

**7. Streaming results for large datasets**

`DuckDBNodeAdapter` currently reads all rows into memory. For large result sets, add a `queryStream()` method to `DatabaseAdapter` that yields rows in chunks. The CLI could then pipe output to stdout or a file without buffering the entire result.

### Long-term (ecosystem)

**8. CI integration**

Golden tests run in CI on every push. Add a GitHub Action that:
- Installs `@duckdb/node-api`
- Runs `npm run test:run` (includes golden tests)
- Fails the build if any statistical output drifts

**9. HTTP API wrapper**

Wrap the core in a lightweight HTTP server (Fastify/Express) for use cases where browser-based analysis isn't suitable but a full CLI session is overkill. The `DatabaseAdapter` pattern means the server code is trivial — just route handlers that call runners.

**10. Python/R interop**

Expose the analysis engine as a subprocess that communicates via JSON over stdin/stdout. Python and R scripts can then call Velocity's crosstab engine as a black box, useful for validation against SPSS output or integration into existing research workflows.
