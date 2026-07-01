/** Contextual micro-tips shown after repeated actions (STAB-UI-F3.3). */

export type ContextualTipId = 'focus' | 'export' | 'variable-manager';

export interface ContextualTipDefinition {
  id: ContextualTipId;
  title: string;
  body: string;
  actionLabel?: string;
}

const DISMISSED_KEY = 'velocity-contextual-tips-dismissed';
const COUNTERS_KEY = 'velocity-contextual-tip-counters';

export const CONTEXTUAL_TIPS: Record<ContextualTipId, ContextualTipDefinition> = {
  focus: {
    id: 'focus',
    title: 'Client-ready layout',
    body: 'Press F to hide chrome and present a cleaner slide artifact.',
    actionLabel: 'Try Focus',
  },
  export: {
    id: 'export',
    title: 'Export your deck',
    body: 'Send this slide to PowerPoint or Excel when the table looks right.',
    actionLabel: 'Open Export',
  },
  'variable-manager': {
    id: 'variable-manager',
    title: 'Recoding lives in Variable Manager',
    body: 'Press D to group values, fix labels, or inspect distributions without leaving the dataset.',
    actionLabel: 'Open Manager',
  },
};

export const TIP_TRIGGER_THRESHOLDS = {
  crosstabRenders: 2,
  slideNavigations: 3,
} as const;

type TipCounters = {
  crosstabRenders: number;
  slideNavigations: number;
  variableManagerOpened: boolean;
  exportOpened: boolean;
  focusModeUsed: boolean;
};

const DEFAULT_COUNTERS: TipCounters = {
  crosstabRenders: 0,
  slideNavigations: 0,
  variableManagerOpened: false,
  exportOpened: false,
  focusModeUsed: false,
};

function readDismissed(): Set<ContextualTipId> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as ContextualTipId[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<ContextualTipId>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function readCounters(): TipCounters {
  if (typeof sessionStorage === 'undefined') return { ...DEFAULT_COUNTERS };
  try {
    const raw = sessionStorage.getItem(COUNTERS_KEY);
    if (!raw) return { ...DEFAULT_COUNTERS };
    return { ...DEFAULT_COUNTERS, ...(JSON.parse(raw) as Partial<TipCounters>) };
  } catch {
    return { ...DEFAULT_COUNTERS };
  }
}

function writeCounters(counters: TipCounters): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
}

export function isContextualTipDismissed(id: ContextualTipId): boolean {
  return readDismissed().has(id);
}

export function dismissContextualTip(id: ContextualTipId): void {
  const dismissed = readDismissed();
  dismissed.add(id);
  writeDismissed(dismissed);
}

export function resetContextualTips(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DISMISSED_KEY);
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(COUNTERS_KEY);
  }
}

export function recordContextualTipEvent(
  event: 'crosstab-render' | 'slide-navigation' | 'variable-manager-open' | 'export-open' | 'focus-mode',
): TipCounters {
  const counters = readCounters();

  switch (event) {
    case 'crosstab-render':
      counters.crosstabRenders += 1;
      break;
    case 'slide-navigation':
      counters.slideNavigations += 1;
      break;
    case 'variable-manager-open':
      counters.variableManagerOpened = true;
      break;
    case 'export-open':
      counters.exportOpened = true;
      break;
    case 'focus-mode':
      counters.focusModeUsed = true;
      break;
  }

  writeCounters(counters);
  return counters;
}

export function getContextualTipCounters(): TipCounters {
  return readCounters();
}

export function resolveActiveContextualTip(counters: TipCounters): ContextualTipId | null {
  const dismissed = readDismissed();

  if (
    !dismissed.has('export') &&
    !counters.exportOpened &&
    counters.crosstabRenders >= TIP_TRIGGER_THRESHOLDS.crosstabRenders
  ) {
    return 'export';
  }

  if (
    !dismissed.has('variable-manager') &&
    !counters.variableManagerOpened &&
    counters.crosstabRenders >= TIP_TRIGGER_THRESHOLDS.crosstabRenders
  ) {
    return 'variable-manager';
  }

  if (
    !dismissed.has('focus') &&
    !counters.focusModeUsed &&
    counters.crosstabRenders >= 1 &&
    counters.slideNavigations >= TIP_TRIGGER_THRESHOLDS.slideNavigations
  ) {
    return 'focus';
  }

  return null;
}
