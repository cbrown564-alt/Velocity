import type { Dataset, VariableSet } from '../../types/dataset';
import type { FacetFilters } from '../../store/slices/uiSlice';
import type { VariableStatsResult } from '../../types/worker';
import { normalizeVariableType } from '../../types';
import { filterSyntheticGridShellSets, isSyntheticGridShellSet } from '../../core/services/syntheticGridShellFilters';

export { isSyntheticGridShellSet, filterSyntheticGridShellSets };

const EMPTY_FACET_FILTERS: FacetFilters = {
  types: [],
  statuses: [],
  qualities: [],
};

export interface FilterVariableSetsOptions {
  dataset?: Dataset | null;
  activeFolderId?: string | null;
  searchQuery?: string;
  facetFilters?: FacetFilters;
  variableStats?: Record<string, VariableStatsResult>;
}

export function filterVariableSets(
  variableSets: VariableSet[],
  options: FilterVariableSetsOptions = {},
): VariableSet[] {
  const { dataset, activeFolderId, searchQuery = '', facetFilters = EMPTY_FACET_FILTERS, variableStats = {} } = options;

  let sets = dataset ? filterSyntheticGridShellSets(variableSets, dataset) : variableSets;

  if (activeFolderId === 'ungrouped') {
    sets = sets.filter((vs) => !vs.folderId);
  } else if (activeFolderId && activeFolderId !== null) {
    sets = sets.filter((vs) => vs.folderId === activeFolderId);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    sets = sets.filter((vs) => vs.name.toLowerCase().includes(query));
  }

  if (facetFilters.types.length > 0) {
    sets = sets.filter((vs) => {
      return vs.type && facetFilters.types.includes(normalizeVariableType(vs.type));
    });
  }

  if (facetFilters.statuses.length > 0) {
    sets = sets.filter((vs) => {
      if (facetFilters.statuses.includes('hidden') && vs.hidden) return true;
      if (facetFilters.statuses.includes('visible') && !vs.hidden) return true;
      if (facetFilters.statuses.includes('derived') && vs.derived) return true;
      return false;
    });
  }

  if (facetFilters.qualities.length > 0) {
    sets = sets.filter((vs) => {
      if (vs.variableIds.length === 1) {
        const stats = variableStats[vs.variableIds[0]];
        if (!stats) return true;
        const missingPercent = stats.totalCount > 0 ? (stats.missingCount / stats.totalCount) * 100 : 0;
        const isComplete = missingPercent === 0;
        return (
          (facetFilters.qualities.includes('complete') && isComplete) ||
          (facetFilters.qualities.includes('incomplete') && !isComplete)
        );
      }
      return true;
    });
  }

  return sets;
}
