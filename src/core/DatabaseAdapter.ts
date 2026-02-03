/**
 * DatabaseAdapter Interface
 *
 * Abstract interface that decouples analysis orchestration from the DuckDB runtime.
 * Implementations:
 * - DuckDBWasmAdapter: Browser Web Worker (uses @duckdb/duckdb-wasm)
 * - DuckDBNodeAdapter: Node.js CLI (uses duckdb native bindings)
 */

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface StreamOptions {
  chunkSize?: number; // default: 10_000
}

export interface DatabaseAdapter {
  /** Execute a SQL query and return results */
  query(sql: string): Promise<QueryResult>;

  /** Stream query results as async iterable chunks */
  queryStream?(sql: string, options?: StreamOptions): AsyncIterable<QueryResult>;

  /** Execute a SQL statement with no return value */
  execute(sql: string): Promise<void>;

  /** Insert an Arrow IPC buffer into a table */
  insertArrowBuffer(tableName: string, buffer: Uint8Array): Promise<void>;

  /** List all table names in the database */
  getTableNames(): Promise<string[]>;

  /** Close the database connection and free resources */
  close(): Promise<void>;
}
