/** Contextual micro-tips persistence and action counting (STAB-UI-F3.3). */

export type MicroTipId = 'focus' | 'export' | 'variable-manager';

export interface MicroTipDefinition {
  id: MicroTipId;
  title: string;
  body: string;
  /** Minimum action count before the tip becomes eligible. */
  actionThreshold: number;
  anchorTestId: string;
}

const DISMISSED_PREFIX = 'velocity-micro-tip-dismissed-';
const ACTION_COUNT_PREFIX = 'velocity-micro-tip-actions-';

export const MICRO_TIP_DEFINITIONS: Record<MicroTipId, MicroTipDefinition> = {
  focus: {
    id: 'focus',
    title: 'Presentation-ready view',
    body: 'Press F for Focus mode when you want a cleaner, client-facing layout.',
    actionThreshold: 1,
    anchorTestId: 'focus-mode-toggle',
  },
  export: {
    id: 'export',
    title: 'Export to PowerPoint',
    body: 'Use Export when your crosstab is ready — deck output keeps editable charts and tables.',
    actionThreshold: 2,
    anchorTestId: 'export-slide-button',
  },
  'variable-manager': {
    id: 'variable-manager',
    title: 'Browse variables',
    body: 'Press D to open Variable Manager for labels, recodes, and distribution checks.',
    actionThreshold: 1,
    anchorTestId: 'mode-toggle-variables',
  },
};

/** Priority when multiple tips are eligible — show one at a time. */
export const MICRO_TIP_PRIORITY: MicroTipId[] = ['focus', 'export', 'variable-manager'];

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

function readActionCount(id: MicroTipId): number {
  if (typeof sessionStorage === 'undefined') return 0;
  const raw = sessionStorage.getItem(`${ACTION_COUNT_PREFIX}${id}`);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeActionCount(id: MicroTipId, count: number): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(`${ACTION_COUNT_PREFIX}${id}`, String(count));
}

export function isMicroTipDismissed(id: MicroTipId): boolean {
  return readFlag(`${DISMISSED_PREFIX}${id}`);
}

export function dismissMicroTip(id: MicroTipId): void {
  writeFlag(`${DISMISSED_PREFIX}${id}`);
}

export function resetMicroTip(id: MicroTipId): void {
  clearFlag(`${DISMISSED_PREFIX}${id}`);
  writeActionCount(id, 0);
}

export function resetAllMicroTips(): void {
  MICRO_TIP_PRIORITY.forEach(resetMicroTip);
}

export function getMicroTipActionCount(id: MicroTipId): number {
  return readActionCount(id);
}

export function incrementMicroTipAction(id: MicroTipId): number {
  const next = readActionCount(id) + 1;
  writeActionCount(id, next);
  return next;
}

export function isMicroTipEligible(id: MicroTipId): boolean {
  if (isMicroTipDismissed(id)) return false;
  const definition = MICRO_TIP_DEFINITIONS[id];
  return readActionCount(id) >= definition.actionThreshold;
}

export function resolveActiveMicroTip(options?: { suppressFirstRun?: boolean }): MicroTipDefinition | null {
  if (options?.suppressFirstRun) return null;
  for (const id of MICRO_TIP_PRIORITY) {
    if (isMicroTipEligible(id)) {
      return MICRO_TIP_DEFINITIONS[id];
    }
  }
  return null;
}
