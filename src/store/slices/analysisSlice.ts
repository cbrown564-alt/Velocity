/**
 * Analysis Slice
 * 
 * Manages table configuration, query results, and filters.
 */

import type { StateCreator } from 'zustand';
import type { VariableStatsResult } from '../../types/worker';
import type { DataSlice } from './dataSlice';
import type { UISlice } from './uiSlice';

import {
    AggregatedRow,
    TableStats,
    type AnalysisEngine,
    type AnalysisSettings,
    type ComparisonMethod,
    type CorrectionType,
    type Filter,
    type TableConfig,
} from '../../types';

export type {
    AnalysisEngine,
    AnalysisSettings,
    ComparisonMethod,
    CorrectionType,
    Filter,
    TableConfig,
};

// ============================================================================
// Types (canonical definitions in src/types/analysis.ts)
// ============================================================================
import type { VariableType } from '../../types';
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
    /** Last crosstab failure message for inline slide UI (UXR-037). */
    queryError: string | null;
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
    fetchVariableStats: (variableId: string, variableType?: VariableType, binCount?: number) => Promise<void>;
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

function triggerAnalysisSafely(runAnalysis: (() => Promise<void>) | undefined, context: string): void {
    if (typeof runAnalysis !== 'function') return;
    void runAnalysis().catch((error) => {
        console.warn(`[AnalysisSlice] ${context} failed:`, error);
    });
}

export const createAnalysisSlice: AnalysisSliceCreator = (set, get) => ({
    // Initial state
    tableConfig: { rowVars: [], colVar: null },
    queryResult: [],
    tableStats: null,
    isQuerying: false,
    queryError: null,
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
        triggerAnalysisSafely(get().runAnalysis, 'setTableConfig analysis');
    },

    runAnalysis: async () => {
        const { engineProxy, tableConfig, dataset, variableSets, activeFilters, analysisSettings } = get();
        if (!engineProxy || !dataset || tableConfig.rowVars.length === 0) {
            set({ queryResult: [], tableStats: null, queryError: null });
            return;
        }

        set({ isQuerying: true, queryError: null });

        try {
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
                void get().fetchVariableStats(request.measureVarId, 'numeric');
            }

            const response = await engineProxy.runCrosstab(
                request.options,
                request.context,
                request.analysisSettings,
            );
            const rawData = response.data.rows as any[];
            const mappedData: AggregatedRow[] = mapCrosstabRows(rawData, request.isWeighted);

            set({
                queryResult: mappedData,
                tableStats: response.data.tableStats,
                isQuerying: false,
                queryError: null,
            });
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : 'Couldn\'t run analysis';
            console.error('[AnalysisSlice] Query error:', message);
            set({
                isQuerying: false,
                queryResult: [],
                tableStats: null,
                queryError: message,
            });
        }
    },

    reorderRowVars: (newOrder) => {
        set((state) => ({
            tableConfig: { ...state.tableConfig, rowVars: newOrder },
        }));
        triggerAnalysisSafely(get().runAnalysis, 'reorderRowVars analysis');
    },

    addFilter: (filterData) => {
        const filter: Filter = {
            ...filterData,
            id: crypto.randomUUID(),
        };
        set((state) => ({
            activeFilters: [...state.activeFilters, filter],
        }));
        triggerAnalysisSafely(get().runAnalysis, 'addFilter analysis');
    },

    removeFilter: (filterId) => {
        set((state) => ({
            activeFilters: state.activeFilters.filter(f => f.id !== filterId),
        }));
        triggerAnalysisSafely(get().runAnalysis, 'removeFilter analysis');
    },

    clearFilters: () => {
        set({ activeFilters: [] });
        triggerAnalysisSafely(get().runAnalysis, 'clearFilters analysis');
    },

    fetchVariableStats: async (variableId: string, variableType?: VariableType, binCount?: number) => {
        const { engineProxy } = get();
        if (!engineProxy) return;

        try {
            const response = await engineProxy.getVariableStats(variableId, variableType, undefined, binCount);
            set({ activeVariableStats: response.data });
        } catch (error: any) {
            console.error('[AnalysisSlice] Variable stats error:', error.message);
        }
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
        triggerAnalysisSafely(get().runAnalysis, 'swapAxes analysis');
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
        triggerAnalysisSafely(get().runAnalysis, 'updateAnalysisSettings analysis');
    },

    reset: () => {
        set({
            tableConfig: { rowVars: [], colVar: null },
            queryResult: [],
            tableStats: null,
            queryError: null,
            activeFilters: [],
            analysisSettings: defaultAnalysisSettings,
        });
    },
});
