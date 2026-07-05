import { afterEach, describe, expect, it, vi } from 'vitest';
import { EngineProxy } from './EngineProxy';

type Listener = (event: { data: unknown }) => void;

function createFakeWorker() {
  const listeners: Record<string, Listener[]> = {};
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: (type: string, cb: Listener) => {
      (listeners[type] ??= []).push(cb);
    },
    removeEventListener: vi.fn(),
    emit(type: string, data: unknown) {
      (listeners[type] ?? []).forEach((cb) => cb({ data }));
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('EngineProxy.shutdown', () => {
  it('sends engine.shutdown, waits for the ack, then terminates', async () => {
    const worker = createFakeWorker();
    const proxy = new EngineProxy(worker as unknown as Worker);

    const shutdownPromise = proxy.shutdown(1000);

    const sent = worker.postMessage.mock.calls[0][0] as { type: string; requestId: string };
    expect(sent.type).toBe('engine.shutdown');
    expect(worker.terminate).not.toHaveBeenCalled();

    worker.emit('message', { type: 'engine.shutdownComplete', requestId: sent.requestId });
    await shutdownPromise;

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('hard-terminates when the shutdown ack times out', async () => {
    vi.useFakeTimers();
    const worker = createFakeWorker();
    const proxy = new EngineProxy(worker as unknown as Worker);

    const shutdownPromise = proxy.shutdown(500);
    await vi.advanceTimersByTimeAsync(500);
    await shutdownPromise;

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('is a no-op once disposed', async () => {
    const worker = createFakeWorker();
    const proxy = new EngineProxy(worker as unknown as Worker);
    proxy.dispose();

    await proxy.shutdown(1000);

    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(worker.terminate).not.toHaveBeenCalled();
  });
});
