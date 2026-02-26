import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSafeLocalStorage } from './safeStorage';

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function installStorageMock(storage: StorageMock): void {
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

describe('safeStorage', () => {
  const originalWindowStorage = window.localStorage;
  const originalGlobalStorage = (globalThis as { localStorage?: Storage }).localStorage;

  beforeEach(() => {
    // No-op; each test installs its own storage mock.
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { value: originalWindowStorage, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: originalGlobalStorage, configurable: true });
  });

  it('swallows quota errors and retries with compacted persisted payload', () => {
    let writeCount = 0;
    let persisted: string | null = null;

    const storageMock: StorageMock = {
      getItem: () => persisted,
      setItem: (_key, value) => {
        writeCount += 1;
        if (writeCount === 1) {
          const error = new Error('The quota has been exceeded.');
          (error as Error & { name?: string }).name = 'QuotaExceededError';
          throw error;
        }
        persisted = value;
      },
      removeItem: () => {
        persisted = null;
      },
    };

    installStorageMock(storageMock);
    const storage = getSafeLocalStorage();

    const rawPayload = JSON.stringify({
      state: {
        dataset: {
          id: 'ds1',
          name: 'test.sav',
          rowCount: 10,
          source: 'sav',
          variables: [
            {
              id: 'v1',
              name: 'v1',
              label: 'Var 1',
              type: 'categorical',
              valueLabels: [{ value: 1, label: 'Yes' }],
              missingValues: { discrete: [99] },
            },
          ],
        },
        workspace: {
          datasets: [
            {
              id: 'ds1',
              sessionState: {
                tableConfig: { rowVars: [], colVar: null },
                activeFilters: [],
                transformLog: [{ type: 'recode' }],
              },
              variables: [
                {
                  id: 'v1',
                  name: 'v1',
                  label: 'Var 1',
                  type: 'categorical',
                  valueLabels: [{ value: 1, label: 'Yes' }],
                  missingValues: { discrete: [99] },
                },
              ],
            },
          ],
        },
      },
      version: 1,
    });

    expect(() => storage.setItem('velocity-state', rawPayload)).not.toThrow();
    expect(writeCount).toBe(2);

    const compacted = JSON.parse(persisted || '{}');
    expect(compacted.state.dataset.variables[0].valueLabels).toEqual([]);
    expect(compacted.state.dataset.variables[0].missingValues).toEqual({});
    expect(compacted.state.dataset.loadDiagnostics?.reason).toBe('storage_quota');
    expect(compacted.state.workspace.datasets[0].variables[0].valueLabels).toEqual([]);
    expect(compacted.state.workspace.datasets[0].sessionState.transformLog).toEqual([]);
  });

  it('falls back to in-memory storage when localStorage writes always fail', () => {
    const storageMock: StorageMock = {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => {
        const error = new Error('The quota has been exceeded.');
        (error as Error & { name?: string }).name = 'QuotaExceededError';
        throw error;
      },
      removeItem: () => {
        throw new Error('storage unavailable');
      },
    };

    installStorageMock(storageMock);
    const storage = getSafeLocalStorage();

    expect(() => storage.setItem('velocity-state', '{"state":{"dataset":null},"version":1}')).not.toThrow();
    expect(storage.getItem('velocity-state')).toBe('{"state":{"dataset":null},"version":1}');
  });
});
