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

export type PersistenceInitDeps = {
  enableOpfs: boolean;
  opfsSupport: OpfsSupport;
  desiredPath: string;
  fallbackPath: string | null;
  openPath: OpenPath;
  listCandidates: ListCandidates;
  quarantine: Quarantine;
  buildRepairPath: BuildRepairPath;
  openMemory: OpenMemory;
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
    opfsSupport,
    desiredPath,
    fallbackPath,
    openPath,
    listCandidates,
    quarantine,
    buildRepairPath,
    openMemory,
  } = deps;

  let opfsAvailable = false;
  let mode: PersistenceMode = 'memory';
  let activeDbPath = ':memory:';
  let persistenceError: string | undefined;
  let corruptionDetected = false;
  let corruptionMessage: string | undefined;

  if (!enableOpfs) {
    await openMemory();
    return {
      opfsAvailable: false,
      mode: 'disabled',
      activeDbPath: ':memory:',
      persistenceError: 'OPFS disabled by feature flag',
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

  const initialOpen = await openPath(desiredPath, 'OPFS persistence');
  if (initialOpen.ok) {
    return {
      opfsAvailable: true,
      mode: 'opfs',
      activeDbPath: desiredPath,
    };
  }

  const errorMsg = initialOpen.error || '';
  const isCorruption = errorMsg.includes('not a valid DuckDB database file') || errorMsg.includes('corrupt');

  if (fallbackPath) {
    const fallbackOpen = await openPath(fallbackPath, 'OPFS fallback path');
    if (fallbackOpen.ok) {
      return {
        opfsAvailable: true,
        mode: 'opfs',
        activeDbPath: fallbackPath,
      };
    }
  }

  if (isCorruption) {
    corruptionDetected = true;
    corruptionMessage = errorMsg;
    await quarantine(desiredPath);

    const candidates = await listCandidates();
    for (const candidate of candidates) {
      if (candidate.path === desiredPath || candidate.path === fallbackPath) continue;
      const candidateOpen = await openPath(candidate.path, 'OPFS candidate DB');
      if (candidateOpen.ok) {
        return {
          opfsAvailable: true,
          mode: 'opfs',
          activeDbPath: candidate.path,
          corruptionDetected,
          corruptionMessage,
        };
      }
    }

    const repairPath = buildRepairPath();
    const repairOpen = await openPath(repairPath, 'OPFS repair path');
    if (repairOpen.ok) {
      return {
        opfsAvailable: true,
        mode: 'opfs',
        activeDbPath: repairPath,
        corruptionDetected,
        corruptionMessage,
      };
    }

    await openMemory();
    persistenceError = errorMsg;
    return {
      opfsAvailable: false,
      mode: 'memory',
      activeDbPath: ':memory:',
      persistenceError,
      corruptionDetected,
      corruptionMessage,
    };
  }

  await openMemory();
  persistenceError = errorMsg;
  return {
    opfsAvailable: false,
    mode: 'memory',
    activeDbPath: ':memory:',
    persistenceError,
  };
}
