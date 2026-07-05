/**
 * Local-first onboarding instrumentation for paid pilots (PILOT-1, PILOT-6).
 * Events stay on-device in localStorage until exported.
 */

export type OpfsBootDecision =
  | 'cache_open'
  | 'rebuild'
  | 'fresh'
  | 'memory_fallback'
  | 'disabled'
  | 'opfs_locked';

export type BootRestoreStrategy = 'open-cache' | 'rebuild-from-source' | 'fresh';

export type PilotOnboardingEventName =
  | 'landing_view'
  | 'landing_cta_upload'
  | 'landing_cta_example'
  | 'boot_start'
  | 'boot_transition'
  | 'engine_warmup_intent'
  | 'wasm_cache_probe'
  | 'engine_ready'
  | 'opfs_decision'
  | 'file_selected'
  | 'dataset_ready'
  | 'canvas_ready'
  | 'first_crosstab'
  | 'pptx_exported'
  | 'xlsx_exported'
  | 'persistence_corruption'
  | 'persistence_fallback'
  | 'workspace_reopened'
  | 'sav_legacy_ingestion';

export interface PilotOnboardingEvent {
  id: string;
  name: PilotOnboardingEventName;
  at: string;
  elapsedMs: number;
  payload?: Record<string, unknown>;
}

const STORAGE_KEY = 'velocity-pilot-events';
const SESSION_START_KEY = 'velocity-pilot-session-start';

let sessionStartMs: number | null = null;
let bootStartMs: number | null = null;
let fileDropMs: number | null = null;

function readEvents(): PilotOnboardingEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PilotOnboardingEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: PilotOnboardingEvent[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function ensureSessionStart(): number {
  if (sessionStartMs !== null) return sessionStartMs;
  if (typeof localStorage === 'undefined') {
    sessionStartMs = Date.now();
    return sessionStartMs;
  }
  const stored = localStorage.getItem(SESSION_START_KEY);
  if (stored) {
    const parsed = Number(stored);
    sessionStartMs = Number.isFinite(parsed) ? parsed : Date.now();
  } else {
    sessionStartMs = Date.now();
    localStorage.setItem(SESSION_START_KEY, String(sessionStartMs));
  }
  return sessionStartMs;
}

function durationSince(startMs: number | null): number | undefined {
  if (startMs === null) return undefined;
  return Date.now() - startMs;
}

export function resetPilotSession(): void {
  sessionStartMs = Date.now();
  bootStartMs = null;
  fileDropMs = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_START_KEY, String(sessionStartMs));
  }
}

export function getPilotEventLog(): PilotOnboardingEvent[] {
  return readEvents();
}

export function recordPilotEvent(
  name: PilotOnboardingEventName,
  payload?: Record<string, unknown>,
): PilotOnboardingEvent | null {
  if (typeof localStorage === 'undefined') return null;

  const events = readEvents();
  if (name === 'first_crosstab' && events.some((e) => e.name === 'first_crosstab')) {
    return null;
  }
  if (name === 'landing_view' && events.some((e) => e.name === 'landing_view')) {
    return null;
  }
  if (name === 'boot_start' && events.some((e) => e.name === 'boot_start')) {
    return null;
  }

  const start = ensureSessionStart();
  const event: PilotOnboardingEvent = {
    id: crypto.randomUUID(),
    name,
    at: new Date().toISOString(),
    elapsedMs: Date.now() - start,
    ...(payload ? { payload } : {}),
  };

  events.push(event);
  writeEvents(events);

  if (name === 'boot_start') {
    bootStartMs = Date.now();
  }
  if (name === 'file_selected') {
    fileDropMs = Date.now();
  }

  return event;
}

export function markBootStart(): PilotOnboardingEvent | null {
  return recordPilotEvent('boot_start');
}

export function recordEngineWarmupIntent(source: string): PilotOnboardingEvent | null {
  return recordPilotEvent('engine_warmup_intent', { source });
}

export function recordEngineReady(payload?: Record<string, unknown>): PilotOnboardingEvent | null {
  return recordPilotEvent('engine_ready', {
    durationFromBootMs: durationSince(bootStartMs),
    ...payload,
  });
}

export function recordOpfsDecision(
  decision: OpfsBootDecision,
  payload?: Record<string, unknown>,
): PilotOnboardingEvent | null {
  return recordPilotEvent('opfs_decision', {
    decision,
    durationFromBootMs: durationSince(bootStartMs),
    ...payload,
  });
}

export function recordBootTransition(payload: {
  from: string;
  to: BootRestoreStrategy;
  reason: string;
  [key: string]: unknown;
}): PilotOnboardingEvent | null {
  return recordPilotEvent('boot_transition', {
    durationFromBootMs: durationSince(bootStartMs),
    ...payload,
  });
}

export function recordDatasetReady(payload?: Record<string, unknown>): PilotOnboardingEvent | null {
  return recordPilotEvent('dataset_ready', {
    durationFromFileDropMs: durationSince(fileDropMs),
    ...payload,
  });
}

export function recordPersistenceCorruption(payload?: Record<string, unknown>): PilotOnboardingEvent | null {
  return recordPilotEvent('persistence_corruption', payload);
}

export function recordPersistenceFallback(
  reason: string,
  payload?: Record<string, unknown>,
): PilotOnboardingEvent | null {
  return recordPilotEvent('persistence_fallback', {
    reason,
    ...payload,
  });
}

export function buildPilotEventExport(): string {
  const events = readEvents();
  const sessionStart = ensureSessionStart();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      sessionStartedAt: new Date(sessionStart).toISOString(),
      eventCount: events.length,
      events,
    },
    null,
    2,
  );
}

export function downloadPilotEventLog(): void {
  const blob = new Blob([buildPilotEventExport()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `velocity-pilot-events-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function clearPilotEventLog(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_START_KEY);
  sessionStartMs = null;
  bootStartMs = null;
  fileDropMs = null;
}
