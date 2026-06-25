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

  it('maps multiple-response row labels to backing columns', () => {
    const result = resolveDrillDownContext({
      rowPath: [{ variable: 'brand_coke', value: 'Coca-Cola' }],
      colValue: null,
      colVarId: null,
      variableSets: [{
        id: 'brand_awareness',
        variableIds: ['brand_coke', 'brand_pepsi'],
        structure: 'multiple',
        countedValue: 1,
      }],
      variables: [
        { id: 'brand_coke', label: 'Coca-Cola' },
        { id: 'brand_pepsi', label: 'Pepsi' },
      ],
    });

    expect(result.rowFilters).toEqual([{ variable: 'brand_coke', value: '1' }]);
    expect(result.colFilter).toBeNull();
    expect(result.title).toBe('Coca-Cola: Coca-Cola');
  });

  it('maps multiple-response column labels to backing columns', () => {
    const result = resolveDrillDownContext({
      rowPath: [{ variable: 'gender', value: 'Male' }],
      colValue: 'Pepsi',
      colVarId: 'brand_awareness',
      variableSets: [{
        id: 'brand_awareness',
        variableIds: ['brand_coke', 'brand_pepsi'],
        structure: 'multiple',
        countedValue: 1,
      }],
      variables: [
        { id: 'gender', label: 'Gender' },
        { id: 'brand_coke', label: 'Coca-Cola' },
        { id: 'brand_pepsi', label: 'Pepsi' },
      ],
    });

    expect(result.rowFilters).toEqual([{ variable: 'gender', value: 'Male' }]);
    expect(result.colFilter).toEqual({ variable: 'brand_pepsi', value: '1' });
    expect(result.title).toBe('Gender: Male • Pepsi: Pepsi');
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
