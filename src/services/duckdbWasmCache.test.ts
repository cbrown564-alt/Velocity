import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDuckDbCacheName,
  getDuckDbServiceWorkerUrl,
  prefetchDuckDbWasmAssets,
  probeDuckDbWasmCache,
  registerDuckDbWasmCache,
} from './duckdbWasmCache';

vi.mock('./duckdbBundles', () => ({
  getLocalDuckDbBundles: vi.fn(() => ({
    eh: {
      mainModule: '/duckdb-eh.wasm',
      mainWorker: '/duckdb-eh.worker.js',
      pthreadWorker: null,
    },
  })),
}));

describe('duckdbWasmCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds version-scoped cache and service worker URLs', () => {
    expect(getDuckDbCacheName()).toMatch(/^velocity-duckdb-wasm-v/);
    expect(getDuckDbServiceWorkerUrl()).toContain('/velocity-duckdb-sw.js?v=');
  });

  it('returns unsupported when Cache Storage is unavailable', async () => {
    const originalCaches = globalThis.caches;
    delete globalThis.caches;

    await expect(probeDuckDbWasmCache()).resolves.toBe('unsupported');
    await expect(prefetchDuckDbWasmAssets()).resolves.toBeUndefined();

    globalThis.caches = originalCaches;
  });

  it('returns null when service workers are unavailable', async () => {
    const originalNavigator = globalThis.navigator;
    // @ts-expect-error test shim
    globalThis.navigator = {};

    await expect(registerDuckDbWasmCache()).resolves.toBeNull();

    globalThis.navigator = originalNavigator;
  });

  it('reports cache miss when assets are not cached', async () => {
    const match = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue({ match });
    globalThis.caches = { open } as unknown as CacheStorage;

    await expect(probeDuckDbWasmCache()).resolves.toBe('miss');
    expect(open).toHaveBeenCalled();
  });
});
