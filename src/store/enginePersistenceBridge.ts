/**
 * Engine persistence bridge (STAB-ARCH-1 §8.3).
 *
 * Worker creation, EngineProxy wiring, and OPFS corruption/persistence callbacks.
 * Store slice init/respawn methods delegate here to keep dataSlice.ts thin.
 */

import { EngineProxy, type EngineProxyOptions } from '../services/EngineProxy';
import type { EngineResponseByType } from '../types/engineWorker';
import type { PersistenceState } from './slices/data/types';

type LoadProgressMessage = EngineResponseByType<'engine.loadProgress'>;
type LoadProgressCallback = (msg: LoadProgressMessage) => void;

export const ANALYSIS_WORKER_MODULE = new URL('../services/analysisWorker.ts', import.meta.url);

export function createAnalysisWorker(): Worker {
  return new Worker(ANALYSIS_WORKER_MODULE, { type: 'module' });
}

export interface EnginePersistenceStatusPatch {
  opfsAvailable: boolean;
  persistenceMode: 'opfs' | 'memory' | 'disabled';
  persistenceError: string | null;
  activeDbPath: string | null;
}

export interface EngineCorruptionPatch {
  persistenceState: 'corrupt';
  persistenceError: string;
  opfsAvailable: false;
  persistedDataInfo: null;
}

export interface EnginePersistenceBridge {
  applyPersistenceStatus: (patch: EnginePersistenceStatusPatch) => void;
  applyCorruption: (patch: EngineCorruptionPatch) => void;
}

export function createStorePersistenceBridge(
  set: (partial: EnginePersistenceStatusPatch | EngineCorruptionPatch) => void,
): EnginePersistenceBridge {
  return {
    applyPersistenceStatus: (patch) => {
      set({
        opfsAvailable: patch.opfsAvailable,
        persistenceMode: patch.persistenceMode,
        persistenceError: patch.persistenceError,
        activeDbPath: patch.activeDbPath,
      });
    },
    applyCorruption: (patch) => {
      set(patch);
    },
  };
}

type PersistenceStatusMessage = EngineResponseByType<'engine.persistenceStatus'>;
type CorruptionMessage = EngineResponseByType<'engine.corruptionDetected'>;

export function createEnginePersistenceCallbacks(
  bridge: EnginePersistenceBridge,
  options: { corruptionLogLabel?: string } = {},
): Pick<EngineProxyOptions, 'onPersistenceStatus' | 'onCorruption'> {
  const corruptionLogLabel = options.corruptionLogLabel ?? '';

  return {
    onPersistenceStatus: (msg: PersistenceStatusMessage) => {
      bridge.applyPersistenceStatus({
        opfsAvailable: msg.opfsAvailable,
        persistenceMode: msg.mode,
        persistenceError: msg.lastError ?? null,
        activeDbPath: msg.dbPath,
      });
    },
    onCorruption: (msg: CorruptionMessage) => {
      console.warn(
        `[enginePersistenceBridge] OPFS corruption detected${corruptionLogLabel}:`,
        msg.message,
      );
      bridge.applyCorruption({
        persistenceState: 'corrupt',
        persistenceError: msg.message || 'OPFS database corruption detected',
        opfsAvailable: false,
        persistedDataInfo: null,
      });
    },
  };
}

export function createEngineProxy(
  worker: Worker,
  bridge: EnginePersistenceBridge,
  options: { corruptionLogLabel?: string; onLoadProgress?: LoadProgressCallback } = {},
): EngineProxy {
  return new EngineProxy(worker, {
    ...createEnginePersistenceCallbacks(bridge, options),
    onProgress: options.onLoadProgress,
  });
}

export interface InitializeEngineContext {
  getExistingProxy: () => EngineProxy | null;
  getDatasetId: () => string | undefined;
  getOpfsAvailable: () => boolean;
  getPersistenceState: () => PersistenceState;
  bridge: EnginePersistenceBridge;
  setWorkerRuntimeError: (message: string) => void;
  assignEngineProxy: (proxy: EngineProxy) => void;
  setInitSuccess: (opfsAvailable: boolean) => void;
  setPersistenceReady: () => void;
  setInitError: (message: string) => void;
  checkPersistedData: () => Promise<void>;
  onLoadProgress?: LoadProgressCallback;
}

export async function initializeEngineWorker(ctx: InitializeEngineContext): Promise<void> {
  if (ctx.getExistingProxy()) {
    console.log('[enginePersistenceBridge] Engine already initialized, skipping duplicate init');
    return;
  }

  try {
    const worker = createAnalysisWorker();

    worker.onerror = (error) => {
      console.error('[enginePersistenceBridge] Worker runtime error:', error);
      ctx.setWorkerRuntimeError(error.message || 'Worker runtime error');
    };

    const proxy = createEngineProxy(worker, ctx.bridge, { onLoadProgress: ctx.onLoadProgress });

    ctx.assignEngineProxy(proxy);

    const datasetId = ctx.getDatasetId();
    const result = await proxy.init({ datasetId, schemaVersion: 1 });

    ctx.setInitSuccess(result.opfsAvailable);
    console.log(`[enginePersistenceBridge] Engine ready, OPFS available: ${result.opfsAvailable}`);

    if (ctx.getOpfsAvailable() && ctx.getPersistenceState() !== 'corrupt') {
      await ctx.checkPersistedData();
    } else {
      ctx.setPersistenceReady();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to initialize engine';
    console.error('[enginePersistenceBridge] Failed to init engine:', error);
    ctx.setInitError(message);
  }
}

export interface RespawnEngineContext {
  terminateWorker: () => void;
  getDatasetId: () => string | undefined;
  bridge: EnginePersistenceBridge;
  setEngineProxy: (proxy: EngineProxy) => void;
  setRespawnSuccess: (opfsAvailable: boolean) => void;
  setRespawnError: (message: string) => void;
  cleanStart?: boolean;
  datasetIdOverride?: string;
  onLoadProgress?: LoadProgressCallback;
}

const RESPAWN_TERMINATION_DELAY_MS = 100;

export async function respawnEngineWorker(ctx: RespawnEngineContext): Promise<void> {
  const cleanStart = ctx.cleanStart ?? false;
  console.log(`[enginePersistenceBridge] Respawning engine (cleanStart: ${cleanStart})`);

  ctx.terminateWorker();
  await new Promise((resolve) => setTimeout(resolve, RESPAWN_TERMINATION_DELAY_MS));

  try {
    const worker = createAnalysisWorker();
    const proxy = createEngineProxy(worker, ctx.bridge, {
      corruptionLogLabel: ' during respawn',
      onLoadProgress: ctx.onLoadProgress,
    });

    ctx.setEngineProxy(proxy);

    const datasetId = ctx.datasetIdOverride ?? ctx.getDatasetId();
    const result = await proxy.init({
      forceCleanStart: cleanStart,
      datasetId,
      schemaVersion: 1,
    });

    ctx.setRespawnSuccess(result.opfsAvailable);
    console.log(`[enginePersistenceBridge] Engine respawned, OPFS available: ${result.opfsAvailable}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to respawn engine';
    console.error('[enginePersistenceBridge] Failed to respawn engine:', error);
    ctx.setRespawnError(message);
  }
}
