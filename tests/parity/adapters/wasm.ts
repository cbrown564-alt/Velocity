import { createRequire } from 'module';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { DuckDBWasmAdapter } from '../../../src/adapters/DuckDBWasmAdapter';
import { DatabaseAdapter } from '../../../src/core/DatabaseAdapter';

const require = createRequire(import.meta.url);
const duckdb = require('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs');

/**
 * Instantiate DuckDB-WASM in Node.js for parity testing using the blocking Node bundle.
 * We wrap the blocking API to match the Async interface expected by DuckDBWasmAdapter.
 */
export async function createWasmAdapter(): Promise<DatabaseAdapter> {
  const distDir = resolve('node_modules/@duckdb/duckdb-wasm/dist');
  const wasmPath = resolve(distDir, 'duckdb-eh.wasm');
  const wasmModule = readFileSync(wasmPath);

  const logger = new duckdb.ConsoleLogger();
  const bundles = {
    eh: {
      mainModule: wasmPath,
      mainWorker: null,
    },
  };

  const db = await duckdb.createDuckDB(bundles, logger, duckdb.NODE_RUNTIME);
  await db.instantiate(wasmModule);
  await db.open({ path: ':memory:' });

  const conn = db.connect();

  const asyncConn = {
    query: async (sql: string) => conn.query(sql),
    close: async () => conn.close(),
    disconnect: async () => conn.close(),
    insertArrowTable: async (table: any, options: any) => conn.insertArrowTable(table, options),
    getTableNames: async (query: any) => conn.getTableNames(query),
  };

  // The adapter expects AsyncDuckDBConnection and optionally AsyncDuckDB
  return new DuckDBWasmAdapter(asyncConn as any, db as any);
}

/**
 * Helper to load a CSV file into the WASM adapter.
 */
export async function loadCSVToWasm(
  adapter: DatabaseAdapter,
  filePath: string,
  tableName: string = 'main',
): Promise<void> {
  const wasmAdapter = adapter as DuckDBWasmAdapter;
  const rawConn = wasmAdapter.getRawConnection();
  const db = (wasmAdapter as any).db || (wasmAdapter as any).conn.db;

  const content = readFileSync(filePath, 'utf-8');
  const fileName = 'data.csv';

  // Both Async and Sync DBs usually have registerFileText
  await (db as any).registerFileText(fileName, content);
  await rawConn.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}')`);
}
