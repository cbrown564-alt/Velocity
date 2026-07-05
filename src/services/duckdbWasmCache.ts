/**
 * DuckDB-WASM Cache Storage integration (Plan 06 Phase 4 — WP4.1).
 *
 * Registers a narrow service worker that caches only DuckDB wasm/worker assets
 * under a versioned cache name so the ~34 MB fetch happens once per release.
 */

import { getLocalDuckDbBundles } from './duckdbBundles';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

export function getDuckDbCacheName(): string {
  return `velocity-duckdb-wasm-v${APP_VERSION}`;
}

export function getDuckDbServiceWorkerUrl(): string {
  return `/velocity-duckdb-sw.js?v=${encodeURIComponent(APP_VERSION)}`;
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function registerDuckDbWasmCache(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(getDuckDbServiceWorkerUrl(), { scope: '/' })
      .then((registration) => {
        if (import.meta.env.DEV) {
          console.log('[duckdbWasmCache] Service worker registered', getDuckDbCacheName());
        }
        return registration;
      })
      .catch((error) => {
        console.warn('[duckdbWasmCache] Service worker registration failed:', error);
        registrationPromise = null;
        return null;
      });
  }

  return registrationPromise;
}

function collectDuckDbAssetUrls(): string[] {
  const bundles = getLocalDuckDbBundles();
  const urls = new Set<string>();

  for (const bundle of Object.values(bundles)) {
    if (bundle.mainModule) urls.add(bundle.mainModule);
    if (bundle.mainWorker) urls.add(bundle.mainWorker);
    if (bundle.pthreadWorker) urls.add(bundle.pthreadWorker);
  }

  return [...urls];
}

export async function probeDuckDbWasmCache(): Promise<'hit' | 'miss' | 'unsupported'> {
  if (typeof caches === 'undefined') return 'unsupported';

  try {
    const cache = await caches.open(getDuckDbCacheName());
    const urls = collectDuckDbAssetUrls();
    if (urls.length === 0) return 'miss';

    const hits = await Promise.all(
      urls.map(async (url) => {
        const response = await cache.match(new URL(url, window.location.origin).toString());
        return Boolean(response);
      }),
    );

    return hits.every(Boolean) ? 'hit' : 'miss';
  } catch {
    return 'unsupported';
  }
}

/** Best-effort prefetch so the first worker boot can be served from Cache Storage. */
export async function prefetchDuckDbWasmAssets(): Promise<void> {
  if (typeof caches === 'undefined') return;

  await registerDuckDbWasmCache();

  try {
    const cache = await caches.open(getDuckDbCacheName());
    const urls = collectDuckDbAssetUrls();

    await Promise.all(
      urls.map(async (url) => {
        const absolute = new URL(url, window.location.origin).toString();
        const existing = await cache.match(absolute);
        if (existing) return;

        const response = await fetch(absolute);
        if (response.ok) {
          await cache.put(absolute, response.clone());
        }
      }),
    );
  } catch (error) {
    console.warn('[duckdbWasmCache] Prefetch failed:', error);
  }
}
