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
    expect(result.decision).toBe('memory_fallback');
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
    expect(result.decision).toBe('cache_open');
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
    expect(result.decision).toBe('cache_open');
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
    expect(result.decision).toBe('disabled');
    expect(result.persistenceError).toBe('OPFS unsupported');
    expect(openMemory).toHaveBeenCalledTimes(1);
  });

  it('skips creating fresh DB when persisted source exists', async () => {
    const openPath = vi.fn(async (path: string) => {
      if (path === 'opfs://repair.db') return { ok: true };
      return { ok: false, error: 'failed' };
    });
    const openMemory = vi.fn(async () => undefined);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://desired.db',
      fallbackPath: null,
      hasPersistedSource: true,
      openPath,
      listCandidates: async () => [],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory,
    });

    expect(openPath).not.toHaveBeenCalledWith('opfs://desired.db', 'OPFS persistence (new)');
    expect(result.decision).toBe('rebuild');
  });

  it('returns rebuild decision on memory fallback when source exists', async () => {
    const openPath = vi.fn(async () => ({ ok: false, error: 'permission denied' }));
    const openMemory = vi.fn(async () => undefined);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://desired.db',
      fallbackPath: null,
      hasPersistedSource: true,
      openPath,
      listCandidates: async () => [],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory,
    });

    expect(result.decision).toBe('rebuild');
    expect(openMemory).toHaveBeenCalledTimes(1);
  });

  it('short-circuits to memory on a bundle-incompatible open error without cascading to repair', async () => {
    // COI reopen throws DataCloneError; further opens only wedge the worker, so
    // we must go straight to memory and not attempt the repair path.
    const openPath = vi.fn(async () => ({
      ok: false,
      error: "Failed to execute 'postMessage' on 'Worker': FileSystemSyncAccessHandle object could not be cloned.",
    }));
    const openMemory = vi.fn(async () => undefined);
    const buildRepairPath = vi.fn(() => 'opfs://repair.db');
    const releaseOpfsLock = vi.fn(() => undefined);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://a.db',
      fallbackPath: null,
      openPath,
      listCandidates: async () => [{ path: 'opfs://a.db' }],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath,
      openMemory,
      acquireOpfsLock: async () => true,
      releaseOpfsLock,
      dropOpenFiles: vi.fn(async () => undefined),
    });

    expect(result.mode).toBe('memory');
    expect(result.decision).toBe('memory_fallback');
    expect(openPath).toHaveBeenCalledTimes(1); // only the candidate; no repair attempt
    expect(buildRepairPath).not.toHaveBeenCalled();
    expect(openMemory).toHaveBeenCalledTimes(1);
    expect(releaseOpfsLock).toHaveBeenCalledTimes(1);
    expect(result.corruptionDetected).toBeUndefined();
  });

  it('boots in memory with opfs_locked and never opens an OPFS path when the lock is held elsewhere', async () => {
    const openPath = vi.fn(async () => ({ ok: true }));
    const openMemory = vi.fn(async () => undefined);
    const acquireOpfsLock = vi.fn(async () => false);
    const releaseOpfsLock = vi.fn(() => undefined);
    const listCandidates = vi.fn(async () => [{ path: 'opfs://default.db' }]);

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://desired.db',
      fallbackPath: 'opfs://default.db',
      openPath,
      listCandidates,
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory,
      acquireOpfsLock,
      releaseOpfsLock,
    });

    expect(result.decision).toBe('opfs_locked');
    expect(result.mode).toBe('memory');
    expect(result.opfsAvailable).toBe(false);
    expect(result.activeDbPath).toBe(':memory:');
    expect(acquireOpfsLock).toHaveBeenCalledTimes(1);
    expect(openMemory).toHaveBeenCalledTimes(1);
    // Critical: we must not touch any opfs:// file when we don't own the lock.
    expect(openPath).not.toHaveBeenCalled();
    expect(listCandidates).not.toHaveBeenCalled();
    // We never acquired ownership, so there is nothing to release.
    expect(releaseOpfsLock).not.toHaveBeenCalled();
  });

  it('releases OPFS file handles before each re-open attempt (handle-leak regression)', async () => {
    const events: string[] = [];
    const openPath = vi.fn(async (path: string) => {
      events.push(`open:${path}`);
      // First candidate opens but has no persisted data → must be discarded.
      // Second candidate has data → wins.
      return { ok: true };
    });
    const dropOpenFiles = vi.fn(async () => {
      events.push('dropFiles');
    });
    const resetBetweenAttempts = vi.fn(async () => {
      events.push('reset');
    });

    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://a.db',
      fallbackPath: null,
      openPath,
      listCandidates: async () => [{ path: 'opfs://a.db' }, { path: 'opfs://b.db' }],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory: vi.fn(async () => undefined),
      validateOpenedPath: async (path) => path === 'opfs://b.db',
      resetBetweenAttempts,
      dropOpenFiles,
    });

    expect(result.opfsAvailable).toBe(true);
    expect(result.activeDbPath).toBe('opfs://b.db');
    // The first (invalid) open must drop its handle *before* the second open,
    // and dropFiles must run before reset in each discard.
    expect(events).toEqual(['open:opfs://a.db', 'dropFiles', 'reset', 'open:opfs://b.db']);
    expect(dropOpenFiles).toHaveBeenCalledTimes(1);
  });

  it('releases the single-owner lock when every OPFS path fails and it falls back to memory', async () => {
    const releaseOpfsLock = vi.fn(() => undefined);
    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://bad.db',
      fallbackPath: null,
      openPath: vi.fn(async () => ({ ok: false, error: 'permission denied' })),
      listCandidates: async () => [{ path: 'opfs://bad.db' }],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory: vi.fn(async () => undefined),
      acquireOpfsLock: async () => true,
      releaseOpfsLock,
      dropOpenFiles: vi.fn(async () => undefined),
    });

    expect(result.mode).toBe('memory');
    expect(result.decision).toBe('memory_fallback');
    expect(releaseOpfsLock).toHaveBeenCalledTimes(1);
  });

  it('keeps the lock held (does not release) on a successful OPFS open', async () => {
    const releaseOpfsLock = vi.fn(() => undefined);
    const result = await initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://default.db',
      fallbackPath: null,
      openPath: vi.fn(async () => ({ ok: true })),
      listCandidates: async () => [{ path: 'opfs://default.db' }],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory: vi.fn(async () => undefined),
      acquireOpfsLock: async () => true,
      releaseOpfsLock,
      validateOpenedPath: async () => true,
    });

    expect(result.opfsAvailable).toBe(true);
    expect(result.decision).toBe('cache_open');
    expect(releaseOpfsLock).not.toHaveBeenCalled();
  });

  it('falls back to the next candidate when an OPFS open attempt times out', async () => {
    vi.useFakeTimers();

    const openPath = vi.fn(async (path: string) => {
      if (path === 'opfs://slow.db') {
        return new Promise<{ ok: boolean }>(() => undefined);
      }
      return { ok: true };
    });

    const initPromise = initOpfsPersistence({
      enableOpfs: true,
      opfsSupport: { supported: true },
      desiredPath: 'opfs://slow.db',
      fallbackPath: null,
      attemptTimeoutMs: 2000,
      openPath,
      listCandidates: async () => [{ path: 'opfs://slow.db' }, { path: 'opfs://fast.db' }],
      quarantine: vi.fn(async () => undefined),
      buildRepairPath: () => 'opfs://repair.db',
      openMemory: vi.fn(async () => undefined),
      validateOpenedPath: async (path) => path === 'opfs://fast.db',
      resetBetweenAttempts: vi.fn(async () => undefined),
    });

    await vi.advanceTimersByTimeAsync(2000);

    const result = await initPromise;

    expect(result.opfsAvailable).toBe(true);
    expect(result.activeDbPath).toBe('opfs://fast.db');
    expect(result.persistenceError).toContain('timed out');

    vi.useRealTimers();
  });
});
