/**
 * Analysis Worker
 *
 * Runs DuckDB-WASM in a dedicated Web Worker to keep the main thread responsive.
 * All database operations go through this worker via message passing.
 *
 * This is a thin shell that delegates to core modules:
 * - Analysis: src/core/analysis/crosstabRunner.ts, variableStatsRunner.ts
 * - Ingestion: src/core/ingestion/savLoader.ts
 * - Grid Detection: src/core/gridDetection.ts
 * - Scale Normalization: src/core/scaleNormalization.ts
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import * as arrow from 'apache-arrow';
import { RecodeConfig, VariableSet, Variable, HistogramBin } from '../types';
import { processAnalysisData } from './analysisProcessor';
import { transformChartData } from './chartDataTransformer';
import { DuckDBWasmAdapter } from '../adapters/DuckDBWasmAdapter';
import { runCrosstab as coreRunCrosstab } from '../core/analysis/crosstabRunner';
import { getVariableStats as coreGetVariableStats } from '../core/analysis/variableStatsRunner';
import { processMetadata } from '../core/ingestion/savLoader';
import { escapeString } from './queryBuilder';
import { analysisRegistry } from '../core/analysis/registry';

// Re-export types from canonical location for backward compatibility
export type { WorkerRequest, WorkerResponse, VariableStatsResult, VariableStatsFrequency, NumericStats } from '../types/worker';
import type { WorkerRequest, WorkerResponse, VariableStatsResult } from '../types/worker';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

// OPFS database path for persistent storage
const OPFS_DB_PATH = 'opfs://velocity_data.db';

type PersistenceMode = 'opfs' | 'memory' | 'disabled';

// Feature flag: Disable OPFS during development due to corruption loop bug
const ENABLE_OPFS = false;

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let adapter: DuckDBWasmAdapter | null = null;
let persistenceMode: PersistenceMode = 'memory';
let persistenceError: string | null = null;
let activeDbPath = ':memory:';

// ============================================================================
// OPFS Management
// ============================================================================

async function cleanOPFS(): Promise<void> {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const entriesToDelete: string[] = [];

    // @ts-expect-error - entries() returns an async iterator
    for await (const [name] of opfsRoot.entries()) {
      entriesToDelete.push(name);
    }

    console.log('🦆 [Worker] Found OPFS entries to clean:', entriesToDelete);

    for (const name of entriesToDelete) {
      try {
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

// ============================================================================
// Keepalive
// ============================================================================

let opfsAvailable = false;
let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepalive() {
  if (keepaliveInterval) return;

  keepaliveInterval = setInterval(async () => {
    if (conn) {
      try {
        await conn.query('SELECT 1');
      } catch (e) {
        console.warn('🦆 [Worker] Keepalive query failed:', e);
      }
    }
  }, 20000);

  console.log('🦆 [Worker] Keepalive started (20s interval)');
}

function stopKeepalive() {
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
    console.log('🦆 [Worker] Keepalive stopped');
  }
}

// ============================================================================ 
// Initialization
// ============================================================================

async function init(forceCleanStart: boolean = false): Promise<{ opfsAvailable: boolean; corruptionDetected?: boolean; corruptionMessage?: string }> {
  if (db) return { opfsAvailable };

  if (forceCleanStart) {
    console.log('🦆 [Worker] Force clean start requested, clearing OPFS before DuckDB init...');
    await cleanOPFS();
  }

  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  console.log('🦆 [Worker] DuckDB Bundle Selected:', bundle);

  if (!bundle.mainWorker) {
    throw new Error('No main worker URL found in bundle');
  }

  const workerRes = await fetch(bundle.mainWorker);
  const workerScript = await workerRes.text();
  const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
  const workerUrl = URL.createObjectURL(workerBlob);

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();

  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  URL.revokeObjectURL(workerUrl);

  opfsAvailable = false;
  persistenceMode = 'memory';
  persistenceError = null;
  activeDbPath = ':memory:';

  if (!ENABLE_OPFS) {
    console.log('🦆 [Worker] OPFS disabled (ENABLE_OPFS=false), using in-memory mode');
    await db.open({ path: ':memory:' });
    persistenceMode = 'disabled';
    persistenceError = 'OPFS disabled by feature flag';
    activeDbPath = ':memory:';
    console.log('🦆 [Worker] DuckDB opened in :memory: mode');
  } else {
    try {
      await db.open({
        path: OPFS_DB_PATH,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE
      });
      console.log('🦆 [Worker] DuckDB opened with OPFS persistence:', OPFS_DB_PATH);
      opfsAvailable = true;
      persistenceMode = 'opfs';
      persistenceError = null;
      activeDbPath = OPFS_DB_PATH;
    } catch (opfsError: any) {
      const errorMsg = opfsError.message || '';
      const isCorruption = errorMsg.includes('not a valid DuckDB database file') || errorMsg.includes('corrupt');

      if (isCorruption && !forceCleanStart) {
        console.error('🦆 [Worker] OPFS corruption detected:', errorMsg);
        persistenceMode = 'memory';
        persistenceError = errorMsg;
        activeDbPath = ':memory:';
        return { opfsAvailable: false, corruptionDetected: true, corruptionMessage: errorMsg };
      } else if (isCorruption && forceCleanStart) {
        console.warn('🦆 [Worker] OPFS still corrupted after cleanup, falling back to in-memory mode');
      } else {
        console.warn('🦆 [Worker] OPFS not available, falling back to in-memory:', errorMsg);
      }
      persistenceMode = 'memory';
      persistenceError = errorMsg;
      activeDbPath = ':memory:';
    }
  }

  if (!opfsAvailable) {
    console.log('🦆 [Worker] Running in in-memory mode (no persistence)');
  }

  conn = await db.connect();
  adapter = new DuckDBWasmAdapter(conn, db);
  console.log('🦆 [Worker] DuckDB Initialized');

  startKeepalive();

  return { opfsAvailable };
}

function getPersistenceStatus() {
  return {
    opfsAvailable,
    mode: persistenceMode,
    dbPath: activeDbPath,
    lastError: persistenceError || undefined,
  };
}

// ============================================================================
// Persistence Operations
// ============================================================================

async function checkPersistedData(): Promise<{ exists: boolean; schema?: { name: string; type: string }[]; rowCount?: number }> {
  if (!conn) throw new Error('DB not initialized');

  try {
    const tableCheck = await conn.query(`
      SELECT COUNT(*) as cnt
      FROM information_schema.tables
      WHERE table_name = 'main'
    `);
    const tableExists = Number(tableCheck.toArray()[0]?.cnt) > 0;

    if (!tableExists) return { exists: false };

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

async function clearPersistedData(): Promise<void> {
  if (!conn) throw new Error('DB not initialized');
  await conn.query(`DROP TABLE IF EXISTS main`);
  console.log('🦆 [Worker] Persisted data cleared');
}

async function flushPersistedData(): Promise<{ ok: boolean; durationMs: number; error?: string }> {
  if (!db) throw new Error('DB not initialized');

  if (!opfsAvailable) {
    return { ok: false, durationMs: 0, error: 'OPFS not available' };
  }

  const start = performance.now();

  try {
    if (conn) {
      try {
        await conn.query('CHECKPOINT');
      } catch (checkpointError) {
        console.warn('🦆 [Worker] CHECKPOINT failed, continuing to flush:', checkpointError);
      }
    }

    const flushFn = (db as any).flushFiles;
    if (typeof flushFn === 'function') {
      await flushFn.call(db);
    }

    return { ok: true, durationMs: performance.now() - start };
  } catch (error: any) {
    return {
      ok: false,
      durationMs: performance.now() - start,
      error: error?.message || 'Failed to flush OPFS',
    };
  }
}

// ============================================================================
// Data Loading
// ============================================================================

async function loadCSV(fileName: string, content: string): Promise<{ schema: { name: string; type: string }[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  await db.registerFileText(fileName, content);
  const safeFileName = escapeString(fileName);
  await conn.query(`CREATE OR REPLACE TABLE main AS SELECT * FROM read_csv_auto('${safeFileName}')`);

  const schema = await getSchema();
  const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const rowCount = Number(countResult.toArray()[0]?.cnt);

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded CSV: ${rowCount} rows, ${schema.length} columns in ${durationMs.toFixed(2)}ms`);

  return { schema, rowCount, durationMs };
}

async function loadSAV(buffer: ArrayBuffer): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();

  // 1. Parse SAV file (platform-specific: ReadStat-WASM)
  const { parseSavFile } = await import('@velocity/readstat-wasm');
  const parsed = await parseSavFile(buffer, (progress) => {
    console.log(`📊 [Worker] Parse progress: ${(progress.progress * 100).toFixed(1)}%`);
  });

  // 2. Process metadata (platform-independent core module)
  const { variables, variableSets } = processMetadata({
    metadata: {
      variables: parsed.metadata.variables,
      valueLabelSets: parsed.metadata.valueLabelSets,
      multipleResponseSets: parsed.metadata.multipleResponseSets,
      rowCount: parsed.metadata.rowCount,
    },
    rows: parsed.rows,
  });

  // 3. Load data into DuckDB (platform-specific: Arrow + WASM)
  const numRows = parsed.rows.length;
  const numCols = parsed.metadata.variables.length;

  if (numRows === 0) {
    throw new Error(`SAV parsing failed: No row data extracted (expected ${parsed.metadata.rowCount} rows)`);
  }

  // Pivot row-major to column-major for Arrow
  const columnsData: any[][] = Array.from({ length: numCols }, () => new Array(numRows));
  for (let r = 0; r < numRows; r++) {
    const row = parsed.rows[r];
    for (let c = 0; c < numCols; c++) {
      columnsData[c][r] = row[c];
    }
    // Release row reference early to reduce peak memory usage during conversion.
    (parsed.rows as any)[r] = null;
  }
  // Drop the rows array reference once converted.
  (parsed as any).rows = [];

  // Create Arrow table
  const vectors: Record<string, arrow.Vector> = {};
  parsed.metadata.variables.forEach((v, i) => {
    const data = columnsData[i];
    if (v.type === 'numeric') {
      vectors[v.name] = arrow.vectorFromArray(data, new arrow.Float64());
    } else {
      vectors[v.name] = arrow.vectorFromArray(data, new arrow.Utf8());
    }
  });

  const table = new arrow.Table(vectors);

  // Insert into DuckDB
  await conn.query(`DROP TABLE IF EXISTS main`);

  try {
    await conn.insertArrowTable(table, { name: 'main', create: true });

    const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
    const count = Number(verifyResult.toArray()[0]?.cnt);

    if (count !== numRows) {
      throw new Error(`Arrow insertion verification failed: expected ${numRows} rows, got ${count}`);
    }
  } catch (insertError: any) {
    throw new Error(`Arrow insertion failed: ${insertError.message}. Check apache-arrow version compatibility.`);
  }

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV: ${parsed.metadata.rowCount} rows, ${variables.length} variables in ${durationMs.toFixed(2)}ms`);

  return { variables, variableSets, rowCount: parsed.metadata.rowCount, durationMs };
}

async function loadSAVMetadata(buffer: ArrayBuffer): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  const start = performance.now();

  // Parse SAV metadata only
  const { parseSavMetadata } = await import('@velocity/readstat-wasm');
  const parsed = await parseSavMetadata(buffer);

  // Process metadata (no row data available in this mode)
  const { variables, variableSets } = processMetadata({
    metadata: {
      variables: parsed.metadata.variables,
      valueLabelSets: parsed.metadata.valueLabelSets,
      multipleResponseSets: parsed.metadata.multipleResponseSets,
      rowCount: parsed.metadata.rowCount,
    },
    rows: [],
  });

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV metadata: ${parsed.metadata.rowCount} rows, ${variables.length} variables in ${durationMs.toFixed(2)}ms`);

  return { variables, variableSets, rowCount: parsed.metadata.rowCount, durationMs };
}

async function loadSAVSample(
  buffer: ArrayBuffer,
  rowLimit: number
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; sampleRowCount: number; durationMs: number }> {
  const start = performance.now();

  const { parseSavSample } = await import('@velocity/readstat-wasm');
  const parsed = await parseSavSample(buffer, rowLimit);

  const { variables, variableSets } = processMetadata({
    metadata: {
      variables: parsed.metadata.variables,
      valueLabelSets: parsed.metadata.valueLabelSets,
      multipleResponseSets: parsed.metadata.multipleResponseSets,
      rowCount: parsed.metadata.rowCount,
    },
    rows: parsed.rows,
  });

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV sample: ${parsed.rows.length}/${parsed.metadata.rowCount} rows, ${variables.length} variables in ${durationMs.toFixed(2)}ms`);

  return { variables, variableSets, rowCount: parsed.metadata.rowCount, sampleRowCount: parsed.rows.length, durationMs };
}

// ============================================================================
// Query Operations
// ============================================================================

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

// ============================================================================
// Recode Operations
// ============================================================================

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

  caseSql += `ELSE CAST("${sourceCol}" AS VARCHAR) END`;

  await conn.query(`UPDATE main SET "${safeNewCol}" = ${caseSql}`);

  return safeNewCol;
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case 'init': {
        const initResult = await init(request.forceCleanStart);
        if (initResult.corruptionDetected) {
          self.postMessage({
            type: 'corruptionDetected',
            message: initResult.corruptionMessage || 'OPFS database corruption detected'
          } as WorkerResponse);
        } else {
          self.postMessage({
            type: 'persistenceStatus',
            ...getPersistenceStatus()
          } as WorkerResponse);
          self.postMessage({
            type: 'ready',
            opfsAvailable: initResult.opfsAvailable
          } as WorkerResponse);
        }
        break;
      }

      case 'loadCSV': {
        const csvResult = await loadCSV(request.fileName, request.content);
        self.postMessage({
          type: 'csvLoaded',
          schema: csvResult.schema,
          rowCount: csvResult.rowCount,
          durationMs: csvResult.durationMs
        } as WorkerResponse);
        break;
      }

      case 'loadSAV': {
        const savResult = await loadSAV(request.buffer);
        self.postMessage({
          type: 'savLoaded',
          variables: savResult.variables,
          variableSets: savResult.variableSets,
          rowCount: savResult.rowCount,
          durationMs: savResult.durationMs,
        } as WorkerResponse);
        break;
      }

      case 'loadSAVMetadata': {
        const savResult = await loadSAVMetadata(request.buffer);
        self.postMessage({
          type: 'savMetadataLoaded',
          variables: savResult.variables,
          variableSets: savResult.variableSets,
          rowCount: savResult.rowCount,
          durationMs: savResult.durationMs,
        } as WorkerResponse);
        break;
      }

      case 'loadSAVSample': {
        const savResult = await loadSAVSample(request.buffer, request.rowLimit);
        self.postMessage({
          type: 'savSampleLoaded',
          variables: savResult.variables,
          variableSets: savResult.variableSets,
          rowCount: savResult.rowCount,
          sampleRowCount: savResult.sampleRowCount,
          durationMs: savResult.durationMs,
        } as WorkerResponse);
        break;
      }

      case 'flushPersistedData': {
        const flushResult = await flushPersistedData();
        self.postMessage({
          type: 'flushComplete',
          ok: flushResult.ok,
          durationMs: flushResult.durationMs,
          error: flushResult.error
        } as WorkerResponse);
        break;
      }

      case 'query': {
        const queryResult = await runQuery(request.sql);
        self.postMessage({
          type: 'queryResult',
          data: queryResult.data,
          durationMs: queryResult.durationMs,
        } as WorkerResponse);
        break;
      }

      case 'runCrosstab': {
        if (!adapter) throw new Error('DB not initialized');
        const start = performance.now();
        const crosstabData = await coreRunCrosstab(adapter, request.options, request.context);
        const duration = performance.now() - start;
        self.postMessage({
          type: 'queryResult',
          data: crosstabData,
          durationMs: duration
        } as WorkerResponse);
        break;
      }

      case 'getSchema': {
        const schemaResult = await getSchema();
        self.postMessage({ type: 'schema', data: schemaResult } as WorkerResponse);
        break;
      }

      case 'getUniqueValues': {
        const uniqueVals = await getUniqueValues(request.column);
        self.postMessage({ type: 'uniqueValues', data: uniqueVals } as WorkerResponse);
        break;
      }

      case 'getVariableStats': {
        if (!adapter) throw new Error('DB not initialized');
        const stats = await coreGetVariableStats(adapter, request.column, request.variableType, request.binCount);
        self.postMessage({ type: 'variableStats', stats } as WorkerResponse);
        break;
      }

      case 'runAnalysis': {
        if (!adapter) throw new Error('DB not initialized');
        const runner = analysisRegistry.get(request.id);
        if (!runner) {
          throw new Error(`Analysis runner not found: ${request.id}`);
        }

        const start = performance.now();
        const result = await runner.run(adapter, request.config);
        const duration = performance.now() - start;

        self.postMessage({
          type: 'analysisResult',
          id: request.id,
          result: result,
          durationMs: duration
        } as WorkerResponse);
        break;
      }

      case 'recodeVariable': {
        const newCol = await recodeVariable(request.sourceCol, request.newColName, request.config);
        self.postMessage({ type: 'recodeComplete', newColName: newCol } as WorkerResponse);
        break;
      }

      case 'processData': {
        const processed = processAnalysisData({
          data: request.data,
          ...request.options
        });

        if (!processed) {
          self.postMessage({ type: 'processedData', requestId: request.requestId, result: null } as WorkerResponse);
          break;
        }

        let finalResult = processed;
        if (request.chartType) {
          const transformed = transformChartData(processed, request.chartType);
          if (transformed) {
            finalResult = transformed;
          }
        }

        self.postMessage({ type: 'processedData', requestId: request.requestId, result: finalResult } as WorkerResponse);
        break;
      }

      case 'checkPersistedData': {
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
      }

      case 'clearPersistedData': {
        await clearPersistedData();
        self.postMessage({ type: 'persistedDataCleared' } as WorkerResponse);
        break;
      }

      case 'ping': {
        if (!conn) {
          self.postMessage({ type: 'pong', hasData: false } as WorkerResponse);
        } else {
          try {
            const tableCheck = await conn.query(`
              SELECT COUNT(*) as cnt
              FROM information_schema.tables
              WHERE table_name = 'main'
            `);
            const tableExists = Number(tableCheck.toArray()[0]?.cnt) > 0;

            if (tableExists) {
              const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
              const rowCount = Number(countResult.toArray()[0]?.cnt);
              self.postMessage({ type: 'pong', hasData: true, rowCount } as WorkerResponse);
            } else {
              self.postMessage({ type: 'pong', hasData: false } as WorkerResponse);
            }
          } catch (e) {
            self.postMessage({ type: 'pong', hasData: false } as WorkerResponse);
          }
        }
        break;
      }
    }
  } catch (error: any) {
    console.error('[Worker] Error:', error);
    self.postMessage({ type: 'error', message: error.message || 'Unknown error' } as WorkerResponse);
  }
};
