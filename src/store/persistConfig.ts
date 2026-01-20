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

    // From UISlice
    appMode: VelocityState['appMode'];
    viewMode: VelocityState['viewMode'];
    activeFolderId: VelocityState['activeFolderId'];

    // From AnalysisSlice
    tableConfig: VelocityState['tableConfig'];
    activeFilters: VelocityState['activeFilters'];
}

// ============================================================================
// Partialize Function
// ============================================================================

/**
 * Extracts only the persistable subset of state.
 * Called by Zustand persist middleware before saving.
 */
export const partialize = (state: VelocityState): PersistedState => ({
    // DataSlice - persist dataset metadata but NOT worker/loading state
    dataset: state.dataset,
    variableSets: state.variableSets,
    folders: state.folders,

    // UISlice - persist view preferences but NOT dragging/modal state
    appMode: state.appMode,
    viewMode: state.viewMode,
    activeFolderId: state.activeFolderId,

    // AnalysisSlice - persist configuration but NOT query results
    tableConfig: state.tableConfig,
    activeFilters: state.activeFilters,

    // DrillDownSlice - entirely ephemeral, not persisted
});

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
            console.log('⚠️ [Persist] Note: Data must be re-imported to DuckDB');
        }
    }
};
