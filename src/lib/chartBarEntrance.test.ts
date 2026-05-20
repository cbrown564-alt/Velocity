import { describe, expect, it } from 'vitest';
import { getBarEntranceMotionProps } from './chartBarEntrance';

describe('getBarEntranceMotionProps', () => {
  it('returns empty props when disabled', () => {
    expect(getBarEntranceMotionProps('vertical', 2, false)).toEqual({});
  });

  it('returns scaleY entrance for vertical bars', () => {
    const props = getBarEntranceMotionProps('vertical', 1, true);
    expect(props.initial).toEqual({ scaleY: 0 });
    expect(props.animate).toEqual({ scaleY: 1 });
    expect(props.transition?.delay).toBe(0.025);
  });

  it('returns scaleX entrance for horizontal bars', () => {
    const props = getBarEntranceMotionProps('horizontal', 0, true);
    expect(props.initial).toEqual({ scaleX: 0 });
    expect(props.animate).toEqual({ scaleX: 1 });
    expect(props.style?.transformOrigin).toBe('left center');
  });
});
