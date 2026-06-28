import { describe, it, expect, vi } from 'vitest';
import { initOpfsPersistence } from './opfsPersistence';

describe('initOpfsPersistence', () => {
  it('falls back to memory and flags corruption when repair fails', async () => {
    const openPath = vi.fn(async () => ({
      ok: false,
      error: 'The file "opfs://bad.db" exists, but it is not a valid DuckDB database file!',
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
        error: 'not a valid DuckDB database file',
      };
    });
    const openMemory = vi.fn(async () => undefined);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://bad.db',
      fallbackPath: 'opfs://default.db',
      openPath,
      listCandidates: async () => [{ path: 'opfs://bad.db' }, { path: 'opfs://candidate.db' }],
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

  it('treats dictionary-scan failures as corruption', async () => {
    const quarantine = vi.fn(async () => undefined);
    const openPath = vi.fn(async () => ({
      ok: false,
      error:
        'IO Error: Failed to scan dictionary string - index was out of range. Database file appears to be corrupted.',
    }));

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://bad.db',
      fallbackPath: null,
      openPath,
      listCandidates: async () => [{ path: 'opfs://bad.db' }],
      quarantine,
      buildRepairPath: () => 'opfs://repair.db',
      openMemory: vi.fn(async () => undefined),
    });

    expect(result.corruptionDetected).toBe(true);
    expect(quarantine).toHaveBeenCalledWith('opfs://bad.db');
  });

  it('prefers existing fallback DB when desired DB does not exist', async () => {
    const openPath = vi.fn(async (path: string) => {
      if (path === 'opfs://default.db') return { ok: true };
      return { ok: true };
    });

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://dataset.db',
      fallbackPath: 'opfs://default.db',
      openPath,
      listCandidates: async () => [{ path: 'opfs://default.db' }],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory: vi.fn(async () => undefined),
      validateOpenedPath: async (path) => path === 'opfs://default.db',
    });

    expect(result.opfsAvailable).toBe(true);
    expect(result.activeDbPath).toBe('opfs://default.db');
    expect(openPath).toHaveBeenCalledWith('opfs://default.db', expect.any(String));
    expect(openPath).not.toHaveBeenCalledWith('opfs://dataset.db', expect.any(String));
  });

  it('skips empty desired DB when another candidate has persisted data', async () => {
    const openPath = vi.fn(async () => ({ ok: true }));

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://desired.db',
      fallbackPath: 'opfs://fallback.db',
      openPath,
      listCandidates: async () => [{ path: 'opfs://desired.db' }, { path: 'opfs://fallback.db' }],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory: vi.fn(async () => undefined),
      validateOpenedPath: async (path) => path === 'opfs://fallback.db',
      resetBetweenAttempts: vi.fn(async () => undefined),
    });

    expect(result.opfsAvailable).toBe(true);
    expect(result.activeDbPath).toBe('opfs://fallback.db');
  });

  it('falls back to memory on non-corruption errors', async () => {
    const openPath = vi.fn(async () => ({
      ok: false,
      error: 'permission denied',
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
