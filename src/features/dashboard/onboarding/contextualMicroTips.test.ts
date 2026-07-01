import { describe, it, expect, beforeEach } from 'vitest';
import { clearPilotEventLog, recordPilotEvent } from '../../../services/pilotOnboarding';
import {
  dismissMicroTip,
  getMicroTipActionCount,
  incrementMicroTipAction,
  isMicroTipDismissed,
  isMicroTipEligible,
  resetAllMicroTips,
  resolveActiveMicroTip,
} from './contextualMicroTips';
import { shouldSuppressFirstRunCoaching } from './firstCrosstabTour';

describe('contextualMicroTips', () => {
  beforeEach(() => {
    resetAllMicroTips();
    sessionStorage.clear();
    clearPilotEventLog();
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

  it('does not resolve tips when first-run coaching is suppressed', () => {
    incrementMicroTipAction('focus');
    expect(resolveActiveMicroTip()?.id).toBe('focus');

    recordPilotEvent('workspace_reopened', { datasetId: 'demo' });
    expect(shouldSuppressFirstRunCoaching()).toBe(true);
    expect(resolveActiveMicroTip({ suppressFirstRun: true })).toBeNull();
  });

  it('keeps dismissed tips ineligible after action counts increase', () => {
    incrementMicroTipAction('export');
    incrementMicroTipAction('export');
    dismissMicroTip('export');

    incrementMicroTipAction('export');
    incrementMicroTipAction('export');
    expect(isMicroTipEligible('export')).toBe(false);
    expect(resolveActiveMicroTip()).toBeNull();
  });
});
