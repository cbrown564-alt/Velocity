/** First-crosstab inline coaching + Focus tip persistence (STAB-UI-F3.2 / PPR-005 / PPR-016). */

import { getPilotEventLog } from '../../../services/pilotOnboarding';
import { resetAllMicroTips } from './contextualMicroTips';

export type FirstCrosstabTourStep = 'rows' | 'columns' | 'significance';

const TOUR_DONE_KEY = 'velocity-first-crosstab-tour-done';
const STEP_DISMISSED_PREFIX = 'velocity-first-crosstab-tour-step-';
const FOCUS_TIP_KEY = 'velocity-focus-tip-seen';

const ALL_TOUR_STEPS: FirstCrosstabTourStep[] = ['rows', 'columns', 'significance'];

export const FIRST_CROSSTAB_TOUR_STEPS: Record<
  FirstCrosstabTourStep,
  { anchorTestId: string; title: string; body: string }
> = {
  rows: {
    anchorTestId: 'drop-zone-rows',
    title: 'Start with rows',
    body: 'Drag or click a variable here to define what each table row represents.',
  },
  columns: {
    anchorTestId: 'drop-zone-cols',
    title: 'Add a column break',
    body: 'Drop a second variable in Columns to build your first crosstab.',
  },
  significance: {
    anchorTestId: 'drop-zone-cols',
    title: 'Read the significance markers',
    body: 'Arrows and letters in cells show where groups differ. The footer explains the active test.',
  },
};

function readFlag(key: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(key) === '1';
}

function writeFlag(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, '1');
}

function clearFlag(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

function stepDismissedKey(step: FirstCrosstabTourStep): string {
  return `${STEP_DISMISSED_PREFIX}${step}`;
}

export function isFirstCrosstabTourStepDismissed(step: FirstCrosstabTourStep): boolean {
  return readFlag(stepDismissedKey(step));
}

export function dismissFirstCrosstabTourStep(step: FirstCrosstabTourStep): void {
  writeFlag(stepDismissedKey(step));
}

export function isFirstCrosstabTourDone(): boolean {
  if (readFlag(TOUR_DONE_KEY)) return true;
  return ALL_TOUR_STEPS.every((step) => isFirstCrosstabTourStepDismissed(step));
}

export function markFirstCrosstabTourDone(): void {
  writeFlag(TOUR_DONE_KEY);
}

export function resetFirstCrosstabTour(): void {
  clearFlag(TOUR_DONE_KEY);
  ALL_TOUR_STEPS.forEach((step) => clearFlag(stepDismissedKey(step)));
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_CROSSTAB_KEY);
  }
}

export function isFocusTipSeen(): boolean {
  return readFlag(FOCUS_TIP_KEY);
}

export function markFocusTipSeen(): void {
  writeFlag(FOCUS_TIP_KEY);
}

export function resetFocusTipSeen(): void {
  clearFlag(FOCUS_TIP_KEY);
}

export function replayFirstCrosstabTour(): void {
  resetFirstCrosstabTour();
  resetFocusTipSeen();
  resetAllMicroTips();
}

const SESSION_CROSSTAB_KEY = 'velocity-session-first-crosstab';

/** Mark that a crosstab rendered in this browser tab session (PPR-016). */
export function markSessionFirstCrosstab(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SESSION_CROSSTAB_KEY, '1');
}

function hasSessionFirstCrosstab(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(SESSION_CROSSTAB_KEY) === '1';
}

/** Suppress first-run coaching after workspace reopen or session resume (PPR-016). */
export function shouldSuppressFirstRunCoaching(): boolean {
  const events = getPilotEventLog();
  if (events.some((event) => event.name === 'workspace_reopened')) return true;
  const hadPriorCrosstab = events.some((event) => event.name === 'first_crosstab');
  return hadPriorCrosstab && !hasSessionFirstCrosstab();
}

export function completeFirstCrosstabTourStepDismissal(
  step: FirstCrosstabTourStep,
  hasRenderedCrosstab: boolean,
): void {
  dismissFirstCrosstabTourStep(step);
  if (hasRenderedCrosstab) {
    markFirstCrosstabTourDone();
  }
}

export function resolveFirstCrosstabTourStep(input: {
  rowCount: number;
  hasColumn: boolean;
  hasRenderedCrosstab: boolean;
  suppressFirstRun?: boolean;
}): FirstCrosstabTourStep | null {
  if (input.suppressFirstRun || shouldSuppressFirstRunCoaching() || isFirstCrosstabTourDone()) {
    return null;
  }

  if (input.hasRenderedCrosstab) {
    return isFirstCrosstabTourStepDismissed('significance') ? null : 'significance';
  }

  if (input.rowCount > 0) {
    return isFirstCrosstabTourStepDismissed('columns') ? null : 'columns';
  }

  return isFirstCrosstabTourStepDismissed('rows') ? null : 'rows';
}
