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

async function tableExists(tableName: string): Promise<boolean> {
  if (!conn) throw new Error('DB not initialized');
  const result = await conn.query(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = 'main'
      AND table_name = '${tableName.replace(/'/g, "''")}'
  `);
  return Number(result.toArray()[0]?.cnt ?? 0) > 0;
}

async function readMeta(): Promise<PersistedMetadata | null> {
  if (!conn) throw new Error('DB not initialized');
  try {
    if (!(await tableExists(META_TABLE))) return null;
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
  const opfsDisabledReason = !ENABLE_DUCKDB_OPFS_PERSISTENCE
    ? 'DuckDB OPFS DB persistence disabled by feature flag'
    : (!duckDbOpfsSupported
      ? `DuckDB ${duckDbVersion || 'unknown'} does not support OPFS DB persistence (requires >= ${MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE.join('.')}). Upgrade @duckdb/duckdb-wasm to enable it.`
      : undefined);

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
    disabledReason: opfsDisabledReason,
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
const DEFAULT_CHUNK_SIZE = 5000; // Rows per chunk for streaming insertion
const MIN_CHUNK_SIZE = 500;
const MAX_CHUNK_SIZE = 10000;
const SLOW_BATCH_MS = 1200;
const FAST_BATCH_MS = 350;
const CHUNK_DOWNSHIFT_FACTOR = 0.7;
const CHUNK_UPSHIFT_FACTOR = 1.2;

// Streaming feature flags
const ENABLE_SAV_STREAMING_V2 = true;
const ENABLE_SAV_STREAMING_V3_SINGLE_PASS = true; // Stage 2 default-on; v2 remains fallback
const STREAMING_V2_HIGH_RISK_BYTES = CHUNKED_THRESHOLD_BYTES;
const STREAMING_V3_HIGH_RISK_BYTES = CHUNKED_THRESHOLD_BYTES;
const V3_INITIAL_CREDITS = 2;
const V3_MAX_CREDITS = 4;

type SavColumnMetadata = { name: string; type: 'numeric' | 'string' };

function clampChunkSize(size: number): number {
  const rounded = Math.floor(size);
  return Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, rounded));
}

function buildEmptyVectorsFromMetadata(
  variables: SavColumnMetadata[]
): Record<string, arrow.Vector> {
  const vectors: Record<string, arrow.Vector> = {};
  for (const variable of variables) {
    vectors[variable.name] = variable.type === 'numeric'
      ? arrow.vectorFromArray([], new arrow.Float64())
      : arrow.vectorFromArray([], new arrow.Utf8());
  }
  return vectors;
}

function buildVectorsFromBatch(
  rows: (number | string | null)[][],
  variables: SavColumnMetadata[]
): Record<string, arrow.Vector> {
  const numRows = rows.length;
  const numCols = rows[0]?.length ?? 0;
  const vectors: Record<string, arrow.Vector> = {};

  for (let c = 0; c < numCols; c++) {
    const colData: (number | string | null)[] = new Array(numRows);
    for (let r = 0; r < numRows; r++) {
      colData[r] = rows[r][c];
    }

    const colMeta = variables[c];
    const colName = colMeta?.name || `col_${c}`;
    const isNumeric = colMeta?.type === 'numeric';

    vectors[colName] = isNumeric
      ? arrow.vectorFromArray(colData as (number | null)[], new arrow.Float64())
      : arrow.vectorFromArray(colData as (string | null)[], new arrow.Utf8());
  }

  return vectors;
}

async function loadSAVChunked(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  const useV3 = ENABLE_SAV_STREAMING_V3_SINGLE_PASS && buffer.byteLength >= STREAMING_V3_HIGH_RISK_BYTES;
  const useV2 = ENABLE_SAV_STREAMING_V2 && buffer.byteLength >= STREAMING_V2_HIGH_RISK_BYTES;

  if (useV3) {
    try {
      return await loadSAVChunkedV3SinglePass(buffer, chunkSize);
    } catch (error: any) {
      console.warn(`🦆 [Worker] V3 single-pass load failed (${error?.message || error}); falling back to v2 path`);
    }
  }

  if (useV2) {
    try {
      return await loadSAVChunkedV2(buffer, chunkSize);
    } catch (error: any) {
      console.warn(`🦆 [Worker] V2 chunked load failed (${error?.message || error}); falling back to legacy chunked path`);
    }
  }

  return loadSAVChunkedLegacy(buffer, chunkSize);
}

async function loadSAVChunkedV3SinglePass(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  const fileSizeMb = buffer.byteLength / (1024 * 1024);
  let activeChunkSize = clampChunkSize(chunkSize);
  let rowsInserted = 0;
  let chunksInserted = 0;

  console.log(`🦆 [Worker] Starting single-pass SAV load v3: ${fileSizeMb.toFixed(1)} MB, chunk size ${activeChunkSize}, credits ${V3_INITIAL_CREDITS}/${V3_MAX_CREDITS}`);
  self.postMessage({
    type: 'loadProgress',
    phase: 'parsing',
    progress: 0,
    message: `Starting single-pass parse bridge for ${fileSizeMb.toFixed(1)} MB file...`
  });

  const { parseSavStreamingSinglePassBridge } = await import('@velocity/readstat-wasm');
  let variableMetadata: SavColumnMetadata[] | null = null;

  await conn.query(`DROP TABLE IF EXISTS main`);

  const streamingResult = await parseSavStreamingSinglePassBridge(
    buffer,
    {
      batchSize: activeChunkSize,
      initialCredits: V3_INITIAL_CREDITS,
      maxCredits: V3_MAX_CREDITS,
    },
    async (batch) => {
      if (!variableMetadata) {
        const vars = batch.variables || [];
        if (vars.length === 0) {
          throw new Error('Streaming v3 did not provide variable metadata in the first batch');
        }
        variableMetadata = vars.map(v => ({ name: v.name, type: v.type }));
      }

      if (batch.rows.length === 0) {
        return activeChunkSize;
      }

      const insertStart = performance.now();
      const table = new arrow.Table(buildVectorsFromBatch(batch.rows, variableMetadata));
      await conn.insertArrowTable(table, { name: 'main', create: chunksInserted === 0 });
      chunksInserted++;
      rowsInserted += batch.rows.length;

      const batchMs = performance.now() - insertStart;
      const progressPct = Math.round(batch.progress * 100);
      if (chunksInserted % 5 === 0 || progressPct >= 99) {
        console.log(`📊 [Worker] V3 chunk ${chunksInserted}: ${rowsInserted}/${batch.totalRows} rows (${progressPct}%), ${batchMs.toFixed(0)}ms`);
        self.postMessage({
          type: 'loadProgress',
          phase: 'inserting',
          progress: batch.progress,
          rowsProcessed: rowsInserted,
          totalRows: batch.totalRows,
          message: `Loaded ${rowsInserted.toLocaleString()} of ${batch.totalRows.toLocaleString()} rows...`
        });
      }

      if (batchMs > SLOW_BATCH_MS && activeChunkSize > MIN_CHUNK_SIZE) {
        activeChunkSize = clampChunkSize(activeChunkSize * CHUNK_DOWNSHIFT_FACTOR);
      } else if (batchMs < FAST_BATCH_MS && activeChunkSize < MAX_CHUNK_SIZE) {
        activeChunkSize = clampChunkSize(activeChunkSize * CHUNK_UPSHIFT_FACTOR);
      }

      return activeChunkSize;
    }
  );

  if (rowsInserted === 0) {
    const emptyVectors = buildEmptyVectorsFromMetadata(
      streamingResult.metadata.variables.map(v => ({ name: v.name, type: v.type }))
    );
    const emptyTable = new arrow.Table(emptyVectors);
    await conn.insertArrowTable(emptyTable, { name: 'main', create: true });
  }

  const processedMeta = processMetadata({
    metadata: {
      variables: streamingResult.metadata.variables,
      valueLabelSets: streamingResult.metadata.valueLabelSets,
      multipleResponseSets: streamingResult.metadata.multipleResponseSets,
      rowCount: streamingResult.metadata.rowCount,
    },
    rows: [],
  });

  const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const count = Number(verifyResult.toArray()[0]?.cnt);
  if (count !== rowsInserted) {
    throw new Error(`Streaming v3 row mismatch: inserted ${rowsInserted}, DuckDB reports ${count}`);
  }

  const durationMs = performance.now() - start;
  console.log(
    `🦆 [Worker] Loaded SAV (single-pass v3): ${count} rows in ${chunksInserted} chunks, ` +
    `${processedMeta.variables.length} variables in ${durationMs.toFixed(2)}ms ` +
    `(bridge queue max ${streamingResult.bridge.maxQueueDepth}, produced ${streamingResult.bridge.producedBatches}, consumed ${streamingResult.bridge.consumedBatches})`
  );
  self.postMessage({
    type: 'loadProgress',
    phase: 'complete',
    progress: 1,
    rowsProcessed: count,
    totalRows: streamingResult.metadata.rowCount,
    message: `Loaded ${count.toLocaleString()} rows successfully`
  });

  return {
    variables: processedMeta.variables,
    variableSets: processedMeta.variableSets,
    rowCount: streamingResult.metadata.rowCount,
    durationMs,
  };
}

async function loadSAVChunkedV2(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  const fileSizeMb = buffer.byteLength / (1024 * 1024);
  let activeChunkSize = clampChunkSize(chunkSize);
  let rowsInserted = 0;
  let chunksInserted = 0;

  console.log(`🦆 [Worker] Starting streaming SAV load v2: ${fileSizeMb.toFixed(1)} MB, chunk size ${activeChunkSize}`);
  self.postMessage({
    type: 'loadProgress',
    phase: 'parsing',
    progress: 0,
    message: `Starting bounded-memory parse for ${fileSizeMb.toFixed(1)} MB file...`
  });

  const { parseSavStreamingV2 } = await import('@velocity/readstat-wasm');
  let variableMetadata: SavColumnMetadata[] | null = null;

  await conn.query(`DROP TABLE IF EXISTS main`);

  const streamingResult = await parseSavStreamingV2(buffer, activeChunkSize, async (batch) => {
    if (!variableMetadata) {
      const vars = batch.variables || [];
      if (vars.length === 0) {
        throw new Error('Streaming v2 did not provide variable metadata in the first batch');
      }
      variableMetadata = vars.map(v => ({ name: v.name, type: v.type }));
    }

    if (batch.rows.length === 0) {
      return activeChunkSize;
    }

    const insertStart = performance.now();
    const numRows = batch.rows.length;
    const table = new arrow.Table(buildVectorsFromBatch(batch.rows, variableMetadata));
    await conn.insertArrowTable(table, { name: 'main', create: chunksInserted === 0 });
    chunksInserted++;
    rowsInserted += numRows;

    const batchMs = performance.now() - insertStart;
    const progressPct = Math.round(batch.progress * 100);
    if (chunksInserted % 5 === 0 || progressPct >= 99) {
      console.log(`📊 [Worker] V2 chunk ${chunksInserted}: ${rowsInserted}/${batch.totalRows} rows (${progressPct}%), ${batchMs.toFixed(0)}ms`);
      self.postMessage({
        type: 'loadProgress',
        phase: 'inserting',
        progress: batch.progress,
        rowsProcessed: rowsInserted,
        totalRows: batch.totalRows,
        message: `Loaded ${rowsInserted.toLocaleString()} of ${batch.totalRows.toLocaleString()} rows...`
      });
    }

    if (batchMs > SLOW_BATCH_MS && activeChunkSize > MIN_CHUNK_SIZE) {
      activeChunkSize = clampChunkSize(activeChunkSize * CHUNK_DOWNSHIFT_FACTOR);
    } else if (batchMs < FAST_BATCH_MS && activeChunkSize < MAX_CHUNK_SIZE) {
      activeChunkSize = clampChunkSize(activeChunkSize * CHUNK_UPSHIFT_FACTOR);
    }

    return activeChunkSize;
  });

  if (rowsInserted === 0) {
    const emptyVectors = buildEmptyVectorsFromMetadata(
      streamingResult.metadata.variables.map(v => ({ name: v.name, type: v.type }))
    );
    const emptyTable = new arrow.Table(emptyVectors);
    await conn.insertArrowTable(emptyTable, { name: 'main', create: true });
  }

  const processedMeta = processMetadata({
    metadata: {
      variables: streamingResult.metadata.variables,
      valueLabelSets: streamingResult.metadata.valueLabelSets,
      multipleResponseSets: streamingResult.metadata.multipleResponseSets,
      rowCount: streamingResult.metadata.rowCount,
    },
    rows: [],
  });

  const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const count = Number(verifyResult.toArray()[0]?.cnt);
  if (count !== rowsInserted) {
    throw new Error(`Streaming v2 row mismatch: inserted ${rowsInserted}, DuckDB reports ${count}`);
  }

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV (streaming v2): ${count} rows in ${chunksInserted} chunks, ${processedMeta.variables.length} variables in ${durationMs.toFixed(2)}ms`);
  self.postMessage({
    type: 'loadProgress',
    phase: 'complete',
    progress: 1,
    rowsProcessed: count,
    totalRows: streamingResult.metadata.rowCount,
    message: `Loaded ${count.toLocaleString()} rows successfully`
  });

  return {
    variables: processedMeta.variables,
    variableSets: processedMeta.variableSets,
    rowCount: streamingResult.metadata.rowCount,
    durationMs,
  };
}

/**
 * Legacy chunked parser path.
 * Kept as rollback path while streaming v2 hardens in production.
 */
async function loadSAVChunkedLegacy(
  buffer: ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  const fileSizeMb = buffer.byteLength / (1024 * 1024);

  console.log(`🦆 [Worker] Starting legacy streaming SAV load: ${fileSizeMb.toFixed(1)} MB, chunk size ${chunkSize}`);

  self.postMessage({
    type: 'loadProgress',
    phase: 'parsing',
    progress: 0,
    message: `Starting to parse ${fileSizeMb.toFixed(1)} MB file...`
  });

  const { parseSavStreaming } = await import('@velocity/readstat-wasm');

  let variableMetadata: SavColumnMetadata[] = [];
  let isFirstChunk = true;
  let totalRowsInserted = 0;
  let chunksInserted = 0;
  let streamingError: Error | null = null;

  await conn.query(`DROP TABLE IF EXISTS main`);

  const streamingResult = await parseSavStreaming(buffer, chunkSize, async (batch) => {
    if (variableMetadata.length === 0) {
      const vars = batch.variables || [];
      if (vars.length > 0) {
        variableMetadata = vars.map(v => ({ name: v.name, type: v.type }));
      } else {
        const numCols = batch.rows[0]?.length ?? 0;
        for (let c = 0; c < numCols; c++) {
          let isNumeric = true;
          for (const row of batch.rows) {
            if (row[c] !== null) {
              isNumeric = typeof row[c] === 'number';
              break;
            }
          }
          variableMetadata.push({
            name: `col_${c}`,
            type: isNumeric ? 'numeric' : 'string',
          });
        }
      }
    }

    if (batch.rows.length === 0) return;

    try {
      const numRows = batch.rows.length;

      const table = new arrow.Table(buildVectorsFromBatch(batch.rows, variableMetadata));
      await conn.insertArrowTable(table, { name: 'main', create: isFirstChunk });
      isFirstChunk = false;
      totalRowsInserted += numRows;
      chunksInserted++;

      const progressPct = Math.round(batch.progress * 100);
      if (chunksInserted % 5 === 0 || progressPct >= 99) {
        console.log(`📊 [Worker] Legacy chunk ${chunksInserted}: ${totalRowsInserted}/${batch.totalRows} rows (${progressPct}%)`);
        self.postMessage({
          type: 'loadProgress',
          phase: 'inserting',
          progress: batch.progress,
          rowsProcessed: totalRowsInserted,
          totalRows: batch.totalRows,
          message: `Loaded ${totalRowsInserted.toLocaleString()} of ${batch.totalRows.toLocaleString()} rows...`
        });
      }
    } catch (err: any) {
      console.error(`🦆 [Worker] Legacy chunk insertion failed at rows ${batch.startRow}-${batch.endRow}:`, err);
      streamingError = err;
      throw err;
    }
  });

  if (streamingError) {
    throw streamingError;
  }

  if (totalRowsInserted === 0) {
    const emptyVectors = buildEmptyVectorsFromMetadata(
      streamingResult.metadata.variables.map(v => ({ name: v.name, type: v.type }))
    );
    const emptyTable = new arrow.Table(emptyVectors);
    await conn.insertArrowTable(emptyTable, { name: 'main', create: true });
  }

  const realVariableNames = streamingResult.metadata.variables.map(v => v.name);
  for (let i = 0; i < Math.min(variableMetadata.length, realVariableNames.length); i++) {
    const oldName = variableMetadata[i].name;
    const newName = realVariableNames[i];
    if (oldName !== newName) {
      try {
        const escapedOld = oldName.replace(/"/g, '""');
        const escapedNew = newName.replace(/"/g, '""');
        await conn.query(`ALTER TABLE main RENAME COLUMN "${escapedOld}" TO "${escapedNew}"`);
      } catch (renameError) {
        console.warn(`🦆 [Worker] Could not rename column ${oldName} to ${newName}:`, renameError);
      }
    }
  }

  const processedMeta = processMetadata({
    metadata: {
      variables: streamingResult.metadata.variables,
      valueLabelSets: streamingResult.metadata.valueLabelSets,
      multipleResponseSets: streamingResult.metadata.multipleResponseSets,
      rowCount: streamingResult.metadata.rowCount,
    },
    rows: [],
  });

  const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const count = Number(verifyResult.toArray()[0]?.cnt);

  if (count !== totalRowsInserted) {
    console.warn(`🦆 [Worker] Row count mismatch: inserted ${totalRowsInserted}, DuckDB reports ${count}`);
  }

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV (legacy streaming): ${streamingResult.metadata.rowCount} rows in ${chunksInserted} chunks, ${processedMeta.variables.length} variables in ${durationMs.toFixed(2)}ms`);
  self.postMessage({
    type: 'loadProgress',
    phase: 'complete',
    progress: 1,
    rowsProcessed: count,
    totalRows: streamingResult.metadata.rowCount,
    message: `Loaded ${count.toLocaleString()} rows successfully`
  });

  return { variables: processedMeta.variables, variableSets: processedMeta.variableSets, rowCount: streamingResult.metadata.rowCount, durationMs };
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
        const crosstabResult = await coreRunCrosstab(
          adapter,
          {
            ...request.options,
            significanceOptions: request.analysisSettings,
          },
          request.context
        );
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
