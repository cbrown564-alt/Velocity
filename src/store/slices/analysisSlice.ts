/**
 * Analysis Slice
 * 
 * Manages table configuration, query results, and filters.
 */

import type { StateCreator } from 'zustand';
import { buildCrosstabQuery } from '../../services/queryBuilder';
import type { WorkerRequest, WorkerResponse, VariableStatsResult } from '../../services/analysisWorker';
import type { DataSlice, VariableSet } from './dataSlice';

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

export interface AggregatedRow {
    rowKeys: string[];
    colKey: string;
    count: number;
    weightedCount?: number;
    // Scale variable stats
    mean?: number;
    median?: number;
    stdDev?: number;
    min?: number;
    max?: number;
    validCount?: number;
}

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
    fetchVariableStats: (variableId: string) => Promise<void>;
    reset: () => void;
}

// This slice needs access to DataSlice for worker and dataset
type AnalysisSliceCreator = StateCreator<
    AnalysisSlice & DataSlice,
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

        // Check if the first row variable is a grid or multiple structure
        const firstRowVarSet = variableSets.find((s: VariableSet) => s.id === tableConfig.rowVars[0]);

        let sql: string;

        if (firstRowVarSet?.structure === 'grid') {
            // Grid structure: unpivot all variables to show scale values as rows, variables as columns
            // Map variable IDs to their labels
            const gridColumns = firstRowVarSet.variableIds.map(varId => {
                const variable = dataset?.variables.find(v => v.id === varId);
                return {
                    name: varId,
                    label: variable?.label || varId,
                };
            });
            sql = buildCrosstabQuery({
                rowVars: [],
                gridColumns,
                filters: activeFilters,
                weightVar: dataset?.weightVariable || undefined,
            });
        } else if (firstRowVarSet?.structure === 'multiple') {
            // Multiple structure: show only counted value for each variable
            // Map variable IDs to their labels
            const multipleColumns = firstRowVarSet.variableIds.map(varId => {
                const variable = dataset?.variables.find(v => v.id === varId);
                return {
                    name: varId,
                    label: variable?.label || varId,
                    countedValue: firstRowVarSet.countedValue ?? 1, // Default to 1 if not specified
                };
            });
            sql = buildCrosstabQuery({
                rowVars: [],
                multipleColumns,
                filters: activeFilters,
                weightVar: dataset?.weightVariable || undefined,
            });
        } else if (firstRowVarSet?.type === 'scale') {
            // Scale Variable: Show Summary Stats instead of frequencies
            // Get the first variable ID (assuming single variable for now)
            const measureVarId = firstRowVarSet.variableIds[0];

            // Also fetch the full distribution stats for the Sparkline
            get().fetchVariableStats(measureVarId);

            const col = tableConfig.colVar
                ? (variableSets.find((s: VariableSet) => s.id === tableConfig.colVar)?.variableIds[0] || tableConfig.colVar)
                : null;

            sql = buildCrosstabQuery({
                rowVars: [], // No row grouping, we group by Col only
                colVar: col,
                filters: activeFilters,
                weightVar: dataset?.weightVariable || undefined,
                measureVar: measureVarId,
                measureLabel: firstRowVarSet.name,
            });
        } else {
            // Standard single variable or nested rows
            const resolveToCol = (id: string): string => {
                const varSet = variableSets.find((s: VariableSet) => s.id === id);
                if (varSet && varSet.variableIds.length > 0) {
                    return varSet.variableIds[0];
                }
                return id;
            };

            const rows = tableConfig.rowVars.map(resolveToCol);
            const col = tableConfig.colVar ? resolveToCol(tableConfig.colVar) : null;

            sql = buildCrosstabQuery({
                rowVars: rows,
                colVar: col,
                filters: activeFilters,
                weightVar: dataset?.weightVariable || undefined,
            });
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
                            // Convert to Number to handle potential BigInts from DuckDB
                            count: isWeighted ? 0 : Number(row.count ?? row.validCount ?? 0),
                            weightedCount: isWeighted ? Number(row.count) : undefined,

                            // Map stats if present
                            mean: row.mean,
                            median: row.median,
                            stdDev: row.stdDev,
                            min: row.min,
                            max: row.max,
                            validCount: row.validCount !== undefined ? Number(row.validCount) : undefined,
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
            worker.postMessage({ type: 'query', sql } as WorkerRequest);
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

    fetchVariableStats: async (variableId: string) => {
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
            worker.postMessage({ type: 'getVariableStats', column: variableId } as WorkerRequest);
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
