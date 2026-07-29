import { describe, expect, it } from 'vitest';
import { useVelocityStore } from '../index';

/**
 * DESIGN-CONV-Q5: focus mode must stay retired.
 * Default Analysis Canvas chrome is the presentation surface.
 */
describe('DESIGN-CONV-Q5 focus mode retirement', () => {
  it('does not expose focus mode state or actions on the store', () => {
    const state = useVelocityStore.getState() as Record<string, unknown>;

    expect(state).not.toHaveProperty('focusMode');
    expect(state).not.toHaveProperty('setFocusMode');
    expect(state).not.toHaveProperty('toggleFocusMode');
  });
});
