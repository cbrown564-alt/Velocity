import type { BootTraceEvent, BootTraceStatus } from '../../types/bootTrace';
import { postEngineResponse } from './engineMessaging';

let correlationId = 'worker-unconfigured';
let requestId = 'worker-unconfigured';
let sequence = 0;
let startedAt = performance.now();

export function configureWorkerBootTrace(nextCorrelationId: string | undefined, nextRequestId: string): void {
  correlationId = nextCorrelationId || nextRequestId;
  requestId = nextRequestId;
  sequence = 0;
  startedAt = performance.now();
}

export function emitWorkerBootTrace(
  phase: string,
  status: BootTraceStatus,
  detail?: Record<string, string | number | boolean | null>,
  durationMs?: number,
  source: BootTraceEvent['source'] = 'analysis-worker',
): void {
  sequence += 1;
  postEngineResponse({
    type: 'engine.bootTrace',
    requestId,
    event: {
      correlationId,
      sequence,
      at: new Date().toISOString(),
      elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
      source,
      phase,
      status,
      durationMs,
      detail,
    },
  });
}

export async function withWorkerBootPhase<T>(
  phase: string,
  timeoutMs: number,
  operation: () => Promise<T>,
  detail?: Record<string, string | number | boolean | null>,
): Promise<T> {
  const phaseStartedAt = performance.now();
  emitWorkerBootTrace(phase, 'started', detail);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${phase} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    emitWorkerBootTrace(phase, 'completed', detail, performance.now() - phaseStartedAt);
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitWorkerBootTrace(
      phase,
      message.includes('timed out') ? 'timeout' : 'error',
      { ...detail, message },
      performance.now() - phaseStartedAt,
    );
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
