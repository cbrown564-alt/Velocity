export const SESSION_DISMISS_KEY = 'velocity-workspace-status-dismissed';
export const PILOT_DISMISS_KEY = 'velocity-pilot-env-banner-dismissed';

export function isSessionDismissed(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
}

export function dismissWorkspaceStatusForSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
}

export function isPilotPermanentlyDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(PILOT_DISMISS_KEY) === '1';
}

export function dismissPilotEnvironmentPermanently(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PILOT_DISMISS_KEY, '1');
}

export function resetWorkspaceStatusStripForTests(): void {
  sessionStorage.removeItem(SESSION_DISMISS_KEY);
  localStorage.removeItem(PILOT_DISMISS_KEY);
}
