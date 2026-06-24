import * as duckdb from '@duckdb/duckdb-wasm';
import { DuckDBWasmAdapter } from '../../adapters/DuckDBWasmAdapter';
import { getLocalDuckDbBundles, resolveDuckDbBundleUrls } from '../duckdbBundles';
import { initOpfsPersistence } from '../opfsPersistence';
import {
  buildOpfsDbPath,
  buildRepairDbPath,
  cleanOPFS,
  detectOpfsSupport,
  isVersionAtLeast,
  listOpfsDbFiles,
  parseDuckDbVersion,
  quarantineCorruptedDb,
} from './duckdbOpfs';
import {
  ENABLE_DUCKDB_OPFS_PERSISTENCE,
  MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE,
  workerDbState,
} from './workerDbState';

const DUCKDB_BUNDLES = getLocalDuckDbBundles();

function startKeepalive(): void {
  if (workerDbState.keepaliveInterval) return;

  workerDbState.keepaliveInterval = setInterval(async () => {
    if (workerDbState.conn) {
      try {
        await workerDbState.conn.query('SELECT 1');
      } catch (e) {
        console.warn('🦆 [Worker] Keepalive query failed:', e);
      }
    }
  }, 20000);

  console.log('🦆 [Worker] Keepalive started (20s interval)');
}

export function stopKeepalive(): void {
  if (workerDbState.keepaliveInterval) {
    clearInterval(workerDbState.keepaliveInterval);
    workerDbState.keepaliveInterval = null;
    console.log('🦆 [Worker] Keepalive stopped');
  }
}

export async function init(
  forceCleanStart: boolean = false,
): Promise<{ opfsAvailable: boolean; corruptionDetected?: boolean; corruptionMessage?: string }> {
  if (workerDbState.db) return { opfsAvailable: workerDbState.opfsAvailable };

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

  workerDbState.db = new duckdb.AsyncDuckDB(logger, worker);
  await workerDbState.db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  workerDbState.opfsAvailable = false;
  workerDbState.persistenceMode = 'memory';
  workerDbState.persistenceError = null;
  workerDbState.activeDbPath = ':memory:';

  const duckDbVersion = await workerDbState.db.getVersion().catch(() => '');
  const parsedVersion = duckDbVersion ? parseDuckDbVersion(duckDbVersion) : null;
  const duckDbOpfsSupported = parsedVersion
    ? isVersionAtLeast(parsedVersion, MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE)
    : true;
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
  const desiredOpfsPath = buildOpfsDbPath(workerDbState.persistenceContext.datasetId);
  const fallbackOpfsPath = workerDbState.persistenceContext.datasetId ? buildOpfsDbPath() : null;

  const openOpfsPath = async (path: string, label: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      await workerDbState.db!.open({
        path,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
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
        const probeConn = await workerDbState.db!.connect();
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
        await workerDbState.db!.reset();
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
      await workerDbState.db!.open({ path: ':memory:' });
    },
  });

  workerDbState.opfsAvailable = initResult.opfsAvailable;
  workerDbState.persistenceMode = initResult.mode;
  workerDbState.persistenceError = initResult.persistenceError ?? null;
  workerDbState.activeDbPath = initResult.activeDbPath;

  if (initResult.corruptionDetected) {
    console.error('🦆 [Worker] OPFS corruption detected:', initResult.corruptionMessage);
  }

  if (!workerDbState.opfsAvailable) {
    console.log('🦆 [Worker] Running in in-memory mode (no persistence)');
  }

  workerDbState.conn = await workerDbState.db.connect();
  workerDbState.adapter = new DuckDBWasmAdapter(workerDbState.conn, workerDbState.db);
  console.log('🦆 [Worker] DuckDB Initialized');

  startKeepalive();

  return {
    opfsAvailable: workerDbState.opfsAvailable,
    corruptionDetected: initResult.corruptionDetected,
    corruptionMessage: initResult.corruptionMessage,
  };
}
