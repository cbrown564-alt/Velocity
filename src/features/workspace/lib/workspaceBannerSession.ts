/** Session-scoped workspace banner dismiss state (STAB-UI-F3.4). */

const SESSION_DISMISS_KEY = 'velocity-workspace-banners-session-dismissed';

export type WorkspaceBannerId = 'pilot-environment' | 'welcome-back';

function readSessionDismissed(): Set<WorkspaceBannerId> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as WorkspaceBannerId[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSessionDismissed(ids: Set<WorkspaceBannerId>): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SESSION_DISMISS_KEY, JSON.stringify([...ids]));
}

export function isWorkspaceBannerSessionDismissed(id: WorkspaceBannerId): boolean {
  return readSessionDismissed().has(id);
}

export function dismissWorkspaceBannerForSession(id: WorkspaceBannerId): void {
  const dismissed = readSessionDismissed();
  dismissed.add(id);
  writeSessionDismissed(dismissed);
}

export function resetWorkspaceBannerSessionDismissals(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SESSION_DISMISS_KEY);
}
