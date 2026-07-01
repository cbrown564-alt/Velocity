import { describe, expect, it, beforeEach } from 'vitest';
import {
  isFirstCrosstabTourDone,
  markFirstCrosstabTourDone,
  replayFirstCrosstabTour,
  resolveFirstCrosstabTourStep,
  isFocusTipSeen,
  markFocusTipSeen,
} from './firstCrosstabTour';

describe('firstCrosstabTour', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves tour steps from table config progress', () => {
    expect(resolveFirstCrosstabTourStep({ rowCount: 0, hasColumn: false, hasRenderedCrosstab: false })).toBe('rows');
    expect(resolveFirstCrosstabTourStep({ rowCount: 1, hasColumn: false, hasRenderedCrosstab: false })).toBe('columns');
    expect(
      resolveFirstCrosstabTourStep({ rowCount: 1, hasColumn: true, hasRenderedCrosstab: true }),
    ).toBe('significance');
  });

  it('returns null after tour is marked done', () => {
    markFirstCrosstabTourDone();
    expect(resolveFirstCrosstabTourStep({ rowCount: 0, hasColumn: false, hasRenderedCrosstab: false })).toBeNull();
  });

  it('replays tour by clearing flags', () => {
    markFirstCrosstabTourDone();
    markFocusTipSeen();
    replayFirstCrosstabTour();
    expect(isFirstCrosstabTourDone()).toBe(false);
    expect(isFocusTipSeen()).toBe(false);
  });
});
