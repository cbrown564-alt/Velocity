/**
 * Analysis Slice
 * 
 * Manages table configuration, query results, and filters.
 */

import type { StateCreator } from 'zustand';
// buildCrosstabQuery import removed
import type { WorkerRequest, WorkerResponse, VariableStatsResult } from '../../types/worker';
import type { DataSlice } from './dataSlice';
import type { UISlice } from './uiSlice';

// ============================================================================
// Types
// ============================================================================

export interface TableConfig {
    rowVars: string[];
    colVar: string | null;
}

export type ComparisonMethod = 'cell_vs_rest' | 'pairwise';
export type CorrectionType = 'none' | 'bonferroni' | 'fdr';
export type AnalysisEngine = 'auto' | 'duckdb' | 'webr';

export interface AnalysisSettings {
    comparisonMethod: ComparisonMethod;
    correctionType: CorrectionType;
    showConfidenceIntervals: boolean;
    significanceLevel: 0.95 | 0.90 | 0.80;
    /** Analysis engine selection: auto selects WebR for design effects/mixed models */
    engine: AnalysisEngine;
    /** Enable design effect calculation (requires WebR) */
    enableDesignEffects: boolean;
}

export interface Filter {
    id: string;
    variableId: string;
    operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt';
    value: number | string | (number | string)[];
}

import { AggregatedRow, TableStats } from '../../types';
import { buildCrosstabRequest } from '../../core/analysis/buildCrosstabRequest';
import { mapCrosstabRows } from '../../core/analysis/mapCrosstabRows';

// ============================================================================
// Slice State & Actions
// ============================================================================

export interface AnalysisSlice {
    // State
    tableConfig: TableConfig;
    queryResult: AggregatedRow[];
    tableStats: TableStats | null;
    isQuerying: boolean;
    activeFilters: Filter[];
    activeVariableStats: VariableStatsResult | null;
    analysisSettings: AnalysisSettings;

    // Actions
    setTableConfig: (config: Partial<TableConfig>) => void;
    runAnalysis: () => Promise<void>;
    reorderRowVars: (newOrder: string[]) => void;
    addFilter: (filter: Omit<Filter, 'id'>) => void;
    removeFilter: (filterId: string) => void;
    clearFilters: () => void;
    fetchVariableStats: (variableId: string, variableType?: 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date', binCount?: number) => Promise<void>;
    swapAxes: () => void;
    clearConfiguration: () => void;
    updateAnalysisSettings: (settings: Partial<AnalysisSettings>) => void;
    reset: () => void;
}

// This slice needs access to DataSlice for worker and dataset, and UISlice for chart type reset
type AnalysisSliceCreator = StateCreator<
    AnalysisSlice & DataSlice & UISlice,
    [],
    [],
    AnalysisSlice
>;

const defaultAnalysisSettings: AnalysisSettings = {
    comparisonMethod: 'cell_vs_rest',
    correctionType: 'none',
    showConfidenceIntervals: false,
    significanceLevel: 0.95,
    engine: 'auto',
    enableDesignEffects: false,
};

export const createAnalysisSlice: AnalysisSliceCreator = (set, get) => ({
    // Initial state
    tableConfig: { rowVars: [], colVar: null },
    queryResult: [],
    tableStats: null,
    isQuerying: false,
    activeFilters: [],
    activeVariableStats: null,
    analysisSettings: defaultAnalysisSettings,

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
        const { worker, tableConfig, dataset, variableSets, activeFilters, analysisSettings } = get();
        if (!worker || !dataset || tableConfig.rowVars.length === 0) {
            set({ queryResult: [], tableStats: null });
            return;
        }

        set({ isQuerying: true });

        const request = buildCrosstabRequest({
            dataset,
            variableSets,
            rowVars: tableConfig.rowVars,
            colVar: tableConfig.colVar,
            filters: activeFilters,
            weightVar: dataset?.weightVariable ?? null,
            analysisSettings,
        });

        if (request.measureVarId) {
            get().fetchVariableStats(request.measureVarId, 'numeric');
        }

        return new Promise<void>((resolve) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'queryResult') {
                    const rawData = response.data as any[];
                    const mappedData: AggregatedRow[] = mapCrosstabRows(rawData, request.isWeighted);

                    set({
                        queryResult: mappedData,
                        tableStats: response.tableStats || null,
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
                options: request.options,
                context: request.context,
                analysisSettings: request.analysisSettings,
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

    swapAxes: () => {
        const { rowVars, colVar } = get().tableConfig;
        let newRowVars = [...rowVars];
        let newColVar = colVar;

        if (colVar && rowVars.length > 0) {
            // Swap first row with col
            // Row 1 -> Col, Col -> Row 1
            const firstRow = rowVars[0];
            newColVar = firstRow;
            newRowVars[0] = colVar;
        } else if (colVar && rowVars.length === 0) {
            // Col -> Row
            newRowVars = [colVar];
            newColVar = null;
        } else if (!colVar && rowVars.length > 0) {
            // Row -> Col
            newColVar = rowVars[0];
            newRowVars.shift();
        }

        set((state) => ({
            tableConfig: {
                ...state.tableConfig,
                rowVars: newRowVars,
                colVar: newColVar
            }
        }));
        get().runAnalysis();
    },

    clearConfiguration: () => {
        set((state) => ({
            tableConfig: { rowVars: [], colVar: null },
            queryResult: [],
            tableStats: null,
        }));
    },

    updateAnalysisSettings: (settings) => {
        set((state) => ({
            analysisSettings: { ...state.analysisSettings, ...settings },
        }));
        // Re-run analysis to apply new settings
        get().runAnalysis();
    },

    reset: () => {
        set({
            tableConfig: { rowVars: [], colVar: null },
            queryResult: [],
            tableStats: null,
            activeFilters: [],
            analysisSettings: defaultAnalysisSettings,
        });
    },
});
