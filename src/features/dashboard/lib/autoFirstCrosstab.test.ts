import { describe, it, expect } from 'vitest';
import type { Variable, VariableSet } from '../../../types';
import {
  pickAutoFirstCrosstabPair,
  resolveAutoCrosstabTableConfig,
  resolveExampleDatasetWeightVariable,
} from './autoFirstCrosstab';

function set(overrides: Partial<VariableSet> & { id: string; name: string }): VariableSet {
  return {
    variableIds: ['v1'],
    structure: 'single',
    hidden: false,
    ...overrides,
  };
}

function variable(overrides: Partial<Variable> & { id: string; name: string }): Variable {
  return {
    label: overrides.name,
    type: 'categorical',
    valueLabels: [],
    missingValues: {},
    ...overrides,
  };
}

describe('pickAutoFirstCrosstabPair', () => {
  it('prefers gender × region on mock_data.csv', () => {
    const sets = [
      set({ id: 'id', name: 'id' }),
      set({ id: 'g', name: 'gender' }),
      set({ id: 'r', name: 'region' }),
      set({ id: 'sat', name: 'product sat' }),
    ];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets)).toEqual({
      rowSetId: 'g',
      colSetId: 'r',
    });
  });

  it('matches gender and region with spaced names', () => {
    const sets = [
      set({ id: 'g', name: 'Gender' }),
      set({ id: 'r', name: 'age group' }),
      set({ id: 'x', name: 'Region' }),
    ];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets)).toEqual({
      rowSetId: 'g',
      colSetId: 'x',
    });
  });

  it('prefers brand preference × segment on brandtracker_w4.sav', () => {
    const sets = [
      set({ id: 'vs_resp_id', name: 'Respondent ID', variableIds: ['resp_id'] }),
      set({ id: 'vs_segment', name: 'SEG. Consumer segment (from segmentation model)', variableIds: ['segment'] }),
      set({
        id: 'vs_brand_pref',
        name: 'Q5. And which ONE of these brands do you most prefer?',
        variableIds: ['brand_pref'],
      }),
      set({ id: 'vs_age_band', name: 'D1b. Age band', variableIds: ['age_band'] }),
    ];
    const segmentLabels = [
      { value: 1, label: 'Core' },
      { value: 2, label: 'Growth' },
      { value: 3, label: 'Value' },
    ];
    const brandLabels = [
      { value: 1, label: 'Atlas' },
      { value: 2, label: 'Beacon' },
      { value: 3, label: 'Meridian' },
    ];
    const variables = [
      variable({ id: 'resp_id', name: 'resp_id' }),
      variable({ id: 'segment', name: 'segment', valueLabels: segmentLabels }),
      variable({ id: 'brand_pref', name: 'brand_pref', valueLabels: brandLabels }),
      variable({
        id: 'age_band',
        name: 'age_band',
        valueLabels: [
          { value: 1, label: '18-34' },
          { value: 2, label: '35-54' },
        ],
      }),
    ];
    expect(pickAutoFirstCrosstabPair('brandtracker_w4.sav', sets, variables)).toEqual({
      rowSetId: 'vs_brand_pref',
      colSetId: 'vs_segment',
    });
  });

  it('falls back to unaided first mention × segment when brand preference is absent', () => {
    const sets = [
      set({ id: 'vs_segment', name: 'SEG. Consumer segment', variableIds: ['segment'] }),
      set({ id: 'vs_unaided_first', name: 'Q1. Which brand comes to mind first?', variableIds: ['unaided_first'] }),
    ];
    const variables = [
      variable({
        id: 'segment',
        name: 'segment',
        valueLabels: [
          { value: 1, label: 'Core' },
          { value: 2, label: 'Growth' },
        ],
      }),
      variable({
        id: 'unaided_first',
        name: 'unaided_first',
        valueLabels: [
          { value: 1, label: 'Atlas' },
          { value: 2, label: 'Beacon' },
        ],
      }),
    ];
    expect(pickAutoFirstCrosstabPair('brandtracker_w4.sav', sets, variables)).toEqual({
      rowSetId: 'vs_unaided_first',
      colSetId: 'vs_segment',
    });
  });

  it('returns null on brandtracker_w4.sav when variables are not provided', () => {
    const sets = [
      set({ id: 'vs_segment', name: 'SEG. Consumer segment', variableIds: ['segment'] }),
      set({ id: 'vs_brand_pref', name: 'Q5. Preference', variableIds: ['brand_pref'] }),
    ];
    expect(pickAutoFirstCrosstabPair('brandtracker_w4.sav', sets)).toBeNull();
  });

  it('prefers sex × marital status on sleep.sav', () => {
    const sets = [
      set({ id: 's', name: 'sex' }),
      set({ id: 'm', name: 'marital status' }),
      set({ id: 'w', name: 'weight' }),
    ];
    expect(pickAutoFirstCrosstabPair('sleep.sav', sets)).toEqual({
      rowSetId: 's',
      colSetId: 'm',
    });
  });

  it('returns null for non-example datasets', () => {
    const sets = [set({ id: 'id', name: 'id' }), set({ id: 'a', name: 'segment' }), set({ id: 'b', name: 'channel' })];
    expect(pickAutoFirstCrosstabPair('survey.csv', sets)).toBeNull();
  });

  it('returns null when fewer than two eligible sets', () => {
    const sets = [set({ id: 'id', name: 'id' }), set({ id: 'g', name: 'gender' })];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets)).toBeNull();
  });

  it('returns null on mock when gender × region are unavailable', () => {
    const sets = [set({ id: 'a', name: 'segment' }), set({ id: 'b', name: 'channel' })];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets)).toBeNull();
  });

  it('skips hidden and multi-response sets', () => {
    const sets = [
      set({ id: 'h', name: 'hidden', hidden: true }),
      set({ id: 'm', name: 'brands', structure: 'multiple' }),
      set({ id: 'a', name: 'gender' }),
      set({ id: 'b', name: 'region' }),
    ];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets)).toEqual({
      rowSetId: 'a',
      colSetId: 'b',
    });
  });

  it('excludes sets whose variables are excluded from auto analysis when variables are provided', () => {
    const sets = [
      set({ id: 'id', name: 'respondent_key', variableIds: ['v-id'] }),
      set({ id: 'g', name: 'gender', variableIds: ['v-g'] }),
      set({ id: 'r', name: 'region', variableIds: ['v-r'] }),
    ];
    const variables = [
      variable({
        id: 'v-id',
        name: 'respondent_key',
        semantic: { topic: 'identifiers', measurementIntent: 'identifier', confidence: 1, source: 'auto' },
      }),
      variable({
        id: 'v-g',
        name: 'gender',
        valueLabels: [
          { value: 1, label: 'Male' },
          { value: 2, label: 'Female' },
        ],
      }),
      variable({
        id: 'v-r',
        name: 'region',
        valueLabels: [
          { value: 1, label: 'North' },
          { value: 2, label: 'South' },
        ],
      }),
    ];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets, variables)).toEqual({
      rowSetId: 'g',
      colSetId: 'r',
    });
  });

  it('works without variables for backward compatibility', () => {
    const sets = [set({ id: 'id', name: 'id' }), set({ id: 'g', name: 'gender' }), set({ id: 'r', name: 'region' })];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets)).toEqual({
      rowSetId: 'g',
      colSetId: 'r',
    });
  });
});

describe('resolveAutoCrosstabTableConfig', () => {
  it('expands grid sets to items and scale ids', () => {
    const sets = [set({ id: 'grid1', name: 'matrix', structure: 'grid' }), set({ id: 'c', name: 'region' })];
    expect(resolveAutoCrosstabTableConfig({ rowSetId: 'grid1', colSetId: 'c' }, sets)).toEqual({
      rowVars: ['grid1_scale'],
      colVar: 'grid1_items',
    });
  });

  it('returns null when row or col set is missing', () => {
    const sets = [set({ id: 'a', name: 'gender' })];
    expect(resolveAutoCrosstabTableConfig({ rowSetId: 'a', colSetId: 'missing' }, sets)).toBeNull();
  });

  it('uses items column when only col set is a grid', () => {
    const sets = [set({ id: 'row', name: 'gender' }), set({ id: 'grid1', name: 'matrix', structure: 'grid' })];
    expect(resolveAutoCrosstabTableConfig({ rowSetId: 'row', colSetId: 'grid1' }, sets)).toEqual({
      rowVars: ['row'],
      colVar: 'grid1_items',
    });
  });
});

describe('resolveExampleDatasetWeightVariable', () => {
  it('returns wt for brandtracker_w4.sav when weight is unset', () => {
    const variables = [variable({ id: 'wt', name: 'wt', type: 'numeric' })];
    expect(resolveExampleDatasetWeightVariable('brandtracker_w4.sav', variables, null)).toBe('wt');
  });

  it('returns null when weight is already set', () => {
    const variables = [variable({ id: 'wt', name: 'wt', type: 'numeric' })];
    expect(resolveExampleDatasetWeightVariable('brandtracker_w4.sav', variables, 'wt')).toBeNull();
  });

  it('returns null for non-tracker examples', () => {
    const variables = [variable({ id: 'wt', name: 'wt', type: 'numeric' })];
    expect(resolveExampleDatasetWeightVariable('sleep.sav', variables, null)).toBeNull();
  });
});
