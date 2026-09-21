import { describe, it, expect } from 'vitest';
import { buildStripVariableIds, touchRecentVariableIds, MAX_RECENT_STRIP_ITEMS } from './recentVariableStrip';

describe('recentVariableStrip', () => {
  it('places pinned variables before recent and dedupes', () => {
    expect(buildStripVariableIds(['a', 'b'], ['b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('caps at MAX_RECENT_STRIP_ITEMS', () => {
    const pinned = ['p1', 'p2'];
    const recent = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'];
    expect(buildStripVariableIds(pinned, recent)).toHaveLength(MAX_RECENT_STRIP_ITEMS);
  });

  it('moves an existing id to the front', () => {
    expect(touchRecentVariableIds(['b', 'c'], 'c')).toEqual(['c', 'b']);
  });
});
