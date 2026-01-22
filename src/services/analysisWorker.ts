/**
 * Analysis Worker
 * 
 * Runs DuckDB-WASM in a dedicated Web Worker to keep the main thread responsive.
 * All database operations go through this worker via message passing.
 * 
 * Data is now persisted using the Origin Private File System (OPFS) so that
 * users do not need to re-import files on reload.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import * as arrow from 'apache-arrow';
import { RecodeConfig } from '../types';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

// OPFS database path for persistent storage
const OPFS_DB_PATH = 'opfs://velocity_data.db';

// Feature flag: Disable OPFS during development due to corruption loop bug
// See: docs/bugs/opfs_corruption_loop.md
const ENABLE_OPFS = false;

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

// Message types for type-safe communication
export type WorkerRequest =
  | { type: 'init'; forceCleanStart?: boolean }
  | { type: 'loadCSV'; fileName: string; content: string }
  | { type: 'loadSAV'; buffer: ArrayBuffer }
  | { type: 'query'; sql: string }
  | { type: 'getSchema' }
  | { type: 'getUniqueValues'; column: string }
  | { type: 'getVariableStats'; column: string }
  | { type: 'recodeVariable'; sourceCol: string; newColName: string; config: RecodeConfig }
  | { type: 'checkPersistedData' }
  | { type: 'clearPersistedData' };

export interface VariableStatsFrequency {
  value: number | string | null;
  count: number;
}

export interface VariableStatsResult {
  column: string;
  frequencies: VariableStatsFrequency[];
  missingCount: number;
  totalCount: number;
}

export type WorkerResponse =
  | { type: 'ready'; opfsAvailable: boolean }
  | { type: 'corruptionDetected'; message: string }
  | { type: 'schema'; data: { name: string; type: string }[] }
  | { type: 'csvLoaded'; schema: { name: string; type: string }[]; rowCount: number; durationMs: number }
  | { type: 'savLoaded'; variables: any[]; rowCount: number; durationMs: number }
  | { type: 'queryResult'; data: any[]; durationMs: number }
  | { type: 'uniqueValues'; data: string[] }
  | { type: 'variableStats'; stats: VariableStatsResult }
  | { type: 'recodeComplete'; newColName: string }
  | { type: 'persistedDataFound'; schema: { name: string; type: string }[]; rowCount: number }
  | { type: 'noPersistedData' }
  | { type: 'persistedDataCleared' }
  | { type: 'error'; message: string };

/**
 * Clean OPFS storage by removing ALL DuckDB-related files
 * DuckDB-WASM stores files in various locations, so we need to be thorough
 */
async function cleanOPFS(): Promise<void> {
  try {
    const opfsRoot = await navigator.storage.getDirectory();

    // List and remove ALL entries in OPFS root
    // This is aggressive but ensures complete cleanup
    const entriesToDelete: string[] = [];

    // @ts-expect-error - entries() returns an async iterator
    for await (const [name] of opfsRoot.entries()) {
      entriesToDelete.push(name);
    }

    console.log('🦆 [Worker] Found OPFS entries to clean:', entriesToDelete);

    for (const name of entriesToDelete) {
      try {
        // @ts-expect-error - recursive option is valid but not always typed
        await opfsRoot.removeEntry(name, { recursive: true });
        console.log(`🦆 [Worker] Removed OPFS entry: ${name}`);
      } catch (e: any) {
        console.warn(`🦆 [Worker] Failed to remove ${name}:`, e.message);
      }
    }

    console.log('🦆 [Worker] Cleared all OPFS storage');
  } catch (error: any) {
    console.warn('🦆 [Worker] Failed to clean OPFS:', error.message);
  }
}

// Track OPFS availability for reporting
let opfsAvailable = false;

async function init(forceCleanStart: boolean = false): Promise<{ opfsAvailable: boolean; corruptionDetected?: boolean; corruptionMessage?: string }> {
  if (db) return { opfsAvailable }; // Already initialized

  // IMPORTANT: Clean OPFS BEFORE DuckDB initialization to avoid cached file handle issues
  if (forceCleanStart) {
    console.log('🦆 [Worker] Force clean start requested, clearing OPFS before DuckDB init...');
    await cleanOPFS();
  }

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

  // Open persistent database from OPFS (or in-memory if disabled)
  opfsAvailable = false;

  if (!ENABLE_OPFS) {
    console.log('🦆 [Worker] OPFS disabled (ENABLE_OPFS=false), using in-memory mode');
  } else {
    // Try OPFS persistence
    try {
      await db.open({
        path: OPFS_DB_PATH,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE
      });
      console.log('🦆 [Worker] DuckDB opened with OPFS persistence:', OPFS_DB_PATH);
      opfsAvailable = true;
    } catch (opfsError: any) {
      // Check if this is a corrupt file error
      const errorMsg = opfsError.message || '';
      const isCorruption = errorMsg.includes('not a valid DuckDB database file') || errorMsg.includes('corrupt');

      if (isCorruption && !forceCleanStart) {
        // First time seeing corruption - signal it so main thread can respawn with clean start
        console.error('🦆 [Worker] OPFS corruption detected:', errorMsg);
        return {
          opfsAvailable: false,
          corruptionDetected: true,
          corruptionMessage: errorMsg
        };
      } else if (isCorruption && forceCleanStart) {
        // Already tried clean start but OPFS still corrupted
        // Fall back to in-memory mode instead of infinite loop
        console.warn('🦆 [Worker] OPFS still corrupted after cleanup, falling back to in-memory mode');
      } else {
        // OPFS may not be available (e.g., in tests or unsupported browsers)
        console.warn('🦆 [Worker] OPFS not available, falling back to in-memory:', errorMsg);
      }
    }
  }

  if (!opfsAvailable) {
    console.log('🦆 [Worker] Running in in-memory mode (no persistence)');
  }

  conn = await db.connect();
  console.log('🦆 [Worker] DuckDB Initialized');

  return { opfsAvailable };
}

/**
 * Check if persisted data exists in the OPFS database
 */
async function checkPersistedData(): Promise<{ exists: boolean; schema?: { name: string; type: string }[]; rowCount?: number }> {
  if (!conn) throw new Error('DB not initialized');

  try {
    // Check if the 'main' table exists
    const tableCheck = await conn.query(`
      SELECT COUNT(*) as cnt 
      FROM information_schema.tables 
      WHERE table_name = 'main'
    `);
    const tableExists = Number(tableCheck.toArray()[0]?.cnt) > 0;

    if (!tableExists) {
      return { exists: false };
    }

    // Table exists, get schema and row count
    const schema = await getSchema();
    const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
    const rowCount = Number(countResult.toArray()[0]?.cnt);

    console.log(`🦆 [Worker] Found persisted data: ${rowCount} rows, ${schema.length} columns`);
    return { exists: true, schema, rowCount };
  } catch (error: any) {
    console.warn('🦆 [Worker] Error checking persisted data:', error.message);
    return { exists: false };
  }
}

/**
 * Clear all persisted data by dropping the main table
 */
async function clearPersistedData(): Promise<void> {
  if (!conn) throw new Error('DB not initialized');

  await conn.query(`DROP TABLE IF EXISTS main`);
  console.log('🦆 [Worker] Persisted data cleared');
}

async function loadCSV(fileName: string, content: string): Promise<{ schema: { name: string; type: string }[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  await db.registerFileText(fileName, content);
  await conn.query(`CREATE OR REPLACE TABLE main AS SELECT * FROM read_csv_auto('${fileName}')`);

  // Get Schema
  const schema = await getSchema();

  // Get Row Count
  const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const rowCount = Number(countResult.toArray()[0]?.cnt);

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded CSV: ${rowCount} rows, ${schema.length} columns in ${durationMs.toFixed(2)}ms`);

  return { schema, rowCount, durationMs };
}

async function loadSAV(buffer: ArrayBuffer): Promise<{ variables: any[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();

  // Use the new high-performance ReadStat WASM parser
  const { parseSavFile } = await import('@velocity/readstat-wasm');

  // Parse the SAV file
  const parsed = await parseSavFile(buffer, (progress) => {
    // Could emit progress events here if needed
    console.log(`📊 [Worker] Parse progress: ${(progress.progress * 100).toFixed(1)}%`);
  });

  // Convert variables to the format expected by the store
  const variables = parsed.metadata.variables.map(v => {
    // 1. Generate ID (using name as unique identifier)
    const id = v.name;

    // 2. Map Types: Variables with value labels are categorical (nominal)
    // SPSS encodes categorical variables as numeric with value labels
    const hasValueLabels = v.valueLabelSetName &&
      parsed.metadata.valueLabelSets[v.valueLabelSetName]?.length > 0;
    const type = hasValueLabels
      ? 'nominal'
      : (v.type === 'numeric' ? 'scale' : 'nominal');

    // 3. Transform Value Labels
    let valueLabels: { value: number; label: string }[] = [];
    if (v.valueLabelSetName && parsed.metadata.valueLabelSets[v.valueLabelSetName]) {
      valueLabels = parsed.metadata.valueLabelSets[v.valueLabelSetName].map((vl: any) => ({
        value: vl.value,
        label: vl.label
      }));
    }

    return {
      id,
      name: v.name,
      label: v.label || v.name,
      type,
      valueLabels,
      missingValues: { discrete: [], range: undefined }
    };
  });

  // Pivot data from row-major to column-major for Arrow
  const numRows = parsed.rows.length;
  const numCols = parsed.metadata.variables.length;

  console.log(`📊 [Worker] DEBUG: parsed.rows.length = ${numRows}, metadata.rowCount = ${parsed.metadata.rowCount}, variables = ${numCols}`);

  // Check if we have actual data
  if (numRows === 0) {
    console.error(`📊 [Worker] ERROR: No rows parsed! Metadata claims ${parsed.metadata.rowCount} rows but parsed.rows is empty.`);
    throw new Error(`SAV parsing failed: No row data extracted (expected ${parsed.metadata.rowCount} rows)`);
  }

  const columnsData: any[][] = Array.from({ length: numCols }, () => new Array(numRows));

  for (let r = 0; r < numRows; r++) {
    const row = parsed.rows[r];
    for (let c = 0; c < numCols; c++) {
      columnsData[c][r] = row[c];
    }
  }

  console.log(`📊 [Worker] DEBUG: First row sample: ${JSON.stringify(parsed.rows[0]?.slice(0, 5))}`);

  // Create Arrow Vectors
  const vectors: Record<string, arrow.Vector> = {};

  parsed.metadata.variables.forEach((v, i) => {
    // ReadStat 'numeric' is generally Double, 'string' is UTF8
    const data = columnsData[i];

    if (v.type === 'numeric') {
      // Using Float64 for all numerics from ReadStat to be safe
      vectors[v.name] = arrow.vectorFromArray(data, new arrow.Float64());
    } else {
      vectors[v.name] = arrow.vectorFromArray(data, new arrow.Utf8());
    }
  });

  // Create Arrow Table
  const table = new arrow.Table(vectors);
  console.log(`📊 [Worker] DEBUG: Arrow table created with ${table.numRows} rows, ${table.numCols} columns`);

  // Bulk load into DuckDB
  // Drop existing table first to ensure clean state
  await conn.query(`DROP TABLE IF EXISTS main`);
  console.log(`📊 [Worker] DEBUG: Inserting Arrow table into DuckDB...`);

  try {
    const insertStart = performance.now();
    await conn.insertArrowTable(table, { name: 'main', create: true });
    const insertDuration = performance.now() - insertStart;
    console.log(`📊 [Worker] DEBUG: Arrow table inserted successfully in ${insertDuration.toFixed(2)}ms`);

    // Verify the table was actually created
    // Note: DuckDB returns BigInt for COUNT(*), so we convert to Number for comparison
    const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
    const count = Number(verifyResult.toArray()[0]?.cnt);

    if (count !== numRows) {
      throw new Error(`Arrow insertion verification failed: expected ${numRows} rows, got ${count}`);
    }

    console.log(`📊 [Worker] DEBUG: Verification passed - Table 'main' has ${count} rows`);
  } catch (insertError: any) {
    // Log detailed error for debugging - Arrow insertion should NOT fail with correct versions
    console.error(`📊 [Worker] CRITICAL: insertArrowTable failed!`, {
      error: insertError.message,
      numRows,
      numCols,
    });
    throw new Error(`Arrow insertion failed: ${insertError.message}. Check apache-arrow version compatibility.`);
  }

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV with ReadStat-WASM: ${parsed.metadata.rowCount} rows, ${variables.length} variables in ${durationMs.toFixed(2)}ms`);

  return { variables, rowCount: parsed.metadata.rowCount, durationMs };
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

async function getVariableStats(column: string): Promise<VariableStatsResult> {
  if (!conn) throw new Error('DB not initialized');

  // Get total count
  const totalResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const totalCount = Number(totalResult.toArray()[0]?.cnt);

  // Get missing count (NULL values)
  const missingResult = await conn.query(`SELECT COUNT(*) as cnt FROM main WHERE "${column}" IS NULL`);
  const missingCount = Number(missingResult.toArray()[0]?.cnt);

  // Get frequency distribution (top 10 values by count)
  const freqResult = await conn.query(`
    SELECT "${column}" as value, COUNT(*) as cnt
    FROM main
    WHERE "${column}" IS NOT NULL
    GROUP BY "${column}"
    ORDER BY cnt DESC
    LIMIT 10
  `);

  const frequencies: VariableStatsFrequency[] = freqResult.toArray().map((row: any) => ({
    value: row.value,
    count: Number(row.cnt),
  }));

  return {
    column,
    frequencies,
    missingCount,
    totalCount,
  };
}

async function recodeVariable(
  sourceCol: string,
  newColName: string,
  config: RecodeConfig
): Promise<string> {
  if (!conn) throw new Error('DB not initialized');

  const safeNewCol = newColName.replace(/[^a-zA-Z0-9_]/g, '_');

  await conn.query(`ALTER TABLE main ADD COLUMN "${safeNewCol}" VARCHAR`);

  let caseSql = `CASE `;

  if (config.mode === 'categorical' && config.mappings) {
    for (const [oldVal, newVal] of Object.entries(config.mappings)) {
      caseSql += `WHEN "${sourceCol}" = '${oldVal.replace(/'/g, "''")}' THEN '${newVal.replace(/'/g, "''")}' `;
    }
  } else if (config.mode === 'binning' && config.rules) {
    for (const rule of config.rules) {
      const parts: string[] = [];
      if (rule.min !== undefined) parts.push(`"${sourceCol}" >= ${rule.min}`);
      if (rule.max !== undefined) parts.push(`"${sourceCol}" < ${rule.max}`);

      if (parts.length > 0) {
        caseSql += `WHEN ${parts.join(' AND ')} THEN '${rule.label.replace(/'/g, "''")}' `;
      }
    }
  }

  // Single ELSE clause with proper CAST for type safety
  caseSql += `ELSE CAST("${sourceCol}" AS VARCHAR) END`;

  await conn.query(`UPDATE main SET "${safeNewCol}" = ${caseSql}`);

  return safeNewCol;
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case 'init':
        const initResult = await init(request.forceCleanStart);
        if (initResult.corruptionDetected) {
          self.postMessage({
            type: 'corruptionDetected',
            message: initResult.corruptionMessage || 'OPFS database corruption detected'
          } as WorkerResponse);
        } else {
          self.postMessage({
            type: 'ready',
            opfsAvailable: initResult.opfsAvailable
          } as WorkerResponse);
        }
        break;

      case 'loadCSV':
        const csvResult = await loadCSV(request.fileName, request.content);
        self.postMessage({
          type: 'csvLoaded',
          schema: csvResult.schema,
          rowCount: csvResult.rowCount,
          durationMs: csvResult.durationMs
        } as WorkerResponse);
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

      case 'getVariableStats':
        const stats = await getVariableStats(request.column);
        self.postMessage({ type: 'variableStats', stats } as WorkerResponse);
        break;

      case 'recodeVariable':
        const newCol = await recodeVariable(request.sourceCol, request.newColName, request.config);
        self.postMessage({ type: 'recodeComplete', newColName: newCol } as WorkerResponse);
        break;

      case 'checkPersistedData':
        const persistedResult = await checkPersistedData();
        if (persistedResult.exists) {
          self.postMessage({
            type: 'persistedDataFound',
            schema: persistedResult.schema!,
            rowCount: persistedResult.rowCount!
          } as WorkerResponse);
        } else {
          self.postMessage({ type: 'noPersistedData' } as WorkerResponse);
        }
        break;

      case 'clearPersistedData':
        await clearPersistedData();
        self.postMessage({ type: 'persistedDataCleared' } as WorkerResponse);
        break;
    }
  } catch (error: any) {
    console.error('[Worker] Error:', error);
    self.postMessage({ type: 'error', message: error.message || 'Unknown error' } as WorkerResponse);
  }
};
