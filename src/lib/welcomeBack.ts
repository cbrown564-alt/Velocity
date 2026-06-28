/**
 * Pure timing primitives for the "welcome back after an absence" behavior
 * (shared kernel — see arch_01 §5).
 *
 * Shared by the workspace feature (welcome-back card display) and the UI store
 * slice (activity touch). Framework-agnostic: no React, store, or engine deps.
 * Both halves must use the same absence threshold, so it lives here rather than
 * in either consumer.
 */

export const MS_THREE_DAYS = 3 * 86_400_000;

export type ActivityTouchState = {
  lastActiveAt: number;
  welcomeBackDismissed: boolean;
};

/** Partial state patch for `touchLastActiveAt` — pure, no store dependencies. */
export function computeActivityTouchPatch(state: ActivityTouchState, now = Date.now()): Partial<ActivityTouchState> {
  const returningAfterAbsence = state.lastActiveAt > 0 && now - state.lastActiveAt >= MS_THREE_DAYS;
  if (returningAfterAbsence) {
    return { welcomeBackDismissed: false };
  }
  return { lastActiveAt: now };
}

/** Whether the welcome-back card should appear after a long absence. */
export function shouldShowWelcomeBack(lastActiveAt: number, welcomeBackDismissed: boolean, now = Date.now()): boolean {
  if (welcomeBackDismissed) return false;
  if (!lastActiveAt || lastActiveAt <= 0) return false;
  return now - lastActiveAt >= MS_THREE_DAYS;
}
