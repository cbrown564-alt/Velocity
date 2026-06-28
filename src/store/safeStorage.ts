import type { StateStorage } from 'zustand/middleware';

const memoryStore = new Map<string, string>();

const memoryStorage: StateStorage = {
  getItem: (name) => memoryStore.get(name) ?? null,
  setItem: (name, value) => {
    memoryStore.set(name, value);
  },
  removeItem: (name) => {
    memoryStore.delete(name);
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: string; code?: number; message?: string };
  if (candidate.name === 'QuotaExceededError' || candidate.code === 22 || candidate.code === 1014) {
    return true;
  }
  return typeof candidate.message === 'string' && candidate.message.toLowerCase().includes('quota');
}

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value;
}

function compactVariablesPayload(variables: unknown): {
  value: unknown;
  changed: boolean;
  droppedLabelCount: number;
  droppedVariables: number;
} {
  if (!Array.isArray(variables)) {
    return { value: variables, changed: false, droppedLabelCount: 0, droppedVariables: 0 };
  }

  let changed = false;
  let droppedLabelCount = 0;
  let droppedVariables = 0;
  const compacted = variables.map((variable) => {
    if (!isRecord(variable)) return variable;

    const hasLabels = Array.isArray(variable.valueLabels) && variable.valueLabels.length > 0;
    const missingValues = variable.missingValues;
    const hasMissing = isRecord(missingValues) && Object.keys(missingValues).length > 0;

    if (!hasLabels && !hasMissing) return variable;

    changed = true;
    droppedVariables += 1;
    if (hasLabels) {
      droppedLabelCount += (variable.valueLabels as unknown[]).length;
    }
    return {
      ...variable,
      valueLabels: [],
      missingValues: {},
    };
  });

  return {
    value: changed ? compacted : variables,
    changed,
    droppedLabelCount,
    droppedVariables,
  };
}

function compactPersistedValue(rawValue: string): string | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.state)) return null;

    const nextState: Record<string, unknown> = { ...parsed.state };
    let changed = false;

    if (isRecord(nextState.dataset)) {
      const compactedDataset = compactVariablesPayload(nextState.dataset.variables);
      if (compactedDataset.changed) {
        nextState.dataset = {
          ...nextState.dataset,
          variables: compactedDataset.value,
          loadDiagnostics: {
            isPartial: true,
            reason: 'storage_quota',
            message:
              'Value labels were omitted from cached metadata due to browser storage limits. Rebuild from source to restore labels.',
            valueLabelsDropped: compactedDataset.droppedLabelCount,
            valueLabelsRetained: 0,
            createdAt: Date.now(),
          },
        };
        changed = true;
      }
    }

    if (isRecord(nextState.workspace) && Array.isArray(nextState.workspace.datasets)) {
      let datasetChanged = false;
      const compactedDatasets = nextState.workspace.datasets.map((datasetEntry) => {
        if (!isRecord(datasetEntry)) return datasetEntry;

        let nextDataset = datasetEntry;
        const compactedVars = compactVariablesPayload(datasetEntry.variables);
        if (compactedVars.changed) {
          nextDataset = {
            ...nextDataset,
            variables: compactedVars.value,
          };
          datasetChanged = true;
        }

        if (
          isRecord(nextDataset.sessionState) &&
          Array.isArray(nextDataset.sessionState.transformLog) &&
          nextDataset.sessionState.transformLog.length > 0
        ) {
          nextDataset = {
            ...nextDataset,
            sessionState: {
              ...nextDataset.sessionState,
              transformLog: [],
            },
          };
          datasetChanged = true;
        }

        return nextDataset;
      });

      if (datasetChanged) {
        nextState.workspace = {
          ...nextState.workspace,
          datasets: compactedDatasets,
        };
        changed = true;
      }
    }

    if (!changed) return null;
    return JSON.stringify({
      ...parsed,
      state: nextState,
    });
  } catch {
    return null;
  }
}

function isStorageLike(value: unknown): value is Storage {
  if (!value || typeof value !== 'object') return false;
  const storage = value as Partial<Storage>;
  return (
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function'
  );
}

function wrapStorage(storage: StateStorage): StateStorage {
  return {
    getItem: (name) => {
      try {
        const value = storage.getItem(name);
        if (typeof value === 'string') {
          memoryStore.set(name, value);
          return value;
        }
        if (isPromiseLike<string | null>(value)) {
          return value
            .then((resolved) => {
              if (typeof resolved === 'string') {
                memoryStore.set(name, resolved);
              }
              return resolved;
            })
            .catch(() => memoryStore.get(name) ?? null);
        }
        return value;
      } catch {
        return memoryStore.get(name) ?? null;
      }
    },
    setItem: (name, value) => {
      try {
        storage.setItem(name, value);
        memoryStore.set(name, value);
        return;
      } catch (error) {
        if (isQuotaExceededError(error)) {
          const compacted = compactPersistedValue(value);
          if (compacted) {
            try {
              storage.setItem(name, compacted);
              memoryStore.set(name, compacted);
              console.warn('[Persist] Quota exceeded; persisted compacted metadata payload.');
              return;
            } catch {
              // Fall through to non-fatal skip.
            }
          }
          memoryStore.set(name, value);
          console.warn('[Persist] Quota exceeded; skipping localStorage update to keep app running.');
          return;
        }

        memoryStore.set(name, value);
        console.warn('[Persist] Storage write failed; using in-memory fallback for this session.');
      }
    },
    removeItem: (name) => {
      memoryStore.delete(name);
      try {
        storage.removeItem(name);
      } catch {
        // Swallow remove failures to avoid crashing the app.
      }
    },
  };
}

export function getSafeLocalStorage(): StateStorage {
  try {
    if (typeof window !== 'undefined' && isStorageLike(window.localStorage)) {
      return wrapStorage(window.localStorage);
    }
  } catch {
    // Fall through to other candidates.
  }

  try {
    const candidate = (globalThis as { localStorage?: unknown }).localStorage;
    if (isStorageLike(candidate)) {
      return wrapStorage(candidate);
    }
  } catch {
    // Fall through to in-memory storage.
  }

  return wrapStorage(memoryStorage);
}
