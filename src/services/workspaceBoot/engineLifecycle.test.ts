import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserEngine } from '../../engine/BrowserEngine';
import {
  attachWorkerRuntimeHandlers,
  createStorePersistenceBridge,
  initializeEngineWorker,
  resetEngineInitDedupeForTests,
  respawnEngineWorker,
  type EnginePersistenceBridge,
  type InitializeEngineContext,
  type RespawnEngineContext,
} from './engineLifecycle';

const mockInit = vi.fn();
const mockTerminate = vi.fn();

vi.mock('../../engine/BrowserEngine', () => ({
  BrowserEngine: vi.fn().mockImplementation(() => ({
    init: mockInit,
    terminate: mockTerminate,
  })),
}));

vi.mock('../analysisWorker?worker', () => ({
  default: vi.fn().mockImplementation(() => ({
    onerror: null,
    onmessageerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    terminate: vi.fn(),
  })),
}));

vi.mock('../opfsFileManager', () => ({
  fileExists: vi.fn().mockResolvedValue(false),
}));

vi.mock('../engineWarmUp', () => ({
  getEngineWarmUpSource: vi.fn(() => 'test-source'),
}));

vi.mock('../duckdbWasmCache', () => ({
  probeDuckDbWasmCache: vi.fn().mockResolvedValue('miss'),
}));

vi.mock('../pilotOnboarding', () => ({
  markBootStart: vi.fn(),
  recordEngineReady: vi.fn(),
  recordOpfsDecision: vi.fn(),
  recordPersistenceCorruption: vi.fn(),
}));

function createInitContext(overrides: Partial<InitializeEngineContext> = {}): InitializeEngineContext {
  const bridge: EnginePersistenceBridge = {
    applyPersistenceStatus: vi.fn(),
    applyCorruption: vi.fn(),
  };

  return {
    getExistingEngine: () => null,
    getDatasetId: () => 'ds-1',
    getOpfsFileKey: () => undefined,
    getOpfsAvailable: () => false,
    getPersistenceState: () => 'checking',
    bridge,
    setWorkerRuntimeError: vi.fn(),
    assignBrowserEngine: vi.fn(),
    setInitSuccess: vi.fn(),
    setPersistenceReady: vi.fn(),
    setInitError: vi.fn(),
    checkPersistedData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('engineLifecycle', () => {
  beforeEach(() => {
    resetEngineInitDedupeForTests();
    vi.clearAllMocks();
    mockInit.mockResolvedValue({ opfsAvailable: true, duckdbBundle: 'eh' });
  });

  it('createStorePersistenceBridge forwards persistence and corruption patches', () => {
    const set = vi.fn();
    const bridge = createStorePersistenceBridge(set);

    bridge.applyPersistenceStatus({
      opfsAvailable: true,
      persistenceMode: 'opfs',
      persistenceError: null,
      activeDbPath: 'opfs://datasets/ds-1.db',
    });
    bridge.applyCorruption({
      persistenceState: 'corrupt',
      persistenceError: 'bad checksum',
      opfsAvailable: false,
      persistedDataInfo: null,
    });

    expect(set).toHaveBeenCalledTimes(2);
  });

  it('attachWorkerRuntimeHandlers reports worker runtime and message errors', () => {
    const setWorkerRuntimeError = vi.fn();
    const worker = {
      onerror: null as ((event: ErrorEvent) => void) | null,
      onmessageerror: null as (() => void) | null,
    };

    attachWorkerRuntimeHandlers(worker as unknown as Worker, setWorkerRuntimeError, ' during test');

    worker.onerror?.({ message: 'boom' } as ErrorEvent);
    worker.onmessageerror?.();

    expect(setWorkerRuntimeError).toHaveBeenCalledWith('boom');
    expect(setWorkerRuntimeError).toHaveBeenCalledWith('Worker message deserialization error');
  });

  it('initializeEngineWorker skips when an engine already exists', async () => {
    const existing = { init: vi.fn() } as unknown as BrowserEngine;
    const ctx = createInitContext({ getExistingEngine: () => existing });

    await initializeEngineWorker(ctx);

    expect(mockInit).not.toHaveBeenCalled();
  });

  it('initializeEngineWorker initializes, records success, and checks persisted data when OPFS is available', async () => {
    const ctx = createInitContext({
      getOpfsAvailable: () => true,
      getPersistenceState: () => 'ready',
    });

    await initializeEngineWorker(ctx);

    expect(ctx.assignBrowserEngine).toHaveBeenCalled();
    expect(ctx.setInitSuccess).toHaveBeenCalledWith(true);
    expect(ctx.checkPersistedData).toHaveBeenCalled();
    expect(ctx.setPersistenceReady).not.toHaveBeenCalled();
  });

  it('initializeEngineWorker marks persistence ready when OPFS is unavailable', async () => {
    const ctx = createInitContext({
      getOpfsAvailable: () => false,
      getPersistenceState: () => 'checking',
    });

    await initializeEngineWorker(ctx);

    expect(ctx.setPersistenceReady).toHaveBeenCalled();
    expect(ctx.checkPersistedData).not.toHaveBeenCalled();
  });

  it('initializeEngineWorker dedupes concurrent init calls', async () => {
    let resolveInit!: (value: { opfsAvailable: boolean; duckdbBundle: string }) => void;
    mockInit.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInit = resolve;
        }),
    );

    const ctx = createInitContext();
    const first = initializeEngineWorker(ctx);
    await Promise.resolve();
    const second = initializeEngineWorker(ctx);

    resolveInit({ opfsAvailable: false, duckdbBundle: 'eh' });
    await Promise.all([first, second]);

    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('initializeEngineWorker reports init failures', async () => {
    mockInit.mockRejectedValue(new Error('worker failed'));
    const ctx = createInitContext();

    await initializeEngineWorker(ctx);

    expect(ctx.setInitError).toHaveBeenCalledWith('worker failed');
  });

  it('respawnEngineWorker reinitializes the worker and reports success', async () => {
    vi.useFakeTimers();
    const ctx: RespawnEngineContext = {
      terminateWorker: vi.fn(),
      getDatasetId: () => 'ds-1',
      getOpfsFileKey: () => 'source-key',
      bridge: {
        applyPersistenceStatus: vi.fn(),
        applyCorruption: vi.fn(),
      },
      setBrowserEngine: vi.fn(),
      setRespawnSuccess: vi.fn(),
      setRespawnError: vi.fn(),
      setWorkerRuntimeError: vi.fn(),
      cleanStart: true,
    };

    const promise = respawnEngineWorker(ctx);
    await vi.runAllTimersAsync();
    await promise;

    expect(ctx.terminateWorker).toHaveBeenCalled();
    expect(ctx.setBrowserEngine).toHaveBeenCalled();
    expect(ctx.setRespawnSuccess).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });

  it('respawnEngineWorker reports respawn failures', async () => {
    vi.useFakeTimers();
    mockInit.mockRejectedValueOnce(new Error('respawn failed'));
    const ctx: RespawnEngineContext = {
      terminateWorker: vi.fn(),
      getDatasetId: () => 'ds-1',
      getOpfsFileKey: () => undefined,
      bridge: {
        applyPersistenceStatus: vi.fn(),
        applyCorruption: vi.fn(),
      },
      setBrowserEngine: vi.fn(),
      setRespawnSuccess: vi.fn(),
      setRespawnError: vi.fn(),
    };

    const promise = respawnEngineWorker(ctx);
    await vi.runAllTimersAsync();
    await promise;

    expect(ctx.setRespawnError).toHaveBeenCalledWith('respawn failed');
    vi.useRealTimers();
  });
});
