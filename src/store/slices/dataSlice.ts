/**
 * Data Slice
 * 
 * Manages dataset state, variables, and variable sets.
 * Handles worker initialization and data loading.
 */

import type { StateCreator } from 'zustand';
import type { WorkerRequest, WorkerResponse, VariableStatsResult } from '../../services/analysisWorker';
import type { RecodeConfig } from '../../types';

// ============================================================================
// Types
// ============================================================================

export type VariableType = 'nominal' | 'ordinal' | 'scale' | 'text' | 'date';

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
    structure: 'single' | 'multiple' | 'grid';
    type?: VariableType;
    /** Hidden from Analysis Canvas (Data Gardening only) */
    hidden?: boolean;
    /** Folder this set belongs to (null = ungrouped) */
    folderId?: string;
    /** Display order within folder */
    order?: number;
    /** True if created via recode/compute operation */
    derived?: boolean;
}

export interface Folder {
    id: string;
    name: string;
    order: number;
}

// ============================================================================
// Persistence Types
// ============================================================================

export type PersistenceState =
    | 'idle'        // Initial state, not yet checked
    | 'checking'    // Checking for persisted data
    | 'found'       // Persisted data found, awaiting user decision
    | 'restoring'   // User chose to restore, loading data
    | 'ready'       // Ready for use (with or without restored data)
    | 'corrupt'     // Corruption detected, recovery in progress
    | 'error';      // Unrecoverable error

export interface PersistedDataInfo {
    schema: { name: string; type: string }[];
    rowCount: number;
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
    folders: Folder[];

    // Variable stats cache (keyed by variable ID)
    variableStats: Record<string, VariableStatsResult>;
    variableStatsLoading: Record<string, boolean>;

    // OPFS Persistence State
    opfsAvailable: boolean;
    persistenceState: PersistenceState;
    persistedDataInfo: PersistedDataInfo | null;

    // Actions
    initWorker: () => Promise<void>;
    terminateWorker: () => void;
    respawnWorker: (cleanStart?: boolean) => Promise<void>;
    checkPersistedData: () => Promise<void>;
    clearPersistedData: () => Promise<void>;
    restoreFromPersistence: () => void;
    discardPersistedData: () => Promise<void>;
    loadCSV: (fileName: string, content: string) => Promise<void>;
    loadSAV: (fileName: string, buffer: ArrayBuffer) => Promise<void>;
    getUniqueValues: (variableId: string) => Promise<string[]>;
    getVariableStats: (variableId: string) => Promise<VariableStatsResult | null>;
    recodeVariable: (sourceColId: string, newColName: string, config: RecodeConfig) => Promise<string>;
    createVariableSet: (name: string, variableIds: string[]) => void;
    splitVariableSet: (setId: string) => void;
    setWeightVariable: (variableId: string | null) => void;
    // Folder management
    createFolder: (name: string) => string;
    renameFolder: (folderId: string, name: string) => void;
    deleteFolder: (folderId: string) => void;
    moveToFolder: (variableSetIds: string[], folderId: string | null) => void;
    // Bulk actions
    reorderVariableSets: (activeId: string, overId: string) => void;
    bulkSetType: (variableSetIds: string[], type: VariableType) => void;
    bulkHide: (variableSetIds: string[], hidden: boolean) => void;
}

export const createDataSlice: StateCreator<DataSlice, [], [], DataSlice> = (set, get) => ({
    // Initial state
    worker: null,
    isDbReady: false,
    initError: null,
    dataset: null,
    variableSets: [],
    folders: [],

    // Variable stats cache
    variableStats: {},
    variableStatsLoading: {},

    // OPFS Persistence State
    opfsAvailable: false,
    persistenceState: 'idle',
    persistedDataInfo: null,

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

            // Create promise to handle init response
            const initPromise = new Promise<void>((resolve, reject) => {
                const initHandler = (event: MessageEvent<WorkerResponse>) => {
                    const response = event.data;
                    switch (response.type) {
                        case 'ready':
                            worker.removeEventListener('message', initHandler);
                            set({
                                isDbReady: true,
                                opfsAvailable: response.opfsAvailable
                            });
                            console.log(`[DataSlice] Worker ready, OPFS available: ${response.opfsAvailable}`);
                            resolve();
                            break;
                        case 'corruptionDetected':
                            worker.removeEventListener('message', initHandler);
                            console.warn('[DataSlice] OPFS corruption detected:', response.message);
                            set({ persistenceState: 'corrupt' });
                            // Respawn worker with clean start
                            get().respawnWorker(true);
                            resolve(); // Resolve - respawn will handle the rest
                            break;
                        case 'error':
                            worker.removeEventListener('message', initHandler);
                            console.error('[DataSlice] Worker error:', response.message);
                            set({ initError: response.message, persistenceState: 'error' });
                            reject(new Error(response.message));
                            break;
                    }
                };
                worker.addEventListener('message', initHandler);
            });

            // Set up general error handler for runtime errors
            worker.onerror = (error) => {
                console.error('[DataSlice] Worker runtime error:', error);
                set({ initError: error.message || 'Worker runtime error' });
            };

            set({ worker, persistenceState: 'checking' });
            worker.postMessage({ type: 'init' } as WorkerRequest);

            await initPromise;

            // If OPFS is available, check for persisted data
            if (get().opfsAvailable && get().persistenceState !== 'corrupt') {
                await get().checkPersistedData();
            } else {
                set({ persistenceState: 'ready' });
            }
        } catch (error: any) {
            console.error('[DataSlice] Failed to init worker:', error);
            set({
                initError: error.message || 'Failed to initialize worker',
                persistenceState: 'error'
            });
        }
    },

    // Terminate the current worker
    terminateWorker: () => {
        const { worker } = get();
        if (worker) {
            worker.terminate();
            console.log('[DataSlice] Worker terminated');
        }
        set({
            worker: null,
            isDbReady: false,
            initError: null
        });
    },

    // Respawn worker (terminates existing and creates fresh)
    respawnWorker: async (cleanStart: boolean = false) => {
        console.log(`[DataSlice] Respawning worker (cleanStart: ${cleanStart})`);
        get().terminateWorker();

        // Small delay to ensure clean termination
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const worker = new Worker(
                new URL('../../services/analysisWorker.ts', import.meta.url),
                { type: 'module' }
            );

            const initPromise = new Promise<void>((resolve, reject) => {
                const initHandler = (event: MessageEvent<WorkerResponse>) => {
                    const response = event.data;
                    switch (response.type) {
                        case 'ready':
                            worker.removeEventListener('message', initHandler);
                            set({
                                isDbReady: true,
                                opfsAvailable: response.opfsAvailable,
                                persistenceState: 'ready'
                            });
                            console.log(`[DataSlice] Worker respawned, OPFS available: ${response.opfsAvailable}`);
                            resolve();
                            break;
                        case 'corruptionDetected':
                            // This shouldn't happen with cleanStart, but handle it
                            worker.removeEventListener('message', initHandler);
                            console.error('[DataSlice] Corruption still detected after clean start');
                            set({
                                initError: 'Unable to recover from OPFS corruption',
                                persistenceState: 'error',
                                opfsAvailable: false
                            });
                            reject(new Error('Unable to recover from corruption'));
                            break;
                        case 'error':
                            worker.removeEventListener('message', initHandler);
                            console.error('[DataSlice] Worker error during respawn:', response.message);
                            set({ initError: response.message, persistenceState: 'error' });
                            reject(new Error(response.message));
                            break;
                    }
                };
                worker.addEventListener('message', initHandler);
            });

            set({ worker });
            worker.postMessage({ type: 'init', forceCleanStart: cleanStart } as WorkerRequest);

            await initPromise;
        } catch (error: any) {
            console.error('[DataSlice] Failed to respawn worker:', error);
            set({
                initError: error.message || 'Failed to respawn worker',
                persistenceState: 'error'
            });
        }
    },

    // Check for persisted data in OPFS
    checkPersistedData: async () => {
        const { worker } = get();
        if (!worker) throw new Error('Worker not initialized');

        set({ persistenceState: 'checking' });

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'persistedDataFound') {
                    worker.removeEventListener('message', handler);
                    set({
                        persistenceState: 'found',
                        persistedDataInfo: {
                            schema: response.schema,
                            rowCount: response.rowCount
                        }
                    });
                    console.log(`[DataSlice] Found persisted data: ${response.rowCount} rows, ${response.schema.length} columns`);
                    resolve(undefined);
                } else if (response.type === 'noPersistedData') {
                    worker.removeEventListener('message', handler);
                    set({
                        persistenceState: 'ready',
                        persistedDataInfo: null
                    });
                    console.log('[DataSlice] No persisted data found');
                    resolve(undefined);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    set({ persistenceState: 'ready' });
                    reject(new Error(response.message));
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'checkPersistedData' } as WorkerRequest);
        });
    },

    // Clear persisted data from OPFS
    clearPersistedData: async () => {
        const { worker } = get();
        if (!worker) throw new Error('Worker not initialized');

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'persistedDataCleared') {
                    worker.removeEventListener('message', handler);
                    set({ persistedDataInfo: null });
                    console.log('[DataSlice] Persisted data cleared');
                    resolve(undefined);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'clearPersistedData' } as WorkerRequest);
        });
    },

    // Restore session from persisted data (user chose to restore)
    restoreFromPersistence: () => {
        const { persistedDataInfo, dataset } = get();

        if (!persistedDataInfo) {
            console.warn('[DataSlice] No persisted data info to restore from');
            set({ persistenceState: 'ready' });
            return;
        }

        // If we have localStorage dataset metadata, use it
        // Otherwise, reconstruct minimal dataset from schema
        if (dataset) {
            console.log('[DataSlice] Restoring with existing dataset metadata');
            set({ persistenceState: 'ready' });
        } else {
            // Reconstruct minimal dataset from OPFS schema
            console.log('[DataSlice] Reconstructing dataset from OPFS schema');
            const variables: Variable[] = persistedDataInfo.schema.map(col => ({
                id: col.name,
                name: col.name,
                label: col.name.replace(/_/g, ' '),
                type: col.type.includes('VARCHAR') || col.type.includes('UTF') ? 'nominal' : 'scale',
                valueLabels: [],
                missingValues: {}
            }));

            const variableSets: VariableSet[] = variables.map(v => ({
                id: crypto.randomUUID(),
                name: v.label || v.name,
                variableIds: [v.id],
                structure: 'single',
                type: v.type
            }));

            set({
                dataset: {
                    id: crypto.randomUUID(),
                    name: 'Restored Session',
                    rowCount: persistedDataInfo.rowCount,
                    variables,
                    source: 'sav' // Assume SAV since that's what we persist
                },
                variableSets,
                persistenceState: 'ready'
            });
        }
    },

    // Discard persisted data and start fresh
    discardPersistedData: async () => {
        await get().clearPersistedData();
        set({
            persistenceState: 'ready',
            persistedDataInfo: null,
            dataset: null,
            variableSets: [],
            folders: []
        });
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
                        // Clear variable stats cache on new dataset load
                        variableStats: {},
                        variableStatsLoading: {},
                        // Reset analysis state - old UUIDs won't match new variableSets
                        tableConfig: { rowVars: [], colVar: null },
                        queryResult: [],
                        activeFilters: [],
                    } as any);

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
                        // Clear variable stats cache on new dataset load
                        variableStats: {},
                        variableStatsLoading: {},
                        // Reset analysis state - old UUIDs won't match new variableSets
                        tableConfig: { rowVars: [], colVar: null },
                        queryResult: [],
                        activeFilters: [],
                    } as any);

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

    // Get variable statistics (frequencies, missing count, and numeric stats for scale variables)
    getVariableStats: async (variableId: string): Promise<VariableStatsResult | null> => {
        const { worker, variableStats, variableStatsLoading, dataset } = get();
        if (!worker) return null;

        // Look up the variable type from the dataset
        const variable = dataset?.variables.find(v => v.id === variableId);
        const variableType = variable?.type;

        // Check if we have cached stats
        const cachedStats = variableStats[variableId];
        if (cachedStats) {
            // For scale variables, ensure we have numeric stats (may need re-fetch if cached before feature was added)
            const needsNumericStats = variableType === 'scale' && !cachedStats.numeric;
            if (!needsNumericStats) {
                return cachedStats;
            }
            // Fall through to re-fetch with numeric stats
        }

        // Don't request if already loading
        if (variableStatsLoading[variableId]) {
            return null;
        }

        // Mark as loading
        set((state) => ({
            variableStatsLoading: { ...state.variableStatsLoading, [variableId]: true }
        }));

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'variableStats' && response.stats.column === variableId) {
                    worker.removeEventListener('message', handler);
                    // Cache the result
                    set((state) => ({
                        variableStats: { ...state.variableStats, [variableId]: response.stats },
                        variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false }
                    }));
                    resolve(response.stats);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    set((state) => ({
                        variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false }
                    }));
                    reject(new Error(response.message));
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({
                type: 'getVariableStats',
                column: variableId,
                variableType
            } as WorkerRequest);
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
            structure: variableIds.length > 1 ? 'multiple' : 'single',
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

    // ========================================================================
    // Folder Management Actions
    // ========================================================================

    createFolder: (name) => {
        const id = crypto.randomUUID();
        set((state) => ({
            folders: [...state.folders, {
                id,
                name,
                order: state.folders.length,
            }],
        }));
        return id;
    },

    renameFolder: (folderId, name) => {
        set((state) => ({
            folders: state.folders.map(f =>
                f.id === folderId ? { ...f, name } : f
            ),
        }));
    },

    deleteFolder: (folderId) => {
        set((state) => ({
            folders: state.folders.filter(f => f.id !== folderId),
            // Move variables in deleted folder back to ungrouped
            variableSets: state.variableSets.map(vs =>
                vs.folderId === folderId ? { ...vs, folderId: undefined } : vs
            ),
        }));
    },

    moveToFolder: (variableSetIds, folderId) => {
        set((state) => ({
            variableSets: state.variableSets.map(vs =>
                variableSetIds.includes(vs.id)
                    ? { ...vs, folderId: folderId || undefined }
                    : vs
            ),
        }));
    },

    // ========================================================================
    // Bulk Actions
    // ========================================================================

    reorderVariableSets: (activeId, overId) => {
        set((state) => {
            const oldIndex = state.variableSets.findIndex(vs => vs.id === activeId);
            const newIndex = state.variableSets.findIndex(vs => vs.id === overId);
            if (oldIndex === -1 || newIndex === -1) return state;

            const newSets = [...state.variableSets];
            const [moved] = newSets.splice(oldIndex, 1);
            newSets.splice(newIndex, 0, moved);

            // Update order property
            return {
                variableSets: newSets.map((vs, idx) => ({ ...vs, order: idx })),
            };
        });
    },

    bulkSetType: (variableSetIds, type) => {
        set((state) => ({
            variableSets: state.variableSets.map(vs =>
                variableSetIds.includes(vs.id) ? { ...vs, type } : vs
            ),
        }));
    },

    bulkHide: (variableSetIds, hidden) => {
        set((state) => ({
            variableSets: state.variableSets.map(vs =>
                variableSetIds.includes(vs.id) ? { ...vs, hidden } : vs
            ),
        }));
    },
});

