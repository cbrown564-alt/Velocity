/**
 * Analysis Slice
 * 
 * Manages table configuration, query results, and filters.
 */

import type { StateCreator } from 'zustand';
// buildCrosstabQuery import removed
import type { WorkerRequest, WorkerResponse, VariableStatsResult } from '../../services/analysisWorker';
import type { DataSlice, VariableSet } from './dataSlice';
import type { UISlice } from './uiSlice';

// ============================================================================
// Types
// ============================================================================

export interface TableConfig {
    rowVars: string[];
    colVar: string | null;
}

export interface Filter {
    id: string;
    variableId: string;
    operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt';
    value: number | string | (number | string)[];
}

import { AggregatedRow } from '../../types';
import { CrosstabQueryOptions } from '../../services/queryBuilder';

// ============================================================================
// Slice State & Actions
// ============================================================================

export interface AnalysisSlice {
    // State
    tableConfig: TableConfig;
    queryResult: AggregatedRow[];
    isQuerying: boolean;
    activeFilters: Filter[];
    activeVariableStats: VariableStatsResult | null;

    // Actions
    setTableConfig: (config: Partial<TableConfig>) => void;
    runAnalysis: () => Promise<void>;
    reorderRowVars: (newOrder: string[]) => void;
    addFilter: (filter: Omit<Filter, 'id'>) => void;
    removeFilter: (filterId: string) => void;
    clearFilters: () => void;
    fetchVariableStats: (variableId: string, variableType?: 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date', binCount?: number) => Promise<void>;
    reset: () => void;
}

// This slice needs access to DataSlice for worker and dataset, and UISlice for chart type reset
type AnalysisSliceCreator = StateCreator<
    AnalysisSlice & DataSlice & UISlice,
    [],
    [],
    AnalysisSlice
>;

export const createAnalysisSlice: AnalysisSliceCreator = (set, get) => ({
    // Initial state
    tableConfig: { rowVars: [], colVar: null },
    queryResult: [],
    isQuerying: false,
    activeFilters: [],
    activeVariableStats: null,

    // Actions
    setTableConfig: (config) => {
        set((state) => ({
            tableConfig: { ...state.tableConfig, ...config },
            // Reset chart type to auto when variables change so the recommender picks the best chart
            selectedChartType: null,
        }));
        get().runAnalysis();
    },

    runAnalysis: async () => {
        const { worker, tableConfig, dataset, variableSets, activeFilters } = get();
        if (!worker || tableConfig.rowVars.length === 0) {
            set({ queryResult: [] });
            return;
        }

        set({ isQuerying: true });

        const firstRowVarSet = variableSets.find((s: VariableSet) => s.id === tableConfig.rowVars[0]);

        const options: CrosstabQueryOptions = {
            rowVars: [],
            colVar: tableConfig.colVar,
            filters: activeFilters,
            weightVar: dataset?.weightVariable
        };

        // Context for worker to resolve synthetic variables and grid definitions
        const contextVariables: Record<string, any> = {};
        const contextVariableSets: Record<string, any> = {};

        // Helper to add context
        const addToContext = (varId: string) => {
            const variable = dataset?.variables.find(v => v.id === varId);
            if (variable) contextVariables[varId] = variable;
        };

        // For synthetic variables, we need to look up source sets
        const resolveSourceSet = (variableId: string) => {
            const variable = dataset?.variables.find(v => v.id === variableId);
            if (variable?.synthetic && variable.sourceGridId) {
                const sourceSet = variableSets.find((s: VariableSet) => s.id === variable.sourceGridId);
                if (sourceSet) {
                    contextVariableSets[sourceSet.id] = sourceSet;
                    // Add all related variables from the set to context
                    sourceSet.variableIds.forEach(vid => {
                        addToContext(vid);
                    });
                }
            }
        };

        // Add row/col vars to context
        tableConfig.rowVars.forEach(vid => {
            addToContext(vid);
            resolveSourceSet(vid);
        });
        if (tableConfig.colVar) {
            addToContext(tableConfig.colVar);
            resolveSourceSet(tableConfig.colVar);
        }

        if (firstRowVarSet?.structure === 'multiple') {
            // Multiple structure - Keeping legacy handling for now
            options.multipleColumns = firstRowVarSet.variableIds.map(varId => {
                const variable = dataset?.variables.find(v => v.id === varId);
                return {
                    name: varId,
                    label: variable?.label || varId,
                    countedValue: firstRowVarSet.countedValue ?? 1,
                };
            });
        } else if (firstRowVarSet?.type === 'numeric' || (tableConfig.colVar && variableSets.find((s: VariableSet) => s.id === tableConfig.colVar)?.type === 'numeric')) {
            // Numeric Variable Analysis (Metric)
            const colVarSet = tableConfig.colVar ? variableSets.find((s: VariableSet) => s.id === tableConfig.colVar) : null;
            const isRowScale = firstRowVarSet?.type === 'numeric';

            // Determine Measure Variable
            const measureVarSet = isRowScale ? firstRowVarSet! : colVarSet!;
            const measureVarId = measureVarSet.variableIds[0];

            get().fetchVariableStats(measureVarId, 'numeric');

            options.measureVar = measureVarId;
            options.measureLabel = measureVarSet.name;
            options.includeDistributions = true;

            // Add measure var to context
            addToContext(measureVarId);

            if (isRowScale) {
                const col = tableConfig.colVar
                    ? (colVarSet?.variableIds[0] || tableConfig.colVar)
                    : null;
                options.colVar = col;
            } else {
                // Grouped Box Plot logic
                const resolveToCol = (id: string): string => {
                    const varSet = variableSets.find((s: VariableSet) => s.id === id);
                    if (varSet && varSet.variableIds.length > 0) {
                        return varSet.variableIds[0];
                    }
                    return id;
                };
                options.rowVars = tableConfig.rowVars.map(resolveToCol);
                options.colVar = null;
            }
        } else {
            // Standard / Nested / (Implicit Grid via Synthetic Vars)
            const resolveToCol = (id: string): string => {
                // If the ID matches a synthetic variable, use it directly
                const variable = dataset?.variables.find(v => v.id === id);
                if (variable) return id;

                // Else check if it's a VariableSet and take first var (legacy single var set)
                const varSet = variableSets.find((s: VariableSet) => s.id === id);
                if (varSet && varSet.variableIds.length > 0) {
                    return varSet.variableIds[0];
                }
                return id;
            };

            options.rowVars = tableConfig.rowVars.map(resolveToCol);
            options.colVar = tableConfig.colVar ? resolveToCol(tableConfig.colVar) : null;
        }

        const isWeighted = !!dataset?.weightVariable;

        return new Promise<void>((resolve) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'queryResult') {
                    const rawData = response.data as any[];
                    const mappedData: AggregatedRow[] = rawData.map(row => {
                        const rowKeys = Object.keys(row)
                            .filter(k => k.startsWith('rowKey_'))
                            .sort()
                            .map(k => row[k]);

                        return {
                            rowKeys,
                            colKey: row.colKey,
                            count: isWeighted ? 0 : Number(row.count ?? row.validCount ?? 0),
                            weightedCount: isWeighted ? Number(row.count) : undefined,
                            mean: row.mean,
                            median: row.median,
                            stdDev: row.stdDev,
                            min: row.min,
                            max: row.max,
                            q1: row.q1,
                            q3: row.q3,
                            validCount: row.validCount !== undefined ? Number(row.validCount) : undefined,
                            histogramBins: row.histogramBins, // Bins for violin/ridgeline
                            sig: row.sig, // Signficance flag from worker
                            stats: row.stats, // Detailed stats for tooltip
                        };
                    });

                    set({
                        queryResult: mappedData,
                        isQuerying: false,
                    });
                    worker.removeEventListener('message', handler);
                    resolve();
                } else if (response.type === 'error') {
                    console.error('[AnalysisSlice] Query error:', response.message);
                    set({ isQuerying: false });
                    worker.removeEventListener('message', handler);
                    resolve();
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({
                type: 'runCrosstab',
                options,
                context: {
                    variables: contextVariables,
                    variableSets: contextVariableSets
                }
            } as WorkerRequest);
        });
    },

    reorderRowVars: (newOrder) => {
        set((state) => ({
            tableConfig: { ...state.tableConfig, rowVars: newOrder },
        }));
        get().runAnalysis();
    },

    addFilter: (filterData) => {
        const filter: Filter = {
            ...filterData,
            id: crypto.randomUUID(),
        };
        set((state) => ({
            activeFilters: [...state.activeFilters, filter],
        }));
        get().runAnalysis();
    },

    removeFilter: (filterId) => {
        set((state) => ({
            activeFilters: state.activeFilters.filter(f => f.id !== filterId),
        }));
        get().runAnalysis();
    },

    clearFilters: () => {
        set({ activeFilters: [] });
        get().runAnalysis();
    },

    fetchVariableStats: async (variableId: string, variableType?: 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date', binCount?: number) => {
        const { worker } = get();
        if (!worker) return;

        return new Promise<void>((resolve) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'variableStats' && response.stats.column === variableId) {
                    set({ activeVariableStats: response.stats });
                    worker.removeEventListener('message', handler);
                    resolve();
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'getVariableStats', column: variableId, variableType, binCount } as WorkerRequest);
        });
    },

    reset: () => {
        set({
            tableConfig: { rowVars: [], colVar: null },
            queryResult: [],
            activeFilters: [],
        });
    },
});
