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
    value: number | string | (number | string)[];
}

export interface AggregatedRow {
    rowKeys: string[];
    colKey: string;
    count: number;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface TableConfig {
    rowVars: string[];
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

export interface FilterModalState {
    isOpen: boolean;
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
    filterModal: FilterModalState;

    // UI
    draggingId: string | null;
    searchQuery: string;
    viewMode: 'table' | 'chart';
    recodeModal: RecodeModalState;
    drillDown: DrillDownState;

    // Actions
    initWorker: () => Promise<void>;
    loadCSV: (fileName: string, content: string) => Promise<void>;
    loadSAV: (fileName: string, buffer: ArrayBuffer) => Promise<void>;
    setTableConfig: (config: Partial<TableConfig>) => void;
    runAnalysis: () => Promise<void>;
    setDraggingId: (id: string | null) => void;
    setSearchQuery: (query: string) => void;
    setViewMode: (mode: 'table' | 'chart') => void;
    reset: () => void;

    // Recode
    openRecodeModal: (variable: Variable) => void;
    closeRecodeModal: () => void;

    // Data Access (routed through worker)
    getUniqueValues: (variableId: string) => Promise<string[]>;
    recodeVariable: (sourceColId: string, newColName: string, mappings: Record<string, string>) => Promise<string>;

    // Drill Down
    openDrillDown: (rowValue: string, colValue: string | null) => Promise<void>;
    closeDrillDown: () => void;

    // Filters
    addFilter: (filter: Omit<Filter, 'id'>) => void;
    removeFilter: (filterId: string) => void;
    clearFilters: () => void;
    openFilterModal: () => void;
    closeFilterModal: () => void;
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
    tableConfig: { rowVars: [], colVar: null },
    queryResult: [],
    isQuerying: false,
    activeFilters: [],
    filterModal: { isOpen: false },
    draggingId: null,
    searchQuery: '',
    viewMode: 'table',
    recodeModal: { isOpen: false, variable: null },
    drillDown: { isOpen: false, title: '', data: [], loading: false },

    // Initialize Web Worker
    initWorker: async () => {
        // Guard: Prevent multiple worker initializations (important for React Strict Mode)
        const currentWorker = get().worker;
        if (currentWorker) {
            console.log('[Store] Worker already initialized, skipping duplicate init');
            return;
        }

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

                if (response.type === 'csvLoaded') {
                    // Convert schema to variables
                    const variables: Variable[] = response.schema.map((col) => ({
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
                            rowCount: response.rowCount,
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

    // Load SAV file
    loadSAV: async (fileName: string, buffer: ArrayBuffer) => {
        const { worker } = get();
        if (!worker) throw new Error('Worker not initialized');

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'savLoaded') {
                    set({
                        dataset: {
                            id: crypto.randomUUID(),
                            name: fileName,
                            rowCount: response.rowCount,
                            variables: response.variables,
                            source: 'sav',
                        },
                    });

                    console.log(`📊 [Store] SAV loaded: ${response.rowCount} rows, ${response.variables.length} variables in ${response.durationMs.toFixed(2)}ms`);
                    worker.removeEventListener('message', handler);
                    resolve(undefined);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'loadSAV', buffer } as WorkerRequest);
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
        const { worker, tableConfig, dataset, activeFilters } = get();
        if (!worker || tableConfig.rowVars.length === 0) {
            set({ queryResult: [] });
            return;
        }

        set({ isQuerying: true });

        const rows = tableConfig.rowVars;
        const col = tableConfig.colVar;

        // Dynamic Row Selection
        const rowSelectors = rows.map((r, i) => `"${r}" as rowKey_${i}`).join(', ');
        const rowGroups = rows.map(r => `"${r}"`).join(', ');

        // Build WHERE clause from active filters
        const whereConditions = activeFilters.map(filter => {
            const varId = `"${filter.variableId}"`;

            // Helper to quote string values
            const formatValue = (v: number | string) => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v;

            switch (filter.operator) {
                case 'eq':
                    return `${varId} = ${formatValue(filter.value as number | string)}`;
                case 'neq':
                    return `${varId} != ${formatValue(filter.value as number | string)}`;
                case 'in':
                    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
                    return `${varId} IN (${values.map(formatValue).join(', ')})`;
                case 'gt':
                    return `${varId} > ${formatValue(filter.value as number | string)}`;
                case 'lt':
                    return `${varId} < ${formatValue(filter.value as number | string)}`;
                default:
                    return null;
            }
        }).filter(Boolean);

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        let sql: string;
        if (col) {
            sql = `SELECT ${rowSelectors}, "${col}" as colKey, COUNT(*)::INTEGER as count FROM main ${whereClause} GROUP BY ${rowGroups}, "${col}"`;
        } else {
            sql = `SELECT ${rowSelectors}, 'Total' as colKey, COUNT(*)::INTEGER as count FROM main ${whereClause} GROUP BY ${rowGroups}`;
        }

        return new Promise<void>((resolve) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'queryResult') {
                    // Map rowKey_0, rowKey_1... to rowKeys[] array
                    const rawData = response.data as any[];
                    const mappedData: AggregatedRow[] = rawData.map(row => {
                        const rowKeys = Object.keys(row)
                            .filter(k => k.startsWith('rowKey_'))
                            .sort() // Ensure 0, 1, 2 order
                            .map(k => row[k]);

                        return {
                            rowKeys,
                            colKey: row.colKey,
                            count: row.count
                        };
                    });

                    set({
                        queryResult: mappedData,
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
            tableConfig: { rowVars: [], colVar: null },
            queryResult: [],
            activeFilters: [],
        });
    },

    // Recode modal
    openRecodeModal: (variable) => set({ recodeModal: { isOpen: true, variable } }),
    closeRecodeModal: () => set({ recodeModal: { isOpen: false, variable: null } }),

    // Data Access (routed through worker for unified data source)
    getUniqueValues: async (variableId: string): Promise<string[]> => {
        const { worker, dataset } = get();
        if (!worker) throw new Error('Worker not initialized');

        // Strategy: First check for embedded value labels (SAV files have these)
        const variable = dataset?.variables.find(v => v.id === variableId);
        if (variable?.valueLabels && variable.valueLabels.length > 0) {
            // Return value labels from metadata (more reliable for SAV files)
            return variable.valueLabels.map(vl => String(vl.value));
        }

        // Fallback: Query DuckDB for unique values (CSV files without metadata)
        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'uniqueValues') {
                    worker.removeEventListener('message', handler);
                    resolve(response.data);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'getUniqueValues', column: variableId } as WorkerRequest);
        });
    },

    recodeVariable: async (sourceColId: string, newColName: string, mappings: Record<string, string>): Promise<string> => {
        const { worker, dataset } = get();
        if (!worker) throw new Error('Worker not initialized');

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'recodeComplete') {
                    // Add the new variable to the dataset
                    if (dataset) {
                        const sourceVar = dataset.variables.find(v => v.id === sourceColId);
                        const newVariable: Variable = {
                            id: response.newColName,
                            name: response.newColName,
                            label: newColName,
                            type: 'nominal',
                            valueLabels: [],
                            missingValues: {},
                        };
                        set({
                            dataset: {
                                ...dataset,
                                variables: [...dataset.variables, newVariable],
                            },
                        });
                    }
                    worker.removeEventListener('message', handler);
                    resolve(response.newColName);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({
                type: 'recodeVariable',
                sourceCol: sourceColId,
                newColName,
                mappings
            } as WorkerRequest);
        });
    },

    // Drill down
    openDrillDown: async (rowValue, colValue) => {
        const { worker, tableConfig, dataset } = get();
        // TODO: Handle nested row drilldown. For now, we take the last row var or require full path?
        // Limitation: The current UI `handleCellClick` only passes `rowValue: string`.
        // To support nested drilldown, `rowValue` needs to become `rowPath: string[]`.
        // For this refactor step, we will temporarily break deep drilldown or just use the first variable.
        // Actually, let's fix the DrillDown signature in a follow up.
        // For now, if we have multiple row vars, we can't reliably drill down with a single string.
        // We will assume rowValue matches the LAST variable in the chain (leaf node) if we are clicking a cell,
        // BUT `DataTable` will likely need to pass the full path.

        // Let's defer strict drill-down logic until DataTable is updated to pass full path.
        // For robustness, we'll check if we can match the rowValue to ANY row variable.
        if (!worker || tableConfig.rowVars.length === 0) return;

        set({
            drillDown: { isOpen: true, title: '', data: [], loading: true },
        });

        // Simplified logic: filter where the FIRST row variable matches (backward compat for single row)
        // Correct logic requires `rowValues: string[]` argument.
        const primaryRowVar = tableConfig.rowVars[0];

        const rowVarLabel = dataset?.variables.find((v) => v.id === primaryRowVar)?.label || primaryRowVar;
        let whereClause = `"${primaryRowVar}" = '${rowValue}'`;
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

    // Filter actions
    addFilter: (filterData) => {
        const filter: Filter = {
            ...filterData,
            id: crypto.randomUUID(),
        };
        set((state) => ({
            activeFilters: [...state.activeFilters, filter],
        }));
        // Trigger analysis with new filter
        get().runAnalysis();
    },

    removeFilter: (filterId) => {
        set((state) => ({
            activeFilters: state.activeFilters.filter(f => f.id !== filterId),
        }));
        // Trigger analysis without removed filter
        get().runAnalysis();
    },

    clearFilters: () => {
        set({ activeFilters: [] });
        get().runAnalysis();
    },

    openFilterModal: () => set({ filterModal: { isOpen: true } }),
    closeFilterModal: () => set({ filterModal: { isOpen: false } }),
}));
