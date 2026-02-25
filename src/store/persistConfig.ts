/**
 * Persist Configuration
 *
 * Configuration for Zustand persist middleware.
 * Defines what state is persisted vs. ephemeral.
 */

import type { VelocityState } from './index';

// ============================================================================
// Configuration Constants
// ============================================================================

export const STORAGE_KEY = 'velocity-state';
export const STORAGE_VERSION = 1;

// ============================================================================
// Data Fingerprint Type
// ============================================================================

/**
 * Fingerprint for reconciling localStorage metadata with OPFS data.
 * Used to determine if session can be auto-restored or needs user confirmation.
 */
export interface DataFingerprint {
    rowCount: number;
    columnCount: number;
    lastModified: number;
}

// ============================================================================
// Persisted State Type
// ============================================================================

/**
 * Subset of VelocityState that is persisted to localStorage.
 * Excludes ephemeral state like workers, loading flags, and modal state.
 */
export interface PersistedState {
    // From DataSlice
    dataset: VelocityState['dataset'];
    variableSets: VelocityState['variableSets'];
    folders: VelocityState['folders'];
    transformLog: VelocityState['transformLog'];

    // From UISlice
    appMode: VelocityState['appMode'];
    activeFolderId: VelocityState['activeFolderId'];

    // From AnalysisSlice
    tableConfig: VelocityState['tableConfig'];
    activeFilters: VelocityState['activeFilters'];

    // From WorkspaceSlice
    workspace: VelocityState['workspace'];
    activeDatasetId: VelocityState['activeDatasetId'];
    isWorkspaceMode: VelocityState['isWorkspaceMode'];

    // From HarmonizationSlice — only persist session, not ephemeral UI state
    harmonizationSession: VelocityState['harmonization']['session'];

    // Data fingerprint for OPFS/localStorage reconciliation
    dataFingerprint?: DataFingerprint;
}

// ============================================================================
// Partialize Function
// ============================================================================

/**
 * Extracts only the persistable subset of state.
 * Called by Zustand persist middleware before saving.
 */
export const partialize = (state: VelocityState): PersistedState => {
    const persistDataset = state.dataset?.metadataOnly ? null : state.dataset;
    const persistVariableSets = state.dataset?.metadataOnly ? [] : state.variableSets;
    const persistFolders = state.dataset?.metadataOnly ? [] : state.folders;
    const persistTransformLog = state.dataset?.metadataOnly ? [] : state.transformLog;

    return {
        // DataSlice - persist dataset metadata but NOT worker/loading state
        dataset: persistDataset,
        variableSets: persistVariableSets,
        folders: persistFolders,
        transformLog: persistTransformLog,

        // UISlice - persist view preferences but NOT dragging/modal state
        appMode: state.appMode,
        activeFolderId: state.activeFolderId,

        // AnalysisSlice - persist configuration but NOT query results
        tableConfig: state.tableConfig,
        activeFilters: state.activeFilters,

        // WorkspaceSlice - persist workspace state for multi-file management
        workspace: state.workspace,
        activeDatasetId: state.activeDatasetId,
        isWorkspaceMode: state.isWorkspaceMode,

        // HarmonizationSlice - persist only the session (not open state or sankey data)
        harmonizationSession: state.harmonization?.session ?? null,

        // Data fingerprint - used for OPFS/localStorage reconciliation
        // Only set when dataset exists
        dataFingerprint: persistDataset
            ? {
                rowCount: persistDataset.rowCount,
                columnCount: persistDataset.variables.length,
                lastModified: Date.now()
            }
            : undefined,

        // DrillDownSlice - entirely ephemeral, not persisted
    };
};

// ============================================================================
// Hydration Handler
// ============================================================================

/**
 * Called when state is rehydrated from localStorage.
 * Use to trigger side effects like logging.
 */
export const onRehydrateStorage = (state: VelocityState | undefined) => {
    if (state) {
        console.log('🔄 [Persist] State rehydrated from localStorage');
        if (state.dataset) {
            console.log(`📊 [Persist] Restored dataset: ${state.dataset.name} (${state.dataset.variables.length} variables)`);
            if (state.dataset.opfsFileKey) {
                console.log(`📁 [Persist] Found OPFS source file: ${state.dataset.opfsFileKey}`);
                console.log('🔁 [Persist] Note: Data will be re-imported to DuckDB from OPFS (if available)');
            } else {
                console.log('⚠️ [Persist] Note: Data must be re-imported to DuckDB');
            }
        }
        if (state.harmonization?.session) {
            console.log(`🔗 [Persist] Restored harmonization session: ${state.harmonization.session.id}`);
        }
    }
};
