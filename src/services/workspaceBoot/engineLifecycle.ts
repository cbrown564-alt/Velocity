/**
 * Engine lifecycle — worker creation, init dedupe, OPFS callbacks.
 */

import { EngineProxy, type EngineProxyOptions } from '../EngineProxy';
import { BrowserEngine } from '../../engine/BrowserEngine';
import type { EngineResponseByType } from '../../types/engineWorker';
import type { PersistenceState } from '../../store/slices/data/types';
import * as opfsFileManager from '../opfsFileManager';
import {
  markBootStart,
  recordEngineReady,
  recordOpfsDecision,
  recordPersistenceCorruption,
  type OpfsBootDecision,
} from '../pilotOnboarding';
import AnalysisWorker from '../analysisWorker?worker';
import { RESPAWN_TERMINATION_DELAY_MS } from './constants';

type LoadProgressMessage = EngineResponseByType<'engine.loadProgress'>;
type LoadProgressCallback = (msg: LoadProgressMessage) => void;

let initInFlight: Promise<void> | null = null;

export function createAnalysisWorker(): Worker {
  return new AnalysisWorker();
}

export function attachWorkerRuntimeHandlers(
  worker: Worker,
  setWorkerRuntimeError: (message: string) => void,
  logLabel = '',
): void {
  worker.onerror = (error) => {
    console.error(`[workspaceBoot] Worker runtime error${logLabel}:`, error);
    setWorkerRuntimeError(error.message || 'Worker runtime error');
  };
  worker.onmessageerror = (event) => {
    console.error(`[workspaceBoot] Worker messageerror${logLabel}:`, event);
    setWorkerRuntimeError('Worker message deserialization error');
  };
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
      recordOpfsDecision(msg.decision as OpfsBootDecision, {
        mode: msg.mode,
        dbPath: msg.dbPath,
        lastError: msg.lastError ?? null,
      });
    },
    onCorruption: (msg: CorruptionMessage) => {
      console.warn(`[workspaceBoot] OPFS corruption detected${corruptionLogLabel}:`, msg.message);
      recordPersistenceCorruption({
        message: msg.message || 'OPFS database corruption detected',
      });
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

export function createBrowserEngine(
  worker: Worker,
  bridge: EnginePersistenceBridge,
  options: { corruptionLogLabel?: string; onLoadProgress?: LoadProgressCallback } = {},
): BrowserEngine {
  return new BrowserEngine(createEngineProxy(worker, bridge, options));
}

export interface InitializeEngineContext {
  getExistingEngine: () => BrowserEngine | null;
  getDatasetId: () => string | undefined;
  getOpfsFileKey: () => string | undefined;
  getOpfsAvailable: () => boolean;
  getPersistenceState: () => PersistenceState;
  bridge: EnginePersistenceBridge;
  setWorkerRuntimeError: (message: string) => void;
  assignBrowserEngine: (engine: BrowserEngine) => void;
  setInitSuccess: (opfsAvailable: boolean) => void;
  setPersistenceReady: () => void;
  setInitError: (message: string) => void;
  checkPersistedData: () => Promise<void>;
  onLoadProgress?: LoadProgressCallback;
}

async function resolveHasPersistedSource(opfsFileKey: string | undefined): Promise<boolean> {
  if (!opfsFileKey) return false;
  try {
    return await opfsFileManager.fileExists(opfsFileKey);
  } catch {
    return false;
  }
}

async function runEngineInit(ctx: InitializeEngineContext): Promise<void> {
  markBootStart();
  const worker = createAnalysisWorker();
  attachWorkerRuntimeHandlers(worker, ctx.setWorkerRuntimeError);

  const engine = createBrowserEngine(worker, ctx.bridge, { onLoadProgress: ctx.onLoadProgress });
  ctx.assignBrowserEngine(engine);

  const datasetId = ctx.getDatasetId();
  const hasPersistedSource = await resolveHasPersistedSource(ctx.getOpfsFileKey());
  const result = await engine.init({ datasetId, schemaVersion: 1, hasPersistedSource });

  ctx.setInitSuccess(result.opfsAvailable);
  recordEngineReady({ opfsAvailable: result.opfsAvailable });
  console.log(`[workspaceBoot] Engine ready, OPFS available: ${result.opfsAvailable}`);

  if (ctx.getOpfsAvailable() && ctx.getPersistenceState() !== 'corrupt') {
    await ctx.checkPersistedData();
  } else {
    ctx.setPersistenceReady();
  }
}

export async function initializeEngineWorker(ctx: InitializeEngineContext): Promise<void> {
  if (ctx.getExistingEngine()) {
    console.log('[workspaceBoot] Engine already initialized, skipping duplicate init');
    return;
  }
  if (initInFlight) {
    await initInFlight;
    return;
  }

  initInFlight = (async () => {
    try {
      await runEngineInit(ctx);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to initialize engine';
      console.error('[workspaceBoot] Failed to init engine:', error);
      ctx.setInitError(message);
    }
  })().finally(() => {
    initInFlight = null;
  });

  await initInFlight;
}

export interface RespawnEngineContext {
  terminateWorker: () => void;
  getDatasetId: () => string | undefined;
  getOpfsFileKey: () => string | undefined;
  bridge: EnginePersistenceBridge;
  setBrowserEngine: (engine: BrowserEngine) => void;
  setRespawnSuccess: (opfsAvailable: boolean) => void;
  setRespawnError: (message: string) => void;
  setWorkerRuntimeError?: (message: string) => void;
  cleanStart?: boolean;
  datasetIdOverride?: string;
  onLoadProgress?: LoadProgressCallback;
}

export async function respawnEngineWorker(ctx: RespawnEngineContext): Promise<void> {
  const cleanStart = ctx.cleanStart ?? false;
  console.log(`[workspaceBoot] Respawning engine (cleanStart: ${cleanStart})`);

  ctx.terminateWorker();
  await new Promise((resolve) => setTimeout(resolve, RESPAWN_TERMINATION_DELAY_MS));

  try {
    const worker = createAnalysisWorker();
    if (ctx.setWorkerRuntimeError) {
      attachWorkerRuntimeHandlers(worker, ctx.setWorkerRuntimeError, ' during respawn');
    }

    const engine = createBrowserEngine(worker, ctx.bridge, {
      corruptionLogLabel: ' during respawn',
      onLoadProgress: ctx.onLoadProgress,
    });

    ctx.setBrowserEngine(engine);

    const datasetId = ctx.datasetIdOverride ?? ctx.getDatasetId();
    const hasPersistedSource = await resolveHasPersistedSource(ctx.getOpfsFileKey());
    const result = await engine.init({
      forceCleanStart: cleanStart,
      datasetId,
      schemaVersion: 1,
      hasPersistedSource,
    });

    ctx.setRespawnSuccess(result.opfsAvailable);
    console.log(`[workspaceBoot] Engine respawned, OPFS available: ${result.opfsAvailable}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to respawn engine';
    console.error('[workspaceBoot] Failed to respawn engine:', error);
    ctx.setRespawnError(message);
  }
}

export function resetEngineInitDedupeForTests(): void {
  initInFlight = null;
}
