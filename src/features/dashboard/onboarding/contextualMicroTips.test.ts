import { describe, it, expect, beforeEach } from 'vitest';
import {
  dismissContextualTip,
  getContextualTipCounters,
  isContextualTipDismissed,
  recordContextualTipEvent,
  resetContextualTips,
  resolveActiveContextualTip,
  TIP_TRIGGER_THRESHOLDS,
} from './contextualMicroTips';

describe('contextualMicroTips', () => {
  beforeEach(() => {
    resetContextualTips();
  });

  it('shows export tip after enough crosstab renders', () => {
    for (let i = 0; i < TIP_TRIGGER_THRESHOLDS.crosstabRenders; i += 1) {
      recordContextualTipEvent('crosstab-render');
    }

    expect(resolveActiveContextualTip(getContextualTipCounters())).toBe('export');
  });

  it('shows variable-manager tip after crosstab renders when export was opened', () => {
    for (let i = 0; i < TIP_TRIGGER_THRESHOLDS.crosstabRenders; i += 1) {
      recordContextualTipEvent('crosstab-render');
    }
    recordContextualTipEvent('export-open');

    expect(resolveActiveContextualTip(getContextualTipCounters())).toBe('variable-manager');
  });

  it('shows focus tip after slide navigations', () => {
    recordContextualTipEvent('crosstab-render');
    for (let i = 0; i < TIP_TRIGGER_THRESHOLDS.slideNavigations; i += 1) {
      recordContextualTipEvent('slide-navigation');
    }

    expect(resolveActiveContextualTip(getContextualTipCounters())).toBe('focus');
  });

  it('does not resurface dismissed tips', () => {
    for (let i = 0; i < TIP_TRIGGER_THRESHOLDS.crosstabRenders; i += 1) {
      recordContextualTipEvent('crosstab-render');
    }
    dismissContextualTip('export');

    expect(isContextualTipDismissed('export')).toBe(true);
    expect(resolveActiveContextualTip(getContextualTipCounters())).toBe('variable-manager');
  });
});
