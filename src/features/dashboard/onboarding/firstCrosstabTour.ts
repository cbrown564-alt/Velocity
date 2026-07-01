/** First-crosstab spotlight tour + Focus tip persistence (STAB-UI-F3.2 / F2.1). */

export type FirstCrosstabTourStep = 'rows' | 'columns' | 'significance';

const TOUR_DONE_KEY = 'velocity-first-crosstab-tour-done';
const FOCUS_TIP_KEY = 'velocity-focus-tip-seen';

export const FIRST_CROSSTAB_TOUR_STEPS: Record<FirstCrosstabTourStep, { target: string; title: string; body: string }> =
  {
    rows: {
      target: '[data-testid="drop-zone-rows"]',
      title: 'Start with rows',
      body: 'Drag or click a variable here to define what each table row represents.',
    },
    columns: {
      target: '[data-testid="drop-zone-cols"]',
      title: 'Add a column break',
      body: 'Drop a second variable in Columns to build your first crosstab.',
    },
    significance: {
      target: '.statistics-status-bar',
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

export function isFirstCrosstabTourDone(): boolean {
  return readFlag(TOUR_DONE_KEY);
}

export function markFirstCrosstabTourDone(): void {
  writeFlag(TOUR_DONE_KEY);
}

export function resetFirstCrosstabTour(): void {
  clearFlag(TOUR_DONE_KEY);
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
}

export function resolveFirstCrosstabTourStep(input: {
  rowCount: number;
  hasColumn: boolean;
  hasRenderedCrosstab: boolean;
}): FirstCrosstabTourStep | null {
  if (isFirstCrosstabTourDone()) return null;
  if (input.hasRenderedCrosstab) return 'significance';
  if (input.hasColumn || input.rowCount > 0) return input.rowCount > 0 ? 'columns' : 'rows';
  return 'rows';
}
