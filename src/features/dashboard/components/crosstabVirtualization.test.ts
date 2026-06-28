import { describe, it, expect } from 'vitest';
import type { TableRowNode } from '../../../core/analysis/treeBuilder';
import {
  VIRTUALIZE_ROW_THRESHOLD,
  computeRowWindow,
  flattenVisibleRows,
  shouldVirtualizeRows,
} from './crosstabVirtualization';

function node(key: string, children: TableRowNode[] = []): TableRowNode {
  return {
    key,
    label: key,
    rawValue: key,
    depth: 0,
    cells: {},
    total: 0,
    children,
    rowPath: [],
  };
}

describe('flattenVisibleRows', () => {
  it('returns a flat list unchanged when there are no children', () => {
    const rows = [node('a'), node('b'), node('c')];
    expect(flattenVisibleRows(rows, {}).map((r) => r.key)).toEqual(['a', 'b', 'c']);
  });

  it('includes children of expanded nodes in display order (default expanded)', () => {
    const rows = [node('a', [node('a1'), node('a2')]), node('b')];
    expect(flattenVisibleRows(rows, {}).map((r) => r.key)).toEqual(['a', 'a1', 'a2', 'b']);
  });

  it('excludes children of collapsed nodes', () => {
    const rows = [node('a', [node('a1'), node('a2')]), node('b')];
    expect(flattenVisibleRows(rows, { a: false }).map((r) => r.key)).toEqual(['a', 'b']);
  });

  it('includes children when a node is explicitly expanded', () => {
    const rows = [node('a', [node('a1', [node('a1x')])])];
    expect(flattenVisibleRows(rows, { a: true, a1: true }).map((r) => r.key)).toEqual(['a', 'a1', 'a1x']);
  });
});

describe('shouldVirtualizeRows', () => {
  it('does not virtualize at or below the threshold', () => {
    expect(shouldVirtualizeRows(VIRTUALIZE_ROW_THRESHOLD)).toBe(false);
    expect(shouldVirtualizeRows(0)).toBe(false);
  });

  it('virtualizes above the threshold', () => {
    expect(shouldVirtualizeRows(VIRTUALIZE_ROW_THRESHOLD + 1)).toBe(true);
  });
});

describe('computeRowWindow', () => {
  it('returns the full range with no padding for an empty table', () => {
    expect(computeRowWindow({ scrollTop: 0, viewportHeight: 600, rowHeight: 30, rowCount: 0 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      topPadding: 0,
      bottomPadding: 0,
    });
  });

  it('renders the top window with no top padding when unscrolled', () => {
    const w = computeRowWindow({ scrollTop: 0, viewportHeight: 600, rowHeight: 30, rowCount: 1000, overscan: 8 });
    expect(w.startIndex).toBe(0);
    expect(w.topPadding).toBe(0);
    // ceil(600/30) = 20 visible + 8 overscan
    expect(w.endIndex).toBe(28);
    expect(w.bottomPadding).toBe((1000 - 28) * 30);
  });

  it('windows around the scroll position', () => {
    const w = computeRowWindow({ scrollTop: 3000, viewportHeight: 600, rowHeight: 30, rowCount: 1000, overscan: 8 });
    // firstVisible = 100
    expect(w.startIndex).toBe(92);
    expect(w.endIndex).toBe(128);
    expect(w.topPadding).toBe(92 * 30);
    expect(w.bottomPadding).toBe((1000 - 128) * 30);
  });

  it('subtracts the sticky header offset from the visible-row calculation', () => {
    const noOffset = computeRowWindow({ scrollTop: 300, viewportHeight: 600, rowHeight: 30, rowCount: 1000, overscan: 0 });
    const withOffset = computeRowWindow({
      scrollTop: 300,
      viewportHeight: 600,
      rowHeight: 30,
      rowCount: 1000,
      overscan: 0,
      headerOffset: 90,
    });
    // header offset pushes the first visible row earlier (300-90)/30 = 7 vs 300/30 = 10
    expect(noOffset.startIndex).toBe(10);
    expect(withOffset.startIndex).toBe(7);
  });

  it('clamps to the end of the list without negative bottom padding', () => {
    const w = computeRowWindow({ scrollTop: 1_000_000, viewportHeight: 600, rowHeight: 30, rowCount: 50, overscan: 8 });
    expect(w.endIndex).toBe(50);
    expect(w.bottomPadding).toBe(0);
  });
});
