import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetOpfsDbLockForTests, acquireOpfsDbLock, isOpfsDbLockHeld, releaseOpfsDbLock } from './opfsDbLock';

/** Minimal Web Locks fake: models exclusive ownership + ifAvailable semantics. */
class FakeLockManager {
  private held = new Set<string>();

  request(
    name: string,
    options: { mode?: string; ifAvailable?: boolean },
    callback: (lock: unknown) => Promise<void> | void,
  ): Promise<unknown> {
    if (options.ifAvailable && this.held.has(name)) {
      // Lock unavailable → per spec the callback runs with null.
      return Promise.resolve(callback(null));
    }
    this.held.add(name);
    const holding = callback({ name, mode: options.mode });
    return Promise.resolve(holding).then(() => {
      this.held.delete(name);
    });
  }

  isHeld(name = 'velocity:opfs-db'): boolean {
    return this.held.has(name);
  }
}

afterEach(() => {
  releaseOpfsDbLock();
  __resetOpfsDbLockForTests();
  vi.unstubAllGlobals();
});

describe('opfsDbLock', () => {
  it('returns true (best-effort) when the Web Locks API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    expect(await acquireOpfsDbLock()).toBe(true);
    // No real lock was taken, so nothing is "held" to release.
    expect(isOpfsDbLockHeld()).toBe(false);
  });

  it('acquires and holds an exclusive lock, then releases it', async () => {
    const locks = new FakeLockManager();
    vi.stubGlobal('navigator', { locks });

    expect(await acquireOpfsDbLock()).toBe(true);
    expect(isOpfsDbLockHeld()).toBe(true);
    expect(locks.isHeld()).toBe(true);

    releaseOpfsDbLock();
    expect(isOpfsDbLockHeld()).toBe(false);
    // Let the held promise settle so the fake frees the name.
    await Promise.resolve();
    expect(locks.isHeld()).toBe(false);
  });

  it('returns false when another context already holds the lock', async () => {
    const locks = new FakeLockManager();
    vi.stubGlobal('navigator', { locks });

    // Simulate another tab owning the lock: take it, hold it open.
    void locks.request('velocity:opfs-db', { mode: 'exclusive' }, () => new Promise<void>(() => undefined));
    expect(locks.isHeld()).toBe(true);

    expect(await acquireOpfsDbLock()).toBe(false);
    expect(isOpfsDbLockHeld()).toBe(false);
  });

  it('is idempotent while held and re-acquirable after release', async () => {
    const locks = new FakeLockManager();
    vi.stubGlobal('navigator', { locks });
    const requestSpy = vi.spyOn(locks, 'request');

    expect(await acquireOpfsDbLock()).toBe(true);
    expect(await acquireOpfsDbLock()).toBe(true); // no second request while held
    expect(requestSpy).toHaveBeenCalledTimes(1);

    releaseOpfsDbLock();
    await Promise.resolve();

    expect(await acquireOpfsDbLock()).toBe(true);
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });
});
