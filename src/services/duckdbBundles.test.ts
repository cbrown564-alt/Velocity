import { describe, expect, it } from 'vitest';
import {
  getLocalDuckDbBundles,
  resolveDuckDbBundleUrls,
  resolveDuckDbBundleVariant,
  selectBootBundle,
} from './duckdbBundles';

describe('DuckDB bundles', () => {
  it('provides the supported variants with their required workers', () => {
    const bundles = getLocalDuckDbBundles();
    expect(Object.keys(bundles).sort()).toEqual(['coi', 'eh']);
    expect(bundles.eh.mainModule).toBeTruthy();
    expect(bundles.eh.mainWorker).toBeTruthy();
    expect(bundles.eh.pthreadWorker).toBeNull();
    expect(bundles.coi.mainModule).toBeTruthy();
    expect(bundles.coi.mainWorker).toBeTruthy();
    expect(bundles.coi.pthreadWorker).toBeTruthy();
    expect(resolveDuckDbBundleVariant(bundles.eh)).toBe('eh');
    expect(resolveDuckDbBundleVariant(bundles.coi)).toBe('coi');
  });

  it('boots the single-threaded variant when OPFS persistence is enabled', async () => {
    const selected = await selectBootBundle(getLocalDuckDbBundles(), true);
    expect(resolveDuckDbBundleVariant(selected)).toBe('eh');
  });

  it('preserves absolute URLs and null workers', () => {
    const bundle = {
      mainModule: 'https://cdn.example.com/duckdb.wasm',
      mainWorker: 'https://cdn.example.com/duckdb.worker.js',
      pthreadWorker: null,
    };
    expect(resolveDuckDbBundleUrls(bundle)).toEqual(bundle);
  });

  it('resolves relative module and worker paths to absolute URLs', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: '/assets/duckdb.wasm',
      mainWorker: '/assets/duckdb.worker.js',
      pthreadWorker: '/assets/pthread.worker.js',
    });
    expect(new URL(result.mainModule).pathname).toBe('/assets/duckdb.wasm');
    expect(new URL(result.mainWorker).pathname).toBe('/assets/duckdb.worker.js');
    expect(new URL(result.pthreadWorker!).pathname).toBe('/assets/pthread.worker.js');
  });
});
