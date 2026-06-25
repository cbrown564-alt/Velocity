import { describe, it, expect } from 'vitest';
import type { Variable, VariableSet } from '../../../types';
import { pickAutoFirstCrosstabPair, resolveAutoCrosstabTableConfig } from './autoFirstCrosstab';

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

  it('returns null for non-mock datasets', () => {
    const sets = [
      set({ id: 'id', name: 'id' }),
      set({ id: 'a', name: 'segment' }),
      set({ id: 'b', name: 'channel' }),
    ];
    expect(pickAutoFirstCrosstabPair('survey.csv', sets)).toBeNull();
  });

  it('returns null when fewer than two eligible sets', () => {
    const sets = [set({ id: 'id', name: 'id' }), set({ id: 'g', name: 'gender' })];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets)).toBeNull();
  });

  it('returns null on mock when gender × region are unavailable', () => {
    const sets = [
      set({ id: 'a', name: 'segment' }),
      set({ id: 'b', name: 'channel' }),
    ];
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
        valueLabels: [{ value: 1, label: 'Male' }, { value: 2, label: 'Female' }],
      }),
      variable({
        id: 'v-r',
        name: 'region',
        valueLabels: [{ value: 1, label: 'North' }, { value: 2, label: 'South' }],
      }),
    ];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets, variables)).toEqual({
      rowSetId: 'g',
      colSetId: 'r',
    });
  });

  it('works without variables for backward compatibility', () => {
    const sets = [
      set({ id: 'id', name: 'id' }),
      set({ id: 'g', name: 'gender' }),
      set({ id: 'r', name: 'region' }),
    ];
    expect(pickAutoFirstCrosstabPair('mock_data.csv', sets)).toEqual({
      rowSetId: 'g',
      colSetId: 'r',
    });
  });
});

describe('resolveAutoCrosstabTableConfig', () => {
  it('expands grid sets to items and scale ids', () => {
    const sets = [
      set({ id: 'grid1', name: 'matrix', structure: 'grid' }),
      set({ id: 'c', name: 'region' }),
    ];
    expect(
      resolveAutoCrosstabTableConfig({ rowSetId: 'grid1', colSetId: 'c' }, sets),
    ).toEqual({ rowVars: ['grid1_scale'], colVar: 'grid1_items' });
  });

  it('returns null when row or col set is missing', () => {
    const sets = [set({ id: 'a', name: 'gender' })];
    expect(
      resolveAutoCrosstabTableConfig({ rowSetId: 'a', colSetId: 'missing' }, sets),
    ).toBeNull();
  });

  it('uses items column when only col set is a grid', () => {
    const sets = [
      set({ id: 'row', name: 'gender' }),
      set({ id: 'grid1', name: 'matrix', structure: 'grid' }),
    ];
    expect(
      resolveAutoCrosstabTableConfig({ rowSetId: 'row', colSetId: 'grid1' }, sets),
    ).toEqual({ rowVars: ['row'], colVar: 'grid1_items' });
  });
});
