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

export interface DatabaseAdapter {
  /** Execute a SQL query and return results */
  query(sql: string): Promise<QueryResult>;

  /** Execute a SQL statement with no return value */
  execute(sql: string): Promise<void>;

  /** Insert an Arrow IPC buffer into a table */
  insertArrowBuffer(tableName: string, buffer: Uint8Array): Promise<void>;

  /** List all table names in the database */
  getTableNames(): Promise<string[]>;

  /** Close the database connection and free resources */
  close(): Promise<void>;
}
