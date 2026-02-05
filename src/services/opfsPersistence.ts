export type PersistenceMode = 'opfs' | 'memory' | 'disabled';

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
};

export type PersistenceInitResult = {
  opfsAvailable: boolean;
  mode: PersistenceMode;
  activeDbPath: string;
  persistenceError?: string;
  corruptionDetected?: boolean;
  corruptionMessage?: string;
};

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
  } = deps;

  let opfsAvailable = false;
  let mode: PersistenceMode = 'memory';
  let activeDbPath = ':memory:';
  let persistenceError: string | undefined;
  let corruptionDetected = false;
  let corruptionMessage: string | undefined;

  const isCorruptionError = (message: string) => {
    const normalized = message.toLowerCase();
    return normalized.includes('not a valid duckdb database file') || normalized.includes('corrupt');
  };

  if (!enableOpfs) {
    await openMemory();
    return {
      opfsAvailable: false,
      mode: 'disabled',
      activeDbPath: ':memory:',
      persistenceError: disabledReason || 'OPFS disabled',
    };
  }

  if (!opfsSupport.supported) {
    await openMemory();
    return {
      opfsAvailable: false,
      mode: 'disabled',
      activeDbPath: ':memory:',
      persistenceError: opfsSupport.error || 'OPFS unsupported',
    };
  }

  let candidates: { path: string }[] = [];
  try {
    candidates = await listCandidates();
  } catch (error: any) {
    candidates = [];
    persistenceError = error?.message || 'Failed to list OPFS candidates';
  }

  const candidatePaths = new Set(candidates.map((candidate) => candidate.path));
  const attemptedPaths = new Set<string>();

  const attemptOpen = async (path: string, label: string, requirePersistedData: boolean) => {
    if (attemptedPaths.has(path)) return false;
    attemptedPaths.add(path);

    const openResult = await openPath(path, label);
    if (!openResult.ok) {
      const errorMsg = openResult.error || '';
      persistenceError = errorMsg;
      if (isCorruptionError(errorMsg)) {
        corruptionDetected = true;
        corruptionMessage = errorMsg;
        await quarantine(path);
      }
      await resetBetweenAttempts?.();
      return false;
    }

    if (requirePersistedData && validateOpenedPath) {
      try {
        const valid = await validateOpenedPath(path);
        if (!valid) {
          await resetBetweenAttempts?.();
          return false;
        }
      } catch {
        await resetBetweenAttempts?.();
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
  if (fallbackPath && candidatePaths.has(fallbackPath)) existingAttempts.push({ path: fallbackPath, label: 'OPFS fallback DB' });
  for (const candidate of candidates) {
    if (candidate.path === desiredPath || candidate.path === fallbackPath) continue;
    existingAttempts.push({ path: candidate.path, label: 'OPFS candidate DB' });
  }

  for (const attempt of existingAttempts) {
    const ok = await attemptOpen(attempt.path, attempt.label, true);
    if (ok) {
      return {
        opfsAvailable,
        mode,
        activeDbPath,
        persistenceError,
        corruptionDetected: corruptionDetected || undefined,
        corruptionMessage,
      };
    }
  }

  if (existingAttempts.length === 0) {
    const created = await attemptOpen(desiredPath, 'OPFS persistence (new)', false);
    if (created) {
      return {
        opfsAvailable,
        mode,
        activeDbPath,
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
      persistenceError,
      corruptionDetected: corruptionDetected || undefined,
      corruptionMessage,
    };
  }

  await openMemory();
  return {
    opfsAvailable: false,
    mode: enableOpfs ? 'memory' : 'disabled',
    activeDbPath: ':memory:',
    persistenceError: persistenceError || 'Failed to open OPFS database',
    corruptionDetected: corruptionDetected || undefined,
    corruptionMessage,
  };
}
