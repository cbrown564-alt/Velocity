import { describe, expect, it } from 'vitest';
import {
  filterSyntheticGridShellSets,
  filterVariableSets,
  isSyntheticGridShellSet,
} from './variableSetFilters';
import type { Dataset, VariableSet } from '../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../types/worker';

const dataset: Dataset = {
  id: 'd1',
  name: 'test.sav',
  rowCount: 10,
  source: 'sav',
  variables: [
    {
      id: 'heuristic_grid_fatigue1_fatigue2_fatigue3_scale',
      name: 'fatigue_scale',
      label: 'fatigue',
      type: 'ordered',
      orderedStyle: 'rating',
      orderedScoring: 'allow_numeric_stats',
      valueLabels: [],
      missingValues: {},
      synthetic: true,
      sourceGridId: 'heuristic_grid_fatigue1_fatigue2_fatigue3',
    },
    {
      id: 'q_scale',
      name: 'q_scale',
      label: 'q scale',
      type: 'numeric',
      valueLabels: [],
      missingValues: {},
      synthetic: false,
    },
    {
      id: 'age',
      name: 'age',
      label: 'Age',
      type: 'numeric',
      valueLabels: [],
      missingValues: {},
      synthetic: false,
    },
  ],
};

const shellSet: VariableSet = {
  id: 'heuristic_grid_fatigue1_fatigue2_fatigue3_scale',
  name: 'fatigue',
  variableIds: ['heuristic_grid_fatigue1_fatigue2_fatigue3_scale'],
  structure: 'single',
  type: 'ordered',
};

const gridSet: VariableSet = {
  id: 'heuristic_grid_fatigue1_fatigue2_fatigue3',
  name: 'fatigue',
  variableIds: ['fatigue1', 'fatigue2', 'fatigue3'],
  structure: 'grid',
  type: 'ordered',
};

const numericSet: VariableSet = {
  id: 'vs_q_scale',
  name: 'q scale',
  variableIds: ['q_scale'],
  structure: 'single',
  type: 'numeric',
};

const ageSet: VariableSet = {
  id: 'vs_age',
  name: 'Age',
  variableIds: ['age'],
  structure: 'single',
  type: 'numeric',
  folderId: 'folder-a',
};

const hiddenSet: VariableSet = {
  id: 'vs_hidden',
  name: 'Hidden Var',
  variableIds: ['hidden_var'],
  structure: 'single',
  type: 'categorical',
  hidden: true,
};

const derivedSet: VariableSet = {
  id: 'vs_derived',
  name: 'Derived Var',
  variableIds: ['derived_var'],
  structure: 'single',
  type: 'numeric',
  derived: true,
};

const allSets = [shellSet, gridSet, numericSet, ageSet, hiddenSet, derivedSet];

const variableStats: Record<string, VariableStatsResult> = {
  age: { column: 'age', frequencies: [], missingCount: 0, totalCount: 100 },
  q_scale: { column: 'q_scale', frequencies: [], missingCount: 5, totalCount: 100 },
};

describe('variableSetFilters', () => {
  it('identifies synthetic grid shell sets', () => {
    expect(isSyntheticGridShellSet(shellSet, dataset)).toBe(true);
  });

  it('does not hide non-synthetic variables that happen to end with _scale/_items', () => {
    expect(isSyntheticGridShellSet(numericSet, dataset)).toBe(false);
  });

  it('filters only synthetic grid shell sets', () => {
    const visible = filterSyntheticGridShellSets(allSets, dataset);
    expect(visible.map(v => v.id)).toEqual([
      'heuristic_grid_fatigue1_fatigue2_fatigue3',
      'vs_q_scale',
      'vs_age',
      'vs_hidden',
      'vs_derived',
    ]);
  });

  describe('filterVariableSets', () => {
    it('excludes synthetic grid shell sets when dataset is provided', () => {
      const result = filterVariableSets(allSets, { dataset });
      expect(result.map(v => v.id)).not.toContain(shellSet.id);
      expect(result).toHaveLength(5);
    });

    it('filters by ungrouped folder', () => {
      const result = filterVariableSets(allSets, {
        dataset,
        activeFolderId: 'ungrouped',
      });
      expect(result.every(vs => !vs.folderId)).toBe(true);
      expect(result.map(v => v.id)).toEqual([
        'heuristic_grid_fatigue1_fatigue2_fatigue3',
        'vs_q_scale',
        'vs_hidden',
        'vs_derived',
      ]);
    });

    it('filters by specific folder', () => {
      const result = filterVariableSets(allSets, {
        dataset,
        activeFolderId: 'folder-a',
      });
      expect(result.map(v => v.id)).toEqual(['vs_age']);
    });

    it('filters by search query (case-insensitive)', () => {
      const result = filterVariableSets(allSets, {
        dataset,
        searchQuery: 'AGE',
      });
      expect(result.map(v => v.id)).toEqual(['vs_age']);
    });

    it('filters by type facet', () => {
      const result = filterVariableSets(allSets, {
        dataset,
        facetFilters: { types: ['numeric'], statuses: [], qualities: [] },
      });
      expect(result.map(v => v.id)).toEqual(['vs_q_scale', 'vs_age', 'vs_derived']);
    });

    it('filters by status facet (hidden, visible, derived)', () => {
      const hiddenResult = filterVariableSets(allSets, {
        dataset,
        facetFilters: { types: [], statuses: ['hidden'], qualities: [] },
      });
      expect(hiddenResult.map(v => v.id)).toEqual(['vs_hidden']);

      const visibleResult = filterVariableSets(allSets, {
        dataset,
        facetFilters: { types: [], statuses: ['visible'], qualities: [] },
      });
      expect(visibleResult.map(v => v.id)).not.toContain('vs_hidden');

      const derivedResult = filterVariableSets(allSets, {
        dataset,
        facetFilters: { types: [], statuses: ['derived'], qualities: [] },
      });
      expect(derivedResult.map(v => v.id)).toEqual(['vs_derived']);
    });

    it('filters by quality facet using variableStats', () => {
      const completeResult = filterVariableSets(allSets, {
        dataset,
        facetFilters: { types: [], statuses: [], qualities: ['complete'] },
        variableStats,
      });
      expect(completeResult.map(v => v.id)).toContain('vs_age');
      expect(completeResult.map(v => v.id)).not.toContain('vs_q_scale');

      const incompleteResult = filterVariableSets(allSets, {
        dataset,
        facetFilters: { types: [], statuses: [], qualities: ['incomplete'] },
        variableStats,
      });
      expect(incompleteResult.map(v => v.id)).toContain('vs_q_scale');
      expect(incompleteResult.map(v => v.id)).not.toContain('vs_age');
    });

    it('combines folder, search, and facet filters', () => {
      const result = filterVariableSets(allSets, {
        dataset,
        activeFolderId: 'ungrouped',
        searchQuery: 'q',
        facetFilters: { types: ['numeric'], statuses: [], qualities: [] },
        variableStats,
      });
      expect(result.map(v => v.id)).toEqual(['vs_q_scale']);
    });

    it('facet type counts match column render population', () => {
      const baseSets = filterVariableSets(allSets, {
        dataset,
        activeFolderId: 'ungrouped',
      });
      const columnWithTypeFacet = filterVariableSets(allSets, {
        dataset,
        activeFolderId: 'ungrouped',
        facetFilters: { types: ['numeric'], statuses: [], qualities: [] },
      });

      const numericCount = baseSets.filter(vs => vs.type === 'numeric').length;
      expect(columnWithTypeFacet).toHaveLength(numericCount);
    });
  });
});
