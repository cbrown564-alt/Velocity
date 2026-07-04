import { describe, expect, it } from 'vitest';
import { getPrimaryVariable, getVariableRowDisplay } from './variableRowMeta';
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
      valueLabels: [
        { value: 1, label: 'Female' },
        { value: 2, label: 'Male' },
      ],
      missingValues: {},
    },
  ],
};

describe('variableRowMeta', () => {
  it('resolves primary variable from dataset', () => {
    const set: VariableSet = {
      id: 'vs_gender',
      name: 'Gender',
      variableIds: ['v_gender'],
      structure: 'single',
      type: 'categorical',
    };
    expect(getPrimaryVariable(set, dataset)?.name).toBe('d2_gender');
    expect(getPrimaryVariable(set, null)).toBeNull();
  });

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
      numeric: { mean: 38.4, min: 18, max: 72, median: 37, stdDev: 10, q1: 30, q3: 45, histogramBins: [] },
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

  it('returns top-category meta for categorical sets', () => {
    const genderStats: VariableStatsResult = {
      column: 'd2_gender',
      frequencies: [
        { value: 1, count: 60 },
        { value: 2, count: 40 },
      ],
      missingCount: 0,
      totalCount: 100,
    };
    const genderSet: VariableSet = {
      id: 'vs_gender',
      name: 'Gender',
      variableIds: ['v_gender'],
      structure: 'single',
      type: 'categorical',
    };
    const display = getVariableRowDisplay(genderSet, dataset, genderStats);
    expect(display.meta).toBe('Female 60%');
  });

  it('returns multiple-structure meta', () => {
    const multiSet: VariableSet = {
      id: 'vs_multi',
      name: 'Battery',
      variableIds: ['v1', 'v2', 'v3'],
      structure: 'multiple',
      type: 'categorical',
    };
    const display = getVariableRowDisplay(multiSet, dataset, null);
    expect(display.meta).toBe('Multi (3)');
  });

  it('returns valid-count meta for date variables', () => {
    const dateSet: VariableSet = {
      id: 'vs_date',
      name: 'Interview date',
      variableIds: ['v_date'],
      structure: 'single',
      type: 'date',
    };
    const dateStats: VariableStatsResult = {
      column: 'interview_date',
      frequencies: [],
      missingCount: 5,
      totalCount: 100,
    };
    const display = getVariableRowDisplay(dateSet, dataset, dateStats);
    expect(display.meta).toBe('95 valid');
  });
});
