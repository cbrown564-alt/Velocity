import { describe, it, expect, beforeEach } from 'vitest';
import { useVelocityStore } from '../../store';

describe('UISlice recent variable strip (DESIGN-CONV-C)', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      pinnedVariableSetIds: [],
      recentVariableSetIds: [],
      recentStripCollapsed: false,
    });
  });

  it('records MRU order via recordRecentVariableSet', () => {
    const { recordRecentVariableSet } = useVelocityStore.getState();
    recordRecentVariableSet('a');
    recordRecentVariableSet('b');
    recordRecentVariableSet('a');
    expect(useVelocityStore.getState().recentVariableSetIds).toEqual(['a', 'b']);
  });

  it('toggles pinned membership', () => {
    const { togglePinnedVariableSet } = useVelocityStore.getState();
    togglePinnedVariableSet('gender');
    expect(useVelocityStore.getState().pinnedVariableSetIds).toEqual(['gender']);
  });
});
