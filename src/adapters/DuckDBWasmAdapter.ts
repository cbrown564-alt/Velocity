/**
 * DuckDB-WASM Adapter
 *
 * Browser-side implementation of DatabaseAdapter using @duckdb/duckdb-wasm.
 * Wraps an existing AsyncDuckDBConnection for use with core analysis modules.
 */

import type * as duckdb from '@duckdb/duckdb-wasm';
import type * as arrow from 'apache-arrow';
import { DatabaseAdapter, QueryResult, StreamOptions } from '../core/DatabaseAdapter';

export class DuckDBWasmAdapter implements DatabaseAdapter {
  constructor(
    private conn: duckdb.AsyncDuckDBConnection,
    private db?: duckdb.AsyncDuckDB
  ) {}

  async query(sql: string): Promise<QueryResult> {
    const result = await this.conn.query(sql);
    const rows = result.toArray().map((row: any) => row.toJSON());
    const columns = result.schema.fields.map((f: any) => f.name);

    return {
      columns,
      rows,
      rowCount: rows.length,
    };
  }

  async *queryStream(sql: string, options?: StreamOptions): AsyncIterable<QueryResult> {
    const chunkSize = options?.chunkSize ?? 10_000;
    let offset = 0;
    while (true) {
      const result = await this.query(`SELECT * FROM (${sql}) AS _q LIMIT ${chunkSize} OFFSET ${offset}`);
      if (result.rowCount === 0) break;
      yield result;
      if (result.rowCount < chunkSize) break;
      offset += chunkSize;
    }
  }

  async execute(sql: string): Promise<void> {
    await this.conn.query(sql);
  }

  async insertArrowBuffer(tableName: string, buffer: Uint8Array): Promise<void> {
    // DuckDB-WASM expects an Arrow Table object, not raw buffer.
    // For raw buffer insertion, we'd need to register it as a file first.
    // This method is primarily used by the Node adapter; the WASM adapter
    // uses insertArrowTable directly via the connection.
    throw new Error(
      'DuckDBWasmAdapter.insertArrowBuffer not implemented. ' +
      'Use conn.insertArrowTable() directly for WASM contexts.'
    );
  }

  /**
   * Insert an Apache Arrow Table directly (WASM-specific convenience method).
   */
  async insertArrowTable(table: arrow.Table, tableName: string): Promise<void> {
    await this.conn.insertArrowTable(table, { name: tableName, create: true });
  }

  async getTableNames(): Promise<string[]> {
    const result = await this.conn.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'`
    );
    return result.toArray().map((row: any) => row.table_name as string);
  }

  async close(): Promise<void> {
    await this.conn.close();
  }

  /**
   * Get the raw DuckDB connection for operations not covered by the adapter interface.
   * Escape hatch for WASM-specific features (e.g., registerFileText).
   */
  getRawConnection(): duckdb.AsyncDuckDBConnection {
    return this.conn;
  }
}
