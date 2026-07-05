/**
 * Version-scoped Cache Storage for DuckDB-WASM assets (~34 MB).
 * Registered from the main thread with ?v=<appVersion> so each release gets
 * a fresh cache namespace and old caches are purged on activate.
 */
const swUrl = new URL(self.location.href);
const CACHE_VERSION = swUrl.searchParams.get('v') || 'dev';
const CACHE_NAME = `velocity-duckdb-wasm-v${CACHE_VERSION}`;

function isDuckDbAsset(url) {
  try {
    const { pathname } = new URL(url);
    if (!pathname.includes('/assets/')) return false;
    if (!pathname.includes('duckdb')) return false;
    return pathname.endsWith('.wasm') || pathname.includes('duckdb-browser');
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('velocity-duckdb-wasm-v') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!isDuckDbAsset(event.request.url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(event.request, response.clone());
      }
      return response;
    }),
  );
});
