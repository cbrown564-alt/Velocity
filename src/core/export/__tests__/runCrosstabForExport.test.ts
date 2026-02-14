import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCrosstabForExport } from '../runCrosstabForExport';
import type { WorkerResponse } from '../../../types/worker';

vi.mock('../../analysis/buildCrosstabRequest', () => ({
  buildCrosstabRequest: () => ({
    isWeighted: false,
    options: {},
    context: {},
  }),
}));

vi.mock('../../analysis/mapCrosstabRows', () => ({
  mapCrosstabRows: (rows: any[]) => rows,
}));

class MockWorker {
  listeners = new Set<(event: MessageEvent<WorkerResponse>) => void>();
  posted: unknown[] = [];

  addEventListener(_type: string, handler: (event: MessageEvent<WorkerResponse>) => void) {
    this.listeners.add(handler);
  }

  removeEventListener(_type: string, handler: (event: MessageEvent<WorkerResponse>) => void) {
    this.listeners.delete(handler);
  }

  postMessage(msg: unknown) {
    this.posted.push(msg);
  }

  emit(response: WorkerResponse) {
    const event = { data: response } as MessageEvent<WorkerResponse>;
    this.listeners.forEach((handler) => handler(event));
  }
}

describe('runCrosstabForExport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cleans up listener on successful response', async () => {
    const worker = new MockWorker();
    const promise = runCrosstabForExport({
      worker: worker as unknown as Worker,
      dataset: { id: 'x', name: 'x', rowCount: 0, variables: [] } as any,
      variableSets: [],
      rowVars: ['gender'],
      colVar: null,
      filters: [],
      weightVar: null,
    });

    expect(worker.listeners.size).toBe(1);
    const reqId = (worker.posted[0] as any).requestId;

    worker.emit({
      type: 'queryResult',
      requestId: reqId,
      data: [{ foo: 'bar' }],
      tableStats: null,
    } as WorkerResponse);

    const result = await promise;
    expect(result.data).toEqual([{ foo: 'bar' }]);
    expect(worker.listeners.size).toBe(0);
  });

  it('cleans up listener on timeout', async () => {
    const worker = new MockWorker();
    const promise = runCrosstabForExport({
      worker: worker as unknown as Worker,
      dataset: { id: 'x', name: 'x', rowCount: 0, variables: [] } as any,
      variableSets: [],
      rowVars: ['gender'],
      colVar: null,
      filters: [],
      weightVar: null,
    });

    expect(worker.listeners.size).toBe(1);
    await vi.advanceTimersByTimeAsync(30_000);

    const result = await promise;
    expect(result.data).toEqual([]);
    expect(worker.listeners.size).toBe(0);
  });
});
