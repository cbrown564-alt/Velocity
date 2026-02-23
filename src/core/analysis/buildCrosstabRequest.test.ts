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
        significanceLevel: 0.80,
      },
    });

    expect(request.options.rowVars).toEqual([mockNominalVariable.id]);
    expect(request.analysisSettings).toEqual({
      comparisonMethod: 'pairwise',
      correctionType: 'fdr',
      significanceLevel: 0.80,
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
});
