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
import { ArrowChunkBuilder } from './arrowChunkBuilder';
import { getLocalDuckDbBundles, resolveDuckDbBundleUrls } from './duckdbBundles';
import { initOpfsPersistence } from './opfsPersistence';
import { walkOpfs, findOpfsFile } from './opfsTraversal';

// Re-export types from canonical location for backward compatibility
export type { WorkerRequest, WorkerResponse, VariableStatsResult, VariableStatsFrequency, NumericStats, PersistedMetadata } from '../types/worker';
import type { WorkerRequest, WorkerResponse, VariableStatsResult, PersistedMetadata } from '../types/worker';

const DUCKDB_BUNDLES = getLocalDuckDbBundles();

// OPFS database path for persistent storage
const OPFS_BASE_NAME = 'velocity_data';
const OPFS_SCHEMA_VERSION = 1;

type PersistenceMode = 'opfs' | 'memory' | 'disabled';

// Feature flag: enable DuckDB OPFS-backed *database file* persistence.
//
// Note: DuckDB-WASM OPFS DB persistence was added in `@duckdb/duckdb-wasm@1.30.0`
// (DuckDB v1.3.2). With older builds, `db.open({ path: 'opfs://...' })` can fail
// with misleading corruption errors. We keep this as a guarded feature.
const ENABLE_DUCKDB_OPFS_PERSISTENCE = true;
const MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE: [number, number, number] = [1, 3, 2];

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let adapter: DuckDBWasmAdapter | null = null;
let persistenceMode: PersistenceMode = 'memory';
let persistenceError: string | null = null;
let activeDbPath = ':memory:';
let persistenceContext: { datasetId?: string; schemaVersion: number } = {
  schemaVersion: OPFS_SCHEMA_VERSION,
};
const META_TABLE = 'velocity_meta';

// ============================================================================
// OPFS Management
// ============================================================================

// OPFS traversal helpers are shared in opfsTraversal.ts

async function cleanOPFS(): Promise<void> {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const entriesToDelete: string[] = [];

    for await (const entry of walkOpfs(opfsRoot)) {
      if (entry.handle.kind !== 'file') continue;
      if (!entry.name.startsWith(OPFS_BASE_NAME)) continue;
      entriesToDelete.push(entry.path);
      try {
        await entry.parent.removeEntry(entry.name, { recursive: true });
        console.log(`🦆 [Worker] Removed OPFS entry: ${entry.path}`);
      } catch (e: any) {
        console.warn(`🦆 [Worker] Failed to remove ${entry.path}:`, e.message);
      }
    }

    console.log('🦆 [Worker] Found OPFS DB entries to clean:', entriesToDelete);
    console.log('🦆 [Worker] Cleared all OPFS storage');
  } catch (error: any) {
    console.warn('🦆 [Worker] Failed to clean OPFS:', error.message);
  }
}

async function listOpfsDbFiles(): Promise<{ name: string; path: string; lastModified: number }[]> {
  const root = await navigator.storage.getDirectory();
  const files: { name: string; path: string; lastModified: number }[] = [];

  for await (const entry of walkOpfs(root)) {
    if (entry.handle.kind !== 'file') continue;
    if (!entry.name.startsWith(OPFS_BASE_NAME)) continue;
    if (!entry.name.endsWith('.db')) continue;
    if (entry.name.includes('.corrupt_')) continue;
    const file = await (entry.handle as FileSystemFileHandle).getFile();
    files.push({ name: entry.name, path: entry.path, lastModified: file.lastModified });
  }

  files.sort((a, b) => b.lastModified - a.lastModified);
  return files;
}

async function detectOpfsSupport(): Promise<{ supported: boolean; error?: string }> {
  try {
    if (typeof self !== 'undefined' && !(self as any).isSecureContext) {
      return { supported: false, error: 'Insecure context (OPFS requires HTTPS or localhost)' };
    }

    if (!navigator?.storage || typeof navigator.storage.getDirectory !== 'function') {
      return { supported: false, error: 'OPFS not supported (StorageManager.getDirectory unavailable)' };
    }

    await navigator.storage.getDirectory();
    return { supported: true };
  } catch (error: any) {
    return { supported: false, error: error?.message || 'OPFS unsupported in this environment' };
  }
}

function parseDuckDbVersion(version: string): [number, number, number] | null {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isVersionAtLeast(version: [number, number, number], minimum: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (version[i] > minimum[i]) return true;
    if (version[i] < minimum[i]) return false;
  }
  return true;
}

function buildOpfsDbPath(datasetId?: string, schemaVersion: number = persistenceContext.schemaVersion): string {
  const datasetPart = datasetId ? `_dataset_${datasetId}` : '_default';
  const versionPart = `_v${schemaVersion}`;
  return `opfs://${OPFS_BASE_NAME}${versionPart}${datasetPart}.db`;
}

function buildRepairDbPath(): string {
  const datasetPart = persistenceContext.datasetId ? `_dataset_${persistenceContext.datasetId}` : '_default';
  const versionPart = `_v${persistenceContext.schemaVersion}`;
  return `opfs://${OPFS_BASE_NAME}${versionPart}${datasetPart}_repair_${Date.now()}.db`;
}

async function ensureMetaTable(): Promise<void> {
  if (!conn) throw new Error('DB not initialized');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ${META_TABLE} (
      dataset_id VARCHAR,
      dataset_name VARCHAR,
      row_count BIGINT,
      column_count BIGINT,
      schema_version INTEGER,
      last_modified BIGINT
    )
  `);
}

async function readMeta(): Promise<PersistedMetadata | null> {
  if (!conn) throw new Error('DB not initialized');
  try {
    const result = await conn.query(`SELECT * FROM ${META_TABLE} LIMIT 1`);
    const row = result.toArray()[0];
    if (!row) return null;
    return {
      datasetId: row.dataset_id ?? undefined,
      datasetName: row.dataset_name ?? undefined,
      rowCount: Number(row.row_count ?? 0),
      columnCount: Number(row.column_count ?? 0),
      schemaVersion: Number(row.schema_version ?? OPFS_SCHEMA_VERSION),
      lastModified: Number(row.last_modified ?? 0),
    };
  } catch {
    return null;
  }
}

async function updateMeta(metadata: PersistedMetadata): Promise<void> {
  if (!conn) throw new Error('DB not initialized');
  await ensureMetaTable();
  await conn.query(`DELETE FROM ${META_TABLE}`);
  const datasetId = metadata.datasetId ? `'${metadata.datasetId.replace(/'/g, "''")}'` : 'NULL';
  const datasetName = metadata.datasetName ? `'${metadata.datasetName.replace(/'/g, "''")}'` : 'NULL';
  await conn.query(`
    INSERT INTO ${META_TABLE} (
      dataset_id, dataset_name, row_count, column_count, schema_version, last_modified
    ) VALUES (
      ${datasetId},
      ${datasetName},
      ${metadata.rowCount},
      ${metadata.columnCount},
      ${metadata.schemaVersion},
      ${metadata.lastModified}
    )
  `);
}

async function quarantineCorruptedDb(dbPath: string): Promise<void> {
  try {
    if (!dbPath.startsWith('opfs://')) return;
    const opfsRoot = await navigator.storage.getDirectory();
    const target = await findOpfsFile(opfsRoot, dbPath);
    if (!target) {
      console.warn('🦆 [Worker] Failed to quarantine corrupted DB: The object can not be found here.');
      return;
    }

    const quarantineName = `${target.name}.corrupt_${Date.now()}`;
    const file = await target.handle.getFile();
    const buffer = await file.arrayBuffer();
    const destHandle = await target.parent.getFileHandle(quarantineName, { create: true });
    const writable = await destHandle.createWritable();
    try {
      await writable.write(buffer);
    } finally {
      await writable.close();
    }
    await target.parent.removeEntry(target.name);
    console.warn('🦆 [Worker] Quarantined corrupted OPFS DB:', quarantineName);
  } catch (error: any) {
    console.warn('🦆 [Worker] Failed to quarantine corrupted DB:', error?.message || error);
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

  const bundle = resolveDuckDbBundleUrls(await duckdb.selectBundle(DUCKDB_BUNDLES));
  console.log('🦆 [Worker] DuckDB Bundle Selected:', bundle);

  if (!bundle.mainWorker) {
    throw new Error('No main worker URL found in bundle');
  }

  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();

  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  opfsAvailable = false;
  persistenceMode = 'memory';
  persistenceError = null;
  activeDbPath = ':memory:';

  const duckDbVersion = await db.getVersion().catch(() => '');
  const parsedVersion = duckDbVersion ? parseDuckDbVersion(duckDbVersion) : null;
  const duckDbOpfsSupported = parsedVersion ? isVersionAtLeast(parsedVersion, MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE) : true;
  const enableDuckDbOpfsPersistence = ENABLE_DUCKDB_OPFS_PERSISTENCE && duckDbOpfsSupported;

  if (duckDbVersion) {
    console.log('🦆 [Worker] DuckDB Version:', duckDbVersion);
  }
  if (!duckDbOpfsSupported) {
    console.warn(`🦆 [Worker] Disabling DuckDB OPFS DB persistence: DuckDB ${duckDbVersion} < ${MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE.join('.')}`);
  }

  const opfsSupport = await detectOpfsSupport();
  const desiredOpfsPath = buildOpfsDbPath(persistenceContext.datasetId);
  const fallbackOpfsPath = persistenceContext.datasetId ? buildOpfsDbPath() : null;

  const openOpfsPath = async (path: string, label: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      await db.open({
        path,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE
      });
      console.log(`🦆 [Worker] DuckDB opened with ${label}:`, path);
      return { ok: true };
    } catch (error: any) {
      const message = error?.message || String(error);
      console.warn(`🦆 [Worker] ${label} open failed:`, message);
      return { ok: false, error: message };
    }
  };

  const initResult = await initOpfsPersistence({
    enableOpfs: enableDuckDbOpfsPersistence,
    opfsSupport,
    desiredPath: desiredOpfsPath,
    fallbackPath: fallbackOpfsPath,
    openPath: openOpfsPath,
    validateOpenedPath: async () => {
      try {
        const probeConn = await db.connect();
        try {
          const tableCheck = await probeConn.query(`
            SELECT COUNT(*) as cnt
            FROM information_schema.tables
            WHERE table_schema = 'main' AND table_name = 'main'
          `);
          return Number(tableCheck.toArray()[0]?.cnt) > 0;
        } finally {
          await probeConn.close();
        }
      } catch {
        return false;
      }
    },
    resetBetweenAttempts: async () => {
      try {
        await db.reset();
      } catch {
        // ignore reset errors; we'll fall back to memory if needed
      }
    },
    listCandidates: async () => {
      const candidates = await listOpfsDbFiles();
      return candidates.map((candidate) => ({ path: `opfs://${candidate.path}` }));
    },
    quarantine: quarantineCorruptedDb,
    buildRepairPath: buildRepairDbPath,
    openMemory: async () => {
      await db.open({ path: ':memory:' });
    },
  });

  opfsAvailable = initResult.opfsAvailable;
  persistenceMode = initResult.mode;
  persistenceError = initResult.persistenceError ?? null;
  activeDbPath = initResult.activeDbPath;

  if (initResult.corruptionDetected) {
    console.error('🦆 [Worker] OPFS corruption detected:', initResult.corruptionMessage);
  }

  if (!opfsAvailable) {
    console.log('🦆 [Worker] Running in in-memory mode (no persistence)');
  }

  conn = await db.connect();
  adapter = new DuckDBWasmAdapter(conn, db);
  console.log('🦆 [Worker] DuckDB Initialized');

  startKeepalive();

  return {
    opfsAvailable,
    corruptionDetected: initResult.corruptionDetected,
    corruptionMessage: initResult.corruptionMessage,
  };
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

async function checkPersistedData(): Promise<{ exists: boolean; schema?: { name: string; type: string }[]; rowCount?: number; metadata?: PersistedMetadata | null }> {
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
    const metadata = await readMeta();

    console.log(`🦆 [Worker] Found persisted data: ${rowCount} rows, ${schema.length} columns`);
    return { exists: true, schema, rowCount, metadata };
  } catch (error: any) {
    console.warn('🦆 [Worker] Error checking persisted data:', error.message);
    return { exists: false };
  }
}

async function clearPersistedData(): Promise<void> {
  if (!conn) throw new Error('DB not initialized');
  await conn.query(`DROP TABLE IF EXISTS main`);
  await conn.query(`DROP TABLE IF EXISTS ${META_TABLE}`);
  if (activeDbPath.startsWith('opfs://')) {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const fileName = activeDbPath.replace('opfs://', '');
      await opfsRoot.removeEntry(fileName);
      console.log('🦆 [Worker] Removed OPFS DB file:', fileName);
    } catch (error: any) {
      if (error?.name !== 'NotFoundError') {
        console.warn('🦆 [Worker] Failed to remove OPFS DB file:', error?.message || error);
      }
    }
  }
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

async function loadSAV(buffer: ArrayBuffer, forceChunked?: boolean): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  // Auto-route to chunked mode for large files
  if (forceChunked || buffer.byteLength > CHUNKED_THRESHOLD_BYTES) {
    console.log(`🦆 [Worker] Auto-routing to chunked mode (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB > ${CHUNKED_THRESHOLD_BYTES / 1024 / 1024} MB threshold)`);
    return loadSAVChunked(buffer);
  }

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

// Threshold for auto-routing to chunked mode (50MB)
const CHUNKED_THRESHOLD_BYTES = 50 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 10000;

async function loadSAVChunked(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();

  // 1. Parse SAV file
  const { parseSavFile } = await import('@velocity/readstat-wasm');
  const parsed = await parseSavFile(buffer, (progress) => {
    console.log(`📊 [Worker] Chunked parse progress: ${(progress.progress * 100).toFixed(1)}%`);
  });

  // 2. Process metadata
  const { variables, variableSets } = processMetadata({
    metadata: {
      variables: parsed.metadata.variables,
      valueLabelSets: parsed.metadata.valueLabelSets,
      multipleResponseSets: parsed.metadata.multipleResponseSets,
      rowCount: parsed.metadata.rowCount,
    },
    rows: parsed.rows,
  });

  const numRows = parsed.rows.length;
  const numCols = parsed.metadata.variables.length;

  if (numRows === 0) {
    throw new Error(`SAV parsing failed: No row data extracted (expected ${parsed.metadata.rowCount} rows)`);
  }

  // 3. Prepare chunked insertion
  const variableMetadata = parsed.metadata.variables.map(v => ({
    name: v.name,
    type: v.type as 'numeric' | 'string',
  }));

  const chunkBuilder = new ArrowChunkBuilder(variableMetadata, chunkSize);

  // Drop existing table
  await conn.query(`DROP TABLE IF EXISTS main`);

  let isFirstChunk = true;
  let chunksInserted = 0;

  // 4. Stream rows through chunk builder
  for (let r = 0; r < numRows; r++) {
    const row = parsed.rows[r];
    const batch = chunkBuilder.addRow(row);

    // Null out processed row to free memory eagerly
    (parsed.rows as any)[r] = null;

    if (batch) {
      // Insert chunk into DuckDB
      const table = new arrow.Table(batch);
      await conn.insertArrowTable(table, { name: 'main', create: isFirstChunk });
      isFirstChunk = false;
      chunksInserted++;

      if (chunksInserted % 10 === 0) {
        console.log(`📊 [Worker] Inserted chunk ${chunksInserted}, ${chunkBuilder.getTotalRowsProcessed()} rows processed`);
      }
    }
  }

  // Drop the rows array reference
  (parsed as any).rows = [];

  // 5. Flush final partial chunk
  const finalBatch = chunkBuilder.flush();
  if (finalBatch) {
    const table = new arrow.Table(finalBatch);
    await conn.insertArrowTable(table, { name: 'main', create: isFirstChunk });
    chunksInserted++;
  }

  // 6. Verify row count
  const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const count = Number(verifyResult.toArray()[0]?.cnt);

  if (count !== numRows) {
    throw new Error(`Chunked insertion verification failed: expected ${numRows} rows, got ${count}`);
  }

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV (chunked): ${parsed.metadata.rowCount} rows in ${chunksInserted} chunks, ${variables.length} variables in ${durationMs.toFixed(2)}ms`);

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
  rowLimit: number,
  strategy: 'sequential' | 'spread' = 'sequential'
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; sampleRowCount: number; sampleStrategy: 'sequential' | 'spread'; durationMs: number }> {
  const start = performance.now();

  const { parseSavSample } = await import('@velocity/readstat-wasm');
  const parsed = await parseSavSample(buffer, rowLimit, strategy);

  const { variables, variableSets } = processMetadata({
    metadata: {
      variables: parsed.metadata.variables,
      valueLabelSets: parsed.metadata.valueLabelSets,
      multipleResponseSets: parsed.metadata.multipleResponseSets,
      rowCount: parsed.metadata.rowCount,
    },
    rows: parsed.rows,
  });

  const usedStrategy = parsed.sampleStrategy || strategy;
  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV sample: ${parsed.rows.length}/${parsed.metadata.rowCount} rows (${usedStrategy}), ${variables.length} variables in ${durationMs.toFixed(2)}ms`);

  return { variables, variableSets, rowCount: parsed.metadata.rowCount, sampleRowCount: parsed.rows.length, sampleStrategy: usedStrategy, durationMs };
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
      case 'setPersistenceContext': {
        persistenceContext = {
          datasetId: request.datasetId,
          schemaVersion: request.schemaVersion ?? OPFS_SCHEMA_VERSION,
        };
        if (!db) {
          activeDbPath = buildOpfsDbPath(persistenceContext.datasetId, persistenceContext.schemaVersion);
        } else {
          console.warn('🦆 [Worker] Persistence context updated after init; changes apply on next restart');
        }
        break;
      }

      case 'updatePersistenceMetadata': {
        await updateMeta(request.metadata);
        break;
      }

      case 'init': {
        if (request.datasetId || request.schemaVersion) {
          persistenceContext = {
            datasetId: request.datasetId,
            schemaVersion: request.schemaVersion ?? OPFS_SCHEMA_VERSION,
          };
        }
        const initResult = await init(request.forceCleanStart);
        if (initResult.corruptionDetected) {
          self.postMessage({
            type: 'corruptionDetected',
            message: initResult.corruptionMessage || 'OPFS database corruption detected'
          } as WorkerResponse);
        }
        self.postMessage({
          type: 'persistenceStatus',
          ...getPersistenceStatus()
        } as WorkerResponse);
        self.postMessage({
          type: 'ready',
          opfsAvailable: initResult.opfsAvailable
        } as WorkerResponse);
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
        const savResult = await loadSAV(request.buffer, request.forceChunked);
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
        const savResult = await loadSAVSample(request.buffer, request.rowLimit, request.strategy || 'spread');
        self.postMessage({
          type: 'savSampleLoaded',
          variables: savResult.variables,
          variableSets: savResult.variableSets,
          rowCount: savResult.rowCount,
          sampleRowCount: savResult.sampleRowCount,
          sampleStrategy: savResult.sampleStrategy,
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
        const crosstabResult = await coreRunCrosstab(adapter, request.options, request.context);
        const duration = performance.now() - start;
        self.postMessage({
          type: 'queryResult',
          data: crosstabResult.rows,
          tableStats: crosstabResult.tableStats,
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

      case 'exportArrow': {
        if (!conn) throw new Error('DB not initialized');

        const start = performance.now();

        // Execute query and get Arrow result
        const result = await conn.query(request.sql);

        // Convert to Arrow IPC format
        const arrowTable = result;
        const ipcBuffer = arrow.tableToIPC(arrowTable);

        const durationMs = performance.now() - start;
        const rowCount = result.numRows;

        console.log(`🦆 [Worker] Exported Arrow IPC: ${rowCount} rows in ${durationMs.toFixed(2)}ms`);

        // Transfer the buffer (zero-copy)
        (self as unknown as Worker).postMessage(
          {
            type: 'arrowExported',
            buffer: ipcBuffer.buffer,
            rowCount,
            durationMs,
          } as WorkerResponse,
          [ipcBuffer.buffer as Transferable]
        );
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
            rowCount: persistedResult.rowCount!,
            metadata: persistedResult.metadata || undefined
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
