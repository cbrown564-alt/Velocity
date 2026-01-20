/**
 * Analysis Slice
 * 
 * Manages table configuration, query results, and filters.
 */

import type { StateCreator } from 'zustand';
import { buildCrosstabQuery } from '../../services/queryBuilder';
import type { WorkerRequest, WorkerResponse } from '../../services/analysisWorker';
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

    // Actions
    setTableConfig: (config: Partial<TableConfig>) => void;
    runAnalysis: () => Promise<void>;
    reorderRowVars: (newOrder: string[]) => void;
    addFilter: (filter: Omit<Filter, 'id'>) => void;
    removeFilter: (filterId: string) => void;
    clearFilters: () => void;
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

        const resolveToCol = (id: string): string => {
            const varSet = variableSets.find((s: VariableSet) => s.id === id);
            if (varSet && varSet.variableIds.length > 0) {
                return varSet.variableIds[0];
            }
            return id;
        };

        const rows = tableConfig.rowVars.map(resolveToCol);
        const col = tableConfig.colVar ? resolveToCol(tableConfig.colVar) : null;

        const sql = buildCrosstabQuery({
            rowVars: rows,
            colVar: col,
            filters: activeFilters,
            weightVar: dataset?.weightVariable || undefined,
        });

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
                            count: isWeighted ? 0 : row.count,
                            weightedCount: isWeighted ? row.count : undefined,
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

    reset: () => {
        set({
            tableConfig: { rowVars: [], colVar: null },
            queryResult: [],
            activeFilters: [],
        });
    },
});
