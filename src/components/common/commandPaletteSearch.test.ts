import { describe, it, expect } from 'vitest';
import { mockNominalSet, mockOrdinalSet, mockScaleVariable } from '../../test/fixtures/variables';
import {
  buildShelfPlacement,
  canAddVariableSetToWeight,
  listVariableSetsForPalette,
  resolveInsertTarget,
  searchVariableSetsForPalette,
  variableSetGlyph,
  variableSetMeta,
} from './commandPaletteSearch';

describe('commandPaletteSearch', () => {
  it('matches variable sets by prefix and substring', () => {
    const sets = [
      { ...mockNominalSet, id: 'region', name: 'Region' },
      { ...mockOrdinalSet, id: 'gender', name: 'Gender' },
    ];

    expect(searchVariableSetsForPalette('reg', sets).map((match) => match.set.id)).toEqual(['region']);
    expect(searchVariableSetsForPalette('gen', sets).map((match) => match.set.id)).toEqual(['gender']);
  });

  it('matches on underlying variable names and labels when provided', () => {
    const sets = [{ ...mockNominalSet, id: 'q5', name: 'q5_preference', variableIds: ['v5'] }];
    const variables = [
      { ...mockScaleVariable, id: 'v5', name: 'q5_preference', label: 'Which brand do you most prefer?' },
    ];

    expect(searchVariableSetsForPalette('brand', sets, { variables }).map((m) => m.set.id)).toEqual(['q5']);
    expect(searchVariableSetsForPalette('brand', sets)).toEqual([]);
  });

  it('excludes hidden sets from search and browse results', () => {
    const sets = [
      { ...mockNominalSet, id: 'region', name: 'Region' },
      { ...mockNominalSet, id: 'secret', name: 'Regatta', hidden: true },
    ];
    expect(searchVariableSetsForPalette('reg', sets).map((m) => m.set.id)).toEqual(['region']);
    expect(listVariableSetsForPalette(sets).map((s) => s.id)).toEqual(['region']);
  });

  describe('insertion grammar (↵ rows, ⌥↵ columns, ⇧↵ filter)', () => {
    it('plain Enter targets rows', () => {
      expect(resolveInsertTarget({})).toBe('rows');
      expect(resolveInsertTarget({ altKey: false, shiftKey: false })).toBe('rows');
    });

    it('Alt+Enter targets columns', () => {
      expect(resolveInsertTarget({ altKey: true })).toBe('columns');
    });

    it('Shift+Enter targets filter, winning over Alt', () => {
      expect(resolveInsertTarget({ shiftKey: true })).toBe('filter');
      expect(resolveInsertTarget({ shiftKey: true, altKey: true })).toBe('filter');
    });
  });

  it('derives monochrome glyphs and metadata from set shape', () => {
    const multi = { ...mockNominalSet, structure: 'multiple' as const, variableIds: ['a', 'b', 'c'] };
    const grid = { ...mockNominalSet, structure: 'grid' as const, variableIds: ['a', 'b'] };
    expect(variableSetGlyph(multi)).toBe('M');
    expect(variableSetMeta(multi)).toBe('Multi · 3');
    expect(variableSetGlyph(grid)).toBe('G');
    expect(variableSetMeta(grid)).toBe('Grid · 2');
    expect(variableSetGlyph({ ...mockNominalSet, type: 'nominal' })).toBe('C');
    expect(variableSetGlyph({ ...mockNominalSet, type: 'numeric' })).toBe('#');
    expect(variableSetMeta({ ...mockNominalSet, type: 'numeric' })).toBe('Numeric');
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
    const variables = [{ ...mockScaleVariable, id: 'w1' }];
    const numericSet = { ...mockOrdinalSet, id: 'weight', name: 'Weight', variableIds: ['w1'] };
    expect(canAddVariableSetToWeight(numericSet, variables)).toBe(true);
    expect(canAddVariableSetToWeight(mockNominalSet, variables)).toBe(false);
  });

  it('searches 500 variable sets within the WP2.2 open budget (<100ms)', () => {
    const sets = Array.from({ length: 500 }, (_, i) => ({
      ...mockNominalSet,
      id: `var_${i}`,
      name: `Variable ${i}`,
      variableIds: [`v${i}`],
    }));

    const start = performance.now();
    const results = searchVariableSetsForPalette('Variable 42', sets);
    const elapsedMs = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((match) => match.set.id === 'var_42')).toBe(true);
    expect(elapsedMs).toBeLessThan(100);
  });
});
