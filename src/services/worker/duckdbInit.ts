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
  DUCKDB_BUNDLE_SELECT_TIMEOUT_MS,
  DUCKDB_CONNECT_TIMEOUT_MS,
  DUCKDB_INSTANTIATE_TIMEOUT_MS,
  DUCKDB_OPFS_SETUP_TIMEOUT_MS,
} from '../workspaceBoot/constants';
import { emitWorkerBootTrace, withWorkerBootPhase } from './workerBootTrace';
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
  options: { hasPersistedSource?: boolean; forceMemory?: boolean } = {},
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
    await withWorkerBootPhase('opfs.clean_start', DUCKDB_OPFS_SETUP_TIMEOUT_MS, cleanOPFS);
  }

  const persistenceEnabled = ENABLE_DUCKDB_OPFS_PERSISTENCE && !options.forceMemory;
  const selectedBundle = await withWorkerBootPhase(
    'duckdb.bundle.select',
    DUCKDB_BUNDLE_SELECT_TIMEOUT_MS,
    () => selectBootBundle(DUCKDB_BUNDLES, persistenceEnabled),
    {
      crossOriginIsolated: Boolean(self.crossOriginIsolated),
      persistenceEnabled,
    },
  );
  const bundle = resolveDuckDbBundleUrls(selectedBundle);
  const duckdbBundle = resolveDuckDbBundleVariant(selectedBundle);
  workerDbState.duckdbBundle = duckdbBundle;
  emitWorkerBootTrace('duckdb.bundle.selected', 'completed', {
    bundle: duckdbBundle,
    crossOriginIsolated: Boolean(self.crossOriginIsolated),
  });
  console.log('🦆 [Worker] DuckDB Bundle Selected:', duckdbBundle, bundle);

  if (!bundle.mainWorker) {
    throw new Error('No main worker URL found in bundle');
  }

  const worker = new Worker(bundle.mainWorker);
  emitWorkerBootTrace('duckdb.nested_worker.created', 'completed', { bundle: duckdbBundle });
  worker.addEventListener('error', (event) => {
    emitWorkerBootTrace('duckdb.nested_worker.runtime', 'error', {
      message: event.message || 'Nested DuckDB worker runtime error',
    });
  });
  const logger = new duckdb.ConsoleLogger();

  workerDbState.db = new duckdb.AsyncDuckDB(logger, worker);
  let wasmFetchCompleted = false;
  emitWorkerBootTrace('wasm.fetch', 'started', { bundle: duckdbBundle });
  await withWorkerBootPhase('duckdb.instantiate', DUCKDB_INSTANTIATE_TIMEOUT_MS, () =>
    workerDbState.db!.instantiate(bundle.mainModule, bundle.pthreadWorker, (progress) => {
      emitWorkerBootTrace('wasm.fetch', 'progress', {
        bytesLoaded: progress.bytesLoaded,
        bytesTotal: progress.bytesTotal,
      });
      if (!wasmFetchCompleted && progress.bytesTotal > 0 && progress.bytesLoaded >= progress.bytesTotal) {
        wasmFetchCompleted = true;
        emitWorkerBootTrace('wasm.fetch', 'completed', {
          bytesLoaded: progress.bytesLoaded,
          bytesTotal: progress.bytesTotal,
        });
      }
    }),
  );
  if (!wasmFetchCompleted) emitWorkerBootTrace('wasm.fetch', 'completed', { bundle: duckdbBundle });

  workerDbState.opfsAvailable = false;
  workerDbState.persistenceMode = 'memory';
  workerDbState.persistenceError = null;
  workerDbState.activeDbPath = ':memory:';

  const duckDbVersion = await workerDbState.db.getVersion().catch(() => '');
  const parsedVersion = duckDbVersion ? parseDuckDbVersion(duckDbVersion) : null;
  const duckDbOpfsSupported = parsedVersion
    ? isVersionAtLeast(parsedVersion, MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE)
    : true;
  const enableDuckDbOpfsPersistence = persistenceEnabled && duckDbOpfsSupported;
  const opfsDisabledReason = options.forceMemory
    ? 'Safe memory mode requested for this session'
    : !ENABLE_DUCKDB_OPFS_PERSISTENCE
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

  const opfsSupport = await withWorkerBootPhase('opfs.support', DUCKDB_OPFS_SETUP_TIMEOUT_MS, detectOpfsSupport);
  emitWorkerBootTrace('opfs.support.result', 'completed', {
    supported: opfsSupport.supported,
    message: opfsSupport.error ?? null,
  });
  const desiredOpfsPath = buildOpfsDbPath(workerDbState.persistenceContext.datasetId);
  const fallbackOpfsPath = workerDbState.persistenceContext.datasetId ? buildOpfsDbPath() : null;

  const openOpfsPath = async (path: string, label: string): Promise<{ ok: boolean; error?: string }> => {
    const startedAt = performance.now();
    emitWorkerBootTrace('opfs.database_open', 'started', { path, label });
    try {
      await workerDbState.db!.open({
        path,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
      });
      console.log(`🦆 [Worker] DuckDB opened with ${label}:`, path);
      emitWorkerBootTrace('opfs.database_open', 'completed', { path, label }, performance.now() - startedAt);
      return { ok: true };
    } catch (error: any) {
      const message = error?.message || String(error);
      console.warn(`🦆 [Worker] ${label} open failed:`, message);
      emitWorkerBootTrace('opfs.database_open', 'error', { path, label, message }, performance.now() - startedAt);
      return { ok: false, error: message };
    }
  };

  const initResult = await withWorkerBootPhase('persistence.setup', DUCKDB_OPFS_SETUP_TIMEOUT_MS, () =>
    initOpfsPersistence({
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
        emitWorkerBootTrace('opfs.database_open', 'timeout', { path, label });
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
        emitWorkerBootTrace('opfs.database_reset', 'started');
        try {
          await workerDbState.db!.reset();
          emitWorkerBootTrace('opfs.database_reset', 'completed');
        } catch {
          emitWorkerBootTrace('opfs.database_reset', 'error');
          // ignore reset errors; we'll fall back to memory if needed
        }
      },
      dropOpenFiles: async () => {
        emitWorkerBootTrace('opfs.drop_files', 'started');
        try {
          // Release any OPFS sync access handle registered by the failed attempt.
          // reset() does not drop OPFS file handles — dropFiles() does.
          await workerDbState.db!.dropFiles();
          emitWorkerBootTrace('opfs.drop_files', 'completed');
        } catch {
          emitWorkerBootTrace('opfs.drop_files', 'error');
          // best-effort handle release
        }
      },
      acquireOpfsLock: async () => {
        emitWorkerBootTrace('opfs.lock', 'started');
        const acquired = await acquireOpfsDbLock();
        emitWorkerBootTrace('opfs.lock', acquired ? 'completed' : 'fallback', { acquired });
        return acquired;
      },
      releaseOpfsLock: () => {
        releaseOpfsDbLock();
        emitWorkerBootTrace('opfs.lock.released', 'completed');
      },
      listCandidates: async () => {
        const candidates = await listOpfsDbFiles();
        return candidates.map((candidate) => ({ path: `opfs://${candidate.path}` }));
      },
      quarantine: quarantineCorruptedDb,
      buildRepairPath: buildRepairDbPath,
      openMemory: async () => {
        emitWorkerBootTrace('persistence.memory_fallback', 'started');
        await workerDbState.db!.open({ path: ':memory:' });
        emitWorkerBootTrace('persistence.memory_fallback', 'fallback');
      },
    }),
  );
  emitWorkerBootTrace('persistence.outcome', initResult.mode === 'opfs' ? 'completed' : 'fallback', {
    mode: initResult.mode,
    decision: initResult.decision,
    message: initResult.persistenceError ?? null,
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

  workerDbState.conn = await withWorkerBootPhase('duckdb.connect', DUCKDB_CONNECT_TIMEOUT_MS, () =>
    workerDbState.db!.connect(),
  );
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
