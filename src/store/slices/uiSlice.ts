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

// Faceted Search Types
export type TypeFacet = 'categorical' | 'numeric';
export type StatusFacet = 'visible' | 'hidden' | 'derived';
export type QualityFacet = 'complete' | 'incomplete';

export interface FacetFilters {
    types: TypeFacet[];
    statuses: StatusFacet[];
    qualities: QualityFacet[];
}

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
    /** Selected variable set IDs in Variable Manager (for bulk operations) */
    selectedVariableSetIds: string[];
    /** Last selected ID for shift-click range selection */
    lastSelectedId: string | null;
    /** Active folder filter in Variable Manager (null = all) */
    activeFolderId: string | null;

    // Miller Column Navigation State
    /** Selected data source ID (for future multi-source support) */
    selectedDataSourceId: string | null;
    /** Single variable set selection for Miller column navigation */
    selectedVariableSetId: string | null;
    /** Single variable selection for Miller column navigation */
    selectedVariableId: string | null;

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
    /** Toggle selection of a variable set (multi = Cmd/Ctrl held) */
    toggleVariableSetSelection: (id: string, multi?: boolean) => void;
    /** Select a range from lastSelectedId to id (for Shift+click) */
    selectVariableSetRange: (id: string, allIds: string[]) => void;
    selectAllVariableSets: (ids: string[]) => void;
    clearSelection: () => void;
    setActiveFolderId: (folderId: string | null) => void;

    // Miller Column Navigation Actions
    setSelectedDataSourceId: (id: string | null) => void;
    setSelectedVariableSetId: (id: string | null) => void;
    setSelectedVariableId: (id: string | null) => void;

    // Faceted Search
    facetFilters: FacetFilters;
    setFacetFilters: (filters: Partial<FacetFilters>) => void;
    clearFacetFilters: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
    // Initial state
    appMode: 'analysis',
    draggingId: null,
    searchQuery: '',
    viewMode: 'table',
    recodeModal: { isOpen: false, variable: null },
    filterModal: { isOpen: false },
    selectedVariableSetIds: [],
    lastSelectedId: null,
    activeFolderId: null,

    // Miller Column Navigation State
    selectedDataSourceId: null,
    selectedVariableSetId: null,
    selectedVariableId: null,

    // Faceted Search State
    facetFilters: { types: [], statuses: [], qualities: [] },

    // Actions
    setAppMode: (mode) => set({ appMode: mode }),

    toggleAppMode: () => set((state) => ({
        appMode: state.appMode === 'analysis' ? 'variables' : 'analysis',
        // Clear bulk selection when leaving Variable Manager (used for multi-select operations)
        selectedVariableSetIds: state.appMode === 'variables' ? [] : state.selectedVariableSetIds,
        // PRESERVE Miller column navigation state for bi-directional focus
        // selectedVariableSetId persists across mode switches to enable:
        // - Analysis → Variable Manager: opens with selected variable focused
        // - Variable Manager → Analysis: sidebar highlights selected variable
    })),

    setDraggingId: (id) => set({ draggingId: id }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setViewMode: (mode) => set({ viewMode: mode }),

    openRecodeModal: (variable) => set({ recodeModal: { isOpen: true, variable } }),
    closeRecodeModal: () => set({ recodeModal: { isOpen: false, variable: null } }),

    openFilterModal: () => set({ filterModal: { isOpen: true } }),
    closeFilterModal: () => set({ filterModal: { isOpen: false } }),

    toggleVariableSetSelection: (id, multi = false) => set((state) => {
        const isSelected = state.selectedVariableSetIds.includes(id);
        if (multi) {
            // Cmd/Ctrl+click: toggle individual item
            return {
                selectedVariableSetIds: isSelected
                    ? state.selectedVariableSetIds.filter(i => i !== id)
                    : [...state.selectedVariableSetIds, id],
                lastSelectedId: id,
            };
        } else {
            // Single click: replace selection
            return {
                selectedVariableSetIds: isSelected ? [] : [id],
                lastSelectedId: id,
            };
        }
    }),

    selectVariableSetRange: (id, allIds) => set((state) => {
        if (!state.lastSelectedId) {
            return { selectedVariableSetIds: [id], lastSelectedId: id };
        }
        const startIdx = allIds.indexOf(state.lastSelectedId);
        const endIdx = allIds.indexOf(id);
        if (startIdx === -1 || endIdx === -1) {
            return { selectedVariableSetIds: [id], lastSelectedId: id };
        }
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = allIds.slice(from, to + 1);
        // Merge with existing selection
        const newSelection = [...new Set([...state.selectedVariableSetIds, ...rangeIds])];
        return { selectedVariableSetIds: newSelection };
    }),

    selectAllVariableSets: (ids) => set({ selectedVariableSetIds: ids }),
    clearSelection: () => set({ selectedVariableSetIds: [], lastSelectedId: null }),
    setActiveFolderId: (folderId) => set({
        activeFolderId: folderId,
        // Cascade: clear variable set and variable selection when folder changes
        selectedVariableSetId: null,
        selectedVariableId: null,
    }),

    // Miller Column Navigation Actions
    setSelectedDataSourceId: (id) => set({
        selectedDataSourceId: id,
        // Cascade: clear folder, variable set, and variable selection
        activeFolderId: null,
        selectedVariableSetId: null,
        selectedVariableId: null,
    }),

    setSelectedVariableSetId: (id) => set({
        selectedVariableSetId: id,
        // Cascade: clear variable selection when variable set changes
        selectedVariableId: null,
    }),

    setSelectedVariableId: (id) => set({ selectedVariableId: id }),

    // Faceted Search Actions
    setFacetFilters: (filters) => set((state) => ({
        facetFilters: { ...state.facetFilters, ...filters },
    })),

    clearFacetFilters: () => set({
        facetFilters: { types: [], statuses: [], qualities: [] },
    }),
});
