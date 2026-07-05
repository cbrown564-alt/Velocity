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

declare global {
  interface Window {
    __velocityWarmUpEngine?: (source: string) => Promise<void>;
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

export async function warmUpEngineOnIntent(source: string): Promise<void> {
  if (warmUpPromise) return warmUpPromise;

  warmUpSource = source;
  markBootStart();
  recordEngineWarmupIntent(source);

  warmUpPromise = (async () => {
    const wasmCacheBefore = await probeDuckDbWasmCache();
    recordPilotEvent('wasm_cache_probe', {
      source,
      cacheState: wasmCacheBefore,
    });

    void registerDuckDbWasmCache();
    void prefetchDuckDbWasmAssets();

    const { useVelocityStore } = await import('../store');
    await useVelocityStore.getState().initWorker();
  })().catch((error) => {
    warmUpPromise = null;
    throw error;
  });

  return warmUpPromise;
}

export function exposeEngineWarmUpForTests(): void {
  if (typeof window === 'undefined') return;
  window.__velocityWarmUpEngine = warmUpEngineOnIntent;
}
