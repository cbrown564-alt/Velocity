import { describe, expect, it } from 'vitest';
import { buildCrosstabRequest } from './buildCrosstabRequest';
import {
  mockDataset,
  mockNominalSet,
  mockNominalVariable,
  mockScaleSet,
  mockScaleVariable,
} from '../../test/fixtures/variables';

describe('buildCrosstabRequest', () => {
  it('passes through analysis significance settings for worker execution', () => {
    const request = buildCrosstabRequest({
      dataset: mockDataset,
      variableSets: [mockNominalSet],
      rowVars: [mockNominalSet.id],
      colVar: null,
      filters: [],
      analysisSettings: {
        comparisonMethod: 'pairwise',
        correctionType: 'fdr',
        significanceLevel: 0.8,
      },
    });

    expect(request.options.rowVars).toEqual([mockNominalVariable.id]);
    expect(request.analysisSettings).toEqual({
      comparisonMethod: 'pairwise',
      correctionType: 'fdr',
      significanceLevel: 0.8,
    });
  });

  it('omits analysis settings when not provided', () => {
    const request = buildCrosstabRequest({
      dataset: mockDataset,
      variableSets: [mockNominalSet],
      rowVars: [mockNominalSet.id],
      colVar: null,
      filters: [],
    });

    expect(request.analysisSettings).toBeUndefined();
  });

  it('plans nested row vars when the first row is a measure and more rows follow', () => {
    const regionSet = {
      id: 'set_region',
      name: 'Region',
      variableIds: ['var_region'],
      structure: 'single' as const,
      type: 'categorical' as const,
    };
    const dataset = {
      ...mockDataset,
      variables: [
        ...mockDataset.variables,
        {
          id: 'var_region',
          name: 'Region',
          label: 'Region',
          type: 'categorical' as const,
          valueLabels: [
            { value: 1, label: 'East' },
            { value: 2, label: 'West' },
          ],
          missingValues: {},
        },
      ],
    };

    const request = buildCrosstabRequest({
      dataset,
      variableSets: [mockScaleSet, regionSet, mockNominalSet],
      rowVars: [mockScaleSet.id, regionSet.id],
      colVar: mockNominalSet.id,
      filters: [],
    });

    expect(request.options.measureVar).toBe(mockScaleVariable.id);
    expect(request.options.measureLabel).toBe('Age (years)');
    expect(request.options.rowVars).toEqual([]);
    expect(request.options.nestedRowVars).toEqual(['var_region']);
    expect(request.options.colVar).toBe(mockNominalVariable.id);
  });

  it('maps a multiple-response column set to columnMultipleColumns', () => {
    const dataset = {
      ...mockDataset,
      variables: [
        ...mockDataset.variables,
        { id: 'mr_1', name: 'mr_1', label: 'Coke', type: 'nominal' as const, valueLabels: [], missingValues: {} },
        { id: 'mr_2', name: 'mr_2', label: 'Pepsi', type: 'nominal' as const, valueLabels: [], missingValues: {} },
      ],
    };

    const multipleColSet = {
      id: 'set_mr_col',
      name: 'Brands',
      variableIds: ['mr_1', 'mr_2'],
      structure: 'multiple' as const,
      countedValue: 1,
    };

    const request = buildCrosstabRequest({
      dataset,
      variableSets: [mockNominalSet, multipleColSet],
      rowVars: [mockNominalSet.id],
      colVar: multipleColSet.id,
      filters: [],
    });

    expect(request.options.rowVars).toEqual([mockNominalVariable.id]);
    expect(request.options.colVar).toBeNull();
    expect(request.options.columnMultipleColumns).toEqual([
      { name: 'mr_1', label: 'Coke', countedValue: 1 },
      { name: 'mr_2', label: 'Pepsi', countedValue: 1 },
    ]);
  });
});
