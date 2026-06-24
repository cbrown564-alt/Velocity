/**
 * Drill Down Slice
 * 
 * Manages drill-down state for inspecting individual records.
 */

import type { StateCreator } from 'zustand';
import type { DataSlice } from './dataSlice';
import type { AnalysisSlice } from './analysisSlice';
import {
    buildDrillDownQueryOptions,
    resolveDrillDownContext,
    type DrillDownFilter,
} from '../../services/drillDown';
export type { DrillDownFilter } from '../../services/drillDown';

// ============================================================================
// Types
// ============================================================================

export interface DrillDownState {
    isOpen: boolean;
    title: string;
    data: any[];
    loading: boolean;
    totalCount: number;
    currentPage: number;
    pageSize: number;
    rowFilters: DrillDownFilter[];
    colFilter: DrillDownFilter | null;
}

// ============================================================================
// Slice State & Actions
// ============================================================================

export interface DrillDownSlice {
    drillDown: DrillDownState;
    openDrillDown: (rowPath: { variable: string; value: string }[], colValue: string | null) => Promise<void>;
    loadMoreDrillDown: () => Promise<void>;
    closeDrillDown: () => void;
}

const initialDrillDown: DrillDownState = {
    isOpen: false,
    title: '',
    data: [],
    loading: false,
    totalCount: 0,
    currentPage: 1,
    pageSize: 50,
    rowFilters: [],
    colFilter: null,
};

type DrillDownSliceCreator = StateCreator<
    DrillDownSlice & DataSlice & AnalysisSlice,
    [],
    [],
    DrillDownSlice
>;

export const createDrillDownSlice: DrillDownSliceCreator = (set, get) => ({
    drillDown: initialDrillDown,

    openDrillDown: async (rowPath, colValue) => {
        const { engineProxy, tableConfig, dataset, activeFilters, variableSets } = get();
        if (!engineProxy || rowPath.length === 0) return;

        const pageSize = 50;
        const { rowFilters, colFilter, title } = resolveDrillDownContext({
            rowPath,
            colValue,
            colVarId: tableConfig.colVar,
            variableSets,
            variables: dataset?.variables ?? [],
        });

        set({
            drillDown: {
                isOpen: true,
                title,
                data: [],
                loading: true,
                totalCount: 0,
                currentPage: 1,
                pageSize,
                rowFilters,
                colFilter,
            },
        });

        const { buildDrillDownQuery, buildDrillDownCountQuery } = await import('../../core/sql/queryBuilder');

        const queryOptions = buildDrillDownQueryOptions({
            rowFilters,
            colFilter,
            filters: activeFilters,
            limit: pageSize,
            offset: 0,
        });

        const dataSql = buildDrillDownQuery(queryOptions);
        const countSql = buildDrillDownCountQuery(queryOptions);

        // Run both queries concurrently via EngineProxy
        const [dataResponse, countResponse] = await Promise.all([
            engineProxy.query(dataSql).catch((err) => {
                console.error('[DrillDownSlice] Data query error:', err.message);
                return { data: [] as any[], durationMs: 0 };
            }),
            engineProxy.query(countSql).catch((err) => {
                console.error('[DrillDownSlice] Count query error:', err.message);
                return { data: [{ total: 0 }] as any[], durationMs: 0 };
            }),
        ]);

        const firstRow = dataResponse.data?.length ? dataResponse.data : [];
        const countRow = countResponse.data?.[0] as Record<string, unknown> | undefined;
        const totalCount = Number(countRow?.total ?? 0);

        set((state) => ({
            drillDown: {
                ...state.drillDown,
                data: firstRow,
                totalCount,
                loading: false,
            },
        }));
    },

    loadMoreDrillDown: async () => {
        const { engineProxy, drillDown, activeFilters } = get();
        if (!engineProxy || drillDown.loading) return;

        const { rowFilters, colFilter, currentPage, pageSize, data } = drillDown;
        const nextPage = currentPage + 1;
        const offset = currentPage * pageSize;

        set((state) => ({
            drillDown: { ...state.drillDown, loading: true },
        }));

        const { buildDrillDownQuery } = await import('../../core/sql/queryBuilder');

        const queryOptions = buildDrillDownQueryOptions({
            rowFilters,
            colFilter,
            filters: activeFilters,
            limit: pageSize,
            offset,
        });

        const sql = buildDrillDownQuery(queryOptions);

        try {
            const response = await engineProxy.query(sql);
            set((state) => ({
                drillDown: {
                    ...state.drillDown,
                    data: [...data, ...response.data],
                    currentPage: nextPage,
                    loading: false,
                },
            }));
        } catch (error: any) {
            console.error('[DrillDownSlice] Load more error:', error.message);
            set((state) => ({
                drillDown: { ...state.drillDown, loading: false },
            }));
        }
    },

    closeDrillDown: () => set({ drillDown: initialDrillDown }),
});
