import { describe, it, expect, vi } from 'vitest';
import { initOpfsPersistence } from './opfsPersistence';

describe('initOpfsPersistence', () => {
  it('falls back to memory and flags corruption when repair fails', async () => {
    const openPath = vi.fn(async () => ({
      ok: false,
      error: 'The file "opfs://bad.db" exists, but it is not a valid DuckDB database file!'
    }));
    const openMemory = vi.fn(async () => undefined);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://bad.db',
      fallbackPath: 'opfs://default.db',
      openPath,
      listCandidates: async () => [],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory,
    });

    expect(result.mode).toBe('memory');
    expect(result.opfsAvailable).toBe(false);
    expect(result.activeDbPath).toBe(':memory:');
    expect(result.corruptionDetected).toBe(true);
    expect(result.persistenceError).toContain('not a valid DuckDB database file');
    expect(openMemory).toHaveBeenCalledTimes(1);
  });

  it('recovers by opening a candidate DB after corruption', async () => {
    const openPath = vi.fn(async (path: string) => {
      if (path === 'opfs://candidate.db') return { ok: true };
      return {
        ok: false,
        error: 'not a valid DuckDB database file'
      };
    });
    const openMemory = vi.fn(async () => undefined);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://bad.db',
      fallbackPath: 'opfs://default.db',
      openPath,
      listCandidates: async () => [{ path: 'opfs://candidate.db' }],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory,
    });

    expect(result.opfsAvailable).toBe(true);
    expect(result.mode).toBe('opfs');
    expect(result.activeDbPath).toBe('opfs://candidate.db');
    expect(result.corruptionDetected).toBe(true);
    expect(openMemory).not.toHaveBeenCalled();
  });

  it('falls back to memory on non-corruption errors', async () => {
    const openPath = vi.fn(async () => ({
      ok: false,
      error: 'permission denied'
    }));
    const openMemory = vi.fn(async () => undefined);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://bad.db',
      fallbackPath: null,
      openPath,
      listCandidates: async () => [],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory,
    });

    expect(result.opfsAvailable).toBe(false);
    expect(result.mode).toBe('memory');
    expect(result.corruptionDetected).toBeUndefined();
    expect(result.persistenceError).toBe('permission denied');
    expect(openMemory).toHaveBeenCalledTimes(1);
  });

  it('disables OPFS when unsupported', async () => {
    const openMemory = vi.fn(async () => undefined);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: false, error: 'OPFS unsupported' },
      desiredPath: 'opfs://bad.db',
      fallbackPath: null,
      openPath: vi.fn(async () => ({ ok: false, error: 'nope' })),
      listCandidates: async () => [],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory,
    });

    expect(result.opfsAvailable).toBe(false);
    expect(result.mode).toBe('disabled');
    expect(result.activeDbPath).toBe(':memory:');
    expect(result.persistenceError).toBe('OPFS unsupported');
    expect(openMemory).toHaveBeenCalledTimes(1);
  });
});
