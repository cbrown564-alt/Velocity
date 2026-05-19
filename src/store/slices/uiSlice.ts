/**
 * UI Slice
 * 
 * Manages UI state: dragging, search, view mode, modals, and app mode.
 * Includes the new appMode for Hub-and-Spoke architecture.
 */

import type { StateCreator } from 'zustand';
import type { VariableType } from './dataSlice';
import type { Variable } from './dataSlice';
import type { ExportConfig } from '../../core/export/types';

// ============================================================================
// Types
// ============================================================================

export type AppMode = 'analysis' | 'variables';

export type TypeFacet = VariableType;
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

export interface AnalysisExportModalState {
    isOpen: boolean;
    config: ExportConfig | null;
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

// ============================================================================
// Slice State & Actions
// ============================================================================

export interface WaveDetectionBannerState {
    isVisible: boolean;
    matchedDatasetId: string | null;
    matchedDatasetName: string;
    confidence: number;
    reason: string;
}

export interface UISlice {
    // State
    appMode: AppMode;
    draggingId: string | null;
    searchQuery: string;
    recodeModal: RecodeModalState;
    filterModal: FilterModalState;
    analysisExportModal: AnalysisExportModalState;
    /** Wave detection banner shown after SAV import */
    waveDetectionBanner: WaveDetectionBannerState;
    /** Selected variable set IDs in Variable Manager (for bulk operations) */
    selectedVariableSetIds: string[];
    /** Last selected ID for shift-click range selection */
    lastSelectedId: string | null;
    /** Active folder filter in Variable Manager (null = all) */
    activeFolderId: string | null;
    /** Focus mode hides chrome for immersive analysis */
    focusMode: boolean;
    /** Toast notification queue */
    toasts: Toast[];
    /** Command palette open state */
    commandPaletteOpen: boolean;
    /** Keyboard shortcut reference open state */
    shortcutsOpen: boolean;

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
    openRecodeModal: (variable: Variable) => void;
    closeRecodeModal: () => void;
    openFilterModal: () => void;
    closeFilterModal: () => void;
    openAnalysisExportModal: (config: ExportConfig) => void;
    closeAnalysisExportModal: () => void;
    /** Toggle selection of a variable set (multi = Cmd/Ctrl held) */
    toggleVariableSetSelection: (id: string, multi?: boolean) => void;
    /** Select a range from lastSelectedId to id (for Shift+click) */
    selectVariableSetRange: (id: string, allIds: string[]) => void;
    /** Select a single variable set exclusively (resetting others) */
    selectSingleVariableSet: (id: string) => void;
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

    // Wave Detection Banner
    showWaveDetectionBanner: (state: Omit<WaveDetectionBannerState, 'isVisible'>) => void;
    dismissWaveDetectionBanner: () => void;

    // Focus Mode
    setFocusMode: (enabled: boolean) => void;
    toggleFocusMode: () => void;

    // Toast Layer
    addToast: (toast: Omit<Toast, 'id'>) => void;
    dismissToast: (id: string) => void;
    clearToasts: () => void;

    // Command Palette
    openCommandPalette: () => void;
    closeCommandPalette: () => void;

    // Shortcuts Reference
    openShortcuts: () => void;
    closeShortcuts: () => void;
}

const DEFAULT_WAVE_BANNER: WaveDetectionBannerState = {
    isVisible: false,
    matchedDatasetId: null,
    matchedDatasetName: '',
    confidence: 0,
    reason: '',
};

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
    // Initial state
    appMode: 'analysis',
    draggingId: null,
    searchQuery: '',
    recodeModal: { isOpen: false, variable: null },
    filterModal: { isOpen: false },
    analysisExportModal: { isOpen: false, config: null },
    waveDetectionBanner: { ...DEFAULT_WAVE_BANNER },
    selectedVariableSetIds: [],
    lastSelectedId: null,
    activeFolderId: null,
    focusMode: false,
    toasts: [],
    commandPaletteOpen: false,
    shortcutsOpen: false,

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

    openRecodeModal: (variable) => set({ recodeModal: { isOpen: true, variable } }),
    closeRecodeModal: () => set({ recodeModal: { isOpen: false, variable: null } }),

    openFilterModal: () => set({ filterModal: { isOpen: true } }),
    closeFilterModal: () => set({ filterModal: { isOpen: false } }),

    openAnalysisExportModal: (config) => set({ analysisExportModal: { isOpen: true, config } }),
    closeAnalysisExportModal: () => set({ analysisExportModal: { isOpen: false, config: null } }),

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

    selectSingleVariableSet: (id) => set({
        selectedVariableSetIds: [id],
        lastSelectedId: id
    }),

    selectAllVariableSets: (ids) => set({ selectedVariableSetIds: ids }),
    clearSelection: () => set({ selectedVariableSetIds: [], lastSelectedId: null }),
    setActiveFolderId: (folderId) => set({
        activeFolderId: folderId,
        // Cascade: clear variable set and variable selection when folder changes
        selectedVariableSetId: null,
        selectedVariableId: null,
        selectedVariableSetIds: [], // Clear bulk selection
        lastSelectedId: null,
    }),

    // Miller Column Navigation Actions
    setSelectedDataSourceId: (id) => set({
        selectedDataSourceId: id,
        // Cascade: clear folder, variable set, and variable selection
        activeFolderId: null,
        selectedVariableSetId: null,
        selectedVariableId: null,
        selectedVariableSetIds: [], // Clear bulk selection
        lastSelectedId: null,
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

    // Wave Detection Banner Actions
    showWaveDetectionBanner: (bannerState) => set({
        waveDetectionBanner: { ...bannerState, isVisible: true },
    }),

    dismissWaveDetectionBanner: () => set({
        waveDetectionBanner: { ...DEFAULT_WAVE_BANNER },
    }),

    // Focus Mode Actions
    setFocusMode: (enabled) => set({ focusMode: enabled }),
    toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

    // Toast Actions
    addToast: (toast) => set((state) => ({
        toasts: [...state.toasts, { ...toast, id: crypto.randomUUID(), duration: toast.duration ?? 4000 }],
    })),
    dismissToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
    })),
    clearToasts: () => set({ toasts: [] }),

    // Command Palette Actions
    openCommandPalette: () => set({ commandPaletteOpen: true }),
    closeCommandPalette: () => set({ commandPaletteOpen: false }),

    // Shortcuts Reference Actions
    openShortcuts: () => set({ shortcutsOpen: true }),
    closeShortcuts: () => set({ shortcutsOpen: false }),
});
