/**
 * Velocity Store
 * 
 * Zustand store composing modular slices per arch_02_data_model.md.
 * Each slice manages a specific domain of state.
 * 
 * Uses persist middleware for local-first state per research_08_UX_patterns_for_surveys.md.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
    createDataSlice,
    createUISlice,
    createAnalysisSlice,
    createDrillDownSlice,
    type DataSlice,
    type UISlice,
    type AnalysisSlice,
    type DrillDownSlice,
    createSlidesSlice,
    type SlidesSlice,
    createWebRSlice,
    type WebRSlice,
    createWorkspaceSlice,
    type WorkspaceSlice,
} from './slices';
import {
    STORAGE_KEY,
    STORAGE_VERSION,
    partialize,
    onRehydrateStorage,
    type DataFingerprint,
} from './persistConfig';

export type { DataFingerprint };

// ============================================================================
// Combined Store Type
// ============================================================================

export type VelocityState = DataSlice & UISlice & AnalysisSlice & DrillDownSlice & SlidesSlice & WebRSlice & WorkspaceSlice;

// ============================================================================
// Store Implementation
// ============================================================================

export const useVelocityStore = create<VelocityState>()(
    persist(
        (...args) => ({
            ...createDataSlice(...args),
            ...createUISlice(...args),
            ...createAnalysisSlice(...args),
            ...createDrillDownSlice(...args),
            ...createSlidesSlice(...args),
            ...createWebRSlice(...args),
            ...createWorkspaceSlice(...args),
        }),
        {
            name: STORAGE_KEY,
            version: STORAGE_VERSION,
            storage: createJSONStorage(() => localStorage),
            partialize,
            onRehydrateStorage: () => onRehydrateStorage,
        }
    )
);

// ============================================================================
// Re-exports for Backward Compatibility
// ============================================================================

// Data types
export type {
    VariableType,
    ValueLabel,
    MissingValueDef,
    Variable,
    Dataset,
    VariableSet,
    PersistenceState,
    PersistedDataInfo,
} from './slices/dataSlice';

// UI types
export type {
    AppMode,
    ViewMode,
    RecodeModalState,
    FilterModalState,
} from './slices/uiSlice';

// Analysis types
export type {
    TableConfig,
    Filter,
} from './slices/analysisSlice';

export type { AggregatedRow } from '../types';

// Drill-down types
export type {
    DrillDownFilter,
    DrillDownState,
} from './slices/drillDownSlice';

// Legacy type alias for tests
export interface Crosstab {
    rowVariable: string;
    colVariable?: string;
    cells: { count: number; weightedCount?: number; percentage: number; sigMarker?: string }[][];
    rowTotals: { count: number; weightedCount?: number; percentage: number; sigMarker?: string }[];
    colTotals: { count: number; weightedCount?: number; percentage: number; sigMarker?: string }[];
    grandTotal: { count: number; weightedCount?: number; percentage: number; sigMarker?: string };
    isWeighted: boolean;
}
