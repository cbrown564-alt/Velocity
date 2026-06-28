/**
 * Local-first onboarding instrumentation for paid pilots (PILOT-1).
 * Events stay on-device in localStorage until exported.
 */

export type PilotOnboardingEventName =
  'file_selected' | 'canvas_ready' | 'first_crosstab' | 'pptx_exported' | 'xlsx_exported' | 'workspace_reopened';

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

export function resetPilotSession(): void {
  sessionStartMs = Date.now();
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
  return event;
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
}
