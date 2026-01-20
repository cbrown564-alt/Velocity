/**
 * Velocity Store
 * 
 * Zustand store managing application state per arch_02_data_model.md.
 * Communicates with Analysis Worker for all database operations.
 */

import { create } from 'zustand';
import type { WorkerRequest, WorkerResponse } from '../services/analysisWorker';
import { buildCrosstabQuery } from '../services/queryBuilder';
import { RecodeConfig } from '../types';

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
    /** Weighted count when a weight variable is applied */
    weightedCount?: number;
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

export interface DrillDownFilter {
    variable: string;
    value: string;
}

export interface DrillDownState {
    isOpen: boolean;
    title: string;
    data: any[];
    loading: boolean;
    // Pagination
    totalCount: number;
    currentPage: number;
    pageSize: number;
    // Context for fetching more pages
    rowFilters: DrillDownFilter[];
    colFilter: DrillDownFilter | null;
}

export interface FilterModalState {
    isOpen: boolean;
}

// ============================================================================
// Variable Set Types (Milestone 2.1)
// ============================================================================

export interface VariableSet {
    id: string;
    /** Display name for the set */
    name: string;
    /** IDs of variables in this set */
    variableIds: string[];
    /** 
     * Structure type:
     * - 'single': Standard single variable (default)
     * - 'multi': Multiple response set
     * - 'grid': Grid/matrix structure
     */
    structure: 'single' | 'multi' | 'grid';
    /** Inferred variable type for the set */
    type?: VariableType;
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
    variableSets: VariableSet[];

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

    recodeVariable: (sourceColId: string, newColName: string, config: RecodeConfig) => Promise<string>;

    // Drill Down (accepts full row path for nested rows)
    openDrillDown: (rowPath: { variable: string; value: string }[], colValue: string | null) => Promise<void>;
    loadMoreDrillDown: () => Promise<void>;
    closeDrillDown: () => void;

    // Filters
    addFilter: (filter: Omit<Filter, 'id'>) => void;
    removeFilter: (filterId: string) => void;
    clearFilters: () => void;
    openFilterModal: () => void;
    closeFilterModal: () => void;

    // Variable Sets (Milestone 2.1)
    createVariableSet: (name: string, variableIds: string[]) => void;
    splitVariableSet: (setId: string) => void;
    reorderRowVars: (newOrder: string[]) => void;

    // Weighting (Milestone 2.2)
    setWeightVariable: (variableId: string | null) => void;
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
    variableSets: [],
    tableConfig: { rowVars: [], colVar: null },
    queryResult: [],
    isQuerying: false,
    activeFilters: [],
    filterModal: { isOpen: false },
    draggingId: null,
    searchQuery: '',
    viewMode: 'table',
    recodeModal: { isOpen: false, variable: null },
    drillDown: {
        isOpen: false,
        title: '',
        data: [],
        loading: false,
        totalCount: 0,
        currentPage: 1,
        pageSize: 50,
        rowFilters: [],
        colFilter: null,
    },

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

                    // Create default 1:1 Variable Sets
                    const variableSets: VariableSet[] = variables.map(v => ({
                        id: crypto.randomUUID(),
                        name: v.label || v.name,
                        variableIds: [v.id],
                        structure: 'single',
                        type: v.type,
                    }));

                    set({
                        dataset: {
                            id: crypto.randomUUID(),
                            name: fileName,
                            rowCount: response.rowCount,
                            variables,
                            source: 'csv',
                        },
                        variableSets,
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
                    // Create default 1:1 Variable Sets
                    const variableSets: VariableSet[] = response.variables.map(v => ({
                        id: crypto.randomUUID(),
                        name: v.label || v.name,
                        variableIds: [v.id],
                        structure: 'single',
                        type: v.type,
                    }));

                    set({
                        dataset: {
                            id: crypto.randomUUID(),
                            name: fileName,
                            rowCount: response.rowCount,
                            variables: response.variables,
                            source: 'sav',
                        },
                        variableSets,
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
        const { worker, tableConfig, dataset, variableSets, activeFilters } = get();
        if (!worker || tableConfig.rowVars.length === 0) {
            set({ queryResult: [] });
            return;
        }

        set({ isQuerying: true });

        // Helper to resolve ID (Set ID -> Variable ID)
        const resolveToCol = (id: string): string => {
            const varSet = variableSets.find(s => s.id === id);
            if (varSet && varSet.variableIds.length > 0) {
                return varSet.variableIds[0]; // Logic: Use 1st var of set
            }
            // Fallback: Check if it's a raw variable ID
            return id;
        };

        const rows = tableConfig.rowVars.map(resolveToCol);
        const col = tableConfig.colVar ? resolveToCol(tableConfig.colVar) : null;

        // Build SQL query using queryBuilder (supports weighting)
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
                    // Map rowKey_0, rowKey_1... to rowKeys[] array
                    const rawData = response.data as any[];
                    const mappedData: AggregatedRow[] = rawData.map(row => {
                        const rowKeys = Object.keys(row)
                            .filter(k => k.startsWith('rowKey_'))
                            .sort() // Ensure 0, 1, 2 order
                            .map(k => row[k]);

                        // When weighted, 'count' is actually the weighted sum
                        // For now we only have the weighted count; unweighted would require a second query
                        return {
                            rowKeys,
                            colKey: row.colKey,
                            count: isWeighted ? 0 : row.count, // Unweighted count (0 when weighted-only)
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

    recodeVariable: async (sourceColId: string, newColName: string, config: RecodeConfig): Promise<string> => {
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

                        // Also create a new Variable Set for this variable
                        set((state) => ({
                            variableSets: [...state.variableSets, {
                                id: crypto.randomUUID(),
                                name: newColName,
                                variableIds: [response.newColName],
                                structure: 'single',
                                type: 'nominal'
                            }]
                        }));
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
                config
            } as WorkerRequest);
        });
    },

    // Drill down with pagination support
    openDrillDown: async (rowPath, colValue) => {
        const { worker, tableConfig, dataset, activeFilters, variableSets } = get();
        if (!worker || rowPath.length === 0) return;

        const pageSize = 50;

        // Helper to resolve ID (Set ID -> Variable ID)
        const resolveToCol = (id: string): string => {
            const set = variableSets.find(s => s.id === id);
            if (set && set.variableIds.length > 0) {
                return set.variableIds[0];
            }
            return id;
        };

        const resolvedColVar = tableConfig.colVar ? resolveToCol(tableConfig.colVar) : null;

        // Build filter context for storing and title generation
        const rowFilters: DrillDownFilter[] = rowPath.map(p => ({
            variable: p.variable,
            value: p.value,
        }));
        const colFilter: DrillDownFilter | null = resolvedColVar && colValue
            ? { variable: resolvedColVar, value: colValue }
            : null;

        // Build title from filters
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

        // Build SQL queries using queryBuilder
        const { buildDrillDownQuery, buildDrillDownCountQuery } = await import('../services/queryBuilder');

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

        // Execute both queries
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

            // Data query handler
            const dataHandler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'queryResult') {
                    dataResult = response.data;
                    responseCount++;
                    worker.removeEventListener('message', dataHandler);
                    checkComplete();
                } else if (response.type === 'error') {
                    console.error('[Store] Drill-down data query error:', response.message);
                    dataResult = [];
                    responseCount++;
                    worker.removeEventListener('message', dataHandler);
                    checkComplete();
                }
            };

            // Count query handler
            const countHandler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'queryResult') {
                    totalCount = response.data[0]?.total ?? 0;
                    responseCount++;
                    worker.removeEventListener('message', countHandler);
                    checkComplete();
                } else if (response.type === 'error') {
                    console.error('[Store] Drill-down count query error:', response.message);
                    totalCount = 0;
                    responseCount++;
                    worker.removeEventListener('message', countHandler);
                    checkComplete();
                }
            };

            worker.addEventListener('message', dataHandler);
            worker.postMessage({ type: 'query', sql: dataSql } as WorkerRequest);

            // Small delay between queries to avoid response collision
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
        const offset = currentPage * pageSize; // currentPage is 1-indexed, so offset = (page-1)*size after increment

        set((state) => ({
            drillDown: { ...state.drillDown, loading: true },
        }));

        const { buildDrillDownQuery } = await import('../services/queryBuilder');

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
                            data: [...data, ...response.data], // Append new data
                            currentPage: nextPage,
                            loading: false,
                        },
                    }));
                    worker.removeEventListener('message', handler);
                    resolve();
                } else if (response.type === 'error') {
                    console.error('[Store] Load more drill-down error:', response.message);
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

    closeDrillDown: () => set({
        drillDown: {
            isOpen: false,
            title: '',
            data: [],
            loading: false,
            totalCount: 0,
            currentPage: 1,
            pageSize: 50,
            rowFilters: [],
            colFilter: null,
        },
    }),

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

    // Variable Sets (Milestone 2.1)
    createVariableSet: (name, variableIds) => {
        const { variableSets, dataset } = get();
        if (!dataset || variableIds.length === 0) return;

        // Infer type from first variable
        const firstVar = dataset.variables.find(v => v.id === variableIds[0]);
        const inferredType = firstVar?.type;

        const newSet: VariableSet = {
            id: crypto.randomUUID(),
            name,
            variableIds,
            structure: variableIds.length > 1 ? 'multi' : 'single',
            type: inferredType,
        };

        // Remove any existing sets that contain ONLY these variables
        // (we're combining them into a new set)
        const existingVarIds = new Set(variableIds);
        const filteredSets = variableSets.filter(s => {
            const allInNew = s.variableIds.every(vId => existingVarIds.has(vId));
            return !allInNew || s.variableIds.length > variableIds.length;
        });

        set({ variableSets: [...filteredSets, newSet] });
    },

    splitVariableSet: (setId) => {
        const { variableSets, dataset } = get();
        if (!dataset) return;

        const setToSplit = variableSets.find(s => s.id === setId);
        if (!setToSplit || setToSplit.variableIds.length <= 1) return;

        // Create individual sets for each variable
        const newSets: VariableSet[] = setToSplit.variableIds.map(vId => {
            const variable = dataset.variables.find(v => v.id === vId);
            return {
                id: crypto.randomUUID(),
                name: variable?.label || vId,
                variableIds: [vId],
                structure: 'single' as const,
                type: variable?.type,
            };
        });

        // Replace the original set with the new individual sets
        const otherSets = variableSets.filter(s => s.id !== setId);
        set({ variableSets: [...otherSets, ...newSets] });
    },

    reorderRowVars: (newOrder) => {
        set((state) => ({
            tableConfig: { ...state.tableConfig, rowVars: newOrder },
        }));
        // Trigger analysis with new row order
        get().runAnalysis();
    },

    // Weighting (Milestone 2.2)
    setWeightVariable: (variableId) => {
        set((state) => {
            if (!state.dataset) return state;
            return {
                dataset: {
                    ...state.dataset,
                    weightVariable: variableId || undefined,
                },
            };
        });
        // Trigger analysis with new weight
        get().runAnalysis();
    },
}));
