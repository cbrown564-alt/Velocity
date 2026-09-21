import { useEffect } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVelocityStore } from '../../../store';
import { mockDataset } from '../../../test/fixtures/variables';
import { useCanvasHandoff } from './useCanvasHandoff';

describe('useCanvasHandoff', () => {
  it('leaves example onboarding in charge of the first analysis', () => {
    useVelocityStore.setState({
      dataset: { ...mockDataset, name: 'brandtracker_w4.sav' },
      tableConfig: { rowVars: [], colVar: null },
      canvasHandoffTrigger: 'fresh_upload',
      hasSeenCanvasHandoff: false,
      hasSeenAutoCrosstab: false,
      commandPaletteOpen: false,
    });
    renderHook(() => useCanvasHandoff());
    expect(useVelocityStore.getState().commandPaletteOpen).toBe(false);
  });

  it('does not cover an analysis created by another mount effect with the palette', () => {
    useVelocityStore.setState({
      dataset: mockDataset,
      tableConfig: { rowVars: [], colVar: null },
      canvasHandoffTrigger: 'fresh_upload',
      hasSeenCanvasHandoff: false,
      commandPaletteOpen: false,
    });
    renderHook(() => {
      // The example crosstab effect runs in the child slide before the parent handoff.
      useEffect(() => {
        useVelocityStore.setState({ tableConfig: { rowVars: ['gender'], colVar: 'region' } });
      }, []);
      useCanvasHandoff();
    });
    expect(useVelocityStore.getState().commandPaletteOpen).toBe(false);
    expect(useVelocityStore.getState().canvasHandoffTrigger).toBeNull();
  });
});
