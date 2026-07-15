export type BootTraceSource = 'main' | 'analysis-worker' | 'duckdb-worker' | 'service-worker' | 'harness';

export type BootTraceStatus = 'started' | 'progress' | 'completed' | 'error' | 'timeout' | 'cancelled' | 'fallback';

export interface BootTraceEvent {
  correlationId: string;
  sequence: number;
  at: string;
  elapsedMs: number;
  source: BootTraceSource;
  phase: string;
  status: BootTraceStatus;
  durationMs?: number;
  detail?: Record<string, string | number | boolean | null>;
}

export interface BootTraceEventInput extends Omit<BootTraceEvent, 'correlationId' | 'sequence' | 'at' | 'elapsedMs'> {
  correlationId?: string;
}

export interface BootTraceSnapshot {
  correlationId: string;
  source: string;
  startedAt: string;
  events: BootTraceEvent[];
  terminal: BootTraceEvent | null;
}
