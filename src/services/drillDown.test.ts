import { describe, expect, it } from 'vitest';
import { buildDrillDownQueryOptions, resolveDrillDownContext } from './drillDown';

describe('resolveDrillDownContext', () => {
  it('resolves column variable set ids and builds a labeled title', () => {
    const result = resolveDrillDownContext({
      rowPath: [{ variable: 'gender', value: 'Male' }],
      colValue: 'North',
      colVarId: 'region_set',
      variableSets: [{ id: 'region_set', variableIds: ['region'] }],
      variables: [
        { id: 'gender', label: 'Gender' },
        { id: 'region', label: 'Region' },
      ],
    });

    expect(result.rowFilters).toEqual([{ variable: 'gender', value: 'Male' }]);
    expect(result.colFilter).toEqual({ variable: 'region', value: 'North' });
    expect(result.title).toBe('Gender: Male • Region: North');
  });

  it('falls back to ids when labels or variable sets are unavailable', () => {
    const result = resolveDrillDownContext({
      rowPath: [{ variable: 'q1', value: '1' }],
      colValue: 'A',
      colVarId: 'missing_set',
      variableSets: [],
      variables: [],
    });

    expect(result.colFilter).toEqual({ variable: 'missing_set', value: 'A' });
    expect(result.title).toBe('q1: 1 • missing_set: A');
  });
});

describe('buildDrillDownQueryOptions', () => {
  it('normalizes filters for queryBuilder input', () => {
    const options = buildDrillDownQueryOptions({
      rowFilters: [{ variable: 'gender', value: 'Male' }],
      colFilter: { variable: 'region', value: 'North' },
      filters: [],
      limit: 50,
      offset: 100,
    });

    expect(options).toEqual({
      rowVars: [{ variable: 'gender', value: 'Male' }],
      colVar: 'region',
      colValue: 'North',
      filters: [],
      limit: 50,
      offset: 100,
    });
  });
});
