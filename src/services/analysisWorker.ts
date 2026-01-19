/**
 * Analysis Worker
 * 
 * Runs DuckDB-WASM in a dedicated Web Worker to keep the main thread responsive.
 * All database operations go through this worker via message passing.
 */

// Polyfill for Node.js 'global' - required by jsavvy
// @ts-ignore
globalThis.global = globalThis;

import * as duckdb from '@duckdb/duckdb-wasm';
// savParser imports jsavvy which needs 'global' - we load it dynamically after polyfill
import type { SavColumn } from './savParser';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

// Message types for type-safe communication
export type WorkerRequest =
  | { type: 'init' }
  | { type: 'loadCSV'; fileName: string; content: string }
  | { type: 'loadSAV'; buffer: ArrayBuffer }
  | { type: 'query'; sql: string }
  | { type: 'getSchema' }
  | { type: 'getUniqueValues'; column: string }
  | { type: 'recodeVariable'; sourceCol: string; newColName: string; mappings: Record<string, string> };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'schema'; data: { name: string; type: string }[] }
  | { type: 'savLoaded'; variables: any[]; rowCount: number; durationMs: number }
  | { type: 'queryResult'; data: any[]; durationMs: number }
  | { type: 'uniqueValues'; data: string[] }
  | { type: 'recodeComplete'; newColName: string }
  | { type: 'error'; message: string };

async function init() {
  if (db) return; // Already initialized

  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  console.log('🦆 [Worker] DuckDB Bundle Selected:', bundle);

  if (!bundle.mainWorker) {
    throw new Error('No main worker URL found in bundle');
  }

  // Fetch worker script and create blob URL (required for cross-origin)
  const workerRes = await fetch(bundle.mainWorker);
  const workerScript = await workerRes.text();
  const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
  const workerUrl = URL.createObjectURL(workerBlob);

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();

  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  URL.revokeObjectURL(workerUrl);

  conn = await db.connect();
  console.log('🦆 [Worker] DuckDB Initialized');
}

async function loadCSV(fileName: string, content: string) {
  if (!db || !conn) throw new Error('DB not initialized');

  await db.registerFileText(fileName, content);
  await conn.query(`CREATE OR REPLACE TABLE main AS SELECT * FROM read_csv_auto('${fileName}')`);
}

async function loadSAV(buffer: ArrayBuffer): Promise<{ variables: any[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();

  // Dynamic import to ensure global polyfill is applied first
  const { parseSavFile, savColumnsToVariables } = await import('./savParser');

  // Parse the SAV file
  const parsed = await parseSavFile(buffer);
  const variables = savColumnsToVariables(parsed.columns);

  // Create table with appropriate schema
  const columnDefs = parsed.columns.map(c => `"${c.name}" ${c.type}`).join(', ');
  await conn.query(`CREATE OR REPLACE TABLE main (${columnDefs})`);

  // Insert data in chunks to avoid memory issues
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < parsed.rows.length; i += CHUNK_SIZE) {
    const chunk = parsed.rows.slice(i, i + CHUNK_SIZE);
    const values = chunk.map(row => {
      const vals = row.map(v => {
        if (v === null) return 'NULL';
        if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
        return String(v);
      });
      return `(${vals.join(', ')})`;
    }).join(', ');

    if (values) {
      await conn.query(`INSERT INTO main VALUES ${values}`);
    }
  }

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV: ${parsed.rowCount} rows, ${variables.length} variables in ${durationMs.toFixed(2)}ms`);

  return { variables, rowCount: parsed.rowCount, durationMs };
}

async function getSchema(): Promise<{ name: string; type: string }[]> {
  if (!conn) throw new Error('DB not initialized');

  const result = await conn.query(`PRAGMA table_info('main')`);
  return result.toArray().map((row: any) => ({
    name: row.name,
    type: row.type,
  }));
}

async function runQuery(sql: string): Promise<{ data: any[]; durationMs: number }> {
  if (!conn) throw new Error('DB not initialized');

  const start = performance.now();
  const result = await conn.query(sql);
  const durationMs = performance.now() - start;

  console.log(`⏱️ [Worker] Query took ${durationMs.toFixed(2)}ms: ${sql}`);

  return {
    data: result.toArray().map((row) => row.toJSON()),
    durationMs,
  };
}

async function getUniqueValues(column: string): Promise<string[]> {
  if (!conn) throw new Error('DB not initialized');

  const result = await conn.query(`SELECT DISTINCT "${column}" as val FROM main ORDER BY val LIMIT 50`);
  return result.toArray().map((row) => String(row.val));
}

async function recodeVariable(
  sourceCol: string,
  newColName: string,
  mappings: Record<string, string>
): Promise<string> {
  if (!conn) throw new Error('DB not initialized');

  const safeNewCol = newColName.replace(/[^a-zA-Z0-9_]/g, '_');

  await conn.query(`ALTER TABLE main ADD COLUMN "${safeNewCol}" VARCHAR`);

  let caseSql = `CASE `;
  for (const [oldVal, newVal] of Object.entries(mappings)) {
    caseSql += `WHEN "${sourceCol}" = '${oldVal.replace(/'/g, "''")}' THEN '${newVal.replace(/'/g, "''")}' `;
  }
  caseSql += `ELSE "${sourceCol}" END`;

  await conn.query(`UPDATE main SET "${safeNewCol}" = ${caseSql}`);

  return safeNewCol;
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case 'init':
        await init();
        self.postMessage({ type: 'ready' } as WorkerResponse);
        break;

      case 'loadCSV':
        await loadCSV(request.fileName, request.content);
        const schema = await getSchema();
        self.postMessage({ type: 'schema', data: schema } as WorkerResponse);
        break;

      case 'loadSAV':
        const savResult = await loadSAV(request.buffer);
        self.postMessage({
          type: 'savLoaded',
          variables: savResult.variables,
          rowCount: savResult.rowCount,
          durationMs: savResult.durationMs,
        } as WorkerResponse);
        break;

      case 'query':
        const queryResult = await runQuery(request.sql);
        self.postMessage({
          type: 'queryResult',
          data: queryResult.data,
          durationMs: queryResult.durationMs,
        } as WorkerResponse);
        break;

      case 'getSchema':
        const schemaResult = await getSchema();
        self.postMessage({ type: 'schema', data: schemaResult } as WorkerResponse);
        break;

      case 'getUniqueValues':
        const uniqueVals = await getUniqueValues(request.column);
        self.postMessage({ type: 'uniqueValues', data: uniqueVals } as WorkerResponse);
        break;

      case 'recodeVariable':
        const newCol = await recodeVariable(request.sourceCol, request.newColName, request.mappings);
        self.postMessage({ type: 'recodeComplete', newColName: newCol } as WorkerResponse);
        break;
    }
  } catch (error: any) {
    console.error('[Worker] Error:', error);
    self.postMessage({ type: 'error', message: error.message || 'Unknown error' } as WorkerResponse);
  }
};
