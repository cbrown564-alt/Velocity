/**
 * Variable catalog, stats cache, folders, and metadata editing actions.
 */

import { allowsNumericStats, normalizeVariableType } from '../../../types';
import type { Variable } from '../../../types/dataset';
import type { VariableStatsResult } from '../../../types/worker';
import type { DataSlice } from './types';
import type { DataSliceGet, DataSliceSet } from './sliceContext';
import { getRunAnalysis as resolveRunAnalysis } from './sliceContext';

export function createVariableCatalogActions(
  set: DataSliceSet,
  get: DataSliceGet,
): Pick<
  DataSlice,
  | 'getUniqueValues'
  | 'getVariableStats'
  | 'createVariableSet'
  | 'splitVariableSet'
  | 'setWeightVariable'
  | 'createFolder'
  | 'renameFolder'
  | 'deleteFolder'
  | 'moveToFolder'
  | 'reorderVariableSets'
  | 'bulkSetType'
  | 'bulkHide'
  | 'convertMultipleToGrid'
  | 'updateVariableMetadata'
  | 'updateValueLabel'
  | 'toggleDiscreteMissingValue'
> {
  return {
    getUniqueValues: async (variableId: string): Promise<string[]> => {
      const { browserEngine, dataset } = get();
      if (!browserEngine) throw new Error('Engine not initialized');

      const variable = dataset?.variables.find((v) => v.id === variableId);
      if (variable?.valueLabels && variable.valueLabels.length > 0) {
        return variable.valueLabels.map((vl) => String(vl.value));
      }

      const response = await browserEngine.getUniqueValues(variableId);
      return response.data;
    },

    getVariableStats: async (variableId: string) => {
      const { browserEngine, variableStats, variableStatsLoading, dataset } = get();
      if (!browserEngine) return null;

      const variable = dataset?.variables.find((v) => v.id === variableId);
      const variableType = variable?.type;

      const cachedStats = variableStats[variableId];
      if (cachedStats) {
        const needsNumericStats = allowsNumericStats(variableType, variable?.orderedScoring) && !cachedStats.numeric;
        if (!needsNumericStats) return cachedStats;
      }

      if (variableStatsLoading[variableId]) return null;

      set((state) => ({
        variableStatsLoading: { ...state.variableStatsLoading, [variableId]: true },
      }));

      try {
        const response = await browserEngine.runAnalysis('variableStats', {
          column: variableId,
          variableType,
          orderedScoring: variable?.orderedScoring,
          missingValues: variable?.missingValues,
        });
        const stats = response.data as VariableStatsResult;
        set((state) => ({
          variableStats: { ...state.variableStats, [variableId]: stats },
          variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false },
        }));
        return stats;
      } catch (error: unknown) {
        set((state) => ({
          variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false },
        }));
        throw error;
      }
    },

    createVariableSet: (name, variableIds) => {
      const { variableSets, dataset } = get();
      if (!dataset || variableIds.length === 0) return;

      const firstVar = dataset.variables.find((v) => v.id === variableIds[0]);
      const inferredType = firstVar?.type;

      const newSet = {
        id: crypto.randomUUID(),
        name,
        variableIds,
        structure: variableIds.length > 1 ? ('multiple' as const) : ('single' as const),
        type: inferredType,
      };

      const existingVarIds = new Set(variableIds);
      const filteredSets = variableSets.filter((s) => {
        const allInNew = s.variableIds.every((vId) => existingVarIds.has(vId));
        return !allInNew || s.variableIds.length > variableIds.length;
      });

      set({ variableSets: [...filteredSets, newSet] });
    },

    splitVariableSet: (setId) => {
      const { variableSets, dataset } = get();
      if (!dataset) return;

      const setToSplit = variableSets.find((s) => s.id === setId);
      if (!setToSplit || setToSplit.variableIds.length <= 1) return;

      const newSets = setToSplit.variableIds.map((vId) => {
        const variable = dataset.variables.find((v) => v.id === vId);
        return {
          id: crypto.randomUUID(),
          name: variable?.label || vId,
          variableIds: [vId],
          structure: 'single' as const,
          type: variable?.type,
        };
      });

      const otherSets = variableSets.filter((s) => s.id !== setId);
      set({ variableSets: [...otherSets, ...newSets] });
    },

    setWeightVariable: (variableId) => {
      set((state) => {
        if (!state.dataset) return state;
        return {
          dataset: {
            ...state.dataset,
            weightVariable: variableId || undefined,
          },
        };
      });
    },

    createFolder: (name) => {
      const id = crypto.randomUUID();
      set((state) => ({
        folders: [
          ...state.folders,
          {
            id,
            name,
            order: state.folders.length,
          },
        ],
      }));
      return id;
    },

    renameFolder: (folderId, name) => {
      set((state) => ({
        folders: state.folders.map((f) => (f.id === folderId ? { ...f, name } : f)),
      }));
    },

    deleteFolder: (folderId) => {
      set((state) => ({
        folders: state.folders.filter((f) => f.id !== folderId),
        variableSets: state.variableSets.map((vs) => (vs.folderId === folderId ? { ...vs, folderId: undefined } : vs)),
      }));
    },

    moveToFolder: (variableSetIds, folderId) => {
      set((state) => ({
        variableSets: state.variableSets.map((vs) =>
          variableSetIds.includes(vs.id) ? { ...vs, folderId: folderId || undefined } : vs,
        ),
      }));
    },

    reorderVariableSets: (activeId, overId) => {
      set((state) => {
        const oldIndex = state.variableSets.findIndex((vs) => vs.id === activeId);
        const newIndex = state.variableSets.findIndex((vs) => vs.id === overId);
        if (oldIndex === -1 || newIndex === -1) return state;

        const newSets = [...state.variableSets];
        const [moved] = newSets.splice(oldIndex, 1);
        newSets.splice(newIndex, 0, moved);

        return {
          variableSets: newSets.map((vs, idx) => ({ ...vs, order: idx })),
        };
      });
    },

    bulkSetType: (variableSetIds, type) => {
      const normalized = normalizeVariableType(type);
      set((state) => ({
        variableSets: state.variableSets.map((vs) =>
          variableSetIds.includes(vs.id)
            ? {
                ...vs,
                type: normalized,
                orderedStyle: normalized === 'ordered' ? (vs.orderedStyle ?? 'sequence') : undefined,
                orderedScoring: normalized === 'ordered' ? (vs.orderedScoring ?? 'categorical_only') : undefined,
              }
            : vs,
        ),
      }));
    },

    bulkHide: (variableSetIds, hidden) => {
      set((state) => ({
        variableSets: state.variableSets.map((vs) => (variableSetIds.includes(vs.id) ? { ...vs, hidden } : vs)),
      }));
    },

    convertMultipleToGrid: (setId) => {
      set((state) => ({
        variableSets: state.variableSets.map((vs) =>
          vs.id === setId ? { ...vs, structure: 'grid' as const, countedValue: undefined } : vs,
        ),
      }));
    },

    updateVariableMetadata: (variableId, updates) => {
      set((state) => {
        if (!state.dataset) return state;
        const variable = state.dataset.variables.find((v) => v.id === variableId);
        if (!variable) return state;

        const currentDerivedName = variable.label || variable.name;
        const newLabel = updates.label !== undefined ? updates.label : variable.label;
        const newName = updates.name !== undefined ? updates.name : variable.name;
        const newDerivedName = newLabel || newName;

        const variableSets = state.variableSets.map((vs) =>
          vs.structure === 'single' && vs.variableIds[0] === variableId && vs.name === currentDerivedName
            ? { ...vs, name: newDerivedName }
            : vs,
        );

        return {
          dataset: {
            ...state.dataset,
            variables: state.dataset.variables.map((v) => (v.id === variableId ? { ...v, ...updates } : v)),
          },
          variableSets,
        };
      });
    },

    updateValueLabel: (variableId, valueCode, newLabel) => {
      set((state) => {
        if (!state.dataset) return state;
        const numCode = typeof valueCode === 'string' ? parseFloat(valueCode) : valueCode;

        const gridSiblingIds = new Set<string>();
        state.variableSets.forEach((vs) => {
          if (vs.structure === 'grid' && vs.variableIds.includes(variableId)) {
            vs.variableIds.forEach((id) => {
              if (id !== variableId) gridSiblingIds.add(id);
            });
          }
        });

        const applyUpdate = (v: Variable) => {
          const exists = v.valueLabels.some((vl) => vl.value === numCode);
          if (exists) {
            return {
              ...v,
              valueLabels: v.valueLabels.map((vl) => (vl.value === numCode ? { ...vl, label: newLabel } : vl)),
            };
          }
          return {
            ...v,
            valueLabels: [...v.valueLabels, { value: numCode, label: newLabel }],
          };
        };

        return {
          dataset: {
            ...state.dataset,
            variables: state.dataset.variables.map((v) => {
              if (v.id === variableId || gridSiblingIds.has(v.id)) return applyUpdate(v);
              return v;
            }),
          },
        };
      });
    },

    toggleDiscreteMissingValue: (variableId, valueCode, isMissing) => {
      set((state) => {
        if (!state.dataset) return state;
        return {
          dataset: {
            ...state.dataset,
            variables: state.dataset.variables.map((v) => {
              if (v.id !== variableId) return v;
              const numCode = typeof valueCode === 'string' ? parseFloat(valueCode) : (valueCode as number);
              const current = v.missingValues.discrete || [];
              const discrete = isMissing
                ? [...current.filter((c) => c !== numCode), numCode]
                : current.filter((c) => c !== numCode);
              return { ...v, missingValues: { ...v.missingValues, discrete } };
            }),
          },
          variableStats: Object.fromEntries(Object.entries(state.variableStats).filter(([key]) => key !== variableId)),
          variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false },
        };
      });

      const runAnalysis = resolveRunAnalysis(get);
      if (runAnalysis) {
        void runAnalysis().catch((error) => {
          console.warn('[DataSlice] Analysis refresh failed after missing-value update:', error);
        });
      }
    },
  };
}
