import { StateCreator } from 'zustand';
import { Slide, SlideCell, LayoutMode, SlideSection } from '../../types/slides';
import { ChartType } from '../../types/charts';

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
    sections: [],
    activeSlideId: 'slide-1',
    activeCellId: 'cell-1',

    addSlide: (title = 'New Analysis', sectionId) => set((state) => {
        const newId = `slide-${Date.now()}`;
        const newCellId = `cell-${Date.now()}`;
        const newSlide: Slide = {
            id: newId,
            title,
            layoutMode: 'focus',
            cells: [{ id: newCellId, content: { type: 'table' } }],
            sectionId
        };
        return {
            slides: [...state.slides, newSlide],
            activeSlideId: newId,
            activeCellId: newCellId
        };
    }),

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

    setActiveSlide: (id) => set((state) => {
        const slide = state.slides.find(s => s.id === id);
        return {
            activeSlideId: id,
            activeCellId: slide?.cells[0]?.id ?? null
        };
    }),

    setSlideLayoutMode: (slideId, mode) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId ? { ...s, layoutMode: mode } : s
        )
    })),

    updateSlideTitle: (slideId, title) => set((state) => ({
        slides: state.slides.map(s =>
            s.id === slideId ? { ...s, title } : s
        )
    })),

    reorderSlides: (fromIndex, toIndex) => set((state) => {
        const newSlides = [...state.slides];
        const [removed] = newSlides.splice(fromIndex, 1);
        newSlides.splice(toIndex, 0, removed);
        return { slides: newSlides };
    }),

    navigateSlide: (direction) => set((state) => {
        const currentIndex = state.slides.findIndex(s => s.id === state.activeSlideId);
        if (currentIndex === -1) return state;

        const newIndex = direction === 'next'
            ? Math.min(currentIndex + 1, state.slides.length - 1)
            : Math.max(currentIndex - 1, 0);

        const newSlide = state.slides[newIndex];
        return {
            activeSlideId: newSlide.id,
            activeCellId: newSlide.cells[0]?.id ?? null
        };
    }),

    // Section Actions
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
            s.id === slideId ? { ...s, sectionId: sectionId ?? undefined } : s
        )
    })),

    // Cell Actions
    addCell: (slideId, type = 'chart') => set((state) => ({
        slides: state.slides.map(s => {
            if (s.id !== slideId) return s;
            const newCellId = `cell-${Date.now()}`;
            return {
                ...s,
                cells: [...s.cells, {
                    id: newCellId,
                    content: { type }
                }]
            };
        })
    })),

    removeCell: (slideId, cellId) => set((state) => ({
        slides: state.slides.map(s => {
            if (s.id !== slideId) return s;
            return {
                ...s,
                cells: s.cells.filter(c => c.id !== cellId)
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
                    )
                }
                : s
        )
    })),

    setActiveCell: (cellId) => set({ activeCellId: cellId }),
});
