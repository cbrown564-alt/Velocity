# Arrow Build for Large SAVs (Current Understanding)

## Context
Velocity loads SAV files in the browser worker via `@velocity/readstat-wasm`, then builds an Apache Arrow table to insert into DuckDB. For large SAVs, the current conversion path can significantly increase peak memory usage and risk worker crashes.

## Current Implementation Summary
- Parsing happens in the worker (`src/services/analysisWorker.ts`).
- `parseSavFile` returns row-major data in `parsed.rows` and metadata in `parsed.metadata`.
- The worker pivots row-major to column-major in JS:
  - `columnsData` is allocated as `numCols` arrays, each `numRows` long.
  - For each row, each column value is copied into `columnsData[c][r]`.
- Arrow vectors are created from each column array and assembled into an Arrow table.
- The Arrow table is inserted into DuckDB, then validated via a row count query.

## Observed Memory Behavior
- The pivot creates a second full in-memory copy of the dataset.
- Peak memory occurs while both `parsed.rows` and `columnsData` coexist.
- We currently null out rows as they are processed and clear `parsed.rows` after conversion to reduce peak usage, but the algorithm still requires a full columnar copy.

## Risks for Large SAVs
- Large row counts and/or wide tables can exceed browser worker memory.
- Memory spikes are most likely during the row-major to column-major pivot.
- A crash or tab kill can occur before DuckDB insertion finishes.

## Open Questions / Follow-Up Topics
- Can we stream into Arrow vectors or use Arrow builders to avoid the full columnar copy?
- Is chunked insertion to DuckDB viable with `insertArrowTable` or via temporary Arrow batches?
- Does `@velocity/readstat-wasm` support columnar output or incremental row streaming?
- Are there DuckDB WASM APIs for appending rows or inserting incremental batches that reduce peak memory?

## Possible Mitigations (Future)
- Chunked conversion: build columnar chunks and insert in batches.
- Arrow builders: append values incrementally instead of creating full arrays first.
- Streaming parser: avoid holding `parsed.rows` fully in memory if supported.

## Related Files
- `src/services/analysisWorker.ts`
- `src/core/ingestion/savLoader.ts`
- `src/core/ingestion/savIngestion.ts` (Node path)

## Next Session Goal
Explore the feasibility of streaming or chunked Arrow construction to reduce peak memory usage, and identify the best approach given available APIs in DuckDB WASM and `@velocity/readstat-wasm`.
