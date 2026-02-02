/**
 * DuckDB Node Adapter
 *
 * Node.js implementation of DatabaseAdapter using @duckdb/node-api.
 * Used by the CLI for headless analysis.
 */

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { DatabaseAdapter, QueryResult } from '../core/DatabaseAdapter';
import { Variable, VariableSet } from '../types';

export class DuckDBNodeAdapter implements DatabaseAdapter {
  private constructor(
    private instance: DuckDBInstance,
    private connection: DuckDBConnection
  ) { }

  static async create(): Promise<DuckDBNodeAdapter> {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    return new DuckDBNodeAdapter(instance, connection);
  }

  async query(sql: string): Promise<QueryResult> {
    const reader = await this.connection.runAndReadAll(sql);
    const columns = reader.columnNames();
    const rowCount = reader.currentRowCount;
    const rows: Record<string, unknown>[] = [];

    for (let r = 0; r < rowCount; r++) {
      const row: Record<string, unknown> = {};
      for (let c = 0; c < columns.length; c++) {
        const val = reader.value(c, r);
        row[columns[c]] = typeof val === 'bigint' ? Number(val) : val;
      }
      rows.push(row);
    }

    return { columns, rows, rowCount };
  }

  async execute(sql: string): Promise<void> {
    await this.connection.run(sql);
  }

  async insertArrowBuffer(tableName: string, buffer: Uint8Array): Promise<void> {
    throw new Error(
      'DuckDBNodeAdapter.insertArrowBuffer not yet implemented. ' +
      'Use loadCSV() or execute() with INSERT statements instead.'
    );
  }

  async getTableNames(): Promise<string[]> {
    const result = await this.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'`
    );
    return result.rows.map(r => r.table_name as string);
  }

  async close(): Promise<void> {
    this.connection.closeSync();
    this.instance.closeSync();
  }

  async loadCSV(filePath: string, tableName: string = 'main'): Promise<number> {
    await this.execute(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${filePath}')`);
    const result = await this.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
    return Number(result.rows[0]?.cnt);
  }

  async loadSav(filePath: string, tableName: string = 'main'): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number }> {
    const { loadSav } = await import('../core/ingestion/savIngestion');
    return loadSav(this, filePath, tableName);
  }
}
