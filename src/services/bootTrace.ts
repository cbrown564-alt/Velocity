import type { BootTraceEvent, BootTraceEventInput, BootTraceSnapshot } from '../types/bootTrace';

const MAX_BOOT_TRACE_EVENTS = 200;
const MAX_DETAIL_STRING_LENGTH = 240;
const STORAGE_KEY = 'velocity:boot-trace:v1';
const FORBIDDEN_DETAIL_KEY = /dataset|buffer|content|schema|variables?|rows?|values?|survey|respondent/i;

declare global {
  interface Window {
    __velocityGetBootTrace?: () => BootTraceSnapshot | null;
  }
}

let snapshot: BootTraceSnapshot | null = null;
let startedAtMs = 0;
let sequence = 0;

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createCorrelationId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `boot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeDetail(
  detail: BootTraceEventInput['detail'],
): Record<string, string | number | boolean | null> | undefined {
  if (!detail) return undefined;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(detail).slice(0, 12)) {
    if (FORBIDDEN_DETAIL_KEY.test(key)) continue;
    safe[key] = typeof value === 'string' ? value.slice(0, MAX_DETAIL_STRING_LENGTH) : value;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function persistSnapshot(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Diagnostics must never interfere with boot.
  }
}

function isTerminal(event: BootTraceEvent): boolean {
  return event.status === 'error' || event.status === 'timeout' || event.status === 'cancelled';
}

function exposeSnapshot(): void {
  if (typeof window === 'undefined') return;
  window.__velocityGetBootTrace = getBootTraceSnapshot;
}

export function beginBootTrace(source: string, correlationId = createCorrelationId()): string {
  const shouldStart = !snapshot || snapshot.terminal !== null;
  if (shouldStart) {
    const startedAt = new Date().toISOString();
    snapshot = { correlationId, source: source.slice(0, 80), startedAt, events: [], terminal: null };
    startedAtMs = nowMs();
    sequence = 0;
  }

  exposeSnapshot();
  recordBootTrace({
    correlationId: snapshot!.correlationId,
    source: 'main',
    phase: 'warmup.requested',
    status: 'started',
    detail: { source: source.slice(0, 80) },
  });
  return snapshot!.correlationId;
}

export function getBootTraceCorrelationId(): string {
  if (!snapshot) return beginBootTrace('app-shell');
  return snapshot.correlationId;
}

export function recordBootTrace(input: BootTraceEventInput): BootTraceEvent {
  if (!snapshot) {
    beginBootTrace('implicit', input.correlationId);
  }

  const event: BootTraceEvent = {
    correlationId: input.correlationId ?? snapshot!.correlationId,
    sequence: ++sequence,
    at: new Date().toISOString(),
    elapsedMs: Math.max(0, Math.round(nowMs() - startedAtMs)),
    source: input.source,
    phase: input.phase.slice(0, 120),
    status: input.status,
    durationMs: input.durationMs == null ? undefined : Math.max(0, Math.round(input.durationMs)),
    detail: sanitizeDetail(input.detail),
  };

  const previous = snapshot!.events.at(-1);
  if (event.status === 'progress' && previous?.status === 'progress' && previous.phase === event.phase) {
    snapshot!.events[snapshot!.events.length - 1] = event;
  } else {
    snapshot!.events.push(event);
  }
  if (snapshot!.events.length > MAX_BOOT_TRACE_EVENTS) {
    snapshot!.events.splice(0, snapshot!.events.length - MAX_BOOT_TRACE_EVENTS);
  }
  if (isTerminal(event)) snapshot!.terminal = event;
  persistSnapshot();

  // Console output gives Playwright and CI a second, transport-independent copy.
  if (event.status !== 'progress') {
    console.info(`[boot-trace] ${JSON.stringify(event)}`);
  }
  return event;
}

export function mergeBootTraceEvent(event: BootTraceEvent): BootTraceEvent {
  return recordBootTrace({
    correlationId: event.correlationId,
    source: event.source,
    phase: event.phase,
    status: event.status,
    durationMs: event.durationMs,
    detail: event.detail,
  });
}

export function getBootTraceSnapshot(): BootTraceSnapshot | null {
  return snapshot ? JSON.parse(JSON.stringify(snapshot)) : null;
}

export function resetBootTraceForTests(): void {
  snapshot = null;
  startedAtMs = 0;
  sequence = 0;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage in tests/workers.
  }
}
