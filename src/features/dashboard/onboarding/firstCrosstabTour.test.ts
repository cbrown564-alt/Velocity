import { describe, expect, it, beforeEach } from 'vitest';
import { recordPilotEvent, clearPilotEventLog } from '../../../services/pilotOnboarding';
import {
  completeFirstCrosstabTourStepDismissal,
  dismissFirstCrosstabTourStep,
  isFirstCrosstabTourDone,
  isFirstCrosstabTourStepDismissed,
  markFirstCrosstabTourDone,
  replayFirstCrosstabTour,
  resolveFirstCrosstabTourStep,
  shouldSuppressFirstRunCoaching,
  isFocusTipSeen,
  markFocusTipSeen,
} from './firstCrosstabTour';

describe('firstCrosstabTour', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPilotEventLog();
  });

  it('resolves tour steps from table config progress', () => {
    expect(resolveFirstCrosstabTourStep({ rowCount: 0, hasColumn: false, hasRenderedCrosstab: false })).toBe('rows');
    expect(resolveFirstCrosstabTourStep({ rowCount: 1, hasColumn: false, hasRenderedCrosstab: false })).toBe('columns');
    expect(resolveFirstCrosstabTourStep({ rowCount: 1, hasColumn: true, hasRenderedCrosstab: true })).toBe(
      'significance',
    );
  });

  it('returns null after tour is marked done', () => {
    markFirstCrosstabTourDone();
    expect(resolveFirstCrosstabTourStep({ rowCount: 0, hasColumn: false, hasRenderedCrosstab: false })).toBeNull();
  });

  it('persists dismiss per tour step', () => {
    dismissFirstCrosstabTourStep('rows');
    expect(isFirstCrosstabTourStepDismissed('rows')).toBe(true);
    expect(resolveFirstCrosstabTourStep({ rowCount: 0, hasColumn: false, hasRenderedCrosstab: false })).toBeNull();

    expect(resolveFirstCrosstabTourStep({ rowCount: 1, hasColumn: false, hasRenderedCrosstab: false })).toBe('columns');

    dismissFirstCrosstabTourStep('columns');
    expect(
      resolveFirstCrosstabTourStep({ rowCount: 1, hasColumn: true, hasRenderedCrosstab: true }),
    ).toBe('significance');

    dismissFirstCrosstabTourStep('significance');
    expect(isFirstCrosstabTourDone()).toBe(true);
    expect(
      resolveFirstCrosstabTourStep({ rowCount: 1, hasColumn: true, hasRenderedCrosstab: true }),
    ).toBeNull();
  });

  it('marks the tour done when any step is dismissed after a crosstab renders', () => {
    completeFirstCrosstabTourStepDismissal('significance', true);
    expect(isFirstCrosstabTourDone()).toBe(true);
    expect(isFirstCrosstabTourStepDismissed('significance')).toBe(true);
  });

  it('does not mark the tour done when dismissing pre-render steps', () => {
    completeFirstCrosstabTourStepDismissal('rows', false);
    expect(isFirstCrosstabTourDone()).toBe(false);
    expect(isFirstCrosstabTourStepDismissed('rows')).toBe(true);
  });

  it('suppresses first-run coaching after workspace reopen', () => {
    expect(shouldSuppressFirstRunCoaching()).toBe(false);
    recordPilotEvent('workspace_reopened', { datasetId: 'demo' });
    expect(shouldSuppressFirstRunCoaching()).toBe(true);
    expect(resolveFirstCrosstabTourStep({ rowCount: 1, hasColumn: true, hasRenderedCrosstab: true })).toBeNull();
  });

  it('replays tour by clearing flags', () => {
    markFirstCrosstabTourDone();
    markFocusTipSeen();
    dismissFirstCrosstabTourStep('rows');
    replayFirstCrosstabTour();
    expect(isFirstCrosstabTourDone()).toBe(false);
    expect(isFocusTipSeen()).toBe(false);
    expect(isFirstCrosstabTourStepDismissed('rows')).toBe(false);
  });
});
