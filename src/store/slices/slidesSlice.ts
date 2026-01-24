import { StateCreator } from 'zustand';
import { Slide, SlideCell, LayoutMode } from '../../types/slides';
import { ChartType } from '../../types/charts';

export interface SlidesSlice {
    slides: Slide[];
    activeSlideId: string | null;
    activeCellId: string | null;

    // Actions
    addSlide: (title?: string) => void;
    setActiveSlide: (id: string) => void;
    setSlideLayoutMode: (slideId: string, mode: LayoutMode) => void;

    // Cell Actions
    addCell: (slideId: string, type?: SlideCell['content']['type']) => void;
    updateCellContent: (slideId: string, cellId: string, updates: Partial<SlideCell['content']>) => void;
    setActiveCell: (cellId: string | null) => void;
}

export const createSlidesSlice: StateCreator<SlidesSlice, [], [], SlidesSlice> = (set, get) => ({
    slides: [
        // Default initial slide
        {
            id: 'slide-1',
            title: 'Analysis 1',
            layoutMode: 'focus',
            cells: [
                {
                    id: 'cell-1',
                    content: { type: 'table' } // Default to table view
                }
            ]
        }
    ],
    activeSlideId: 'slide-1',
    activeCellId: 'cell-1',

    addSlide: (title = 'New Analysis') => set((state) => {
        const newId = `slide-${Date.now()}`;
        const newCellId = `cell-${Date.now()}`;
        const newSlide: Slide = {
            id: newId,
            title,
            layoutMode: 'focus',
            cells: [{ id: newCellId, content: { type: 'table' } }]
        };
        return {
            slides: [...state.slides, newSlide],
            activeSlideId: newId,
            activeCellId: newCellId
        };
    }),

    setActiveSlide: (id) => set({ activeSlideId: id }),

    setSlideLayoutMode: (slideId, mode) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId ? { ...s, layoutMode: mode } : s
        )
    })),

    addCell: (slideId, type = 'chart') => set((state) => {
        // Logic to add a cell would need to handle layout positioning for Grid mode
        // For Focus mode, we typically only have one cell, so this might replace it or warn
        return state; // Placeholder for now
    }),

    updateCellContent: (slideId, cellId, updates) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId
                ? {
                    ...s,
                    cells: s.cells.map(c =>
                        c.id === cellId
                            ? { ...c, content: { ...c.content, ...updates } }
                            : c
                    )
                }
                : s
        )
    })),

    setActiveCell: (cellId) => set({ activeCellId: cellId }),
});
