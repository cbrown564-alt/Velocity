import { describe, expect, it } from 'vitest';
import { buildCrosstabRequest } from './buildCrosstabRequest';
import { mockDataset, mockNominalSet, mockNominalVariable } from '../../test/fixtures/variables';

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
