/**
 * Single-owner OPFS database lock (Layer 2 of the OPFS reliability refactor).
 *
 * OPFS `FileSystemSyncAccessHandle`s are exclusive *per file across the whole
 * origin* — every browser tab and every worker shares the same handle space.
 * When a second context reaches for a DB file that another already owns,
 * DuckDB-WASM throws:
 *
 *   "Access Handles cannot be created if there is another open Access Handle
 *    or Writable stream associated with the same file."
 *
 * We serialize ownership with the Web Locks API. The worker that boots the OPFS
 * database acquires an origin-scoped exclusive lock and holds it for the entire
 * DB session. A second tab/worker that cannot get the lock boots cleanly in
 * memory mode (decision: `opfs_locked`) instead of colliding on the handle and
 * collapsing the whole persistence path.
 *
 * The lock is held via a promise that stays pending until `releaseOpfsDbLock()`
 * is called. The browser also releases locks held by a destroyed context, so a
 * terminated worker never strands the lock.
 */

const OPFS_DB_LOCK_NAME = 'velocity:opfs-db';

/** Resolver for the pending "hold" promise; non-null iff this context owns the lock. */
let releaseHeldLock: (() => void) | null = null;

type MinimalLockManager = {
  request: (
    name: string,
    options: { mode?: 'exclusive' | 'shared'; ifAvailable?: boolean },
    callback: (lock: unknown) => Promise<void> | void,
  ) => Promise<unknown>;
};

function getLockManager(): MinimalLockManager | null {
  if (typeof navigator === 'undefined') return null;
  const locks = (navigator as unknown as { locks?: MinimalLockManager }).locks;
  return locks && typeof locks.request === 'function' ? locks : null;
}

/**
 * Try to acquire the exclusive OPFS DB lock without blocking.
 *
 * Resolves `true` when this context now owns the lock (held until release), or
 * when Web Locks are unavailable — in which case we allow a best-effort open so
 * behavior degrades to the pre-lock path rather than disabling OPFS entirely.
 * Resolves `false` only when another live context already holds the lock.
 */
export async function acquireOpfsDbLock(name: string = OPFS_DB_LOCK_NAME): Promise<boolean> {
  if (releaseHeldLock) return true; // already owned by this context (idempotent)

  const locks = getLockManager();
  if (!locks) return true; // no Web Locks API → cannot coordinate; allow best-effort open

  return new Promise<boolean>((resolveAcquired) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolveAcquired(value);
    };

    locks
      .request(name, { mode: 'exclusive', ifAvailable: true }, (lock) => {
        // Per spec, `ifAvailable` invokes the callback with `null` when the
        // lock is already held elsewhere.
        if (!lock) {
          settle(false);
          return; // returning resolves request() immediately, releasing nothing
        }
        settle(true);
        // Keep the lock granted until releaseOpfsDbLock() is invoked.
        return new Promise<void>((release) => {
          releaseHeldLock = () => {
            releaseHeldLock = null;
            release();
          };
        });
      })
      .catch(() => {
        // A lock-API failure should not disable OPFS; fall back to best-effort.
        settle(true);
      });
  });
}

/** Release the held OPFS DB lock, if any. Safe to call when nothing is held. */
export function releaseOpfsDbLock(): void {
  releaseHeldLock?.();
}

/** Whether this context currently owns the OPFS DB lock. */
export function isOpfsDbLockHeld(): boolean {
  return releaseHeldLock !== null;
}

/** Test-only: clear held-lock state between cases. */
export function __resetOpfsDbLockForTests(): void {
  releaseHeldLock = null;
}
