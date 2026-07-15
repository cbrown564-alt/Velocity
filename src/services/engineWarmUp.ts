/**
 * Intent-based analysis engine warm-up (Plan 06 Phase 4 — WP4.1).
 *
 * Defers DuckDB worker boot until the user shows first-run intent (landing CTA,
 * file picker, dataset open) so first paint is not blocked by the ~34 MB WASM
 * fetch. Returning sessions with persisted workspace data warm up immediately.
 */

import { STORAGE_KEY } from '../store/persistConfig';
import { prefetchDuckDbWasmAssets, probeDuckDbWasmCache, registerDuckDbWasmCache } from './duckdbWasmCache';
import { markBootStart, recordEngineWarmupIntent, recordPilotEvent } from './pilotOnboarding';
import { beginBootTrace, recordBootTrace } from './bootTrace';

declare global {
  interface Window {
    __velocityWarmUpEngine?: (source: string, persistenceMode?: 'auto' | 'memory') => Promise<void>;
  }
}

let warmUpPromise: Promise<void> | null = null;
let warmUpSource: string | null = null;

function readPersistedWorkspaceDatasetCount(): number {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { state?: { workspace?: { datasets?: unknown[] }; dataFingerprint?: unknown } };
    const datasets = parsed.state?.workspace?.datasets;
    if (Array.isArray(datasets) && datasets.length > 0) return datasets.length;
    return parsed.state?.dataFingerprint ? 1 : 0;
  } catch {
    return 0;
  }
}

export function shouldWarmEngineOnBoot(): boolean {
  return readPersistedWorkspaceDatasetCount() > 0;
}

export function getEngineWarmUpSource(): string | null {
  return warmUpSource;
}

/** Test-only reset for module-level warm-up state. */
export function resetEngineWarmUpForTests(): void {
  warmUpPromise = null;
  warmUpSource = null;
}

export async function warmUpEngineOnIntent(
  source: string,
  options: { persistenceMode?: 'auto' | 'memory' } = {},
): Promise<void> {
  if (warmUpPromise) return warmUpPromise;

  warmUpSource = source;
  const correlationId = beginBootTrace(source);
  markBootStart();
  recordEngineWarmupIntent(source);

  warmUpPromise = (async () => {
    recordBootTrace({ correlationId, source: 'main', phase: 'wasm_cache.probe', status: 'started' });
    const wasmCacheBefore = await probeDuckDbWasmCache();
    recordBootTrace({
      correlationId,
      source: 'main',
      phase: 'wasm_cache.probe',
      status: 'completed',
      detail: { cacheState: wasmCacheBefore },
    });
    recordPilotEvent('wasm_cache_probe', {
      source,
      cacheState: wasmCacheBefore,
    });

    recordBootTrace({ correlationId, source: 'main', phase: 'service_worker.register', status: 'started' });
    void registerDuckDbWasmCache().then((registration) => {
      recordBootTrace({
        correlationId,
        source: 'service-worker',
        phase: 'service_worker.register',
        status: 'completed',
        detail: { registered: Boolean(registration) },
      });
    });
    recordBootTrace({ correlationId, source: 'main', phase: 'wasm_cache.prefetch', status: 'started' });
    void prefetchDuckDbWasmAssets().then(() => {
      recordBootTrace({ correlationId, source: 'service-worker', phase: 'wasm_cache.prefetch', status: 'completed' });
    });

    recordBootTrace({ correlationId, source: 'main', phase: 'store.dynamic_import', status: 'started' });
    const { useVelocityStore } = await import('../store');
    recordBootTrace({ correlationId, source: 'main', phase: 'store.dynamic_import', status: 'completed' });
    await useVelocityStore.getState().initWorker({ persistenceMode: options.persistenceMode ?? 'auto' });
    const state = useVelocityStore.getState();
    if (state.engineStatus === 'error') throw new Error(state.initError || 'Engine failed to start');
    if (state.engineStatus === 'cancelled') throw new Error('Engine boot cancelled');
  })().catch((error) => {
    recordBootTrace({
      correlationId,
      source: 'main',
      phase: 'boot.terminal',
      status: error instanceof Error && error.message === 'Engine boot cancelled' ? 'cancelled' : 'error',
      detail: { message: error instanceof Error ? error.message : String(error) },
    });
    warmUpPromise = null;
    throw error;
  });

  return warmUpPromise;
}

export function exposeEngineWarmUpForTests(): void {
  if (typeof window === 'undefined') return;
  window.__velocityWarmUpEngine = (source, persistenceMode) => warmUpEngineOnIntent(source, { persistenceMode });
}
