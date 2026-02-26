import { describe, expect, it } from 'vitest';
import { filterSyntheticGridShellSets, isSyntheticGridShellSet } from './variableSetFilters';
import type { Dataset, VariableSet } from '../../store/slices/dataSlice';

const dataset: Dataset = {
  id: 'd1',
  name: 'test.sav',
  rowCount: 10,
  source: 'sav',
  variables: [
    {
      id: 'heuristic_grid_fatigue1_fatigue2_fatigue3_scale',
      name: 'fatigue_scale',
      label: 'fatigue',
      type: 'ordered',
      orderedStyle: 'rating',
      orderedScoring: 'allow_numeric_stats',
      valueLabels: [],
      missingValues: {},
      synthetic: true,
      sourceGridId: 'heuristic_grid_fatigue1_fatigue2_fatigue3',
    },
    {
      id: 'q_scale',
      name: 'q_scale',
      label: 'q scale',
      type: 'numeric',
      valueLabels: [],
      missingValues: {},
      synthetic: false,
    },
  ],
};

describe('variableSetFilters', () => {
  it('identifies synthetic grid shell sets', () => {
    const shellSet: VariableSet = {
      id: 'heuristic_grid_fatigue1_fatigue2_fatigue3_scale',
      name: 'fatigue',
      variableIds: ['heuristic_grid_fatigue1_fatigue2_fatigue3_scale'],
      structure: 'single',
      type: 'ordered',
    };

    expect(isSyntheticGridShellSet(shellSet, dataset)).toBe(true);
  });

  it('does not hide non-synthetic variables that happen to end with _scale/_items', () => {
    const regularSet: VariableSet = {
      id: 'vs_q_scale',
      name: 'q scale',
      variableIds: ['q_scale'],
      structure: 'single',
      type: 'numeric',
    };

    expect(isSyntheticGridShellSet(regularSet, dataset)).toBe(false);
  });

  it('filters only synthetic grid shell sets', () => {
    const sets: VariableSet[] = [
      {
        id: 'heuristic_grid_fatigue1_fatigue2_fatigue3_scale',
        name: 'fatigue',
        variableIds: ['heuristic_grid_fatigue1_fatigue2_fatigue3_scale'],
        structure: 'single',
        type: 'ordered',
      },
      {
        id: 'heuristic_grid_fatigue1_fatigue2_fatigue3',
        name: 'fatigue',
        variableIds: ['fatigue1', 'fatigue2', 'fatigue3'],
        structure: 'grid',
        type: 'ordered',
      },
      {
        id: 'vs_q_scale',
        name: 'q scale',
        variableIds: ['q_scale'],
        structure: 'single',
        type: 'numeric',
      },
    ];

    const visible = filterSyntheticGridShellSets(sets, dataset);
    expect(visible.map(v => v.id)).toEqual([
      'heuristic_grid_fatigue1_fatigue2_fatigue3',
      'vs_q_scale',
    ]);
  });
});
