import { describe, it, expect } from 'vitest';
import {
  VIRTUALIZE_COL_THRESHOLD,
  VIRTUALIZED_COL_WIDTH,
  VIRTUALIZED_ROW_LABEL_WIDTH,
  VIRTUALIZED_TOTAL_COL_WIDTH,
  computeColWindow,
  shouldVirtualizeCols,
  virtualizedTableWidth,
} from './crosstabColumnVirtualization';

describe('shouldVirtualizeCols', () => {
  it('does not virtualize at or below the threshold', () => {
    expect(shouldVirtualizeCols(VIRTUALIZE_COL_THRESHOLD)).toBe(false);
    expect(shouldVirtualizeCols(0)).toBe(false);
  });

  it('virtualizes above the threshold', () => {
    expect(shouldVirtualizeCols(VIRTUALIZE_COL_THRESHOLD + 1)).toBe(true);
  });
});

describe('virtualizedTableWidth', () => {
  it('sums row-label, data columns, and the total column', () => {
    expect(virtualizedTableWidth(50, true)).toBe(
      VIRTUALIZED_ROW_LABEL_WIDTH + 50 * VIRTUALIZED_COL_WIDTH + VIRTUALIZED_TOTAL_COL_WIDTH,
    );
  });

  it('omits the total column width when there is no total column', () => {
    expect(virtualizedTableWidth(50, false)).toBe(VIRTUALIZED_ROW_LABEL_WIDTH + 50 * VIRTUALIZED_COL_WIDTH);
  });
});

describe('computeColWindow', () => {
  it('returns the full range with no padding for an empty banner', () => {
    expect(computeColWindow({ scrollLeft: 0, viewportWidth: 1000, colWidth: 112, colCount: 0 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      leftPadding: 0,
      rightPadding: 0,
    });
  });

  it('renders the left window with no left padding when unscrolled', () => {
    const w = computeColWindow({ scrollLeft: 0, viewportWidth: 1000, colWidth: 100, colCount: 100, overscan: 4 });
    expect(w.startIndex).toBe(0);
    expect(w.leftPadding).toBe(0);
    // ceil(1000/100) = 10 visible + 4 overscan
    expect(w.endIndex).toBe(14);
    expect(w.rightPadding).toBe((100 - 14) * 100);
  });

  it('windows around the horizontal scroll position', () => {
    const w = computeColWindow({ scrollLeft: 5000, viewportWidth: 1000, colWidth: 100, colCount: 100, overscan: 4 });
    // firstVisible = 50
    expect(w.startIndex).toBe(46);
    expect(w.endIndex).toBe(64);
    expect(w.leftPadding).toBe(46 * 100);
    expect(w.rightPadding).toBe((100 - 64) * 100);
  });

  it('subtracts the row-label column offset from the visible-column calculation', () => {
    const noOffset = computeColWindow({
      scrollLeft: 1000,
      viewportWidth: 1000,
      colWidth: 100,
      colCount: 100,
      overscan: 0,
    });
    const withOffset = computeColWindow({
      scrollLeft: 1000,
      viewportWidth: 1000,
      colWidth: 100,
      colCount: 100,
      overscan: 0,
      leftOffset: 240,
    });
    // the row-label offset pushes the first visible column earlier: (1000-240)/100 = 7 vs 1000/100 = 10
    expect(noOffset.startIndex).toBe(10);
    expect(withOffset.startIndex).toBe(7);
  });

  it('clamps to the end of the banner without negative right padding', () => {
    const w = computeColWindow({
      scrollLeft: 1_000_000,
      viewportWidth: 1000,
      colWidth: 100,
      colCount: 20,
      overscan: 4,
    });
    expect(w.endIndex).toBe(20);
    expect(w.rightPadding).toBe(0);
  });
});
