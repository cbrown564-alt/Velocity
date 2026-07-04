import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useVelocityStore } from './index';
import { materializeBrandTrackerFunnelSkeleton } from '../core/deckTemplates/brandTrackerSkeleton';
import type { Variable, VariableSet } from '../types';

describe('applyDeckTemplate', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      slides: [
        {
          id: 'slide-test-1',
          title: 'New Slide',
          subtitle: '',
          analysisState: { rowVars: [], colVar: null, filters: [], weightVar: null },
          visualizationType: 'table',
          layoutMode: 'focus',
          cells: [{ id: 'cell-test-1', content: { type: 'table' } }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      sections: [],
      activeSlideId: 'slide-test-1',
      activeCellId: 'cell-test-1',
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
    });
  });

  it('replaces slides and sections with a materialized template', () => {
    const sets: VariableSet[] = [
      { id: 'vs_aware', name: 'Awareness', variableIds: ['aware_atlas'], structure: 'single', hidden: false },
    ];
    const variables: Variable[] = [
      {
        id: 'aware_atlas',
        name: 'aware_atlas',
        label: 'aware_atlas',
        type: 'categorical',
        valueLabels: [],
        missingValues: {},
      },
    ];
    act(() => {
      useVelocityStore.getState().applyDeckTemplate(materializeBrandTrackerFunnelSkeleton(sets, variables));
    });
    expect(useVelocityStore.getState().slides).toHaveLength(3);
    expect(useVelocityStore.getState().tableConfig.rowVars).toEqual(['vs_aware']);
  });

  it('triggers analysis when rows are bound', () => {
    const runAnalysis = vi.fn().mockResolvedValue(undefined);
    useVelocityStore.setState({
      runAnalysis,
      browserEngine: {} as never,
      dataset: { id: 'ds', name: 'test.sav', variables: [], rowCount: 0 } as never,
    });
    const sets: VariableSet[] = [
      { id: 'vs_aware', name: 'Awareness', variableIds: ['aware_atlas'], structure: 'single', hidden: false },
    ];
    const variables: Variable[] = [
      {
        id: 'aware_atlas',
        name: 'aware_atlas',
        label: 'aware_atlas',
        type: 'categorical',
        valueLabels: [],
        missingValues: {},
      },
    ];
    act(() => {
      useVelocityStore.getState().applyDeckTemplate(materializeBrandTrackerFunnelSkeleton(sets, variables));
    });
    expect(runAnalysis).toHaveBeenCalled();
  });
});
