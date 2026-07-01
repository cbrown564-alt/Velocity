import { describe, it, expect } from 'vitest';
import { mockNominalSet, mockOrdinalSet } from '../../test/fixtures/variables';
import { buildShelfPlacement, canAddVariableSetToWeight, searchVariableSetsForPalette } from './commandPaletteSearch';

describe('commandPaletteSearch', () => {
  it('matches variable sets by prefix and substring', () => {
    const sets = [
      { ...mockNominalSet, id: 'region', name: 'Region' },
      { ...mockOrdinalSet, id: 'gender', name: 'Gender' },
    ];

    expect(searchVariableSetsForPalette('reg', sets).map((match) => match.set.id)).toEqual(['region']);
    expect(searchVariableSetsForPalette('gen', sets).map((match) => match.set.id)).toEqual(['gender']);
  });

  it('builds row and column shelf placements', () => {
    const set = { ...mockNominalSet, id: 'region', name: 'Region' };
    expect(buildShelfPlacement(set, 'drop-zone-rows', { rowVars: [], colVar: null })).toEqual({
      rowVars: ['region'],
    });
    expect(buildShelfPlacement(set, 'drop-zone-cols', { rowVars: [], colVar: null })).toEqual({
      colVar: 'region',
    });
  });

  it('detects numeric weight eligibility', () => {
    const numericSet = { ...mockOrdinalSet, id: 'weight', name: 'Weight', variableIds: ['w1'] };
    const variables = [{ id: 'w1', type: 'numeric' as const }];
    expect(canAddVariableSetToWeight(numericSet, variables)).toBe(true);
    expect(canAddVariableSetToWeight(mockNominalSet, variables)).toBe(false);
  });
});
