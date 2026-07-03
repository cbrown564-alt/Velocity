import { describe, expect, it } from 'vitest';
import { getVariableRowDisplay } from './variableRowMeta';
import type { Dataset, VariableSet } from '../../types/dataset';
import type { VariableStatsResult } from '../../types/worker';

const dataset: Dataset = {
  id: 'd1',
  name: 'test.sav',
  rowCount: 100,
  source: 'sav',
  variables: [
    {
      id: 'v_gender',
      name: 'd2_gender',
      label: 'D2. Gender',
      type: 'categorical',
      valueLabels: [{ value: 1, label: 'Female' }, { value: 2, label: 'Male' }],
      missingValues: {},
    },
  ],
};

describe('variableRowMeta', () => {
  it('returns structure meta for multi-variable sets', () => {
    const gridSet: VariableSet = {
      id: 'vs_grid',
      name: 'Attitude grid',
      variableIds: ['v1', 'v2', 'v3', 'v4', 'v5'],
      structure: 'grid',
      type: 'categorical',
    };
    const display = getVariableRowDisplay(gridSet, dataset, null);
    expect(display.meta).toBe('Grid · 5');
  });

  it('returns mean meta for numeric sets', () => {
    const ageStats: VariableStatsResult = {
      column: 'd1_age',
      frequencies: [],
      missingCount: 0,
      totalCount: 100,
      numeric: { mean: 38.4, min: 18, max: 72, stdDev: 10, histogramBins: [] },
    };
    const ageSet: VariableSet = {
      id: 'vs_age',
      name: 'Age',
      variableIds: ['v_age'],
      structure: 'single',
      type: 'numeric',
    };
    const display = getVariableRowDisplay(ageSet, dataset, ageStats);
    expect(display.meta).toBe('μ 38.4');
  });
});
