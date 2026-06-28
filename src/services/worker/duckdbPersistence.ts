import * as duckdb from '@duckdb/duckdb-wasm';
import { DuckDBWasmAdapter } from '../../adapters/DuckDBWasmAdapter';
import type { PersistedMetadata } from '../../types/worker';
import {
  getErrorMessage,
  isCorruptionLikeError,
  isFatalDatabaseRuntimeError,
  isWriteModeCommitError,
} from './duckdbErrorHelpers';
import { init, stopKeepalive } from './duckdbInit';
import { buildOpfsDbPath, buildRepairDbPath, quarantineCorruptedDb, removeOpfsDbFile } from './duckdbOpfs';
import { postEngineResponse } from './engineMessaging';
import { getSchema } from './workerQueries';
import { META_TABLE, OPFS_SCHEMA_VERSION, workerDbState } from './workerDbState';

export { init, stopKeepalive };
export { getErrorMessage, isCorruptionLikeError, isFatalDatabaseRuntimeError, isWriteModeCommitError };

async function ensureMetaTable(): Promise<void> {
  const { conn } = workerDbState;
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
  const { conn } = workerDbState;
  if (!conn) throw new Error('DB not initialized');
  const result = await conn.query(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = 'main'
      AND table_name = '${tableName.replace(/'/g, "''")}'
  `);
  return Number(result.toArray()[0]?.cnt ?? 0) > 0;
}

export async function readMeta(): Promise<PersistedMetadata | null> {
  const { conn } = workerDbState;
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

export async function updateMeta(metadata: PersistedMetadata): Promise<void> {
  const { conn } = workerDbState;
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

export function getPersistenceStatus() {
  return {
    opfsAvailable: workerDbState.opfsAvailable,
    mode: workerDbState.persistenceMode,
    dbPath: workerDbState.activeDbPath,
    lastError: workerDbState.persistenceError || undefined,
  };
}

async function closeActiveDatabase(): Promise<void> {
  if (!workerDbState.db) throw new Error('DB not initialized');

  try {
    if (workerDbState.conn) {
      await workerDbState.conn.close();
    }
  } catch {
    // Ignore close failures during recovery.
  }

  workerDbState.conn = null;
  workerDbState.adapter = null;

  try {
    await workerDbState.db.reset();
  } catch {
    // Continue recovery even if reset fails.
  }
}

export async function reopenWritableDatabase(pathOverride?: string): Promise<void> {
  if (!workerDbState.db) throw new Error('DB not initialized');

  await closeActiveDatabase();

  if (workerDbState.opfsAvailable || pathOverride?.startsWith('opfs://')) {
    const repairPath = pathOverride ?? buildRepairDbPath();
    try {
      await workerDbState.db.open({
        path: repairPath,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
      });
      workerDbState.activeDbPath = repairPath;
      workerDbState.persistenceMode = 'opfs';
      workerDbState.persistenceError = null;
      workerDbState.conn = await workerDbState.db.connect();
      workerDbState.adapter = new DuckDBWasmAdapter(workerDbState.conn, workerDbState.db);
      console.warn('🦆 [Worker] Reopened DuckDB on writable OPFS repair path:', repairPath);
      return;
    } catch (error: any) {
      workerDbState.persistenceError = error?.message || String(error);
      console.warn(
        '🦆 [Worker] Failed to reopen writable OPFS database, falling back to memory:',
        workerDbState.persistenceError,
      );
    }
  }

  await workerDbState.db.open({ path: ':memory:' });
  workerDbState.activeDbPath = ':memory:';
  workerDbState.persistenceMode = 'memory';
  workerDbState.opfsAvailable = false;
  workerDbState.conn = await workerDbState.db.connect();
  workerDbState.adapter = new DuckDBWasmAdapter(workerDbState.conn, workerDbState.db);
  console.warn('🦆 [Worker] Reopened DuckDB in memory mode after write-mode commit failure');
}

export async function reopenInMemoryDatabase(): Promise<void> {
  if (!workerDbState.db) throw new Error('DB not initialized');
  await closeActiveDatabase();
  await workerDbState.db.open({ path: ':memory:' });
  workerDbState.activeDbPath = ':memory:';
  workerDbState.persistenceMode = 'memory';
  workerDbState.opfsAvailable = false;
  workerDbState.conn = await workerDbState.db.connect();
  workerDbState.adapter = new DuckDBWasmAdapter(workerDbState.conn, workerDbState.db);
  console.warn('🦆 [Worker] Reopened DuckDB in forced memory mode');
}

export async function recoverFromFatalDatabaseError(error: unknown, requestId: string): Promise<void> {
  if (!workerDbState.fatalRecoveryPromise) {
    workerDbState.fatalRecoveryPromise = (async () => {
      const message = getErrorMessage(error);

      if (isCorruptionLikeError(error) && workerDbState.activeDbPath.startsWith('opfs://')) {
        try {
          await quarantineCorruptedDb(workerDbState.activeDbPath);
        } catch (quarantineError: any) {
          console.warn('🦆 [Worker] Failed to quarantine fatal DB path:', quarantineError?.message || quarantineError);
        }
      }

      workerDbState.persistenceError = message || 'Fatal DuckDB runtime error';
      await reopenInMemoryDatabase();
    })().finally(() => {
      workerDbState.fatalRecoveryPromise = null;
    });
  }

  await workerDbState.fatalRecoveryPromise;

  const message = getErrorMessage(error) || 'Fatal DuckDB runtime error';
  if (isCorruptionLikeError(error)) {
    postEngineResponse({
      type: 'engine.corruptionDetected',
      requestId,
      message,
    });
  }
  postEngineResponse({
    type: 'engine.persistenceStatus',
    requestId,
    ...getPersistenceStatus(),
  });
}

export async function checkPersistedData(): Promise<{
  exists: boolean;
  schema?: { name: string; type: string }[];
  rowCount?: number;
  metadata?: PersistedMetadata | null;
}> {
  const { conn } = workerDbState;
  if (!conn) throw new Error('DB not initialized');

  try {
    const tableCheck = await conn.query(`
      SELECT COUNT(*) as cnt
      FROM information_schema.tables
      WHERE table_name = 'main'
    `);
    const mainTableExists = Number(tableCheck.toArray()[0]?.cnt) > 0;

    if (!mainTableExists) return { exists: false };

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

export async function clearPersistedData(): Promise<void> {
  const { conn } = workerDbState;
  if (!conn) throw new Error('DB not initialized');

  const targetDbPath = workerDbState.activeDbPath;
  const nextOpfsPath = buildOpfsDbPath(
    workerDbState.persistenceContext.datasetId,
    workerDbState.persistenceContext.schemaVersion,
  );

  if (targetDbPath.startsWith('opfs://')) {
    await reopenInMemoryDatabase();
    await removeOpfsDbFile(targetDbPath);

    try {
      await reopenWritableDatabase(nextOpfsPath);
    } catch (error: any) {
      console.warn('🦆 [Worker] Failed to reopen writable OPFS database after discard:', error?.message || error);
      await reopenInMemoryDatabase();
    }
  } else {
    await conn.query(`DROP TABLE IF EXISTS main`);
    await conn.query(`DROP TABLE IF EXISTS ${META_TABLE}`);
  }
  console.log('🦆 [Worker] Persisted data cleared');
}

export async function flushPersistedData(): Promise<{ ok: boolean; durationMs: number; error?: string }> {
  const { db, conn } = workerDbState;
  if (!db) throw new Error('DB not initialized');

  if (!workerDbState.opfsAvailable) {
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
