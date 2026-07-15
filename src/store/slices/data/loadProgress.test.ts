import { describe, expect, it, vi } from 'vitest';

import type { DataSliceSet } from './sliceContext';
import { createSetLoadProgress } from './loadProgress';

describe('createSetLoadProgress', () => {
  it('does not erase the dataset status when transient progress is cleared', () => {
    const set = vi.fn() as unknown as DataSliceSet;
    const setLoadProgress = createSetLoadProgress(set);

    setLoadProgress(null);

    const update = vi.mocked(set).mock.calls[0]?.[0];
    expect(update).toEqual({ loadProgress: null });
    expect(Object.keys(update ?? {})).toEqual(['loadProgress']);
  });
});
