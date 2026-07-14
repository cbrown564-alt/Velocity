export type PersistenceMode = 'opfs' | 'memory' | 'disabled';

export type OpfsBootDecision = 'cache_open' | 'rebuild' | 'fresh' | 'memory_fallback' | 'disabled' | 'opfs_locked';

export type OpfsSupport = {
  supported: boolean;
  error?: string;
};

export type OpenPath = (path: string, label: string) => Promise<{ ok: boolean; error?: string }>;
export type ListCandidates = () => Promise<{ path: string }[]>;
export type Quarantine = (path: string) => Promise<void>;
export type BuildRepairPath = () => string;
export type OpenMemory = () => Promise<void>;
export type ValidateOpenedPath = (path: string) => Promise<boolean>;
export type ResetBetweenAttempts = () => Promise<void>;
/** Release any OPFS file handles registered by the previous open attempt. */
export type DropOpenFiles = () => Promise<void>;
/** Acquire single-owner ownership of the OPFS DB. Returns false if another context holds it. */
export type AcquireOpfsLock = () => Promise<boolean>;
/** Release the single-owner OPFS DB lock (only when abandoning OPFS for memory). */
export type ReleaseOpfsLock = () => void;

export const OPFS_LOCKED_MESSAGE = 'OPFS database is locked by another tab or worker; using in-memory mode';

export type PersistenceInitDeps = {
  enableOpfs: boolean;
  disabledReason?: string;
  opfsSupport: OpfsSupport;
  desiredPath: string;
  fallbackPath: string | null;
  openPath: OpenPath;
  listCandidates: ListCandidates;
  quarantine: Quarantine;
  buildRepairPath: BuildRepairPath;
  openMemory: OpenMemory;
  validateOpenedPath?: ValidateOpenedPath;
  resetBetweenAttempts?: ResetBetweenAttempts;
  dropOpenFiles?: DropOpenFiles;
  acquireOpfsLock?: AcquireOpfsLock;
  releaseOpfsLock?: ReleaseOpfsLock;
  hasPersistedSource?: boolean;
  attemptTimeoutMs?: number;
  cacheOpenBudgetMs?: number;
  onAttemptTimeout?: (path: string, label: string) => void;
};

export type PersistenceInitResult = {
  opfsAvailable: boolean;
  mode: PersistenceMode;
  activeDbPath: string;
  decision: OpfsBootDecision;
  persistenceError?: string;
  corruptionDetected?: boolean;
  corruptionMessage?: string;
};

async function withAttemptTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  onTimeout: (() => void) | undefined,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error(`OPFS open attempt timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function initOpfsPersistence(deps: PersistenceInitDeps): Promise<PersistenceInitResult> {
  const {
    enableOpfs,
    disabledReason,
    opfsSupport,
    desiredPath,
    fallbackPath,
    openPath,
    listCandidates,
    quarantine,
    buildRepairPath,
    openMemory,
    validateOpenedPath,
    resetBetweenAttempts,
    dropOpenFiles,
    acquireOpfsLock,
    releaseOpfsLock,
    hasPersistedSource = false,
    attemptTimeoutMs,
    cacheOpenBudgetMs,
    onAttemptTimeout,
  } = deps;

  let opfsAvailable = false;
  let mode: PersistenceMode = 'memory';
  let activeDbPath = ':memory:';
  let persistenceError: string | undefined;
  let corruptionDetected = false;
  let corruptionMessage: string | undefined;
  let bundleIncompatible = false;

  const isBundleIncompatibleError = (message: string) => {
    const normalized = message.toLowerCase();
    // COI (multithreaded) DuckDB can't share an OPFS sync access handle across
    // pthread workers, so reopening throws a DataClone / postMessage error and
    // wedges the worker. Treat it as fatal-for-OPFS, not corruption.
    return normalized.includes('could not be cloned') || normalized.includes('dataclone');
  };

  // Time-bound the memory fallback: if a prior OPFS open wedged the worker,
  // db.open(':memory:') can hang forever. Surfacing an init error (recoverable
  // by reload) is always better than an infinite "Initializing…" spinner.
  const openMemoryGuarded = () =>
    withAttemptTimeout(openMemory(), attemptTimeoutMs, () => onAttemptTimeout?.(':memory:', 'memory fallback'));

  const isCorruptionError = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes('not a valid duckdb database file') ||
      normalized.includes('database file appears to be corrupted') ||
      normalized.includes('failed to scan dictionary string') ||
      normalized.includes('invalid bit width for bitpacking') ||
      normalized.includes('corrupt')
    );
  };

  if (!enableOpfs) {
    await openMemory();
    return {
      opfsAvailable: false,
      mode: 'disabled',
      activeDbPath: ':memory:',
      decision: 'disabled',
      persistenceError: disabledReason || 'OPFS disabled',
    };
  }

  if (!opfsSupport.supported) {
    await openMemory();
    return {
      opfsAvailable: false,
      mode: 'disabled',
      activeDbPath: ':memory:',
      decision: 'disabled',
      persistenceError: opfsSupport.error || 'OPFS unsupported',
    };
  }

  // Single-owner gate: OPFS sync access handles are exclusive per file across
  // the whole origin. If another tab/worker owns the DB, boot cleanly in memory
  // instead of colliding on the handle (which collapses the whole OPFS path).
  if (acquireOpfsLock) {
    const acquired = await acquireOpfsLock();
    if (!acquired) {
      await openMemory();
      return {
        opfsAvailable: false,
        mode: 'memory',
        activeDbPath: ':memory:',
        decision: 'opfs_locked',
        persistenceError: OPFS_LOCKED_MESSAGE,
      };
    }
  }

  let candidates: { path: string }[];
  try {
    candidates = await listCandidates();
  } catch (error: any) {
    candidates = [];
    persistenceError = error?.message || 'Failed to list OPFS candidates';
  }

  const candidatePaths = new Set(candidates.map((candidate) => candidate.path));
  const attemptedPaths = new Set<string>();
  const cacheOpenStartedAt = Date.now();

  const isCacheBudgetExceeded = () =>
    cacheOpenBudgetMs != null && cacheOpenBudgetMs > 0 && Date.now() - cacheOpenStartedAt >= cacheOpenBudgetMs;

  // Abandoning an OPFS open must release its sync access handle *before* the
  // next open(), or DuckDB throws "another open Access Handle … same file".
  // db.reset() alone does not drop OPFS handles — dropOpenFiles() does.
  const discardAttempt = async () => {
    await dropOpenFiles?.();
    await resetBetweenAttempts?.();
  };

  const attemptOpen = async (path: string, label: string, requirePersistedData: boolean) => {
    if (attemptedPaths.has(path)) return false;
    attemptedPaths.add(path);

    let openResult: { ok: boolean; error?: string };
    try {
      openResult = await withAttemptTimeout(openPath(path, label), attemptTimeoutMs, () =>
        onAttemptTimeout?.(path, label),
      );
    } catch (error: any) {
      openResult = { ok: false, error: error?.message || String(error) };
    }

    if (!openResult.ok) {
      const errorMsg = openResult.error || '';
      persistenceError = errorMsg;
      if (isCorruptionError(errorMsg)) {
        corruptionDetected = true;
        corruptionMessage = errorMsg;
        await quarantine(path);
      }
      if (isBundleIncompatibleError(errorMsg)) {
        bundleIncompatible = true;
      }
      await discardAttempt();
      return false;
    }

    if (requirePersistedData && validateOpenedPath) {
      try {
        const valid = await validateOpenedPath(path);
        if (!valid) {
          await discardAttempt();
          return false;
        }
      } catch {
        await discardAttempt();
        return false;
      }
    }

    activeDbPath = path;
    opfsAvailable = true;
    mode = 'opfs';
    return true;
  };

  const existingAttempts: Array<{ path: string; label: string }> = [];
  if (candidatePaths.has(desiredPath)) existingAttempts.push({ path: desiredPath, label: 'OPFS desired DB' });
  if (fallbackPath && candidatePaths.has(fallbackPath))
    existingAttempts.push({ path: fallbackPath, label: 'OPFS fallback DB' });
  for (const candidate of candidates) {
    if (candidate.path === desiredPath || candidate.path === fallbackPath) continue;
    existingAttempts.push({ path: candidate.path, label: 'OPFS candidate DB' });
  }

  for (const attempt of existingAttempts) {
    if (isCacheBudgetExceeded()) {
      persistenceError = persistenceError || `Cache open budget exceeded (${cacheOpenBudgetMs}ms)`;
      break;
    }
    const ok = await attemptOpen(attempt.path, attempt.label, true);
    if (ok) {
      return {
        opfsAvailable,
        mode,
        activeDbPath,
        decision: 'cache_open',
        persistenceError,
        corruptionDetected: corruptionDetected || undefined,
        corruptionMessage,
      };
    }
  }

  if (bundleIncompatible) {
    // The DuckDB bundle can't reopen OPFS databases; further opens only wedge the
    // worker. Fall straight to memory — the boot state machine rebuilds from the
    // source file. (With OPFS persistence enabled the app now boots the EH bundle,
    // which reopens cleanly; this guards any residual COI-with-OPFS path.)
    await openMemoryGuarded();
    releaseOpfsLock?.();
    return {
      opfsAvailable: false,
      mode: 'memory',
      activeDbPath: ':memory:',
      decision: hasPersistedSource ? 'rebuild' : 'memory_fallback',
      persistenceError: persistenceError || 'DuckDB bundle cannot reopen OPFS databases',
    };
  }

  if (existingAttempts.length === 0 && !hasPersistedSource) {
    const created = await attemptOpen(desiredPath, 'OPFS persistence (new)', false);
    if (created) {
      return {
        opfsAvailable,
        mode,
        activeDbPath,
        decision: 'fresh',
        persistenceError,
        corruptionDetected: corruptionDetected || undefined,
        corruptionMessage,
      };
    }
  }

  const repairPath = buildRepairPath();
  const repaired = await attemptOpen(repairPath, 'OPFS repair path', false);
  if (repaired) {
    return {
      opfsAvailable,
      mode,
      activeDbPath,
      decision: 'rebuild',
      persistenceError,
      corruptionDetected: corruptionDetected || undefined,
      corruptionMessage,
    };
  }

  // Every OPFS path failed — abandon OPFS for this session and release the
  // single-owner lock so another tab/worker can take ownership.
  await openMemoryGuarded();
  releaseOpfsLock?.();
  return {
    opfsAvailable: false,
    mode: enableOpfs ? 'memory' : 'disabled',
    activeDbPath: ':memory:',
    decision: hasPersistedSource ? 'rebuild' : 'memory_fallback',
    persistenceError: persistenceError || 'Failed to open OPFS database',
    corruptionDetected: corruptionDetected || undefined,
    corruptionMessage,
  };
}
