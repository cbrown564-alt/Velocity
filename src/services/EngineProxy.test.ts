/**
 * Characterization tests for EngineProxy.ts
 *
 * EngineProxy is a main-thread Worker message router. These tests exercise
 * transport behaviour only: request-ID correlation, timeout rejection,
 * callback routing, and dispose/terminate lifecycle. No business logic is
 * tested here — that lives in BrowserEngine.test.ts and core unit tests.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EngineProxy } from './EngineProxy';
import type { EngineProxyOptions } from './EngineProxy';

// ─── Mock Worker ──────────────────────────────────────────────────────────────

type MockListener = (event: MessageEvent) => void;

interface MockWorkerHandle {
  worker: Worker;
  emit: (data: unknown) => void;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}

function createMockWorker(): MockWorkerHandle {
  const listeners: MockListener[] = [];

  const addEventListenerMock = vi.fn((_type: string, fn: EventListenerOrEventListenerObject) => {
    listeners.push(fn as MockListener);
  });

  const removeEventListenerMock = vi.fn((_type: string, fn: EventListenerOrEventListenerObject) => {
    const idx = listeners.indexOf(fn as MockListener);
    if (idx !== -1) listeners.splice(idx, 1);
  });

  const postMessageMock = vi.fn();
  const terminateMock = vi.fn();

  const worker = {
    addEventListener: addEventListenerMock,
    removeEventListener: removeEventListenerMock,
    postMessage: postMessageMock,
    terminate: terminateMock,
  } as unknown as Worker;

  const emit = (data: unknown) => {
    const event = new MessageEvent('message', { data });
    [...listeners].forEach((fn) => fn(event));
  };

  return {
    worker,
    emit,
    postMessage: postMessageMock,
    addEventListener: addEventListenerMock,
    removeEventListener: removeEventListenerMock,
    terminate: terminateMock,
  };
}

/** Extract requestId from the most recent postMessage call. */
function lastRequestId(handle: MockWorkerHandle): string {
  const call = handle.postMessage.mock.calls.at(-1)?.[0] as { requestId: string };
  return call.requestId;
}

/** Extract requestId from the nth-most-recent postMessage call (0 = last). */
function nthRequestId(handle: MockWorkerHandle, nFromEnd: number): string {
  const calls = handle.postMessage.mock.calls;
  const call = calls[calls.length - 1 - nFromEnd]?.[0] as { requestId: string };
  return call.requestId;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a proxy that auto-replies to postMessage based on a type→response map. */
function createAutoProxy(
  responseMap: Record<string, { type: string; extra?: Record<string, unknown> }>,
  options: EngineProxyOptions = {},
): { proxy: EngineProxy; handle: MockWorkerHandle } {
  const handle = createMockWorker();
  handle.postMessage.mockImplementation((msg: { type: string; requestId: string }) => {
    const config = responseMap[msg.type];
    if (!config) return;
    handle.emit({ type: config.type, requestId: msg.requestId, ...(config.extra ?? {}) });
  });
  const proxy = new EngineProxy(handle.worker, options);
  return { proxy, handle };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.useRealTimers();
});

// ────────────────────────────────────────────────────────────
// Constructor
// ────────────────────────────────────────────────────────────

describe('EngineProxy constructor', () => {
  it('registers a message listener on the worker', () => {
    const handle = createMockWorker();
    new EngineProxy(handle.worker);
    expect(handle.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });
});

// ────────────────────────────────────────────────────────────
// Request / response correlation
// ────────────────────────────────────────────────────────────

describe('EngineProxy request/response correlation', () => {
  it('ping resolves with the worker pong response', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);
    handle.emit({ type: 'engine.pong', requestId: reqId, hasData: false, rowCount: 0 });

    const result = await promise;
    expect(result.type).toBe('engine.pong');
    expect((result as { hasData: boolean }).hasData).toBe(false);
  });

  it('sends engine.ping as the message type', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);
    handle.emit({ type: 'engine.pong', requestId: reqId, hasData: false });

    await promise;
    expect(handle.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'engine.ping', requestId: expect.any(String) }),
    );
  });

  it('concurrent requests resolve to their own responses', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const p1 = proxy.ping();
    const reqId1 = lastRequestId(handle);
    const p2 = proxy.ping();
    const reqId2 = lastRequestId(handle);

    // Respond in reverse order to prove correlation
    handle.emit({ type: 'engine.pong', requestId: reqId2, hasData: true });
    handle.emit({ type: 'engine.pong', requestId: reqId1, hasData: false });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect((r1 as { hasData: boolean }).hasData).toBe(false);
    expect((r2 as { hasData: boolean }).hasData).toBe(true);
  });

  it('ignores responses whose requestId does not match any pending request', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);

    // Spurious response with wrong ID — must not resolve or reject
    handle.emit({ type: 'engine.pong', requestId: 'wrong-id', hasData: false });

    // Correct response
    handle.emit({ type: 'engine.pong', requestId: reqId, hasData: true });

    const result = await promise;
    expect((result as { hasData: boolean }).hasData).toBe(true);
  });

  it('ignores non-engine messages (no engine. prefix)', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);

    handle.emit({ type: 'some.legacy.message', requestId: reqId });
    handle.emit({ type: 'engine.pong', requestId: reqId, hasData: false });

    await expect(promise).resolves.toBeDefined();
  });

  it('ignores messages without a requestId', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);

    handle.emit({ type: 'engine.pong' }); // no requestId
    handle.emit({ type: 'engine.pong', requestId: reqId, hasData: false });

    await expect(promise).resolves.toBeDefined();
  });

  it('ignores null/undefined data messages', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);

    handle.emit(null);
    handle.emit(undefined);
    handle.emit({ type: 'engine.pong', requestId: reqId, hasData: false });

    await expect(promise).resolves.toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────
// Error handling
// ────────────────────────────────────────────────────────────

describe('EngineProxy error responses', () => {
  it('rejects the promise when worker replies with engine.error', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);
    handle.emit({ type: 'engine.error', requestId: reqId, message: 'something went wrong' });

    await expect(promise).rejects.toThrow('something went wrong');
  });
});

// ────────────────────────────────────────────────────────────
// Timeout
// ────────────────────────────────────────────────────────────

describe('EngineProxy timeout', () => {
  it('rejects with a timeout error after timeoutMs elapses', async () => {
    vi.useFakeTimers();
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker, { timeoutMs: 1000 });

    const promise = proxy.ping();

    vi.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow(/timeout.*1000ms/i);
  });

  it('does not reject before timeoutMs elapses', async () => {
    vi.useFakeTimers();
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker, { timeoutMs: 5000 });

    const promise = proxy.ping();

    // Advance to just before the deadline, then respond
    vi.advanceTimersByTime(4999);
    const reqId = lastRequestId(handle);
    handle.emit({ type: 'engine.pong', requestId: reqId, hasData: false });

    await expect(promise).resolves.toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────
// Progress / persistence / corruption callbacks
// ────────────────────────────────────────────────────────────

describe('EngineProxy broadcast callbacks', () => {
  it('calls onProgress when engine.loadProgress arrives (no pending request)', () => {
    const onProgress = vi.fn();
    const handle = createMockWorker();
    new EngineProxy(handle.worker, { onProgress });

    handle.emit({
      type: 'engine.loadProgress',
      phase: 'parsing',
      progress: 0.5,
      message: 'half done',
    });

    expect(onProgress).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'engine.loadProgress', phase: 'parsing' }),
    );
  });

  it('calls onPersistenceStatus when engine.persistenceStatus arrives', () => {
    const onPersistenceStatus = vi.fn();
    const handle = createMockWorker();
    new EngineProxy(handle.worker, { onPersistenceStatus });

    handle.emit({
      type: 'engine.persistenceStatus',
      opfsAvailable: true,
      mode: 'opfs',
      dbPath: 'opfs://db.db',
    });

    expect(onPersistenceStatus).toHaveBeenCalledOnce();
  });

  it('calls onCorruption when engine.corruptionDetected arrives', () => {
    const onCorruption = vi.fn();
    const handle = createMockWorker();
    new EngineProxy(handle.worker, { onCorruption });

    handle.emit({ type: 'engine.corruptionDetected', message: 'db is corrupt' });

    expect(onCorruption).toHaveBeenCalledOnce();
    expect(onCorruption).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'engine.corruptionDetected' }),
    );
  });

  it('engine.persistenceStatus with a requestId does NOT resolve the pending request', async () => {
    vi.useFakeTimers();
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker, { timeoutMs: 500 });

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);

    // Intermediate persistence status during init — should not resolve pending
    handle.emit({ type: 'engine.persistenceStatus', requestId: reqId, opfsAvailable: true, mode: 'opfs', dbPath: '' });

    // Promise should still be pending; advance past timeout to confirm it was not resolved
    vi.advanceTimersByTime(501);
    await expect(promise).rejects.toThrow(/timeout/i);
  });

  it('engine.corruptionDetected with a requestId does NOT resolve the pending request', async () => {
    vi.useFakeTimers();
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker, { timeoutMs: 500 });

    const promise = proxy.ping();
    const reqId = lastRequestId(handle);

    handle.emit({ type: 'engine.corruptionDetected', requestId: reqId, message: 'corrupt' });

    vi.advanceTimersByTime(501);
    await expect(promise).rejects.toThrow(/timeout/i);
  });
});

// ────────────────────────────────────────────────────────────
// Dispose
// ────────────────────────────────────────────────────────────

describe('EngineProxy.dispose', () => {
  it('removes the message listener from the worker', () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);
    proxy.dispose();
    expect(handle.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('rejects all pending requests with "EngineProxy disposed"', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const p1 = proxy.ping();
    const p2 = proxy.ping();

    proxy.dispose();

    await expect(p1).rejects.toThrow('EngineProxy disposed');
    await expect(p2).rejects.toThrow('EngineProxy disposed');
  });

  it('rejects new sends immediately after dispose', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    proxy.dispose();

    await expect(proxy.ping()).rejects.toThrow('EngineProxy is disposed');
  });

  it('calling dispose twice is safe (idempotent)', () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);
    proxy.dispose();
    expect(() => proxy.dispose()).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// Terminate
// ────────────────────────────────────────────────────────────

describe('EngineProxy.terminate', () => {
  it('calls worker.terminate', () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);
    proxy.terminate();
    expect(handle.terminate).toHaveBeenCalledOnce();
  });

  it('also disposes (rejects pending requests)', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);
    const promise = proxy.ping();
    proxy.terminate();
    await expect(promise).rejects.toThrow('EngineProxy disposed');
  });
});

// ────────────────────────────────────────────────────────────
// getWorker
// ────────────────────────────────────────────────────────────

describe('EngineProxy.getWorker', () => {
  it('returns the underlying Worker instance', () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);
    expect(proxy.getWorker()).toBe(handle.worker);
  });
});

// ────────────────────────────────────────────────────────────
// setDatasetContext
// ────────────────────────────────────────────────────────────

describe('EngineProxy.setDatasetContext', () => {
  it('updates the metadata embedded in ResultEnvelope outputs', async () => {
    const { proxy } = createAutoProxy({
      'engine.getVariableStats': {
        type: 'engine.variableStats',
        extra: { stats: { frequencies: [], total: 0 } },
      },
    });

    proxy.setDatasetContext('survey.sav', 500);

    const envelope = await proxy.getVariableStats('age');
    expect(envelope.metadata.datasetName).toBe('survey.sav');
    expect(envelope.metadata.rowCount).toBe(500);
  });
});

// ────────────────────────────────────────────────────────────
// updatePersistenceMetadata (fire-and-forget)
// ────────────────────────────────────────────────────────────

describe('EngineProxy.updatePersistenceMetadata', () => {
  it('posts a message without registering a pending request', () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    proxy.updatePersistenceMetadata({
      datasetName: 'test.sav',
      rowCount: 100,
      columnCount: 5,
      schemaVersion: 1,
      lastModified: Date.now(),
    });

    expect(handle.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'engine.updatePersistenceMetadata' }),
    );
  });

  it('does not create a pending request (dispose does not reject anything for it)', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    proxy.updatePersistenceMetadata({ datasetName: 'x', rowCount: 1, columnCount: 1, schemaVersion: 1, lastModified: 0 });

    // If dispose rejected the update call, we'd get an unhandled rejection. Instead it's void.
    expect(() => proxy.dispose()).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// init
// ────────────────────────────────────────────────────────────

describe('EngineProxy.init', () => {
  it('sends engine.init with options', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.init({ forceCleanStart: true, datasetId: 'ds-1', schemaVersion: 3 });
    const reqId = lastRequestId(handle);

    expect(handle.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'engine.init',
        forceCleanStart: true,
        datasetId: 'ds-1',
        schemaVersion: 3,
        requestId: reqId,
      }),
    );

    handle.emit({ type: 'engine.ready', requestId: reqId, opfsAvailable: true });
    await promise;
  });

  it('sends engine.init without options when called with no arguments', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.init();
    const reqId = lastRequestId(handle);
    handle.emit({ type: 'engine.ready', requestId: reqId, opfsAvailable: false });

    const result = await promise;
    expect(result.type).toBe('engine.ready');
  });
});

// ────────────────────────────────────────────────────────────
// getVariableStats (exercises wrapResult + ResultEnvelope)
// ────────────────────────────────────────────────────────────

describe('EngineProxy.getVariableStats', () => {
  it('returns a ResultEnvelope with operation=getVariableStats', async () => {
    const { proxy } = createAutoProxy({
      'engine.getVariableStats': {
        type: 'engine.variableStats',
        extra: { stats: { frequencies: [{ value: 1, count: 10 }], total: 10 } },
      },
    });

    const envelope = await proxy.getVariableStats('q1', 'nominal');
    expect(envelope.operation).toBe('getVariableStats');
    expect(envelope.inputs).toMatchObject({ column: 'q1', variableType: 'nominal' });
    expect(envelope.metadata.engineVersion).toBe('browser-wasm');
    expect(envelope.warnings).toEqual([]);
  });

  it('forwards column and variableType in the worker message', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const promise = proxy.getVariableStats('income', 'numeric');
    const reqId = lastRequestId(handle);

    expect(handle.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'engine.getVariableStats', column: 'income', variableType: 'numeric' }),
    );

    handle.emit({ type: 'engine.variableStats', requestId: reqId, stats: { frequencies: [], total: 0 } });
    await promise;
  });
});

// ────────────────────────────────────────────────────────────
// runCrosstab (exercises the complex wrapResult path)
// ────────────────────────────────────────────────────────────

describe('EngineProxy.runCrosstab', () => {
  it('returns a ResultEnvelope with operation=runCrosstab', async () => {
    const { proxy } = createAutoProxy({
      'engine.runCrosstab': {
        type: 'engine.queryResult',
        extra: { data: [], durationMs: 5, tableStats: null },
      },
    });

    const context = { variables: {}, variableSets: {} };
    const envelope = await proxy.runCrosstab({ rowVars: ['gender'], colVar: 'age' }, context);

    expect(envelope.operation).toBe('runCrosstab');
    expect(envelope.data).toMatchObject({ rows: [], tableStats: null });
    expect(envelope.metadata.filtersApplied).toBe(0);
    expect(envelope.metadata.isWeighted).toBe(false);
  });

  it('counts filters applied from options.filters', async () => {
    const { proxy } = createAutoProxy({
      'engine.runCrosstab': {
        type: 'engine.queryResult',
        extra: { data: [], durationMs: 3, tableStats: null },
      },
    });

    const context = { variables: {}, variableSets: {} };
    const envelope = await proxy.runCrosstab(
      {
        rowVars: ['q1'],
        colVar: 'q2',
        filters: [
          { id: 'f1', variableId: 'q1', operator: 'eq', value: '1' },
          { id: 'f2', variableId: 'q2', operator: 'eq', value: '2' },
        ],
        weightVar: 'weight',
      },
      context,
    );

    expect(envelope.metadata.filtersApplied).toBe(2);
    expect(envelope.metadata.isWeighted).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// Delegation batch — exercises remaining public methods
// ────────────────────────────────────────────────────────────

describe('EngineProxy delegation methods send the correct message type', () => {
  const cases: Array<{
    method: string;
    args: unknown[];
    msgType: string;
    responseType: string;
    responseExtra?: Record<string, unknown>;
  }> = [
    {
      method: 'checkPersistedData',
      args: [],
      msgType: 'engine.checkPersistedData',
      responseType: 'engine.noPersistedData',
    },
    {
      method: 'clearPersistedData',
      args: [],
      msgType: 'engine.clearPersistedData',
      responseType: 'engine.persistedDataCleared',
    },
    {
      method: 'flushPersistedData',
      args: [],
      msgType: 'engine.flushPersistedData',
      responseType: 'engine.flushComplete',
      responseExtra: { ok: true, durationMs: 1 },
    },
    {
      method: 'query',
      args: ['SELECT 1'],
      msgType: 'engine.query',
      responseType: 'engine.queryResult',
      responseExtra: { data: [], durationMs: 1 },
    },
    {
      method: 'getSchema',
      args: [],
      msgType: 'engine.getSchema',
      responseType: 'engine.schema',
      responseExtra: { data: [] },
    },
    {
      method: 'getUniqueValues',
      args: ['gender'],
      msgType: 'engine.getUniqueValues',
      responseType: 'engine.uniqueValues',
      responseExtra: { data: ['Male', 'Female'] },
    },
    {
      method: 'loadCSV',
      args: ['data.csv', 'a,b\n1,2'],
      msgType: 'engine.loadCSV',
      responseType: 'engine.csvLoaded',
      responseExtra: { schema: [], rowCount: 1, durationMs: 1 },
    },
    {
      method: 'loadSAV',
      args: [new ArrayBuffer(8)],
      msgType: 'engine.loadSAV',
      responseType: 'engine.savLoaded',
      responseExtra: { variables: [], variableSets: [], rowCount: 0, durationMs: 1 },
    },
    {
      method: 'loadSAVMetadata',
      args: [new ArrayBuffer(8)],
      msgType: 'engine.loadSAVMetadata',
      responseType: 'engine.savMetadataLoaded',
      responseExtra: { variables: [], variableSets: [], rowCount: 0, durationMs: 1 },
    },
    {
      method: 'loadSAVSample',
      args: [new ArrayBuffer(8), 100, 'spread'],
      msgType: 'engine.loadSAVSample',
      responseType: 'engine.savSampleLoaded',
      responseExtra: {
        variables: [],
        variableSets: [],
        rowCount: 0,
        sampleRowCount: 0,
        sampleStrategy: 'spread',
        durationMs: 1,
      },
    },
    {
      method: 'processData',
      args: [[], { rowVariables: [], colVariable: null }],
      msgType: 'engine.processData',
      responseType: 'engine.processedData',
      responseExtra: { result: null },
    },
    {
      method: 'recodeVariable',
      args: ['src', 'dst', { mode: 'categorical' }],
      msgType: 'engine.recodeVariable',
      responseType: 'engine.recodeComplete',
      responseExtra: { newColName: 'dst' },
    },
    {
      method: 'dropColumn',
      args: ['old_col'],
      msgType: 'engine.dropColumn',
      responseType: 'engine.columnDropped',
      responseExtra: { column: 'old_col' },
    },
    {
      method: 'updateColumn',
      args: ['src', 'dst', { mode: 'categorical' }],
      msgType: 'engine.updateColumn',
      responseType: 'engine.columnUpdated',
      responseExtra: { column: 'dst' },
    },
    {
      method: 'fillSystemMissing',
      args: ['score', 99],
      msgType: 'engine.fillSystemMissing',
      responseType: 'engine.fillSystemMissingComplete',
      responseExtra: { column: 'score' },
    },
    {
      method: 'exportArrow',
      args: ['SELECT 1', ['a']],
      msgType: 'engine.exportArrow',
      responseType: 'engine.arrowExported',
      responseExtra: { buffer: new ArrayBuffer(0), rowCount: 0, durationMs: 1 },
    },
    {
      method: 'getValueFrequencies',
      args: ['my_table', 'col'],
      msgType: 'engine.getValueFrequencies',
      responseType: 'engine.valueFrequencies',
      responseExtra: { column: 'col', frequencies: [] },
    },
    {
      method: 'buildHarmonizedTable',
      args: ['src', 'tgt', [], 'out'],
      msgType: 'engine.buildHarmonizedTable',
      responseType: 'engine.harmonizedTableCreated',
      responseExtra: { tableName: 'out', rowCount: 0, durationMs: 1 },
    },
    {
      method: 'getRespondentOverlap',
      args: ['src', 'tgt', 'id'],
      msgType: 'engine.getRespondentOverlap',
      responseType: 'engine.respondentOverlap',
      responseExtra: { totalSource: 0, totalTarget: 0, overlap: 0 },
    },
  ];

  it.each(cases)('$method posts $msgType and resolves', async ({ method, args, msgType, responseType, responseExtra }) => {
    const handle = createMockWorker();
    handle.postMessage.mockImplementation((msg: { type: string; requestId: string }) => {
      handle.emit({ type: responseType, requestId: msg.requestId, ...(responseExtra ?? {}) });
    });

    const proxy = new EngineProxy(handle.worker);
    await (proxy as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!(...args);

    // For transferable methods (loadSAV*), postMessage receives a second argument
    // (the transfer array). Check only the message payload via the first call argument.
    const sentMessage = handle.postMessage.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sentMessage).toMatchObject({ type: msgType, requestId: expect.any(String) });
  });
});

// ────────────────────────────────────────────────────────────
// Multiple concurrent requests (stress check on correlation)
// ────────────────────────────────────────────────────────────

describe('EngineProxy concurrent requests', () => {
  it('resolves three simultaneous pings independently', async () => {
    const handle = createMockWorker();
    const proxy = new EngineProxy(handle.worker);

    const p1 = proxy.ping();
    const id1 = nthRequestId(handle, 0);
    const p2 = proxy.ping();
    const id2 = nthRequestId(handle, 0);
    const p3 = proxy.ping();
    const id3 = nthRequestId(handle, 0);

    handle.emit({ type: 'engine.pong', requestId: id3, hasData: true });
    handle.emit({ type: 'engine.pong', requestId: id1, hasData: false });
    handle.emit({ type: 'engine.pong', requestId: id2, hasData: true });

    const results = await Promise.all([p1, p2, p3]);
    expect((results[0] as { hasData: boolean }).hasData).toBe(false);
    expect((results[1] as { hasData: boolean }).hasData).toBe(true);
    expect((results[2] as { hasData: boolean }).hasData).toBe(true);
  });
});
