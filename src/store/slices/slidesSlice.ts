import { StateCreator } from 'zustand';
import { Slide, SlideCell, LayoutMode, SlideSection, SlideAnalysisState } from '../../types/slides';
import { ChartType } from '../../types/charts';
import type { AnalysisSlice } from './analysisSlice';
import type { UISlice } from './uiSlice';
import type { DataSlice } from './dataSlice';

// ============================================================================
// Slice Interface
// ============================================================================

export interface SlidesSlice {
    slides: Slide[];
    sections: SlideSection[];
    activeSlideId: string | null;
    activeCellId: string | null;

    // Navigation Actions
    addSlide: (title?: string, sectionId?: string) => void;
    removeSlide: (slideId: string) => void;
    setActiveSlide: (id: string) => void;
    setSlideLayoutMode: (slideId: string, mode: LayoutMode) => void;
    updateSlideTitle: (slideId: string, title: string) => void;
    updateSlideSubtitle: (slideId: string, subtitle: string) => void;
    reorderSlides: (fromIndex: number, toIndex: number) => void;
    navigateSlide: (direction: 'prev' | 'next') => void;

    // Section Actions
    addSection: (title: string) => void;
    removeSection: (sectionId: string) => void;
    updateSectionTitle: (sectionId: string, title: string) => void;
    assignSlideToSection: (slideId: string, sectionId: string | null) => void;

    // Cell Actions
    addCell: (slideId: string, type?: SlideCell['content']['type']) => void;
    removeCell: (slideId: string, cellId: string) => void;
    updateCellContent: (slideId: string, cellId: string, updates: Partial<SlideCell['content']>) => void;
    setActiveCell: (cellId: string | null) => void;

    // Analysis State Actions
    snapshotCurrentSlide: () => void;
    setSlideVisualizationType: (slideId: string, type: 'table' | 'chart', chartType?: ChartType) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a default empty analysis state.
 */
function createDefaultAnalysisState(): SlideAnalysisState {
    return {
        rowVars: [],
        colVar: null,
        filters: [],
        weightVar: null,
    };
}

/**
 * Create a new slide with defaults.
 */
function createNewSlide(
    id: string,
    title: string,
    analysisState: SlideAnalysisState,
    sectionId?: string
): Slide {
    const now = Date.now();
    return {
        id,
        title,
        subtitle: '',
        analysisState,
        visualizationType: 'table',
        layoutMode: 'focus',
        cells: [{ id: `cell-${now}`, content: { type: 'table' } }],
        sectionId,
        createdAt: now,
        updatedAt: now,
    };
}

// ============================================================================
// Slice Creator
// ============================================================================

// This slice needs access to AnalysisSlice, UISlice, and DataSlice for state capture
type SlidesSliceCreator = StateCreator<
    SlidesSlice & Partial<AnalysisSlice> & Partial<UISlice> & Partial<DataSlice>,
    [],
    [],
    SlidesSlice
>;

export const createSlidesSlice: SlidesSliceCreator = (set, get) => ({
    slides: [
        // Default initial slide with full structure
        createNewSlide('slide-1', 'Analysis 1', createDefaultAnalysisState()),
    ],
    sections: [],
    activeSlideId: 'slide-1',
    activeCellId: 'cell-1',

    // ========================================================================
    // Navigation Actions
    // ========================================================================

    addSlide: (title = 'New Analysis', sectionId) => {
        const state = get();
        const now = Date.now();
        const newId = `slide-${now}`;

        // Capture current analysis state
        const analysisState: SlideAnalysisState = {
            rowVars: state.tableConfig?.rowVars ?? [],
            colVar: state.tableConfig?.colVar ?? null,
            filters: state.activeFilters ?? [],
            weightVar: state.dataset?.weightVariable ?? null,
        };

        // Determine visualization from current viewMode
        const visualizationType = state.viewMode === 'chart' ? 'chart' : 'table';
        const chartType = state.selectedChartType ?? undefined;

        const newSlide: Slide = {
            id: newId,
            title,
            subtitle: '',
            analysisState,
            visualizationType,
            chartType,
            layoutMode: 'focus',
            cells: [{
                id: `cell-${now}`,
                content: {
                    type: visualizationType,
                    chartType: visualizationType === 'chart' ? chartType : undefined,
                }
            }],
            sectionId,
            createdAt: now,
            updatedAt: now,
        };

        set({
            slides: [...state.slides, newSlide],
            activeSlideId: newId,
            activeCellId: `cell-${now}`,
        });
    },

    removeSlide: (slideId) => set((state) => {
        const newSlides = state.slides.filter(s => s.id !== slideId);
        // If we removed the active slide, activate the first remaining
        const newActiveId = state.activeSlideId === slideId
            ? (newSlides[0]?.id ?? null)
            : state.activeSlideId;
        return {
            slides: newSlides,
            activeSlideId: newActiveId,
            activeCellId: newSlides.find(s => s.id === newActiveId)?.cells[0]?.id ?? null
        };
    }),

    setActiveSlide: (id) => {
        const state = get();
        const outgoingSlide = state.slides.find(s => s.id === state.activeSlideId);
        const incomingSlide = state.slides.find(s => s.id === id);

        if (!incomingSlide) return;

        const now = Date.now();

        // Snapshot current analysis state to outgoing slide
        const currentAnalysisState: SlideAnalysisState = {
            rowVars: state.tableConfig?.rowVars ?? [],
            colVar: state.tableConfig?.colVar ?? null,
            filters: state.activeFilters ?? [],
            weightVar: state.dataset?.weightVariable ?? null,
        };
        const currentVisualizationType = state.viewMode === 'chart' ? 'chart' : 'table';
        const currentChartType = state.selectedChartType ?? undefined;

        // Update slides with snapshotted outgoing and activate incoming
        set({
            slides: state.slides.map(s => {
                if (s.id === state.activeSlideId && outgoingSlide) {
                    return {
                        ...s,
                        analysisState: currentAnalysisState,
                        visualizationType: currentVisualizationType as 'table' | 'chart',
                        chartType: currentChartType,
                        updatedAt: now,
                    };
                }
                return s;
            }),
            activeSlideId: id,
            activeCellId: incomingSlide.cells[0]?.id ?? null,
        });

        // Restore incoming slide's state via AnalysisSlice and UISlice actions
        // Note: These actions are available since we're in combined store
        const restored = state.slides.find(s => s.id === id);
        if (restored && state.setTableConfig && state.setViewMode) {
            // Restore table config
            state.setTableConfig({
                rowVars: restored.analysisState.rowVars,
                colVar: restored.analysisState.colVar,
            });

            // Restore view mode
            state.setViewMode(restored.visualizationType);

            // Restore chart type if applicable
            if (restored.visualizationType === 'chart' && restored.chartType && state.setSelectedChartType) {
                state.setSelectedChartType(restored.chartType);
            }

            // Filters need separate handling - clear and re-add
            if (state.clearFilters && state.addFilter) {
                state.clearFilters();
                restored.analysisState.filters.forEach(f => {
                    state.addFilter!({
                        variableId: f.variableId,
                        operator: f.operator,
                        value: f.value,
                    });
                });
            }

            // Trigger analysis re-run
            if (state.runAnalysis) {
                state.runAnalysis();
            }
        }
    },

    setSlideLayoutMode: (slideId, mode) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId ? { ...s, layoutMode: mode, updatedAt: Date.now() } : s
        )
    })),

    updateSlideTitle: (slideId, title) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId ? { ...s, title, updatedAt: Date.now() } : s
        )
    })),

    updateSlideSubtitle: (slideId, subtitle) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId ? { ...s, subtitle, updatedAt: Date.now() } : s
        )
    })),

    reorderSlides: (fromIndex, toIndex) => set((state) => {
        const newSlides = [...state.slides];
        const [removed] = newSlides.splice(fromIndex, 1);
        newSlides.splice(toIndex, 0, removed);
        return { slides: newSlides };
    }),

    navigateSlide: (direction) => {
        const state = get();
        const currentIndex = state.slides.findIndex(s => s.id === state.activeSlideId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'next'
            ? Math.min(currentIndex + 1, state.slides.length - 1)
            : Math.max(currentIndex - 1, 0);

        const newSlide = state.slides[newIndex];
        if (newSlide.id !== state.activeSlideId) {
            // Use setActiveSlide to trigger snapshot/restore
            state.setActiveSlide(newSlide.id);
        }
    },

    // ========================================================================
    // Section Actions
    // ========================================================================

    addSection: (title) => set((state) => ({
        sections: [...state.sections, {
            id: `section-${Date.now()}`,
            title
        }]
    })),

    removeSection: (sectionId) => set((state) => ({
        sections: state.sections.filter(s => s.id !== sectionId),
        // Unassign slides from this section
        slides: state.slides.map(s =>
            s.sectionId === sectionId ? { ...s, sectionId: undefined } : s
        )
    })),

    updateSectionTitle: (sectionId, title) => set((state) => ({
        sections: state.sections.map(s =>
            s.id === sectionId ? { ...s, title } : s
        )
    })),

    assignSlideToSection: (slideId, sectionId) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId ? { ...s, sectionId: sectionId ?? undefined, updatedAt: Date.now() } : s
        )
    })),

    // ========================================================================
    // Cell Actions
    // ========================================================================

    addCell: (slideId, type = 'chart') => set((state) => ({
        slides: state.slides.map(s => {
            if (s.id !== slideId) return s;
            const newCellId = `cell-${Date.now()}`;
            return {
                ...s,
                cells: [...s.cells, {
                    id: newCellId,
                    content: { type }
                }],
                updatedAt: Date.now(),
            };
        })
    })),

    removeCell: (slideId, cellId) => set((state) => ({
        slides: state.slides.map(s => {
            if (s.id !== slideId) return s;
            return {
                ...s,
                cells: s.cells.filter(c => c.id !== cellId),
                updatedAt: Date.now(),
            };
        })
    })),

    updateCellContent: (slideId, cellId, updates) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId
                ? {
                    ...s,
                    cells: s.cells.map(c =>
                        c.id === cellId
                            ? { ...c, content: { ...c.content, ...updates } }
                            : c
                    ),
                    updatedAt: Date.now(),
                }
                : s
        )
    })),

    setActiveCell: (cellId) => set({ activeCellId: cellId }),

    // ========================================================================
    // Analysis State Actions
    // ========================================================================

    snapshotCurrentSlide: () => {
        const state = get();
        if (!state.activeSlideId) return;

        const now = Date.now();
        const analysisState: SlideAnalysisState = {
            rowVars: state.tableConfig?.rowVars ?? [],
            colVar: state.tableConfig?.colVar ?? null,
            filters: state.activeFilters ?? [],
            weightVar: state.dataset?.weightVariable ?? null,
        };
        const visualizationType = state.viewMode === 'chart' ? 'chart' : 'table';
        const chartType = state.selectedChartType ?? undefined;

        set({
            slides: state.slides.map(s =>
                s.id === state.activeSlideId
                    ? {
                        ...s,
                        analysisState,
                        visualizationType: visualizationType as 'table' | 'chart',
                        chartType,
                        updatedAt: now,
                    }
                    : s
            ),
        });
    },

    setSlideVisualizationType: (slideId, type, chartType) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId
                ? { ...s, visualizationType: type, chartType, updatedAt: Date.now() }
                : s
        )
    })),
});
