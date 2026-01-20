/**
 * Data Slice
 * 
 * Manages dataset state, variables, and variable sets.
 * Handles worker initialization and data loading.
 */

import type { StateCreator } from 'zustand';
import type { WorkerRequest, WorkerResponse } from '../../services/analysisWorker';
import type { RecodeConfig } from '../../types';

// ============================================================================
// Types
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

export interface VariableSet {
    id: string;
    name: string;
    variableIds: string[];
    structure: 'single' | 'multi' | 'grid';
    type?: VariableType;
}

// ============================================================================
// Slice State & Actions
// ============================================================================

export interface DataSlice {
    // State
    worker: Worker | null;
    isDbReady: boolean;
    initError: string | null;
    dataset: Dataset | null;
    variableSets: VariableSet[];

    // Actions
    initWorker: () => Promise<void>;
    loadCSV: (fileName: string, content: string) => Promise<void>;
    loadSAV: (fileName: string, buffer: ArrayBuffer) => Promise<void>;
    getUniqueValues: (variableId: string) => Promise<string[]>;
    recodeVariable: (sourceColId: string, newColName: string, config: RecodeConfig) => Promise<string>;
    createVariableSet: (name: string, variableIds: string[]) => void;
    splitVariableSet: (setId: string) => void;
    setWeightVariable: (variableId: string | null) => void;
}

export const createDataSlice: StateCreator<DataSlice, [], [], DataSlice> = (set, get) => ({
    // Initial state
    worker: null,
    isDbReady: false,
    initError: null,
    dataset: null,
    variableSets: [],

    // Initialize Web Worker
    initWorker: async () => {
        const currentWorker = get().worker;
        if (currentWorker) {
            console.log('[DataSlice] Worker already initialized, skipping duplicate init');
            return;
        }

        try {
            const worker = new Worker(
                new URL('../../services/analysisWorker.ts', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                switch (response.type) {
                    case 'ready':
                        set({ isDbReady: true });
                        break;
                    case 'error':
                        console.error('[DataSlice] Worker error:', response.message);
                        set({ initError: response.message });
                        break;
                }
            };

            set({ worker });
            worker.postMessage({ type: 'init' } as WorkerRequest);
        } catch (error: any) {
            console.error('[DataSlice] Failed to init worker:', error);
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
                    const variables: Variable[] = response.schema.map((col) => ({
                        id: col.name,
                        name: col.name,
                        label: col.name.replace(/_/g, ' '),
                        type: col.type === 'VARCHAR' ? 'nominal' : 'scale',
                        valueLabels: [],
                        missingValues: {},
                    }));

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

                    console.log(`📊 [DataSlice] SAV loaded: ${response.rowCount} rows, ${response.variables.length} variables in ${response.durationMs.toFixed(2)}ms`);
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

    // Get unique values for a variable
    getUniqueValues: async (variableId: string): Promise<string[]> => {
        const { worker, dataset } = get();
        if (!worker) throw new Error('Worker not initialized');

        const variable = dataset?.variables.find(v => v.id === variableId);
        if (variable?.valueLabels && variable.valueLabels.length > 0) {
            return variable.valueLabels.map(vl => String(vl.value));
        }

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

    // Recode variable
    recodeVariable: async (sourceColId: string, newColName: string, config: RecodeConfig): Promise<string> => {
        const { worker, dataset } = get();
        if (!worker) throw new Error('Worker not initialized');

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'recodeComplete') {
                    if (dataset) {
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

    // Create variable set
    createVariableSet: (name, variableIds) => {
        const { variableSets, dataset } = get();
        if (!dataset || variableIds.length === 0) return;

        const firstVar = dataset.variables.find(v => v.id === variableIds[0]);
        const inferredType = firstVar?.type;

        const newSet: VariableSet = {
            id: crypto.randomUUID(),
            name,
            variableIds,
            structure: variableIds.length > 1 ? 'multi' : 'single',
            type: inferredType,
        };

        const existingVarIds = new Set(variableIds);
        const filteredSets = variableSets.filter(s => {
            const allInNew = s.variableIds.every(vId => existingVarIds.has(vId));
            return !allInNew || s.variableIds.length > variableIds.length;
        });

        set({ variableSets: [...filteredSets, newSet] });
    },

    // Split variable set
    splitVariableSet: (setId) => {
        const { variableSets, dataset } = get();
        if (!dataset) return;

        const setToSplit = variableSets.find(s => s.id === setId);
        if (!setToSplit || setToSplit.variableIds.length <= 1) return;

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

        const otherSets = variableSets.filter(s => s.id !== setId);
        set({ variableSets: [...otherSets, ...newSets] });
    },

    // Set weight variable
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
    },
});
