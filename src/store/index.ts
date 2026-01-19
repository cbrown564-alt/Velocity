/**
 * Velocity Store
 * 
 * Zustand store managing application state per arch_02_data_model.md.
 * Communicates with Analysis Worker for all database operations.
 */

import { create } from 'zustand';
import type { WorkerRequest, WorkerResponse } from '../services/analysisWorker';

// ============================================================================
// Data Model Types (from arch_02_data_model.md)
// ============================================================================

export type VariableType = 'nominal' | 'ordinal' | 'scale';

export interface ValueLabel {
    value: number;
    label: string;
}

export interface MissingValueDef {
    discrete?: number[];
    range?: { low: number; high: number };
}

export interface Variable {
    id: string;
    name: string;
    label: string;
    type: VariableType;
    valueLabels: ValueLabel[];
    missingValues: MissingValueDef;
}

export interface Dataset {
    id: string;
    name: string;
    rowCount: number;
    variables: Variable[];
    weightVariable?: string;
    source: 'sav' | 'csv' | 'arrow';
}

export interface CrosstabCell {
    count: number;
    weightedCount?: number;
    percentage: number;
    sigMarker?: string;
}

export interface Crosstab {
    rowVariable: string;
    colVariable?: string;
    cells: CrosstabCell[][];
    rowTotals: CrosstabCell[];
    colTotals: CrosstabCell[];
    grandTotal: CrosstabCell;
    isWeighted: boolean;
}

export interface Filter {
    id: string;
    variableId: string;
    operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt';
    value: number | number[];
}

export interface AggregatedRow {
    rowKey: string;
    colKey: string;
    count: number;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface TableConfig {
    rowVar: string | null;
    colVar: string | null;
}

export interface RecodeModalState {
    isOpen: boolean;
    variable: Variable | null;
}

export interface DrillDownState {
    isOpen: boolean;
    title: string;
    data: any[];
    loading: boolean;
}

// ============================================================================
// Store State
// ============================================================================

interface VelocityState {
    // Worker
    worker: Worker | null;
    isDbReady: boolean;
    initError: string | null;

    // Dataset
    dataset: Dataset | null;

    // Analysis
    tableConfig: TableConfig;
    queryResult: AggregatedRow[];
    isQuerying: boolean;

    // Filters
    activeFilters: Filter[];

    // UI
    draggingId: string | null;
    searchQuery: string;
    viewMode: 'table' | 'chart';
    recodeModal: RecodeModalState;
    drillDown: DrillDownState;

    // Actions
    initWorker: () => Promise<void>;
    loadCSV: (fileName: string, content: string) => Promise<void>;
    setTableConfig: (config: Partial<TableConfig>) => void;
    runAnalysis: () => Promise<void>;
    setDraggingId: (id: string | null) => void;
    setSearchQuery: (query: string) => void;
    setViewMode: (mode: 'table' | 'chart') => void;
    reset: () => void;

    // Recode
    openRecodeModal: (variable: Variable) => void;
    closeRecodeModal: () => void;

    // Drill Down
    openDrillDown: (rowValue: string, colValue: string | null) => Promise<void>;
    closeDrillDown: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useVelocityStore = create<VelocityState>((set, get) => ({
    // Initial state
    worker: null,
    isDbReady: false,
    initError: null,
    dataset: null,
    tableConfig: { rowVar: null, colVar: null },
    queryResult: [],
    isQuerying: false,
    activeFilters: [],
    draggingId: null,
    searchQuery: '',
    viewMode: 'table',
    recodeModal: { isOpen: false, variable: null },
    drillDown: { isOpen: false, title: '', data: [], loading: false },

    // Initialize Web Worker
    initWorker: async () => {
        try {
            const worker = new Worker(
                new URL('../services/analysisWorker.ts', import.meta.url),
                { type: 'module' }
            );

            // Set up message handler
            worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                switch (response.type) {
                    case 'ready':
                        set({ isDbReady: true });
                        break;

                    case 'error':
                        console.error('[Store] Worker error:', response.message);
                        set({ initError: response.message });
                        break;
                }
            };

            set({ worker });

            // Send init message
            worker.postMessage({ type: 'init' } as WorkerRequest);
        } catch (error: any) {
            console.error('[Store] Failed to init worker:', error);
            set({ initError: error.message || 'Failed to initialize worker' });
        }
    },

    // Load CSV file
    loadCSV: async (fileName: string, content: string) => {
        const { worker } = get();
        if (!worker) throw new Error('Worker not initialized');

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'schema') {
                    // Convert schema to variables
                    const variables: Variable[] = response.data.map((col) => ({
                        id: col.name,
                        name: col.name,
                        label: col.name.replace(/_/g, ' '),
                        type: col.type === 'VARCHAR' ? 'nominal' : 'scale',
                        valueLabels: [],
                        missingValues: {},
                    }));

                    set({
                        dataset: {
                            id: crypto.randomUUID(),
                            name: fileName,
                            rowCount: 0, // Will be updated
                            variables,
                            source: 'csv',
                        },
                    });

                    worker.removeEventListener('message', handler);
                    resolve(undefined);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'loadCSV', fileName, content } as WorkerRequest);
        });
    },

    // Update table configuration
    setTableConfig: (config) => {
        set((state) => ({
            tableConfig: { ...state.tableConfig, ...config },
        }));
        // Trigger analysis
        get().runAnalysis();
    },

    // Run crosstab/frequency analysis
    runAnalysis: async () => {
        const { worker, tableConfig, dataset } = get();
        if (!worker || !tableConfig.rowVar) {
            set({ queryResult: [] });
            return;
        }

        set({ isQuerying: true });

        const row = tableConfig.rowVar;
        const col = tableConfig.colVar;

        let sql: string;
        if (col) {
            sql = `SELECT "${row}" as rowKey, "${col}" as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "${row}", "${col}"`;
        } else {
            sql = `SELECT "${row}" as rowKey, 'Total' as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "${row}"`;
        }

        return new Promise<void>((resolve) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'queryResult') {
                    set({
                        queryResult: response.data as AggregatedRow[],
                        isQuerying: false,
                    });
                    worker.removeEventListener('message', handler);
                    resolve();
                } else if (response.type === 'error') {
                    console.error('[Store] Query error:', response.message);
                    set({ isQuerying: false });
                    worker.removeEventListener('message', handler);
                    resolve();
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'query', sql } as WorkerRequest);
        });
    },

    // UI state setters
    setDraggingId: (id) => set({ draggingId: id }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setViewMode: (mode) => set({ viewMode: mode }),

    reset: () => {
        set({
            tableConfig: { rowVar: null, colVar: null },
            queryResult: [],
        });
    },

    // Recode modal
    openRecodeModal: (variable) => set({ recodeModal: { isOpen: true, variable } }),
    closeRecodeModal: () => set({ recodeModal: { isOpen: false, variable: null } }),

    // Drill down
    openDrillDown: async (rowValue, colValue) => {
        const { worker, tableConfig, dataset } = get();
        if (!worker || !tableConfig.rowVar) return;

        set({
            drillDown: { isOpen: true, title: '', data: [], loading: true },
        });

        const rowVarLabel = dataset?.variables.find((v) => v.id === tableConfig.rowVar)?.label || tableConfig.rowVar;
        let whereClause = `"${tableConfig.rowVar}" = '${rowValue}'`;
        let titleDescription = `${rowVarLabel}: ${rowValue}`;

        if (tableConfig.colVar && colValue) {
            const colVarLabel = dataset?.variables.find((v) => v.id === tableConfig.colVar)?.label || tableConfig.colVar;
            whereClause += ` AND "${tableConfig.colVar}" = '${colValue}'`;
            titleDescription += ` • ${colVarLabel}: ${colValue}`;
        }

        set((state) => ({
            drillDown: { ...state.drillDown, title: titleDescription },
        }));

        const sql = `SELECT * FROM main WHERE ${whereClause} LIMIT 100`;

        return new Promise<void>((resolve) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'queryResult') {
                    set((state) => ({
                        drillDown: { ...state.drillDown, data: response.data, loading: false },
                    }));
                    worker.removeEventListener('message', handler);
                    resolve();
                } else if (response.type === 'error') {
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

    closeDrillDown: () => set({ drillDown: { isOpen: false, title: '', data: [], loading: false } }),
}));
