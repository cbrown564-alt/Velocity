/**
 * UI Slice
 * 
 * Manages UI state: dragging, search, view mode, modals, and app mode.
 * Includes the new appMode for Hub-and-Spoke architecture.
 */

import type { StateCreator } from 'zustand';
import type { Variable } from './dataSlice';

// ============================================================================
// Types
// ============================================================================

export type AppMode = 'analysis' | 'variables';
export type ViewMode = 'table' | 'chart';

export interface RecodeModalState {
    isOpen: boolean;
    variable: Variable | null;
}

export interface FilterModalState {
    isOpen: boolean;
}

// ============================================================================
// Slice State & Actions
// ============================================================================

export interface UISlice {
    // State
    appMode: AppMode;
    draggingId: string | null;
    searchQuery: string;
    viewMode: ViewMode;
    recodeModal: RecodeModalState;
    filterModal: FilterModalState;

    // Actions
    setAppMode: (mode: AppMode) => void;
    toggleAppMode: () => void;
    setDraggingId: (id: string | null) => void;
    setSearchQuery: (query: string) => void;
    setViewMode: (mode: ViewMode) => void;
    openRecodeModal: (variable: Variable) => void;
    closeRecodeModal: () => void;
    openFilterModal: () => void;
    closeFilterModal: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
    // Initial state
    appMode: 'analysis',
    draggingId: null,
    searchQuery: '',
    viewMode: 'table',
    recodeModal: { isOpen: false, variable: null },
    filterModal: { isOpen: false },

    // Actions
    setAppMode: (mode) => set({ appMode: mode }),

    toggleAppMode: () => set((state) => ({
        appMode: state.appMode === 'analysis' ? 'variables' : 'analysis'
    })),

    setDraggingId: (id) => set({ draggingId: id }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setViewMode: (mode) => set({ viewMode: mode }),

    openRecodeModal: (variable) => set({ recodeModal: { isOpen: true, variable } }),
    closeRecodeModal: () => set({ recodeModal: { isOpen: false, variable: null } }),

    openFilterModal: () => set({ filterModal: { isOpen: true } }),
    closeFilterModal: () => set({ filterModal: { isOpen: false } }),
});
