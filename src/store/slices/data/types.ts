/**
 * Data slice types — persistence, load progress, workspace open input, and slice contract.
 */

import type { BrowserEngine } from '../../../engine/BrowserEngine';
import type { VariableStatsResult } from '../../../types/worker';
import type { RecodeConfig, VariableType } from '../../../types';
import type { DatasetSessionState } from '../../../types/workspaceSession';
import type {
    DataTransform,
    Dataset,
    Folder,
    Variable,
    VariableSet,
} from '../../../types/dataset';

export type { VariableType } from '../../../types';
export type {
    DataTransform,
    Dataset,
    Folder,
    MissingValueDef,
    ValueLabel,
    Variable,
    VariableSet,
} from '../../../types/dataset';

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
    sessionState?: DatasetSessionState;
}

export type PersistenceState =
    | 'idle'
    | 'checking'
    | 'found'
    | 'restoring'
    | 'ready'
    | 'corrupt'
    | 'error';

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

export interface DataSlice {
    browserEngine: BrowserEngine | null;
    isDbReady: boolean;
    initError: string | null;
    dataset: Dataset | null;
    variableSets: VariableSet[];
    folders: Folder[];
    transformLog: DataTransform[];

    variableStats: Record<string, VariableStatsResult>;
    variableStatsLoading: Record<string, boolean>;

    opfsAvailable: boolean;
    persistenceMode: 'opfs' | 'memory' | 'disabled';
    persistenceError: string | null;
    activeDbPath: string | null;
    persistenceState: PersistenceState;
    persistedDataInfo: PersistedDataInfo | null;
    loadProgress: LoadProgressState | null;

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
    createFolder: (name: string) => string;
    renameFolder: (folderId: string, name: string) => void;
    deleteFolder: (folderId: string) => void;
    moveToFolder: (variableSetIds: string[], folderId: string | null) => void;
    reorderVariableSets: (activeId: string, overId: string) => void;
    bulkSetType: (variableSetIds: string[], type: VariableType) => void;
    bulkHide: (variableSetIds: string[], hidden: boolean) => void;
    convertMultipleToGrid: (setId: string) => void;
    updateVariableMetadata: (variableId: string, updates: { label?: string; name?: string }) => void;
    updateValueLabel: (variableId: string, valueCode: number | string, newLabel: string) => void;
    toggleDiscreteMissingValue: (variableId: string, valueCode: number | string, isMissing: boolean) => void;
    setLoadProgress: (progress: LoadProgressState | null) => void;
}
