import * as duckdb from '@duckdb/duckdb-wasm';
import { DuckDBWasmAdapter } from '../../adapters/DuckDBWasmAdapter';
import {
  getLocalDuckDbBundles,
  resolveDuckDbBundleUrls,
  resolveDuckDbBundleVariant,
  selectBootBundle,
} from '../duckdbBundles';
import type { DuckDbBundleVariant } from '../duckdbBundles';
import { initOpfsPersistence } from '../opfsPersistence';
import { acquireOpfsDbLock, releaseOpfsDbLock } from './opfsDbLock';
import { CACHE_OPEN_BUDGET_MS, OPFS_ATTEMPT_TIMEOUT_MS } from '../workspaceBoot/constants';
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
  options: { hasPersistedSource?: boolean } = {},
): Promise<{
  opfsAvailable: boolean;
  corruptionDetected?: boolean;
  corruptionMessage?: string;
  duckdbBundle?: DuckDbBundleVariant;
}> {
  if (workerDbState.db) {
    return { opfsAvailable: workerDbState.opfsAvailable, duckdbBundle: workerDbState.duckdbBundle };
  }

  if (forceCleanStart) {
    console.log('🦆 [Worker] Force clean start requested, clearing OPFS before DuckDB init...');
    await cleanOPFS();
  }

  const selectedBundle = await selectBootBundle(DUCKDB_BUNDLES, ENABLE_DUCKDB_OPFS_PERSISTENCE);
  const bundle = resolveDuckDbBundleUrls(selectedBundle);
  const duckdbBundle = resolveDuckDbBundleVariant(selectedBundle);
  workerDbState.duckdbBundle = duckdbBundle;
  console.log('🦆 [Worker] DuckDB Bundle Selected:', duckdbBundle, bundle);

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
    : !duckDbOpfsSupported
      ? `DuckDB ${duckDbVersion || 'unknown'} does not support OPFS DB persistence (requires >= ${MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE.join('.')}). Upgrade @duckdb/duckdb-wasm to enable it.`
      : undefined;

  if (duckDbVersion) {
    console.log('🦆 [Worker] DuckDB Version:', duckDbVersion);
  }
  if (!duckDbOpfsSupported) {
    console.warn(
      `🦆 [Worker] Disabling DuckDB OPFS DB persistence: DuckDB ${duckDbVersion} < ${MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE.join('.')}`,
    );
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
    hasPersistedSource: options.hasPersistedSource ?? false,
    attemptTimeoutMs: OPFS_ATTEMPT_TIMEOUT_MS,
    cacheOpenBudgetMs: CACHE_OPEN_BUDGET_MS,
    onAttemptTimeout: (path, label) => {
      console.warn(`🦆 [Worker] OPFS open timed out (${label}): ${path}`);
    },
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
    dropOpenFiles: async () => {
      try {
        // Release any OPFS sync access handle registered by the failed attempt.
        // reset() does not drop OPFS file handles — dropFiles() does.
        await workerDbState.db!.dropFiles();
      } catch {
        // best-effort handle release
      }
    },
    acquireOpfsLock: () => acquireOpfsDbLock(),
    releaseOpfsLock: () => releaseOpfsDbLock(),
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
  workerDbState.opfsBootDecision = initResult.decision;

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
    duckdbBundle,
  };
}
