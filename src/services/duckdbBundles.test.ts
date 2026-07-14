/**
 * Characterization tests for duckdbBundles.ts
 *
 * Tests pure URL-resolution logic that is runnable without WASM.
 * getLocalDuckDbBundles() and resolveDuckDbBundleUrls() are covered here.
 * WASM/Worker boot tests remain in duckDbArrow.test.ts (describe.skip).
 */

import { describe, it, expect } from 'vitest';
import {
  getLocalDuckDbBundles,
  resolveDuckDbBundleUrls,
  resolveDuckDbBundleVariant,
  selectBootBundle,
} from './duckdbBundles';

// ─── getLocalDuckDbBundles ────────────────────────────────────────────────────

describe('getLocalDuckDbBundles', () => {
  it('returns pilot-supported eh and coi bundles only (mvp removed)', () => {
    const bundles = getLocalDuckDbBundles();
    expect(bundles).toHaveProperty('eh');
    expect(bundles).toHaveProperty('coi');
    expect(bundles).not.toHaveProperty('mvp');
  });

  it.each(['eh', 'coi'] as const)('%s bundle has string mainModule URL', (key) => {
    const bundles = getLocalDuckDbBundles();
    expect(typeof bundles[key].mainModule).toBe('string');
    expect(bundles[key].mainModule.length).toBeGreaterThan(0);
  });

  it.each(['eh', 'coi'] as const)('%s bundle has string mainWorker URL', (key) => {
    const bundles = getLocalDuckDbBundles();
    expect(typeof bundles[key].mainWorker).toBe('string');
    expect(bundles[key].mainWorker.length).toBeGreaterThan(0);
  });

  it('coi bundle has a string pthreadWorker URL', () => {
    const bundles = getLocalDuckDbBundles();
    expect(typeof bundles.coi.pthreadWorker).toBe('string');
    expect((bundles.coi.pthreadWorker as string).length).toBeGreaterThan(0);
  });

  it('eh bundle declares a null pthreadWorker', () => {
    const bundles = getLocalDuckDbBundles();
    expect(bundles.eh.pthreadWorker).toBeNull();
  });

  it('resolveDuckDbBundleVariant identifies coi vs eh', () => {
    const bundles = getLocalDuckDbBundles();
    expect(resolveDuckDbBundleVariant(bundles.coi)).toBe('coi');
    expect(resolveDuckDbBundleVariant(bundles.eh)).toBe('eh');
  });

  it('returns a new object each call (no shared reference)', () => {
    const a = getLocalDuckDbBundles();
    const b = getLocalDuckDbBundles();
    expect(a).not.toBe(b);
  });
});

// ─── selectBootBundle ────────────────────────────────────────────────────────

describe('selectBootBundle', () => {
  it('forces the single-threaded EH bundle when OPFS DB persistence is enabled', async () => {
    // COI cannot reopen OPFS DBs (DataCloneError on the sync access handle), so
    // OPFS persistence must boot on EH.
    const bundles = getLocalDuckDbBundles();
    const selected = await selectBootBundle(bundles, true);
    expect(resolveDuckDbBundleVariant(selected)).toBe('eh');
    expect(selected.pthreadWorker).toBeNull();
  });
});

// ─── resolveDuckDbBundleUrls ─────────────────────────────────────────────────

describe('resolveDuckDbBundleUrls', () => {
  it('passes an absolute mainModule URL through unchanged', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: 'https://cdn.example.com/duckdb.wasm',
      mainWorker: 'https://cdn.example.com/duckdb.worker.js',
      pthreadWorker: null,
    });
    expect(result.mainModule).toBe('https://cdn.example.com/duckdb.wasm');
  });

  it('passes an absolute mainWorker URL through unchanged', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: 'https://cdn.example.com/duckdb.wasm',
      mainWorker: 'https://cdn.example.com/duckdb.worker.js',
      pthreadWorker: null,
    });
    expect(result.mainWorker).toBe('https://cdn.example.com/duckdb.worker.js');
  });

  it('passes an absolute pthreadWorker URL through unchanged', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: 'https://cdn.example.com/duckdb.wasm',
      mainWorker: 'https://cdn.example.com/duckdb.worker.js',
      pthreadWorker: 'https://cdn.example.com/duckdb.pthread.js',
    });
    expect(result.pthreadWorker).toBe('https://cdn.example.com/duckdb.pthread.js');
  });

  it('returns null when pthreadWorker is null', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: 'https://cdn.example.com/duckdb.wasm',
      mainWorker: 'https://cdn.example.com/duckdb.worker.js',
      pthreadWorker: null,
    });
    expect(result.pthreadWorker).toBeNull();
  });

  it('resolves relative mainModule paths into absolute URLs via origin', () => {
    // happy-dom exposes location.origin (http://localhost), so relative paths
    // should be resolved into full absolute URLs.
    const result = resolveDuckDbBundleUrls({
      mainModule: '/assets/duckdb.wasm',
      mainWorker: '/assets/duckdb.worker.js',
      pthreadWorker: null,
    });
    // After resolution the value must be a parseable absolute URL.
    expect(() => new URL(result.mainModule)).not.toThrow();
    expect(result.mainModule).toContain('/assets/duckdb.wasm');
  });

  it('resolves relative mainWorker paths into absolute URLs via origin', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: '/assets/duckdb.wasm',
      mainWorker: '/assets/duckdb.worker.js',
      pthreadWorker: null,
    });
    expect(() => new URL(result.mainWorker)).not.toThrow();
    expect(result.mainWorker).toContain('/assets/duckdb.worker.js');
  });

  it('resolves a relative pthreadWorker path into an absolute URL', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: 'https://cdn.example.com/duckdb.wasm',
      mainWorker: 'https://cdn.example.com/duckdb.worker.js',
      pthreadWorker: '/assets/pthread.worker.js',
    });
    expect(result.pthreadWorker).not.toBeNull();
    expect(() => new URL(result.pthreadWorker!)).not.toThrow();
    expect(result.pthreadWorker).toContain('/assets/pthread.worker.js');
  });

  it('output mainModule is always a string', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: 'https://cdn.example.com/duckdb.wasm',
      mainWorker: 'https://cdn.example.com/duckdb.worker.js',
      pthreadWorker: null,
    });
    expect(typeof result.mainModule).toBe('string');
  });

  it('output mainWorker is always a string', () => {
    const result = resolveDuckDbBundleUrls({
      mainModule: 'https://cdn.example.com/duckdb.wasm',
      mainWorker: 'https://cdn.example.com/duckdb.worker.js',
      pthreadWorker: null,
    });
    expect(typeof result.mainWorker).toBe('string');
  });
});
