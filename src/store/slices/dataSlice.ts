/**
 * Data Slice
 * 
 * Manages dataset state, variables, and variable sets.
 * Handles worker initialization and data loading.
 */

import type { StateCreator } from 'zustand';
import type { WorkerRequest, WorkerResponse, VariableStatsResult } from '../../types/worker';
import type { OrderedScoring, OrderedStyle, RecodeConfig, VariableType } from '../../types';
import { allowsNumericStats, normalizeVariableType } from '../../types';
import * as opfsFileManager from '../../services/opfsFileManager';

export type { VariableType } from '../../types';

// ============================================================================
// Types
// ============================================================================

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
    orderedStyle?: OrderedStyle;
    orderedScoring?: OrderedScoring;
    valueLabels: ValueLabel[];
    missingValues: MissingValueDef;
    /** True if this variable was generated automatically (e.g. grid helpers). */
    synthetic?: boolean;
    /** ID of the grid VariableSet that generated this synthetic variable. */
    sourceGridId?: string;
}

export interface Dataset {
    id: string;
    name: string;
    rowCount: number;
    variables: Variable[];
    weightVariable?: string;
    source: 'sav' | 'csv' | 'arrow';
    /** OPFS key for the original uploaded file (used for local-first restore). */
    opfsFileKey?: string;
    /** True if only metadata was loaded (no rows in DuckDB) */
    metadataOnly?: boolean;
    /** Number of rows loaded in sample mode (if applicable) */
    sampleRowCount?: number;
    /** Sampling strategy used: 'sequential' (first N rows) or 'spread' (evenly distributed) */
    sampleStrategy?: 'sequential' | 'spread';
    /** Non-fatal ingestion/degradation diagnostics surfaced to the UI. */
    loadDiagnostics?: {
        isPartial: boolean;
        reason: 'storage_quota' | 'sampling' | 'metadata_only' | 'unknown';
        message: string;
        valueLabelsDropped?: number;
        valueLabelsRetained?: number;
        createdAt: number;
    };
}

export interface VariableSet {
    id: string;
    name: string;
    variableIds: string[];
    structure: 'single' | 'multiple' | 'grid';
    type?: VariableType;
    orderedStyle?: OrderedStyle;
    orderedScoring?: OrderedScoring;
    /** Hidden from Analysis Canvas (Data Gardening only) */
    hidden?: boolean;
    /** Folder this set belongs to (null = ungrouped) */
    folderId?: string;
    /** Display order within folder */
    order?: number;
    /** True if created via recode/compute operation */
    derived?: boolean;
    /** For multiple-response sets, which value counts as "selected" */
    countedValue?: number;
    /** Optional description */
    description?: string;
}

export interface Folder {
    id: string;
    name: string;
    order: number;
}

function normalizeVariable(variable: Variable): Variable {
    const normalizedType = normalizeVariableType(variable.type);
    const next: Variable = {
        ...variable,
        type: normalizedType,
    };

    if (normalizedType !== 'ordered') {
        delete next.orderedStyle;
        delete next.orderedScoring;
        return next;
    }

    if (!next.orderedStyle) {
        next.orderedStyle = variable.type === 'scale' ? 'rating' : 'sequence';
    }
    if (!next.orderedScoring) {
        next.orderedScoring = variable.type === 'scale' ? 'allow_numeric_stats' : 'categorical_only';
    }
    return next;
}

function normalizeVariableSet(variableSet: VariableSet): VariableSet {
    if (!variableSet.type) return variableSet;
    const normalizedType = normalizeVariableType(variableSet.type);
    const next: VariableSet = {
        ...variableSet,
        type: normalizedType,
    };

    if (normalizedType !== 'ordered') {
        delete next.orderedStyle;
        delete next.orderedScoring;
        return next;
    }

    if (!next.orderedStyle) {
        next.orderedStyle = variableSet.type === 'scale' ? 'rating' : 'sequence';
    }
    if (!next.orderedScoring) {
        next.orderedScoring = variableSet.type === 'scale' ? 'allow_numeric_stats' : 'categorical_only';
    }
    return next;
}

// ============================================================================
// Transform Log (Local-First Rebuild)
// ============================================================================

export type DataTransform =
    | {
        type: 'recode';
        sourceColId: string;
        newColId: string;
        label: string;
        config: RecodeConfig;
        createdAt: number;
    };

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
    metadata?: {
        datasetId?: string;
        datasetName?: string;
        rowCount: number;
        columnCount: number;
        schemaVersion: number;
        lastModified: number;
    };
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
    transformLog: DataTransform[];

    // Variable stats cache (keyed by variable ID)
    variableStats: Record<string, VariableStatsResult>;
    variableStatsLoading: Record<string, boolean>;

    // OPFS Persistence State
    opfsAvailable: boolean;
    persistenceMode: 'opfs' | 'memory' | 'disabled';
    persistenceError: string | null;
    activeDbPath: string | null;
    persistenceState: PersistenceState;
    persistedDataInfo: PersistedDataInfo | null;

    // Actions
    initWorker: () => Promise<void>;
    terminateWorker: () => void;
    respawnWorker: (cleanStart?: boolean) => Promise<void>;
    checkPersistedData: () => Promise<void>;
    clearPersistedData: () => Promise<void>;
    flushPersistedData: () => Promise<void>;
    restoreFromPersistence: () => void;
    discardPersistedData: () => Promise<void>;
    rehydrateDatasetFromOpfs: () => Promise<void>;
    loadCSV: (fileName: string, content: string) => Promise<void>;
    loadSAV: (fileName: string, buffer: ArrayBuffer, options?: { datasetId?: string; opfsFileKey?: string }) => Promise<void>;
    loadSAVMetadata: (fileName: string, buffer: ArrayBuffer) => Promise<void>;
    loadSAVSample: (fileName: string, buffer: ArrayBuffer, rowLimit: number, strategy?: 'sequential' | 'spread') => Promise<void>;
    getUniqueValues: (variableId: string) => Promise<string[]>;
    getVariableStats: (variableId: string) => Promise<VariableStatsResult | null>;
    recodeVariable: (sourceColId: string, newColName: string, config: RecodeConfig) => Promise<string>;
    fillSystemMissing: (variableId: string, replacementCode: number, replacementLabel: string) => Promise<void>;
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
    // Structure conversion
    convertMultipleToGrid: (setId: string) => void;
    // Variable metadata editing
    updateVariableMetadata: (variableId: string, updates: { label?: string; name?: string }) => void;
    updateValueLabel: (variableId: string, valueCode: number | string, newLabel: string) => void;
    toggleDiscreteMissingValue: (variableId: string, valueCode: number | string, isMissing: boolean) => void;
}

export const createDataSlice: StateCreator<DataSlice, [], [], DataSlice> = (set, get) => ({
    // Initial state
    worker: null,
    isDbReady: false,
    initError: null,
    dataset: null,
    variableSets: [],
    folders: [],
    transformLog: [],

    // Variable stats cache
    variableStats: {},
    variableStatsLoading: {},

    // OPFS Persistence State
    opfsAvailable: false,
    persistenceMode: 'memory',
    persistenceError: null,
    activeDbPath: null,
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
                        case 'persistenceStatus':
                            set({
                                opfsAvailable: response.opfsAvailable,
                                persistenceMode: response.mode,
                                persistenceError: response.lastError || null,
                                activeDbPath: response.dbPath
                            });
                            break;
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
                            console.warn('[DataSlice] OPFS corruption detected:', response.message);
                            set({
                                persistenceState: 'corrupt',
                                persistenceError: response.message || 'OPFS database corruption detected',
                                opfsAvailable: false
                            });
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
            const datasetId = get().dataset?.id;
            worker.postMessage({ type: 'init', datasetId, schemaVersion: 1 } as WorkerRequest);

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
                        case 'persistenceStatus':
                            set({
                                opfsAvailable: response.opfsAvailable,
                                persistenceMode: response.mode,
                                persistenceError: response.lastError || null,
                                activeDbPath: response.dbPath
                            });
                            break;
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
                            console.warn('[DataSlice] OPFS corruption detected during respawn:', response.message);
                            set({
                                persistenceState: 'corrupt',
                                persistenceError: response.message || 'OPFS database corruption detected',
                                opfsAvailable: false
                            });
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
            const datasetId = get().dataset?.id;
            worker.postMessage({ type: 'init', forceCleanStart: cleanStart, datasetId, schemaVersion: 1 } as WorkerRequest);

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
                            rowCount: response.rowCount,
                            metadata: response.metadata
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

    // Flush persisted data to OPFS (best-effort)
    flushPersistedData: async () => {
        const { worker, opfsAvailable } = get();
        if (!worker || !opfsAvailable) return;

        return new Promise((resolve) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'flushComplete') {
                    worker.removeEventListener('message', handler);
                    if (!response.ok) {
                        console.warn('[DataSlice] OPFS flush failed:', response.error);
                        set({ persistenceError: response.error || 'OPFS flush failed' });
                    }
                    resolve(undefined);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    console.warn('[DataSlice] OPFS flush error:', response.message);
                    set({ persistenceError: response.message });
                    resolve(undefined);
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'flushPersistedData' } as WorkerRequest);
        });
    },

    // Rehydrate DuckDB data from persisted source file in OPFS (best-effort).
    // This is the local-first fallback when DuckDB OPFS DB persistence is unavailable/corrupt.
    rehydrateDatasetFromOpfs: async () => {
        const { worker, dataset } = get();
        if (!worker) throw new Error('Worker not initialized');
        if (!dataset?.opfsFileKey) throw new Error('Dataset has no OPFS source key');

        const ping = () =>
            new Promise<{ hasData: boolean; rowCount?: number }>((resolve) => {
                const handler = (event: MessageEvent<WorkerResponse>) => {
                    const response = event.data;
                    if (response.type === 'pong') {
                        worker.removeEventListener('message', handler);
                        resolve({ hasData: response.hasData, rowCount: response.rowCount });
                    } else if (response.type === 'error') {
                        worker.removeEventListener('message', handler);
                        resolve({ hasData: false });
                    }
                };
                worker.addEventListener('message', handler);
                worker.postMessage({ type: 'ping' } as WorkerRequest);
            });

        const status = await ping();
        if (status.hasData) {
            // If the DB already has data, don't clobber it.
            const runAnalysis = (get() as any).runAnalysis as undefined | (() => Promise<void>);
            if (typeof runAnalysis === 'function') {
                void runAnalysis();
            }
            return;
        }

        console.log(`[DataSlice] Rehydrating DuckDB from OPFS source: ${dataset.opfsFileKey}`);
        const opfsOk = await opfsFileManager.isAvailable().catch(() => false);
        if (!opfsOk) {
            throw new Error('OPFS is unavailable in this browser/session (private browsing can disable it)');
        }

        const sourceKey = dataset.opfsFileKey;
        const exists = await opfsFileManager.fileExists(sourceKey).catch(() => false);
        if (!exists) {
            throw new Error(`OPFS source file not found: ${sourceKey}`);
        }

        let buffer: ArrayBuffer;
        try {
            buffer = await opfsFileManager.readFile(sourceKey);
        } catch (error: any) {
            const message = error?.message || String(error) || 'Unknown read error';
            throw new Error(`Failed to read OPFS source file (${sourceKey}): ${message}`);
        }

        await new Promise<void>((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'savLoaded') {
                    worker.removeEventListener('message', handler);
                    resolve();
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'loadSAV', buffer } as WorkerRequest, [buffer]);
        });

        const transforms = get().transformLog;
        if (transforms.length > 0) {
            console.log(`[DataSlice] Replaying ${transforms.length} transforms`);
        }

        for (const transform of transforms) {
            if (transform.type !== 'recode') continue;

            await new Promise<void>((resolve) => {
                const handler = (event: MessageEvent<WorkerResponse>) => {
                    const response = event.data;
                    if (response.type === 'recodeComplete') {
                        worker.removeEventListener('message', handler);
                        resolve();
                    } else if (response.type === 'error') {
                        worker.removeEventListener('message', handler);
                        console.warn('[DataSlice] Transform replay failed:', response.message);
                        resolve();
                    }
                };

                worker.addEventListener('message', handler);
                worker.postMessage({
                    type: 'recodeVariable',
                    sourceCol: transform.sourceColId,
                    newColName: transform.newColId,
                    config: transform.config
                } as WorkerRequest);
            });
        }

        // If the user had an analysis in view (tableConfig persisted), rerun it now that
        // DuckDB has been repopulated. Query results are intentionally not persisted.
        const runAnalysis = (get() as any).runAnalysis as undefined | (() => Promise<void>);
        if (typeof runAnalysis === 'function') {
            await runAnalysis();
        }

        void get().flushPersistedData();
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
            const runAnalysis = (get() as any).runAnalysis as undefined | (() => Promise<void>);
            if (typeof runAnalysis === 'function') {
                void runAnalysis();
            }
        } else {
            // Reconstruct minimal dataset from OPFS schema
            console.log('[DataSlice] Reconstructing dataset from OPFS schema');
            const variables: Variable[] = persistedDataInfo.schema.map(col => ({
                id: col.name,
                name: col.name,
                label: col.name.replace(/_/g, ' '),
                type: col.type.includes('VARCHAR') || col.type.includes('UTF') ? 'categorical' : 'numeric',
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
                    source: 'sav', // Assume SAV since that's what we persist
                    loadDiagnostics: {
                        isPartial: true,
                        reason: 'unknown',
                        message: 'Session restored from schema metadata only. Value labels are unavailable until you rebuild from source.',
                        createdAt: Date.now(),
                    },
                },
                variableSets,
                persistenceState: 'ready'
            });
            const runAnalysis = (get() as any).runAnalysis as undefined | (() => Promise<void>);
            if (typeof runAnalysis === 'function') {
                void runAnalysis();
            }
        }
    },

    // Discard persisted data and start fresh
    discardPersistedData: async () => {
        const opfsKey = get().dataset?.opfsFileKey;
        await get().clearPersistedData();
        if (opfsKey) {
            await opfsFileManager.deleteFile(opfsKey).catch(() => {});
        }
        set({
            persistenceState: 'ready',
            persistedDataInfo: null,
            dataset: null,
            variableSets: [],
            folders: [],
            transformLog: [],
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
                        type: col.type === 'VARCHAR' ? 'categorical' : 'numeric',
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
                        transformLog: [],
                        // Clear variable stats cache on new dataset load
                        variableStats: {},
                        variableStatsLoading: {},
                        // Reset analysis state - old UUIDs won't match new variableSets
                        tableConfig: { rowVars: [], colVar: null },
                        queryResult: [],
                        activeFilters: [],
                    } as any);

                    const datasetId = get().dataset?.id;
                    if (datasetId) {
                        worker.postMessage({
                            type: 'updatePersistenceMetadata',
                            metadata: {
                                datasetId,
                                datasetName: fileName,
                                rowCount: response.rowCount,
                                columnCount: variables.length,
                                schemaVersion: 1,
                                lastModified: Date.now()
                            }
                        } as WorkerRequest);
                    }

                    void get().flushPersistedData();
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
    loadSAV: async (fileName: string, buffer: ArrayBuffer, options?: { datasetId?: string; opfsFileKey?: string }) => {
        const { worker } = get();
        if (!worker) throw new Error('Worker not initialized');

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'savLoaded') {
                    const datasetId = options?.datasetId || crypto.randomUUID();
                    // Use pre-built variableSets from worker (includes MR sets as grid/multiple)
                    const variableSets: VariableSet[] = response.variableSets.map(normalizeVariableSet);
                    const variables: Variable[] = response.variables.map(normalizeVariable);

                    // Log MR set detection results
                    const gridSets = variableSets.filter(vs => vs.structure === 'grid');
                    const multipleSets = variableSets.filter(vs => vs.structure === 'multiple');
                    if (gridSets.length > 0 || multipleSets.length > 0) {
                        console.log(`📊 [DataSlice] Detected ${gridSets.length} grid sets, ${multipleSets.length} multi-response sets`);
                    }

                    set({
                        dataset: {
                            id: datasetId,
                            name: fileName,
                            rowCount: response.rowCount,
                            variables,
                            source: 'sav',
                            opfsFileKey: options?.opfsFileKey,
                            metadataOnly: false,
                            loadDiagnostics: undefined,
                        },
                        variableSets,
                        transformLog: [],
                        // Clear variable stats cache on new dataset load
                        variableStats: {},
                        variableStatsLoading: {},
                        // Reset analysis state - old UUIDs won't match new variableSets
                        tableConfig: { rowVars: [], colVar: null },
                        queryResult: [],
                        activeFilters: [],
                    } as any);

                    console.log(`📊 [DataSlice] SAV loaded: ${response.rowCount} rows, ${variables.length} variables, ${variableSets.length} variable sets in ${response.durationMs.toFixed(2)}ms`);
                    if (datasetId) {
                        worker.postMessage({
                            type: 'updatePersistenceMetadata',
                            metadata: {
                                datasetId,
                                datasetName: fileName,
                                rowCount: response.rowCount,
                                columnCount: variables.length,
                                schemaVersion: 1,
                                lastModified: Date.now()
                            }
                        } as WorkerRequest);
                    }
                    void get().flushPersistedData();
                    worker.removeEventListener('message', handler);
                    resolve(undefined);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'loadSAV', buffer } as WorkerRequest, [buffer]);
        });
    },

    // Load SAV metadata only (no data inserted into DuckDB)
    loadSAVMetadata: async (fileName: string, buffer: ArrayBuffer) => {
        const { worker } = get();
        if (!worker) throw new Error('Worker not initialized');

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'savMetadataLoaded') {
                    const variableSets: VariableSet[] = response.variableSets.map(normalizeVariableSet);
                    const variables: Variable[] = response.variables.map(normalizeVariable);

                    set({
                        dataset: {
                            id: crypto.randomUUID(),
                            name: fileName,
                            rowCount: response.rowCount,
                            variables,
                            source: 'sav',
                            metadataOnly: true,
                            loadDiagnostics: {
                                isPartial: true,
                                reason: 'metadata_only',
                                message: 'Loaded metadata only. Full row data is not available until you load from source.',
                                createdAt: Date.now(),
                            },
                        },
                        variableSets,
                        variableStats: {},
                        variableStatsLoading: {},
                        tableConfig: { rowVars: [], colVar: null },
                        queryResult: [],
                        activeFilters: [],
                    } as any);

                    console.log(`📊 [DataSlice] SAV metadata loaded: ${response.rowCount} rows, ${variables.length} variables in ${response.durationMs.toFixed(2)}ms`);
                    worker.removeEventListener('message', handler);
                    resolve(undefined);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'loadSAVMetadata', buffer } as WorkerRequest, [buffer]);
        });
    },

    // Load SAV sample rows for metadata heuristics (no data inserted into DuckDB)
    loadSAVSample: async (fileName: string, buffer: ArrayBuffer, rowLimit: number, strategy: 'sequential' | 'spread' = 'spread') => {
        const { worker } = get();
        if (!worker) throw new Error('Worker not initialized');

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;

                if (response.type === 'savSampleLoaded') {
                    const variableSets: VariableSet[] = response.variableSets.map(normalizeVariableSet);
                    const variables: Variable[] = response.variables.map(normalizeVariable);

                    set({
                        dataset: {
                            id: crypto.randomUUID(),
                            name: fileName,
                            rowCount: response.rowCount,
                            variables,
                            source: 'sav',
                            metadataOnly: true,
                            sampleRowCount: response.sampleRowCount,
                            sampleStrategy: response.sampleStrategy,
                            loadDiagnostics: {
                                isPartial: true,
                                reason: 'sampling',
                                message: 'Loaded using sampled metadata to reduce memory risk. Value labels may be incomplete until full load.',
                                createdAt: Date.now(),
                            },
                        },
                        variableSets,
                        variableStats: {},
                        variableStatsLoading: {},
                        tableConfig: { rowVars: [], colVar: null },
                        queryResult: [],
                        activeFilters: [],
                    } as any);

                    console.log(`📊 [DataSlice] SAV sample loaded: ${response.sampleRowCount}/${response.rowCount} rows (${response.sampleStrategy}), ${variables.length} variables in ${response.durationMs.toFixed(2)}ms`);
                    worker.removeEventListener('message', handler);
                    resolve(undefined);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'loadSAVSample', buffer, rowLimit, strategy } as WorkerRequest, [buffer]);
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

        const reqId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.requestId !== reqId) return;
                if (response.type === 'uniqueValues') {
                    worker.removeEventListener('message', handler);
                    resolve(response.data);
                } else if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'getUniqueValues', requestId: reqId, column: variableId } as WorkerRequest);
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
            const needsNumericStats = allowsNumericStats(variableType, variable?.orderedScoring) && !cachedStats.numeric;
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

        const reqId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.requestId !== reqId) return;
                if (response.type === 'variableStats') {
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
                requestId: reqId,
                column: variableId,
                variableType,
                orderedScoring: variable?.orderedScoring,
                missingValues: variable?.missingValues,
            } as WorkerRequest);
        });
    },

    // Recode variable
    recodeVariable: async (sourceColId: string, newColName: string, config: RecodeConfig): Promise<string> => {
        const { worker, dataset } = get();
        if (!worker) throw new Error('Worker not initialized');

        const reqId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.requestId !== reqId) return;
                if (response.type === 'recodeComplete') {
                    if (dataset) {
                        const createdAt = Date.now();
                        const newVariable: Variable = {
                            id: response.newColName,
                            name: response.newColName,
                            label: newColName,
                            type: 'categorical',
                            valueLabels: [],
                            missingValues: {},
                        };
                        const updatedDataset = {
                            ...dataset,
                            variables: [...dataset.variables, newVariable],
                        };
                        set((state) => ({
                            dataset: updatedDataset,
                            variableSets: [...state.variableSets, {
                                id: crypto.randomUUID(),
                                name: newColName,
                                variableIds: [response.newColName],
                                structure: 'single',
                                type: 'categorical'
                            }],
                            transformLog: [
                                ...state.transformLog,
                                {
                                    type: 'recode',
                                    sourceColId,
                                    newColId: response.newColName,
                                    label: newColName,
                                    config,
                                    createdAt,
                                }
                            ]
                        }));

                        if (worker) {
                            worker.postMessage({
                                type: 'updatePersistenceMetadata',
                                metadata: {
                                    datasetId: updatedDataset.id,
                                    datasetName: updatedDataset.name,
                                    rowCount: updatedDataset.rowCount,
                                    columnCount: updatedDataset.variables.length,
                                    schemaVersion: 1,
                                    lastModified: createdAt
                                }
                            } as WorkerRequest);
                        }
                    }
                    void get().flushPersistedData();
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
                requestId: reqId,
                sourceCol: sourceColId,
                newColName,
                config
            } as WorkerRequest);
        });
    },

    fillSystemMissing: async (variableId: string, replacementCode: number, replacementLabel: string): Promise<void> => {
        const { worker, dataset } = get();
        if (!worker) throw new Error('Worker not initialized');
        if (!dataset) throw new Error('No dataset loaded');

        const variable = dataset.variables.find(v => v.id === variableId);
        if (!variable) throw new Error(`Variable not found: ${variableId}`);

        if (variable.missingValues.range) {
            const low = Math.min(variable.missingValues.range.low, variable.missingValues.range.high);
            const high = Math.max(variable.missingValues.range.low, variable.missingValues.range.high);
            if (replacementCode >= low && replacementCode <= high) {
                throw new Error(`Replacement code ${replacementCode} falls within missing range ${low}-${high}`);
            }
        }

        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent<WorkerResponse>) => {
                const response = event.data;
                if (response.type === 'fillSystemMissingComplete' && response.column === variableId) {
                    worker.removeEventListener('message', handler);

                    set((state) => {
                        if (!state.dataset) return state;
                        return {
                            dataset: {
                                ...state.dataset,
                                variables: state.dataset.variables.map(v => {
                                    if (v.id !== variableId) return v;
                                    const existingLabel = v.valueLabels.find(vl => vl.value === replacementCode);
                                    const valueLabels = existingLabel
                                        ? v.valueLabels.map(vl => vl.value === replacementCode ? { ...vl, label: replacementLabel } : vl)
                                        : [...v.valueLabels, { value: replacementCode, label: replacementLabel }];
                                    const discrete = (v.missingValues.discrete || []).filter(code => code !== replacementCode);
                                    return { ...v, valueLabels, missingValues: { ...v.missingValues, discrete } };
                                }),
                            },
                            variableStats: Object.fromEntries(
                                Object.entries(state.variableStats).filter(([key]) => key !== variableId)
                            ),
                            variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false },
                        };
                    });

                    void get().getVariableStats(variableId);
                    resolve();
                    return;
                }
                if (response.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(response.message));
                    return;
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'fillSystemMissing', column: variableId, value: replacementCode } as WorkerRequest);
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
        const normalized = normalizeVariableType(type);
        set((state) => ({
            variableSets: state.variableSets.map(vs =>
                variableSetIds.includes(vs.id)
                    ? {
                        ...vs,
                        type: normalized,
                        orderedStyle: normalized === 'ordered' ? (vs.orderedStyle ?? 'sequence') : undefined,
                        orderedScoring: normalized === 'ordered' ? (vs.orderedScoring ?? 'categorical_only') : undefined,
                    }
                    : vs
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

    // ========================================================================
    // Structure Conversion
    // ========================================================================

    convertMultipleToGrid: (setId) => {
        set((state) => ({
            variableSets: state.variableSets.map(vs =>
                vs.id === setId
                    ? { ...vs, structure: 'grid' as const, countedValue: undefined }
                    : vs
            ),
        }));
    },

    updateVariableMetadata: (variableId, updates) => {
        set((state) => {
            if (!state.dataset) return state;
            const variable = state.dataset.variables.find(v => v.id === variableId);
            if (!variable) return state;

            // Variable sets are created with `label || name` as their natural name.
            // Propagate any label/name change to single-variable sets that are still
            // in sync with that derived name (i.e., not manually renamed).
            const currentDerivedName = variable.label || variable.name;
            const newLabel = updates.label !== undefined ? updates.label : variable.label;
            const newName = updates.name !== undefined ? updates.name : variable.name;
            const newDerivedName = newLabel || newName;

            const variableSets = state.variableSets.map(vs =>
                vs.structure === 'single' &&
                vs.variableIds[0] === variableId &&
                vs.name === currentDerivedName
                    ? { ...vs, name: newDerivedName }
                    : vs
            );

            return {
                dataset: {
                    ...state.dataset,
                    variables: state.dataset.variables.map(v =>
                        v.id === variableId ? { ...v, ...updates } : v
                    ),
                },
                variableSets,
            };
        });
    },

    updateValueLabel: (variableId, valueCode, newLabel) => {
        set((state) => {
            if (!state.dataset) return state;
            const numCode = typeof valueCode === 'string' ? parseFloat(valueCode) : valueCode;

            // Collect IDs of all grid siblings (other vars in the same grid set)
            const gridSiblingIds = new Set<string>();
            state.variableSets.forEach(vs => {
                if (vs.structure === 'grid' && vs.variableIds.includes(variableId)) {
                    vs.variableIds.forEach(id => { if (id !== variableId) gridSiblingIds.add(id); });
                }
            });

            const applyUpdate = (v: Variable) => {
                const exists = v.valueLabels.some(vl => vl.value === numCode);
                if (exists) {
                    return {
                        ...v,
                        valueLabels: v.valueLabels.map(vl =>
                            vl.value === numCode ? { ...vl, label: newLabel } : vl
                        ),
                    };
                }
                // Brand-new value label (value existed in data but had no label)
                return {
                    ...v,
                    valueLabels: [...v.valueLabels, { value: numCode, label: newLabel }],
                };
            };

            return {
                dataset: {
                    ...state.dataset,
                    variables: state.dataset.variables.map(v => {
                        if (v.id === variableId || gridSiblingIds.has(v.id)) return applyUpdate(v);
                        return v;
                    }),
                },
            };
        });
    },

    toggleDiscreteMissingValue: (variableId, valueCode, isMissing) => {
        set((state) => {
            if (!state.dataset) return state;
            return {
                dataset: {
                    ...state.dataset,
                    variables: state.dataset.variables.map(v => {
                        if (v.id !== variableId) return v;
                        const numCode = typeof valueCode === 'string' ? parseFloat(valueCode) : valueCode as number;
                        const current = v.missingValues.discrete || [];
                        const discrete = isMissing
                            ? [...current.filter(c => c !== numCode), numCode]
                            : current.filter(c => c !== numCode);
                        return { ...v, missingValues: { ...v.missingValues, discrete } };
                    }),
                },
                variableStats: Object.fromEntries(
                    Object.entries(state.variableStats).filter(([key]) => key !== variableId)
                ),
                variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false },
            };
        });

        const runAnalysis = (get() as unknown as { runAnalysis?: () => Promise<void> }).runAnalysis;
        if (typeof runAnalysis === 'function') {
            void runAnalysis();
        }
    },
});
