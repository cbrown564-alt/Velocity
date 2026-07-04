import { describe, it, expect } from 'vitest';
import { makeVariable, mockNominalSet, mockOrdinalSet, mockScaleVariable } from '../../test/fixtures/variables';
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

  it('excludes synthetic grid shell sets from palette browse and search', () => {
    const parentGridId = 'heuristic_grid_fatigue1_fatigue2_fatigue3';
    const sets = [
      { ...mockNominalSet, id: parentGridId, name: 'Fatigue battery', structure: 'grid', variableIds: ['f1', 'f2'] },
      {
        ...mockNominalSet,
        id: `${parentGridId}_scale`,
        name: 'fatigue_scale',
        structure: 'single',
        variableIds: [`${parentGridId}_scale`],
      },
      { ...mockNominalSet, id: 'region', name: 'Region' },
    ];
    const dataset = {
      id: 'ds1',
      name: 'demo.sav',
      rowCount: 100,
      variables: [
        {
          ...mockScaleVariable,
          id: `${parentGridId}_scale`,
          name: `${parentGridId}_scale`,
          synthetic: true,
          sourceGridId: parentGridId,
        },
      ],
      source: 'sav' as const,
    };

    expect(listVariableSetsForPalette(sets, 12, dataset).map((s) => s.id)).toEqual([parentGridId, 'region']);
    expect(
      searchVariableSetsForPalette('fatigue', sets, { dataset, variables: dataset.variables }).map((m) => m.set.id),
    ).toEqual([parentGridId]);
  });

  describe('insertion grammar (↵ columns, ⌥↵ rows, ⇧↵ filter)', () => {
    it('plain Enter targets columns', () => {
      expect(resolveInsertTarget({})).toBe('columns');
      expect(resolveInsertTarget({ altKey: false, shiftKey: false })).toBe('columns');
    });

    it('Alt+Enter targets rows', () => {
      expect(resolveInsertTarget({ altKey: true })).toBe('rows');
    });

    it('Shift+Enter targets filter, winning over Alt', () => {
      expect(resolveInsertTarget({ shiftKey: true })).toBe('filter');
      expect(resolveInsertTarget({ shiftKey: true, altKey: true })).toBe('filter');
    });

    it('uses a preset insert target when no modifiers are held', () => {
      expect(resolveInsertTarget({}, 'columns')).toBe('columns');
      expect(resolveInsertTarget({}, 'weight')).toBe('weight');
    });

    it('modifier keys override a preset insert target', () => {
      expect(resolveInsertTarget({ altKey: true }, 'weight')).toBe('rows');
      expect(resolveInsertTarget({ shiftKey: true }, 'columns')).toBe('filter');
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

  it('prefers underlying variable type over a stale numeric set type', () => {
    const set = { ...mockNominalSet, id: 'cat_buyer', type: 'numeric' as const };
    const variable = makeVariable({
      id: 'cat_buyer',
      name: 'cat_buyer',
      type: 'categorical',
      valueLabels: [{ value: 1, label: 'Yes' }],
    });
    expect(variableSetGlyph(set, variable)).toBe('C');
    expect(variableSetMeta(set, variable)).toBe('Category');
  });

  it('builds row and column shelf placements', () => {
    const set = { ...mockNominalSet, id: 'region', name: 'Region' };
    expect(buildShelfPlacement(set, 'drop-zone-rows', { rowVars: [], colVar: null })).toEqual({
      placement: { rowVars: ['region'] },
      redirectedFromColumn: false,
    });
    expect(buildShelfPlacement(set, 'drop-zone-cols', { rowVars: [], colVar: null })).toEqual({
      placement: { rowVars: ['region'] },
      redirectedFromColumn: true,
    });
    expect(buildShelfPlacement(set, 'drop-zone-cols', { rowVars: ['gender'], colVar: null })).toEqual({
      placement: { colVar: 'region' },
      redirectedFromColumn: false,
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
