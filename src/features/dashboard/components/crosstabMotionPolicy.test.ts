import { describe, it, expect } from 'vitest';
import type { TableRowNode } from '../../../core/analysis/treeBuilder';
import {
  MAX_ANIMATED_CROSSTAB_CELLS,
  countTreeNodes,
  shouldAnimateCrosstab,
} from './crosstabMotionPolicy';

/** Minimal node factory — only the fields countTreeNodes reads matter here. */
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

describe('countTreeNodes', () => {
  it('returns 0 for an empty tree', () => {
    expect(countTreeNodes([])).toBe(0);
  });

  it('counts a flat list of rows', () => {
    expect(countTreeNodes([node('a'), node('b'), node('c')])).toBe(3);
  });

  it('counts nested child rows', () => {
    const tree = [
      node('a', [node('a1'), node('a2')]),
      node('b', [node('b1', [node('b1a')])]),
    ];
    // a, a1, a2, b, b1, b1a = 6
    expect(countTreeNodes(tree)).toBe(6);
  });
});

describe('shouldAnimateCrosstab', () => {
  it('animates small result matrices', () => {
    expect(shouldAnimateCrosstab(5, 6)).toBe(true); // 30 cells
    expect(shouldAnimateCrosstab(20, 10)).toBe(true); // 200 cells
  });

  it('animates exactly at the threshold but not above it', () => {
    expect(shouldAnimateCrosstab(MAX_ANIMATED_CROSSTAB_CELLS, 1)).toBe(true);
    expect(shouldAnimateCrosstab(MAX_ANIMATED_CROSSTAB_CELLS + 1, 1)).toBe(false);
  });

  it('suppresses animation for wide banners', () => {
    expect(shouldAnimateCrosstab(20, 60)).toBe(false); // 1200 cells
  });

  it('suppresses animation for long multi-level tables', () => {
    expect(shouldAnimateCrosstab(600, 1)).toBe(false);
  });

  it('treats a column count of 0 as a single column (frequency table)', () => {
    // A no-banner frequency table still has one rendered value column.
    expect(shouldAnimateCrosstab(MAX_ANIMATED_CROSSTAB_CELLS, 0)).toBe(true);
    expect(shouldAnimateCrosstab(MAX_ANIMATED_CROSSTAB_CELLS + 1, 0)).toBe(false);
  });
});
