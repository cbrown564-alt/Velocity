/**
 * Drill Down Slice
 * 
 * Manages drill-down state for inspecting individual records.
 */

import type { StateCreator } from 'zustand';
import type { WorkerRequest, WorkerResponse } from '../../services/analysisWorker';
import type { DataSlice, VariableSet } from './dataSlice';
import type { AnalysisSlice, Filter } from './analysisSlice';

// ============================================================================
// Types
// ============================================================================

export interface DrillDownFilter {
    variable: string;
    value: string;
}

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
        const { worker, tableConfig, dataset, activeFilters, variableSets } = get();
        if (!worker || rowPath.length === 0) return;

        const pageSize = 50;

        const resolveToCol = (id: string): string => {
            const varSet = variableSets.find((s: VariableSet) => s.id === id);
            if (varSet && varSet.variableIds.length > 0) {
                return varSet.variableIds[0];
            }
            return id;
        };

        const resolvedColVar = tableConfig.colVar ? resolveToCol(tableConfig.colVar) : null;

        const rowFilters: DrillDownFilter[] = rowPath.map(p => ({
            variable: p.variable,
            value: p.value,
        }));
        const colFilter: DrillDownFilter | null = resolvedColVar && colValue
            ? { variable: resolvedColVar, value: colValue }
            : null;

        const titleParts: string[] = rowPath.map(p => {
            const varLabel = dataset?.variables.find(v => v.id === p.variable)?.label || p.variable;
            return `${varLabel}: ${p.value}`;
        });
        if (colFilter) {
            const colVarLabel = dataset?.variables.find(v => v.id === colFilter.variable)?.label || colFilter.variable;
            titleParts.push(`${colVarLabel}: ${colFilter.value}`);
        }
        const title = titleParts.join(' • ');

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

        const { buildDrillDownQuery, buildDrillDownCountQuery } = await import('../../services/queryBuilder');

        const queryOptions = {
            rowVars: rowPath,
            colVar: colFilter?.variable || null,
            colValue: colFilter?.value || null,
            filters: activeFilters,
            limit: pageSize,
            offset: 0,
        };

        const dataSql = buildDrillDownQuery(queryOptions);
        const countSql = buildDrillDownCountQuery(queryOptions);

        return new Promise<void>((resolve) => {
            let dataResult: any[] | null = null;
            let totalCount: number | null = null;
            let responseCount = 0;

            const checkComplete = () => {
                if (responseCount === 2) {
                    set((state) => ({
                        drillDown: {
                            ...state.drillDown,
                            data: dataResult || [],
                            totalCount: totalCount || 0,
                            loading: false,
                        },
                    }));
                    resolve();
                }
            };

            const dataHandler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'queryResult') {
                    dataResult = response.data;
                    responseCount++;
                    worker.removeEventListener('message', dataHandler);
                    checkComplete();
                } else if (response.type === 'error') {
                    console.error('[DrillDownSlice] Data query error:', response.message);
                    dataResult = [];
                    responseCount++;
                    worker.removeEventListener('message', dataHandler);
                    checkComplete();
                }
            };

            const countHandler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'queryResult') {
                    totalCount = response.data[0]?.total ?? 0;
                    responseCount++;
                    worker.removeEventListener('message', countHandler);
                    checkComplete();
                } else if (response.type === 'error') {
                    console.error('[DrillDownSlice] Count query error:', response.message);
                    totalCount = 0;
                    responseCount++;
                    worker.removeEventListener('message', countHandler);
                    checkComplete();
                }
            };

            worker.addEventListener('message', dataHandler);
            worker.postMessage({ type: 'query', sql: dataSql } as WorkerRequest);

            setTimeout(() => {
                worker.addEventListener('message', countHandler);
                worker.postMessage({ type: 'query', sql: countSql } as WorkerRequest);
            }, 10);
        });
    },

    loadMoreDrillDown: async () => {
        const { worker, drillDown, activeFilters } = get();
        if (!worker || drillDown.loading) return;

        const { rowFilters, colFilter, currentPage, pageSize, data } = drillDown;
        const nextPage = currentPage + 1;
        const offset = currentPage * pageSize;

        set((state) => ({
            drillDown: { ...state.drillDown, loading: true },
        }));

        const { buildDrillDownQuery } = await import('../../services/queryBuilder');

        const queryOptions = {
            rowVars: rowFilters,
            colVar: colFilter?.variable || null,
            colValue: colFilter?.value || null,
            filters: activeFilters,
            limit: pageSize,
            offset,
        };

        const sql = buildDrillDownQuery(queryOptions);

        return new Promise<void>((resolve) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'queryResult') {
                    set((state) => ({
                        drillDown: {
                            ...state.drillDown,
                            data: [...data, ...response.data],
                            currentPage: nextPage,
                            loading: false,
                        },
                    }));
                    worker.removeEventListener('message', handler);
                    resolve();
                } else if (response.type === 'error') {
                    console.error('[DrillDownSlice] Load more error:', response.message);
                    set((state) => ({
                        drillDown: { ...state.drillDown, loading: false },
                    }));
                    worker.removeEventListener('message', handler);
                    resolve();
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'query', sql } as WorkerRequest);
        });
    },

    closeDrillDown: () => set({ drillDown: initialDrillDown }),
});
