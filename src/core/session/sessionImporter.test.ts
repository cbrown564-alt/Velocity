import { describe, expect, it } from 'vitest';
import type { Dataset, Variable } from '../../types/dataset';
import type { VelocitySessionFile } from './sessionTypes';
import { importSession } from './sessionImporter';

function variable(id: string, label = id): Variable {
  return {
    id,
    name: id.toUpperCase(),
    label,
    type: 'categorical',
    valueLabels: [{ value: 1, label: 'Yes' }],
    missingValues: {},
  };
}

const loadedDataset: Dataset = {
  id: 'dataset-live',
  name: 'sleep.sav',
  rowCount: 100,
  source: 'sav',
  weightVariable: 'weight',
  variables: [
    variable('q1', 'Loaded Label 1'),
    variable('q2', 'Loaded Label 2'),
    { ...variable('weight', 'Weight'), type: 'numeric', valueLabels: [] },
  ],
};

function buildSessionFile(overrides: Partial<VelocitySessionFile> = {}): VelocitySessionFile {
  return {
    formatVersion: 1,
    exportedAt: '2026-02-26T16:00:00.000Z',
    velocityVersion: '0.1.0',
    dataset: {
      originalFilename: 'sleep.sav',
      rowCount: 100,
      source: 'sav',
      fingerprint: {
        columnCount: 3,
        columnNames: ['q1', 'q2', 'weight'],
      },
    },
    variables: [
      {
        ...variable('q1', 'Session Label 1'),
        valueLabels: [
          { value: 1, label: 'Awake' },
          { value: 2, label: 'Asleep' },
        ],
      },
      variable('q_missing', 'Missing Variable'),
    ],
    variableSets: [
      { id: 'set-valid', name: 'Valid Set', variableIds: ['q1'], structure: 'single', type: 'categorical' },
      { id: 'set-missing', name: 'Missing Set', variableIds: ['q_missing'], structure: 'single', type: 'categorical' },
      { id: 'set-partial', name: 'Partial Set', variableIds: ['q2', 'q_missing'], structure: 'multiple', type: 'categorical' },
    ],
    folders: [{ id: 'folder-1', name: 'Main', order: 0 }],
    transformLog: [],
    tableConfig: { rowVars: ['set-valid', 'set-missing', 'unknown-row'], colVar: 'set-missing' },
    activeFilters: [
      { id: 'filter-valid', variableId: 'q1', operator: 'eq', value: 1 },
      { id: 'filter-missing', variableId: 'q_missing', operator: 'eq', value: 1 },
    ],
    weightVariable: 'weight',
    analysisSettings: { engine: 'webr' },
    slides: [
      {
        id: 'slide-1',
        title: 'Slide',
        subtitle: '',
        sectionId: 'missing-section',
        analysisState: {
          rowVars: ['set-valid', 'set-missing'],
          colVar: 'set-missing',
          filters: [
            { id: 'slide-filter-valid', variableId: 'q1', operator: 'eq', value: 1 },
            { id: 'slide-filter-missing', variableId: 'q_missing', operator: 'eq', value: 1 },
          ],
          weightVar: 'q_missing',
        },
        visualizationType: 'table',
        layoutMode: 'focus',
        cells: [{ id: 'cell-1', content: { type: 'table' } }],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    sections: [{ id: 'section-1', title: 'Section 1' }],
    harmonizationSession: null,
    ...overrides,
  };
}

describe('importSession', () => {
  it('restores a sanitized patch and reports diagnostics for missing references', () => {
    const result = importSession(buildSessionFile(), loadedDataset);

    expect(result.patch.dataset.variables.find((item) => item.id === 'q1')?.label).toBe('Session Label 1');
    expect(result.patch.dataset.weightVariable).toBe('weight');
    expect(result.patch.variableSets.map((item) => item.id)).toEqual(['set-valid', 'set-partial']);
    expect(result.patch.variableSets.find((item) => item.id === 'set-partial')?.variableIds).toEqual(['q2']);
    expect(result.patch.tableConfig).toEqual({ rowVars: ['set-valid'], colVar: null });
    expect(result.patch.activeFilters.map((filter) => filter.id)).toEqual(['filter-valid']);

    expect(result.patch.slides[0].analysisState.rowVars).toEqual(['set-valid']);
    expect(result.patch.slides[0].analysisState.colVar).toBeNull();
    expect(result.patch.slides[0].analysisState.filters.map((filter) => filter.id)).toEqual(['slide-filter-valid']);
    expect(result.patch.slides[0].analysisState.weightVar).toBeNull();
    expect(result.patch.slides[0].sectionId).toBeUndefined();
    expect(result.patch.deckRecipe.slideRecipes.map((recipe) => recipe.slideId)).toEqual(['slide-1']);

    expect(result.diagnostics.missingVariableIds).toContain('q_missing');
    expect(result.diagnostics.droppedVariableSetIds).toContain('set-missing');
    expect(result.diagnostics.droppedFilterIds).toContain('filter-missing');
    expect(result.diagnostics.droppedFilterIds).toContain('slide-filter-missing');
    expect(result.diagnostics.droppedRowVarIds).toContain('set-missing');
    expect(result.diagnostics.droppedRowVarIds).toContain('unknown-row');
    expect(result.diagnostics.droppedColVarIds).toContain('set-missing');
    expect(result.diagnostics.missingSectionIds).toContain('missing-section');
  });

  it('generates fallback variable sets when imported sets are unusable', () => {
    const result = importSession(buildSessionFile({
      variableSets: [
        { id: 'bad-set', name: 'Bad', variableIds: ['q_missing'], structure: 'single', type: 'categorical' },
      ],
      tableConfig: { rowVars: ['bad-set'], colVar: 'bad-set' },
    }), loadedDataset);

    expect(result.patch.variableSets.length).toBe(loadedDataset.variables.length);
    expect(result.patch.variableSets[0].id).toBe('vs_q1');
    expect(result.patch.tableConfig).toEqual({ rowVars: [], colVar: null });
    expect(result.diagnostics.fallbackVariableSetsGenerated).toBe(true);
  });

  it('drops stale deck recipe slide references and reports diagnostics', () => {
    const result = importSession(buildSessionFile({
      deckRecipe: {
        recipeVersion: 1,
        sections: [],
        slideRecipes: [
          {
            slideId: 'slide-1',
            title: 'Slide',
            subtitle: '',
            analysisState: {
              rowVars: ['set-valid'],
              colVar: null,
              filters: [],
              weightVar: null,
            },
            visualizationType: 'table',
          },
          {
            slideId: 'stale-slide',
            title: 'Stale',
            subtitle: '',
            analysisState: {
              rowVars: ['set-valid'],
              colVar: null,
              filters: [],
              weightVar: null,
            },
            visualizationType: 'table',
          },
        ],
      },
    }), loadedDataset);

    expect(result.patch.deckRecipe.slideRecipes.map((recipe) => recipe.slideId)).toEqual(['slide-1']);
    expect(result.diagnostics.droppedDeckRecipeSlideIds).toContain('stale-slide');
  });

  it('throws when session file validation fails', () => {
    const invalid = buildSessionFile({ formatVersion: 99 as 1 });
    expect(() => importSession(invalid, loadedDataset)).toThrow('Invalid session file');
  });
});
