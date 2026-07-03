import { describe, it, expect } from 'vitest';
import { MAX_ANIMATED_CROSSTAB_CELLS, shouldAnimateCrosstab } from './crosstabMotionPolicy';

describe('shouldAnimateCrosstab', () => {
  it('disables decorative cell animations on data surfaces (Phase 3 craft)', () => {
    expect(MAX_ANIMATED_CROSSTAB_CELLS).toBe(0);
    expect(shouldAnimateCrosstab(5, 6)).toBe(false);
    expect(shouldAnimateCrosstab(600, 1)).toBe(false);
  });
});
