/**
 * Data Slice
 * 
 * Manages dataset state, variables, and variable sets.
 * Handles worker initialization and data loading.
 */

import type { StateCreator } from 'zustand';
import type { VariableStatsResult } from '../../types/worker';
import type { OrderedScoring, OrderedStyle, RecodeConfig, VariableType } from '../../types';
import { allowsNumericStats, normalizeVariableType } from '../../types';
import * as opfsFileManager from '../../services/opfsFileManager';
import { EngineProxy } from '../../services/EngineProxy';
import {
    openWorkspaceDatasetLifecycle,
    rehydrateDatasetFromOpfsSource,
} from '../workspaceDatasetLifecycle';
import {
    initializeEngineWorker,
    respawnEngineWorker,
    createStorePersistenceBridge,
} from '../enginePersistenceBridge';
import type { EngineResponseByType } from '../../types/engineWorker';
import { enrichVariablesWithSemantic } from '../../core/semantic/respondentIdentifier';

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

export function normalizeVariable(variable: Variable): Variable {
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

export function normalizeVariableSet(variableSet: VariableSet): VariableSet {
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

export function buildVariableSetsFromVariables(variables: Variable[]): VariableSet[] {
    return variables
        .filter((variable) => !variable.synthetic)
        .map((variable) => ({
            id: crypto.randomUUID(),
            name: variable.label || variable.name,
            variableIds: [variable.id],
            structure: 'single' as const,
            type: variable.type,
        }));
}

export interface WorkspaceDatasetOpenInput {
    id: string;
    name: string;
    fileName?: string;
    rowCount: number;
    source: 'sav' | 'csv' | 'arrow';
    opfsFileKey?: string;
    variables?: Variable[];
    variableSets?: VariableSet[];
    folders?: Folder[];
    sessionState?: {
        tableConfig: { rowVars: string[]; colVar: string | null };
        activeFilters: unknown[];
        transformLog: unknown[];
    };
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

export interface LoadProgressState {
    phase: 'parsing' | 'inserting' | 'complete';
    progress: number;
    message: string;
    rowsProcessed?: number;
    totalRows?: number;
}

function applyLoadProgressMessage(
    set: (partial: Partial<DataSlice>) => void,
    msg: EngineResponseByType<'engine.loadProgress'>,
): void {
    if (msg.phase === 'complete') {
        set({ loadProgress: null });
    } else {
        set({
            loadProgress: {
                phase: msg.phase,
                progress: msg.progress,
                message: msg.message,
                rowsProcessed: msg.rowsProcessed,
                totalRows: msg.totalRows,
            },
        });
    }
}

// ============================================================================
// Slice State & Actions
// ============================================================================

export interface DataSlice {
    // State
    engineProxy: EngineProxy | null;
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
    /** Worker-driven ingest progress (UXR-036) */
    loadProgress: LoadProgressState | null;

    // Actions
    initWorker: () => Promise<void>;
    terminateWorker: () => void;
    respawnWorker: (cleanStart?: boolean, datasetIdOverride?: string) => Promise<void>;
    checkPersistedData: () => Promise<void>;
    clearPersistedData: () => Promise<void>;
    flushPersistedData: () => Promise<void>;
    restoreFromPersistence: () => void;
    discardPersistedData: () => Promise<void>;
    rehydrateDatasetFromOpfs: (options?: { forceReload?: boolean }) => Promise<void>;
    openWorkspaceDataset: (stored: WorkspaceDatasetOpenInput) => Promise<void>;
    loadCSV: (fileName: string, content: string) => Promise<void>;
    loadSAV: (fileName: string, buffer: ArrayBuffer, options?: { datasetId?: string; opfsFileKey?: string }) => Promise<void>;
    loadSAVMetadata: (fileName: string, buffer: ArrayBuffer) => Promise<void>;
    loadSAVSample: (fileName: string, buffer: ArrayBuffer, rowLimit: number, strategy?: 'sequential' | 'spread') => Promise<void>;
    getUniqueValues: (variableId: string) => Promise<string[]>;
    getVariableStats: (variableId: string) => Promise<VariableStatsResult | null>;
    recodeVariable: (sourceColId: string, newColName: string, config: RecodeConfig) => Promise<string>;
    deleteGroupedVariable: (varId: string) => Promise<void>;
    splitGroupValue: (varId: string, groupValue: string) => Promise<void>;
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
    setLoadProgress: (progress: LoadProgressState | null) => void;
}

export const createDataSlice: StateCreator<DataSlice, [], [], DataSlice> = (set, get) => ({
    // Initial state
    engineProxy: null,
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
    loadProgress: null,

    // Initialize Web Worker with EngineProxy
    initWorker: async () => {
        const bridge = createStorePersistenceBridge((partial) => set(partial as any));

        const handleLoadProgress = (msg: EngineResponseByType<'engine.loadProgress'>) => {
            applyLoadProgressMessage(set, msg);
        };

        await initializeEngineWorker({
            getExistingProxy: () => get().engineProxy,
            getDatasetId: () => get().dataset?.id,
            getOpfsAvailable: () => get().opfsAvailable,
            getPersistenceState: () => get().persistenceState,
            bridge,
            setWorkerRuntimeError: (message) => set({ initError: message }),
            assignEngineProxy: (proxy) => set({ engineProxy: proxy, persistenceState: 'checking' }),
            setInitSuccess: (opfsAvailable) => set({ isDbReady: true, opfsAvailable }),
            setPersistenceReady: () => set({ persistenceState: 'ready' }),
            setInitError: (message) => set({ initError: message, persistenceState: 'error' }),
            checkPersistedData: () => get().checkPersistedData(),
            onLoadProgress: handleLoadProgress,
        });
    },

    // Terminate the current worker
    terminateWorker: () => {
        const { engineProxy } = get();
        if (engineProxy) {
            engineProxy.terminate();
            console.log('[DataSlice] Engine terminated');
        }
        set({
            engineProxy: null,
            isDbReady: false,
            initError: null
        });
    },

    // Respawn worker (terminates existing and creates fresh)
    respawnWorker: async (cleanStart: boolean = false, datasetIdOverride?: string) => {
        const bridge = createStorePersistenceBridge((partial) => set(partial as any));

        const handleLoadProgress = (msg: EngineResponseByType<'engine.loadProgress'>) => {
            applyLoadProgressMessage(set, msg);
        };

        await respawnEngineWorker({
            terminateWorker: () => get().terminateWorker(),
            getDatasetId: () => get().dataset?.id,
            bridge,
            setEngineProxy: (proxy) => set({ engineProxy: proxy }),
            setRespawnSuccess: (opfsAvailable) => set({
                isDbReady: true,
                opfsAvailable,
                persistenceState: 'ready',
            }),
            setRespawnError: (message) => set({
                initError: message,
                persistenceState: 'error',
            }),
            cleanStart,
            datasetIdOverride,
            onLoadProgress: handleLoadProgress,
        });
    },

    setLoadProgress: (progress) => set({ loadProgress: progress }),

    // Check for persisted data in OPFS
    checkPersistedData: async () => {
        const { engineProxy } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        set({ persistenceState: 'checking' });

        try {
            const response = await engineProxy.checkPersistedData();
            if (response.type === 'engine.persistedDataFound') {
                set({
                    persistenceState: 'found',
                    persistedDataInfo: {
                        schema: response.schema,
                        rowCount: response.rowCount,
                        metadata: response.metadata,
                    },
                });
                console.log(`[DataSlice] Found persisted data: ${response.rowCount} rows, ${response.schema.length} columns`);
            } else {
                set({ persistenceState: 'ready', persistedDataInfo: null });
                console.log('[DataSlice] No persisted data found');
            }
        } catch (error: any) {
            if (get().persistenceState !== 'corrupt') {
                set({ persistenceState: 'ready' });
            }
            throw error;
        }
    },

    // Clear persisted data from OPFS
    clearPersistedData: async () => {
        const { engineProxy } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        await engineProxy.clearPersistedData();
        set({ persistedDataInfo: null });
        console.log('[DataSlice] Persisted data cleared');
    },

    // Flush persisted data to OPFS (best-effort)
    flushPersistedData: async () => {
        const { engineProxy, opfsAvailable } = get();
        if (!engineProxy || !opfsAvailable) return;

        try {
            const response = await engineProxy.flushPersistedData();
            if (!response.ok) {
                console.warn('[DataSlice] OPFS flush failed:', response.error);
                set({ persistenceError: response.error || 'OPFS flush failed' });
            }
        } catch (error: any) {
            console.warn('[DataSlice] OPFS flush error:', error.message);
            set({ persistenceError: error.message });
        }
    },

    // Rehydrate DuckDB data from persisted source file in OPFS (best-effort).
    // This is the local-first fallback when DuckDB OPFS DB persistence is unavailable/corrupt.
    rehydrateDatasetFromOpfs: async (options?: { forceReload?: boolean }) => {
        const { engineProxy, dataset, transformLog } = get();
        if (!engineProxy) throw new Error('Engine not initialized');
        if (!dataset) throw new Error('Dataset has no OPFS source key');

        const runAnalysis = (get() as any).runAnalysis as undefined | (() => Promise<void>);

        await rehydrateDatasetFromOpfsSource(
            {
                engineProxy,
                dataset,
                transformLog,
                runAnalysis: typeof runAnalysis === 'function' ? runAnalysis : undefined,
                flushPersistedData: () => get().flushPersistedData(),
            },
            options,
        );
    },

    openWorkspaceDataset: async (stored: WorkspaceDatasetOpenInput) => {
        const { engineProxy, dataset: currentDataset } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        const runAnalysis = (get() as any).runAnalysis as undefined | (() => Promise<void>);

        await openWorkspaceDatasetLifecycle(stored, {
            engineProxy,
            currentDataset,
            runAnalysis: typeof runAnalysis === 'function' ? runAnalysis : undefined,
            flushPersistedData: () => get().flushPersistedData(),
            respawnWorker: (cleanStart) => get().respawnWorker(cleanStart),
            getEngineProxy: () => get().engineProxy,
            getPersistenceState: () => get().persistenceState,
            applyOpenPatch: (patch) => {
                set({
                    dataset: patch.dataset,
                    variableSets: patch.variableSets,
                    folders: patch.folders,
                    transformLog: patch.transformLog,
                    variableStats: {},
                    variableStatsLoading: {},
                    tableConfig: patch.tableConfig,
                    activeFilters: patch.activeFilters,
                    queryResult: [],
                    tableStats: null,
                    persistenceState: 'checking',
                    persistedDataInfo: null,
                    persistenceError: null,
                } as any);
            },
            applySameDatasetSession: (sessionState) => {
                if (!sessionState) return;
                set({
                    tableConfig: sessionState.tableConfig,
                    activeFilters: sessionState.activeFilters,
                    transformLog: sessionState.transformLog as DataTransform[],
                } as any);
            },
            rehydrateFromOpfs: (options) => get().rehydrateDatasetFromOpfs(options),
            setPersistenceReady: (fileName, rowCount) => {
                const activeProxy = get().engineProxy;
                if (!activeProxy) return;
                activeProxy.setDatasetContext(fileName, rowCount);
                set({ persistenceState: 'ready' });
            },
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
            const runAnalysis = (get() as any).runAnalysis as undefined | (() => Promise<void>);
            if (typeof runAnalysis === 'function') {
                void runAnalysis().catch((error) => {
                    console.warn('[DataSlice] Analysis replay failed after persistence restore:', error);
                });
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
                void runAnalysis().catch((error) => {
                    console.warn('[DataSlice] Analysis replay failed after schema-only restore:', error);
                });
            }
        }
    },

    // Discard persisted data and start fresh
    discardPersistedData: async () => {
        const opfsKey = get().dataset?.opfsFileKey;
        const activeDbPath = get().activeDbPath;

        if (activeDbPath?.startsWith('opfs://')) {
            get().terminateWorker();
            try {
                const dbFiles = await opfsFileManager.listDbFiles();
                await Promise.all(dbFiles.map((file) => opfsFileManager.deleteDbFile(file.name)));
            } catch (error) {
                console.warn('[DataSlice] Failed to purge OPFS DB files during discard:', error);
            }
            await get().respawnWorker(false);
        } else {
            await get().clearPersistedData();
        }

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
        const { engineProxy } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        const response = await engineProxy.loadCSV(fileName, content);

        const variableSets: VariableSet[] = response.schema.map((col) => {
            const id = col.name;
            const label = col.name.replace(/_/g, ' ');
            const type = col.type === 'VARCHAR' ? 'categorical' : 'numeric';
            return {
                id: crypto.randomUUID(),
                name: label || id,
                variableIds: [id],
                structure: 'single' as const,
                type,
            };
        });

        const variables: Variable[] = enrichVariablesWithSemantic(
            response.schema.map((col) => ({
                id: col.name,
                name: col.name,
                label: col.name.replace(/_/g, ' '),
                type: col.type === 'VARCHAR' ? 'categorical' : 'numeric',
                valueLabels: [],
                missingValues: {},
            })),
            variableSets
        );

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
            variableStats: {},
            variableStatsLoading: {},
            tableConfig: { rowVars: [], colVar: null },
            queryResult: [],
            activeFilters: [],
        } as any);

        engineProxy.setDatasetContext(fileName, response.rowCount);

        const datasetId = get().dataset?.id;
        if (datasetId) {
            void engineProxy.updatePersistenceMetadata({
                datasetId,
                datasetName: fileName,
                rowCount: response.rowCount,
                columnCount: variables.length,
                schemaVersion: 1,
                lastModified: Date.now(),
            });
        }

        void get().flushPersistedData();
    },

    // Load SAV file
    loadSAV: async (fileName: string, buffer: ArrayBuffer, options?: { datasetId?: string; opfsFileKey?: string }) => {
        const targetDatasetId = options?.datasetId;
        const currentDataset = get().dataset;

        if (targetDatasetId && currentDataset?.id !== targetDatasetId) {
            if (currentDataset) {
                await get().flushPersistedData().catch(() => {});
            }
            await get().respawnWorker(false, targetDatasetId);
        }

        const { engineProxy } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        const response = await engineProxy.loadSAV(buffer);

        const datasetId = targetDatasetId || crypto.randomUUID();
        const variableSets: VariableSet[] = response.variableSets.map(normalizeVariableSet);
        const variables: Variable[] = response.variables.map(normalizeVariable);

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
            variableStats: {},
            variableStatsLoading: {},
            tableConfig: { rowVars: [], colVar: null },
            queryResult: [],
            activeFilters: [],
        } as any);

        engineProxy.setDatasetContext(fileName, response.rowCount);
        console.log(`📊 [DataSlice] SAV loaded: ${response.rowCount} rows, ${variables.length} variables, ${variableSets.length} variable sets in ${response.durationMs.toFixed(2)}ms`);
        if (datasetId) {
            void engineProxy.updatePersistenceMetadata({
                datasetId,
                datasetName: fileName,
                rowCount: response.rowCount,
                columnCount: variables.length,
                schemaVersion: 1,
                lastModified: Date.now(),
            });
        }
        void get().flushPersistedData();
    },

    // Load SAV metadata only (no data inserted into DuckDB)
    loadSAVMetadata: async (fileName: string, buffer: ArrayBuffer) => {
        const { engineProxy } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        const response = await engineProxy.loadSAVMetadata(buffer);
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
    },

    // Load SAV sample rows for metadata heuristics (no data inserted into DuckDB)
    loadSAVSample: async (fileName: string, buffer: ArrayBuffer, rowLimit: number, strategy: 'sequential' | 'spread' = 'spread') => {
        const { engineProxy } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        const response = await engineProxy.loadSAVSample(buffer, rowLimit, strategy);
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
    },

    // Get unique values for a variable
    getUniqueValues: async (variableId: string): Promise<string[]> => {
        const { engineProxy, dataset } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        const variable = dataset?.variables.find(v => v.id === variableId);
        if (variable?.valueLabels && variable.valueLabels.length > 0) {
            return variable.valueLabels.map(vl => String(vl.value));
        }

        const response = await engineProxy.getUniqueValues(variableId);
        return response.data;
    },

    // Get variable statistics (frequencies, missing count, and numeric stats for scale variables)
    getVariableStats: async (variableId: string): Promise<VariableStatsResult | null> => {
        const { engineProxy, variableStats, variableStatsLoading, dataset } = get();
        if (!engineProxy) return null;

        const variable = dataset?.variables.find(v => v.id === variableId);
        const variableType = variable?.type;

        const cachedStats = variableStats[variableId];
        if (cachedStats) {
            const needsNumericStats = allowsNumericStats(variableType, variable?.orderedScoring) && !cachedStats.numeric;
            if (!needsNumericStats) return cachedStats;
        }

        if (variableStatsLoading[variableId]) return null;

        set((state) => ({
            variableStatsLoading: { ...state.variableStatsLoading, [variableId]: true }
        }));

        try {
            const response = await engineProxy.getVariableStats(
                variableId,
                variableType,
                variable?.orderedScoring,
                undefined,
                variable?.missingValues,
            );
            set((state) => ({
                variableStats: { ...state.variableStats, [variableId]: response.data },
                variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false }
            }));
            return response.data;
        } catch (error: any) {
            set((state) => ({
                variableStatsLoading: { ...state.variableStatsLoading, [variableId]: false }
            }));
            throw error;
        }
    },

    // Recode variable
    recodeVariable: async (sourceColId: string, newColName: string, config: RecodeConfig): Promise<string> => {
        const { engineProxy, dataset } = get();
        if (!engineProxy) throw new Error('Engine not initialized');

        const response = await engineProxy.recodeVariable(sourceColId, newColName, config);

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

            void engineProxy.updatePersistenceMetadata({
                datasetId: updatedDataset.id,
                datasetName: updatedDataset.name,
                rowCount: updatedDataset.rowCount,
                columnCount: updatedDataset.variables.length,
                schemaVersion: 1,
                lastModified: createdAt,
            });
        }
        void get().flushPersistedData();
        return response.newColName;
    },

    fillSystemMissing: async (variableId: string, replacementCode: number, replacementLabel: string): Promise<void> => {
        const { engineProxy, dataset } = get();
        if (!engineProxy) throw new Error('Engine not initialized');
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

        await engineProxy.fillSystemMissing(variableId, replacementCode);

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
            void runAnalysis().catch((error) => {
                console.warn('[DataSlice] Analysis refresh failed after missing-value update:', error);
            });
        }
    },

    deleteGroupedVariable: async (varId: string): Promise<void> => {
        const { engineProxy, dataset, variableSets, transformLog } = get();
        if (!engineProxy || !dataset) return;

        const transform = transformLog.find(t => t.newColId === varId);
        if (!transform) return;

        await engineProxy.dropColumn(varId);

        // Update state: remove variable, variable set, transform log entry
        set((state) => {
            const newVariables = state.dataset
                ? state.dataset.variables.filter(v => v.id !== varId)
                : (state.dataset?.variables ?? []);
            const newVariableSets = state.variableSets.filter(
                vs => !vs.variableIds.includes(varId)
            );
            const newTransformLog = state.transformLog.filter(t => t.newColId !== varId);

            // Swap varId with sourceColId in tableConfig
            const storeAny = get() as any;
            const tableConfig = storeAny.tableConfig as { rowVars: string[]; colVar: string | null } | undefined;
            const sourceColId = transform.sourceColId;

            const newRowVars = tableConfig?.rowVars.map(id => id === varId ? sourceColId : id) ?? [];
            const newColVar = tableConfig?.colVar === varId ? sourceColId : (tableConfig?.colVar ?? null);

            return {
                dataset: state.dataset ? { ...state.dataset, variables: newVariables } : state.dataset,
                variableSets: newVariableSets,
                transformLog: newTransformLog,
                variableStats: Object.fromEntries(
                    Object.entries(state.variableStats).filter(([key]) => key !== varId)
                ),
            };
        });

        // Swap varId in tableConfig via setTableConfig (triggers runAnalysis)
        const storeAny = get() as any;
        const tableConfig = storeAny.tableConfig as { rowVars: string[]; colVar: string | null } | undefined;
        if (tableConfig) {
            const newRowVars = tableConfig.rowVars.map(id => id === varId ? transform.sourceColId : id);
            const newColVar = tableConfig.colVar === varId ? transform.sourceColId : tableConfig.colVar;
            const setTableConfig = storeAny.setTableConfig as ((c: { rowVars: string[]; colVar: string | null }) => void) | undefined;
            if (typeof setTableConfig === 'function') {
                setTableConfig({ rowVars: newRowVars, colVar: newColVar });
            }
        }

        // Navigate inspector back to source variable
        const setSelectedVariableId = (get() as any).setSelectedVariableId as ((id: string) => void) | undefined;
        if (typeof setSelectedVariableId === 'function') {
            setSelectedVariableId(transform.sourceColId);
        }

        void get().flushPersistedData();
    },

    splitGroupValue: async (varId: string, groupValue: string): Promise<void> => {
        const { engineProxy, dataset, transformLog } = get();
        if (!engineProxy || !dataset) return;

        const transform = transformLog.find(t => t.newColId === varId);
        if (!transform || transform.config.mode !== 'categorical' || !transform.config.mappings) return;

        const sourceVar = dataset.variables.find(v => v.id === transform.sourceColId);

        // Build new mappings: un-merge entries that map to groupValue
        const newMappings: Record<string, string> = {};
        for (const [key, val] of Object.entries(transform.config.mappings)) {
            if (val === groupValue) {
                const originalLabel = sourceVar?.valueLabels.find(
                    vl => String(vl.value) === key
                )?.label ?? key;
                newMappings[key] = originalLabel;
            } else {
                newMappings[key] = val;
            }
        }

        const newConfig: RecodeConfig = { ...transform.config, mappings: newMappings };

        await engineProxy.updateColumn(transform.sourceColId, varId, newConfig);

        // Update transformLog and invalidate cached stats
        set((state) => ({
            transformLog: state.transformLog.map(t =>
                t.newColId === varId ? { ...t, config: newConfig } : t
            ),
            variableStats: Object.fromEntries(
                Object.entries(state.variableStats).filter(([key]) => key !== varId)
            ),
            variableStatsLoading: { ...state.variableStatsLoading, [varId]: false },
        }));

        // Re-fetch stats and re-run analysis
        void get().getVariableStats(varId);
        const runAnalysis = (get() as unknown as { runAnalysis?: () => Promise<void> }).runAnalysis;
        if (typeof runAnalysis === 'function') {
            void runAnalysis().catch((error) => {
                console.warn('[DataSlice] Analysis refresh failed after splitGroupValue:', error);
            });
        }
    },
});
