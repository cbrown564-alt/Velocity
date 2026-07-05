/**
 * Whether pilot-only instrumentation (event log download) is visible in the UI.
 * Enabled in dev builds, via VITE_PILOT_INSTRUMENTATION, or localStorage opt-in.
 */

const STORAGE_KEY = 'velocity-pilot-instrumentation';

export function isPilotInstrumentationVisible(): boolean {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_PILOT_INSTRUMENTATION === 'true') return true;
  if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1') {
    return true;
  }
  return false;
}

export function enablePilotInstrumentation(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, '1');
  }
}
