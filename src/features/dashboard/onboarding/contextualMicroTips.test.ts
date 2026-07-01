import { describe, it, expect, beforeEach } from 'vitest';
import {
  dismissMicroTip,
  getMicroTipActionCount,
  incrementMicroTipAction,
  isMicroTipDismissed,
  isMicroTipEligible,
  resetAllMicroTips,
  resolveActiveMicroTip,
} from './contextualMicroTips';

describe('contextualMicroTips', () => {
  beforeEach(() => {
    resetAllMicroTips();
    sessionStorage.clear();
  });

  it('shows a tip once the action threshold is met', () => {
    expect(isMicroTipEligible('focus')).toBe(false);
    incrementMicroTipAction('focus');
    expect(isMicroTipEligible('focus')).toBe(true);
    expect(resolveActiveMicroTip()?.id).toBe('focus');
  });

  it('respects dismissal and priority ordering', () => {
    incrementMicroTipAction('focus');
    incrementMicroTipAction('export');
    incrementMicroTipAction('export');

    expect(resolveActiveMicroTip()?.id).toBe('focus');

    dismissMicroTip('focus');
    expect(resolveActiveMicroTip()?.id).toBe('export');
    expect(isMicroTipDismissed('focus')).toBe(true);
  });

  it('tracks action counts in session storage', () => {
    incrementMicroTipAction('variable-manager');
    expect(getMicroTipActionCount('variable-manager')).toBe(1);
  });
});
