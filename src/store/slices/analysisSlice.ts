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
  type Variable,
} from '../../types';

export type { AnalysisEngine, AnalysisSettings, ComparisonMethod, CorrectionType, Filter, TableConfig };

// ============================================================================
// Types (canonical definitions in src/types/analysis.ts)
// ============================================================================
import type { VariableType } from '../../types';
import type { SlideAnalysisState } from '../../types/slides';
import { buildCrosstabRequest } from '../../core/analysis/buildCrosstabRequest';
import { mapCrosstabRows } from '../../core/analysis/mapCrosstabRows';
import type { CrosstabSqlRow } from '../../core/analysis/crosstab/types';
import { recordPilotEvent } from '../../services/pilotOnboarding';
import type { ProcessedAnalysisData } from '../../types/processedData';

interface CachedCrosstabResult {
  queryResult: AggregatedRow[];
  processedQueryResult: ProcessedAnalysisData | null;
  tableStats: TableStats | null;
}

const CROSSTAB_CACHE_LIMIT = 25;
const crosstabResultCache = new Map<string, CachedCrosstabResult>();

function stableCacheStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue) => {
    if (!nestedValue || typeof nestedValue !== 'object' || Array.isArray(nestedValue)) return nestedValue;
    return Object.keys(nestedValue)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (nestedValue as Record<string, unknown>)[key];
        return acc;
      }, {});
  });
}

function writeCrosstabCache(key: string, result: CachedCrosstabResult): void {
  if (crosstabResultCache.has(key)) crosstabResultCache.delete(key);
  crosstabResultCache.set(key, result);
  while (crosstabResultCache.size > CROSSTAB_CACHE_LIMIT) {
    const oldestKey = crosstabResultCache.keys().next().value;
    if (!oldestKey) break;
    crosstabResultCache.delete(oldestKey);
  }
}

// ============================================================================
// Slice State & Actions
// ============================================================================

export interface AnalysisSlice {
  // State
  tableConfig: TableConfig;
  queryResult: AggregatedRow[];
  processedQueryResult: ProcessedAnalysisData | null;
  tableStats: TableStats | null;
  isQuerying: boolean;
  /** Last crosstab failure message for inline slide UI (UXR-037). */
  queryError: string | null;
  activeFilters: Filter[];
  activeVariableStats: VariableStatsResult | null;
  analysisSettings: AnalysisSettings;

  // Actions
  setTableConfig: (config: Partial<TableConfig>) => void;
  /** Project slide-owned analysis config into global store; optional single runAnalysis. */
  applySlideAnalysisState: (slideState: SlideAnalysisState, options?: { runAnalysis?: boolean }) => void;
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
type AnalysisSliceCreator = StateCreator<AnalysisSlice & DataSlice & UISlice, [], [], AnalysisSlice>;

const defaultAnalysisSettings: AnalysisSettings = {
  comparisonMethod: 'cell_vs_rest',
  correctionType: 'none',
  showConfidenceIntervals: false,
  showCellN: true,
  showColumnBases: true,
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
  processedQueryResult: null,
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

  applySlideAnalysisState: (slideState, options = {}) => {
    const { runAnalysis: shouldRun = true } = options;
    set(() => ({
      tableConfig: {
        rowVars: [...slideState.rowVars],
        colVar: slideState.colVar,
      },
      activeFilters: slideState.filters.map((filter) => ({ ...filter })),
      selectedChartType: null,
    }));
    if (shouldRun) {
      triggerAnalysisSafely(get().runAnalysis, 'applySlideAnalysisState analysis');
    }
  },

  runAnalysis: async () => {
    const { browserEngine, tableConfig, dataset, variableSets, activeFilters, analysisSettings, transformLog } = get();
    if (!browserEngine || !dataset || tableConfig.rowVars.length === 0) {
      set({ queryResult: [], processedQueryResult: null, tableStats: null, queryError: null });
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

      const rowVariables = tableConfig.rowVars
        .map((varId) => dataset.variables.find((variable) => variable.id === varId))
        .filter((variable): variable is Variable => Boolean(variable));
      const colVariable = tableConfig.colVar
        ? (dataset.variables.find((variable) => variable.id === tableConfig.colVar) ?? null)
        : null;
      const isMultipleResponse = Boolean(request.options.multipleColumns || request.options.columnMultipleColumns);
      const cacheKey = stableCacheStringify({
        dataset: {
          id: dataset.id,
          name: dataset.name,
          rowCount: dataset.rowCount,
          variableCount: dataset.variables.length,
          weightVariable: dataset.weightVariable ?? null,
        },
        transformLog: transformLog.map((transform) => ({
          type: transform.type,
          sourceColId: transform.sourceColId,
          newColId: transform.newColId,
          createdAt: transform.createdAt,
          config: transform.config,
        })),
        rowVars: tableConfig.rowVars,
        colVar: tableConfig.colVar,
        filters: activeFilters,
        weightVar: dataset?.weightVariable ?? null,
        analysisSettings,
        options: request.options,
      });
      const cached = crosstabResultCache.get(cacheKey);
      if (cached) {
        set({
          queryResult: cached.queryResult,
          processedQueryResult: cached.processedQueryResult,
          tableStats: cached.tableStats,
          isQuerying: false,
          queryError: null,
        });
        return;
      }

      const response = await browserEngine.runAnalysis(
        'crosstab',
        {
          rowVars: tableConfig.rowVars,
          colVar: tableConfig.colVar,
          filters: activeFilters,
          weightVar: dataset?.weightVariable ?? null,
          analysisSettings,
          includeProcessedData: {
            rowVariables,
            colVariable,
            isWeighted: request.isWeighted,
            isMultipleResponse,
          },
        },
        { dataset, variableSets },
      );
      const rawData = response.data as {
        rows: CrosstabSqlRow[];
        processedData?: ProcessedAnalysisData | null;
        timings?: { queryMs: number; processMs?: number; totalMs: number };
      };
      const mappedData: AggregatedRow[] = mapCrosstabRows(rawData.rows, request.isWeighted);
      const nextResult = {
        queryResult: mappedData,
        processedQueryResult: rawData.processedData ?? null,
        tableStats: (response.data as { tableStats: TableStats | null }).tableStats,
      };
      writeCrosstabCache(cacheKey, nextResult);

      set({
        queryResult: nextResult.queryResult,
        processedQueryResult: nextResult.processedQueryResult,
        tableStats: nextResult.tableStats,
        isQuerying: false,
        queryError: null,
      });

      if (tableConfig.colVar && mappedData.length > 0) {
        recordPilotEvent('first_crosstab', {
          rowVars: tableConfig.rowVars,
          colVar: tableConfig.colVar,
          rowCount: mappedData.length,
          weighted: !!dataset?.weightVariable,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Couldn't run analysis";
      console.error('[AnalysisSlice] Query error:', message);
      set({
        isQuerying: false,
        queryResult: [],
        processedQueryResult: null,
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
      activeFilters: state.activeFilters.filter((f) => f.id !== filterId),
    }));
    triggerAnalysisSafely(get().runAnalysis, 'removeFilter analysis');
  },

  clearFilters: () => {
    set({ activeFilters: [] });
    triggerAnalysisSafely(get().runAnalysis, 'clearFilters analysis');
  },

  fetchVariableStats: async (variableId: string, variableType?: VariableType, binCount?: number) => {
    const { browserEngine } = get();
    if (!browserEngine) return;

    try {
      const response = await browserEngine.runAnalysis('variableStats', {
        column: variableId,
        variableType,
        binCount,
      });
      set({ activeVariableStats: response.data as VariableStatsResult });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Variable stats failed';
      console.error('[AnalysisSlice] Variable stats error:', message);
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
        colVar: newColVar,
      },
    }));
    triggerAnalysisSafely(get().runAnalysis, 'swapAxes analysis');
  },

  clearConfiguration: () => {
    set({
      tableConfig: { rowVars: [], colVar: null },
      queryResult: [],
      processedQueryResult: null,
      tableStats: null,
    });
  },

  updateAnalysisSettings: (settings) => {
    set((state) => ({
      analysisSettings: { ...state.analysisSettings, ...settings },
    }));
    const displayOnlyKeys = new Set(['showCellN', 'showColumnBases']);
    const needsRerun = Object.keys(settings).some((key) => !displayOnlyKeys.has(key));
    if (needsRerun) {
      triggerAnalysisSafely(get().runAnalysis, 'updateAnalysisSettings analysis');
    }
  },

  reset: () => {
    set({
      tableConfig: { rowVars: [], colVar: null },
      queryResult: [],
      processedQueryResult: null,
      tableStats: null,
      queryError: null,
      activeFilters: [],
      analysisSettings: defaultAnalysisSettings,
    });
  },
});
