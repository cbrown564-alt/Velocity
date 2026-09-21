/**
 * One-time insert-palette grammar hint (DESIGN-CONV-D).
 * Scoped per workspace dataset; dismiss persists in localStorage.
 */

const dismissedInMemory = new Set<string>();

export const STORAGE_KEY = 'velocity-palette-onboarding-dismissed-v1';

function readDismissedWorkspaceIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

function writeDismissedWorkspaceIds(ids: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Dismissal must not interrupt insertion when browser storage is unavailable.
  }
}

export function resolvePaletteOnboardingWorkspaceId(
  activeDatasetId: string | null | undefined,
  datasetId: string | null | undefined,
): string | null {
  return activeDatasetId ?? datasetId ?? null;
}

export function shouldShowPaletteOnboarding(workspaceId: string | null): boolean {
  if (!workspaceId) return false;
  return !dismissedInMemory.has(workspaceId) && !readDismissedWorkspaceIds().has(workspaceId);
}

export function dismissPaletteOnboarding(workspaceId: string | null): void {
  if (!workspaceId) return;
  dismissedInMemory.add(workspaceId);
  const ids = readDismissedWorkspaceIds();
  if (ids.has(workspaceId)) return;
  ids.add(workspaceId);
  writeDismissedWorkspaceIds(ids);
}

export function resetPaletteOnboardingForTests(): void {
  dismissedInMemory.clear();
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
