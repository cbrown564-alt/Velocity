/**
 * Engine lifecycle — worker creation, init dedupe, OPFS callbacks.
 */

import { EngineProxy, type EngineProxyOptions } from '../EngineProxy';
import { BrowserEngine } from '../../engine/BrowserEngine';
import type { EngineResponseByType } from '../../types/engineWorker';
import type { PersistenceState } from '../../store/slices/data/types';
import * as opfsFileManager from '../opfsFileManager';
import { getEngineWarmUpSource } from '../engineWarmUp';
import { probeDuckDbWasmCache } from '../duckdbWasmCache';
import { getBootTraceCorrelationId, recordBootTrace } from '../bootTrace';
import {
  markBootStart,
  recordEngineReady,
  recordOpfsDecision,
  recordPersistenceCorruption,
  type OpfsBootDecision,
} from '../pilotOnboarding';
import AnalysisWorker from '../analysisWorker?worker';
import { ENGINE_BOOT_TIMEOUT_MS, ENGINE_SHUTDOWN_ACK_TIMEOUT_MS } from './constants';

type LoadProgressMessage = EngineResponseByType<'engine.loadProgress'>;
type LoadProgressCallback = (msg: LoadProgressMessage) => void;

/**
 * Single serialized lifecycle queue. Every worker lifecycle transition — init,
 * respawn, shutdown — runs through this chain so two workers can never be live
 * at once (warm-up racing a respawn, StrictMode double-mount, dataset switch
 * mid-boot). Combined with the per-worker OPFS lock, this is the ownership
 * guarantee that keeps the DB file single-owner.
 */
let lifecycleChain: Promise<unknown> = Promise.resolve();

function runExclusive<T>(op: () => Promise<T>): Promise<T> {
  const run = lifecycleChain.then(op, op);
  // Keep the chain alive regardless of this op's outcome so one failure does
  // not deadlock later transitions.
  lifecycleChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Init-specific dedupe: collapse concurrent boot requests onto one worker. */
let initInFlight: Promise<void> | null = null;

class EngineBootCancelledError extends Error {
  constructor() {
    super('Engine boot cancelled');
    this.name = 'EngineBootCancelledError';
  }
}

let activeBoot: {
  engine: BrowserEngine;
  cancelled: boolean;
  rejectCancellation: (error: Error) => void;
} | null = null;

export function createAnalysisWorker(): Worker {
  const worker = new AnalysisWorker();
  recordBootTrace({ source: 'main', phase: 'analysis_worker.created', status: 'completed' });
  return worker;
}

export function attachWorkerRuntimeHandlers(
  worker: Worker,
  setWorkerRuntimeError: (message: string) => void,
  logLabel = '',
): void {
  worker.onerror = (error) => {
    console.error(`[workspaceBoot] Worker runtime error${logLabel}:`, error);
    recordBootTrace({
      source: 'main',
      phase: 'analysis_worker.runtime',
      status: 'error',
      detail: { message: error.message || 'Worker runtime error' },
    });
    setWorkerRuntimeError(error.message || 'Worker runtime error');
  };
  worker.onmessageerror = (event) => {
    console.error(`[workspaceBoot] Worker messageerror${logLabel}:`, event);
    recordBootTrace({
      source: 'main',
      phase: 'analysis_worker.message',
      status: 'error',
      detail: { message: 'Worker message deserialization error' },
    });
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
      if (msg.decision === 'memory_fallback' || msg.mode === 'memory') {
        recordBootTrace({
          source: 'main',
          phase: 'persistence.memory_fallback',
          status: 'fallback',
          detail: { decision: msg.decision, message: msg.lastError ?? null },
        });
      }
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
    timeoutMs: ENGINE_BOOT_TIMEOUT_MS,
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
  setInitCancelled?: () => void;
  checkPersistedData: () => Promise<void>;
  onLoadProgress?: LoadProgressCallback;
  persistenceMode?: 'auto' | 'memory';
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

  let rejectCancellation!: (error: Error) => void;
  const cancellation = new Promise<never>((_, reject) => {
    rejectCancellation = reject;
  });
  const boot = { engine, cancelled: false, rejectCancellation };
  activeBoot = boot;

  try {
    const datasetId = ctx.getDatasetId();
    const hasPersistedSource = await resolveHasPersistedSource(ctx.getOpfsFileKey());
    const correlationId = getBootTraceCorrelationId();
    recordBootTrace({ source: 'main', phase: 'engine.init.sent', status: 'completed', correlationId });
    const result = await Promise.race([
      engine.init({
        datasetId,
        schemaVersion: 1,
        hasPersistedSource,
        bootCorrelationId: correlationId,
        persistenceMode: ctx.persistenceMode ?? 'auto',
      }),
      cancellation,
    ]);
    recordBootTrace({ source: 'main', phase: 'engine.ready.received', status: 'completed', correlationId });

    ctx.setInitSuccess(result.opfsAvailable);
    const wasmCacheAfter = await probeDuckDbWasmCache();
    recordEngineReady({
      opfsAvailable: result.opfsAvailable,
      warmUpSource: getEngineWarmUpSource(),
      duckdbBundle: result.duckdbBundle,
      wasmCacheState: wasmCacheAfter,
    });
    console.log(`[workspaceBoot] Engine ready, OPFS available: ${result.opfsAvailable}`);

    if (ctx.getOpfsAvailable() && ctx.getPersistenceState() !== 'corrupt') {
      await ctx.checkPersistedData();
    } else {
      ctx.setPersistenceReady();
    }
    recordBootTrace({ source: 'main', phase: 'boot.terminal', status: 'completed', correlationId });
  } catch (error) {
    if (!(error instanceof EngineBootCancelledError)) engine.terminate();
    throw error;
  } finally {
    if (activeBoot === boot) activeBoot = null;
  }
}

/** Cancel the current end-to-end boot. The abandoned worker is hard-terminated. */
export function cancelEngineBoot(): boolean {
  if (!activeBoot || activeBoot.cancelled) return false;
  activeBoot.cancelled = true;
  activeBoot.engine.terminate();
  activeBoot.rejectCancellation(new EngineBootCancelledError());
  recordBootTrace({ source: 'main', phase: 'boot.terminal', status: 'cancelled' });
  return true;
}

export async function initializeEngineWorker(ctx: InitializeEngineContext): Promise<void> {
  if (initInFlight) {
    await initInFlight;
    return;
  }
  if (ctx.getExistingEngine()) {
    console.log('[workspaceBoot] Engine already initialized, skipping duplicate init');
    return;
  }

  initInFlight = runExclusive(async () => {
    // Re-check inside the exclusive section: a queued respawn/init may have
    // created (or torn down) the engine while we waited for the lock.
    if (ctx.getExistingEngine()) {
      console.log('[workspaceBoot] Engine already initialized, skipping duplicate init');
      return;
    }
    try {
      await runEngineInit(ctx);
    } catch (error: unknown) {
      if (error instanceof EngineBootCancelledError) {
        ctx.setInitCancelled?.();
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to initialize engine';
      console.error('[workspaceBoot] Failed to init engine:', error);
      recordBootTrace({ source: 'main', phase: 'boot.terminal', status: 'error', detail: { message } });
      ctx.setInitError(message);
    }
  }).finally(() => {
    initInFlight = null;
  });

  await initInFlight;
}

export interface RespawnEngineContext {
  /** Current engine to gracefully shut down before the new worker boots. */
  getExistingEngine: () => BrowserEngine | null;
  /** Clear engine/readiness store state during the teardown gap. */
  clearEngineState: () => void;
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

/** Gracefully tear down the current engine, waiting for its shutdown ack. */
async function teardownExistingEngine(engine: BrowserEngine | null): Promise<void> {
  if (!engine) return;
  try {
    // Graceful: the worker releases its OPFS handle + lock and acks before we
    // terminate, so the replacement worker can take ownership without racing a
    // lingering handle. shutdown() hard-terminates on ack timeout.
    await engine.shutdown(ENGINE_SHUTDOWN_ACK_TIMEOUT_MS);
  } catch {
    try {
      engine.terminate();
    } catch {
      // Worker already gone.
    }
  }
}

export async function respawnEngineWorker(ctx: RespawnEngineContext): Promise<void> {
  return runExclusive(async () => {
    const cleanStart = ctx.cleanStart ?? false;
    console.log(`[workspaceBoot] Respawning engine (cleanStart: ${cleanStart})`);

    await teardownExistingEngine(ctx.getExistingEngine());
    ctx.clearEngineState();

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
  });
}

export interface ShutdownEngineContext {
  getExistingEngine: () => BrowserEngine | null;
  clearEngineState: () => void;
}

/**
 * Gracefully tear down the engine and wait for the worker to release its OPFS
 * handle + lock. Serialized with init/respawn so callers (e.g. discard) can
 * safely mutate OPFS files immediately afterward.
 */
export async function shutdownEngineWorker(ctx: ShutdownEngineContext): Promise<void> {
  return runExclusive(async () => {
    await teardownExistingEngine(ctx.getExistingEngine());
    ctx.clearEngineState();
  });
}

export function resetEngineInitDedupeForTests(): void {
  activeBoot = null;
  initInFlight = null;
  lifecycleChain = Promise.resolve();
}
