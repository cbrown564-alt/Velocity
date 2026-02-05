/**
 * TimelineDock Component
 * 
 * A floating horizontal dock for navigating between slides in the analysis deck.
 * Features:
 * - Slide thumbnails with titles
 * - Drag-to-reorder via dnd-kit
 * - Section dividers
 * - Keyboard navigation (←/→, N for new)
 * - Theme-aware styling (Mission Control, Soft Machine, Liquid Glass)
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ChevronLeft, ChevronRight, BarChart3, Table2 } from 'lucide-react';
import { useVelocityStore } from '../../../store';
import { Slide, SlideSection, SlideAnalysisState } from '../../../types/slides';

// ============================================================================
// Helper: Compare analysis states for unsaved detection
// ============================================================================

function isAnalysisStateEqual(
    current: SlideAnalysisState,
    saved: SlideAnalysisState
): boolean {
    // Compare rowVars arrays
    if (current.rowVars.length !== saved.rowVars.length) return false;
    if (!current.rowVars.every((v, i) => v === saved.rowVars[i])) return false;

    // Compare colVar
    if (current.colVar !== saved.colVar) return false;

    // Compare weightVar
    if (current.weightVar !== saved.weightVar) return false;

    // Compare filters (by variableId, operator, value)
    if (current.filters.length !== saved.filters.length) return false;
    const filtersMatch = current.filters.every((f, i) => {
        const sf = saved.filters[i];
        return f.variableId === sf.variableId &&
            f.operator === sf.operator &&
            JSON.stringify(f.value) === JSON.stringify(sf.value);
    });
    if (!filtersMatch) return false;

    return true;
}

// ============================================================================
// SlideThumb - Individual sortable slide thumbnail
// ============================================================================

interface SlideThumbProps {
    slide: Slide;
    index: number;
    isActive: boolean;
    hasUnsavedChanges?: boolean;
    section?: SlideSection;
    onClick: () => void;
}

const SlideThumb: React.FC<SlideThumbProps> = ({ slide, index, isActive, hasUnsavedChanges, section, onClick }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: slide.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Determine icon based on first cell content
    const firstCellType = slide.cells[0]?.content.type;
    const Icon = firstCellType === 'chart' ? BarChart3 : Table2;

    return (
        <motion.button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className={`
                relative flex flex-col items-center gap-1
                min-w-[72px] p-2
                rounded-lg
                cursor-pointer select-none
                transition-all duration-150
                ${isDragging ? 'opacity-50 z-50' : ''}
                ${isActive
                    ? 'bg-[var(--bg-active)] border-2 border-[var(--color-accent)] shadow-lg'
                    : 'bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-[var(--color-accent)]'
                }
            `}
            title={slide.title}
        >
            {/* Section indicator */}
            {section && (
                <div
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-1 rounded-full"
                    style={{ backgroundColor: section.color || 'var(--color-accent)' }}
                />
            )}

            {/* Thumbnail preview area */}
            <div className={`
                w-14 h-9 rounded
                flex items-center justify-center
                ${isActive ? 'bg-[var(--color-accent)]/10' : 'bg-[var(--bg-app)]'}
            `}>
                <Icon
                    size={18}
                    className={isActive ? 'text-[var(--color-accent)]' : 'text-[var(--text-secondary)]'}
                />
            </div>

            {/* Slide title (truncated) */}
            <span className={`
                text-[10px] font-medium truncate max-w-[64px]
                ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--text-secondary)]'}
            `}>
                {slide.title}
            </span>

            {/* Slide number badge */}
            <div className={`
                absolute -top-1 -right-1 
                w-4 h-4 rounded-full text-[9px] font-bold
                flex items-center justify-center
                ${isActive
                    ? 'bg-[var(--color-accent)] text-[var(--text-inverse)]'
                    : 'bg-[var(--border-color)] text-[var(--text-secondary)]'
                }
            `}>
                {index + 1}
            </div>

            {/* Unsaved changes indicator */}
            {hasUnsavedChanges && (
                <div
                    className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                    title="Unsaved changes"
                />
            )}

            {/* Active glow effect (theme-specific) */}
            {isActive && (
                <div className="absolute inset-0 rounded-lg pointer-events-none timeline-active-glow" />
            )}
        </motion.button>
    );
};

// ============================================================================
// SectionDivider - Visual separator between slide sections
// ============================================================================

interface SectionDividerProps {
    section: SlideSection;
}

const SectionDivider: React.FC<SectionDividerProps> = ({ section }) => (
    <div className="flex flex-col items-center justify-center px-2 py-1">
        <div
            className="w-[2px] h-8 rounded-full"
            style={{ backgroundColor: section.color || 'var(--border-color)' }}
        />
        <span className="text-[8px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mt-1 writing-mode-vertical">
            {section.title}
        </span>
    </div>
);

// ============================================================================
// TimelineDock - Main component
// ============================================================================

export const TimelineDock: React.FC = () => {
    const slides = useVelocityStore((state) => state.slides);
    const sections = useVelocityStore((state) => state.sections);
    const activeSlideId = useVelocityStore((state) => state.activeSlideId);
    const setActiveSlide = useVelocityStore((state) => state.setActiveSlide);
    const addSlide = useVelocityStore((state) => state.addSlide);
    const reorderSlides = useVelocityStore((state) => state.reorderSlides);
    const navigateSlide = useVelocityStore((state) => state.navigateSlide);

    // State for unsaved changes detection
    const tableConfig = useVelocityStore((state) => state.tableConfig);
    const activeFilters = useVelocityStore((state) => state.activeFilters);
    const dataset = useVelocityStore((state) => state.dataset);

    // Compute if active slide has unsaved changes
    const activeSlideHasUnsavedChanges = useMemo(() => {
        const activeSlide = slides.find(s => s.id === activeSlideId);
        if (!activeSlide) return false;

        const currentState: SlideAnalysisState = {
            rowVars: tableConfig?.rowVars ?? [],
            colVar: tableConfig?.colVar ?? null,
            filters: activeFilters ?? [],
            weightVar: dataset?.weightVariable ?? null,
        };

        return !isAnalysisStateEqual(currentState, activeSlide.analysisState);
    }, [slides, activeSlideId, tableConfig, activeFilters, dataset]);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Handle drag end for reordering
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = slides.findIndex((s) => s.id === active.id);
            const newIndex = slides.findIndex((s) => s.id === over.id);
            reorderSlides(oldIndex, newIndex);
        }
    }, [slides, reorderSlides]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    navigateSlide('prev');
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    navigateSlide('next');
                    break;
                case 'n':
                case 'N':
                    if (!e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        addSlide();
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [navigateSlide, addSlide]);

    // Build slide list with section dividers
    const itemsWithDividers = useMemo(() => {
        const result: Array<{ type: 'slide' | 'divider'; slide?: Slide; section?: SlideSection; index?: number }> = [];
        let lastSectionId: string | undefined = undefined;

        slides.forEach((slide, index) => {
            // Check if we're entering a new section
            if (slide.sectionId && slide.sectionId !== lastSectionId) {
                const section = sections.find(s => s.id === slide.sectionId);
                if (section) {
                    result.push({ type: 'divider', section });
                }
            }
            lastSectionId = slide.sectionId;

            const section = sections.find(s => s.id === slide.sectionId);
            result.push({ type: 'slide', slide, section, index });
        });

        return result;
    }, [slides, sections]);

    // Don't render if no dataset loaded (no slides to show meaningfully)
    if (slides.length === 0) return null;

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="timeline-dock"
        >
            {/* Navigation: Previous */}
            <button
                onClick={() => navigateSlide('prev')}
                disabled={slides.findIndex(s => s.id === activeSlideId) === 0}
                className="timeline-nav-btn"
                title="Previous slide (←)"
            >
                <ChevronLeft size={16} />
            </button>

            {/* Slides container with DnD */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={slides.map(s => s.id)}
                    strategy={horizontalListSortingStrategy}
                >
                    <div className="flex items-center gap-2 px-2 overflow-x-auto max-w-[calc(100vw-300px)] scrollbar-none">
                        <AnimatePresence>
                            {itemsWithDividers.map((item, i) => {
                                if (item.type === 'divider' && item.section) {
                                    return (
                                        <SectionDivider
                                            key={`divider-${item.section.id}`}
                                            section={item.section}
                                        />
                                    );
                                }
                                if (item.type === 'slide' && item.slide) {
                                    const isActive = item.slide.id === activeSlideId;
                                    return (
                                        <SlideThumb
                                            key={item.slide.id}
                                            slide={item.slide}
                                            index={item.index!}
                                            isActive={isActive}
                                            hasUnsavedChanges={isActive && activeSlideHasUnsavedChanges}
                                            section={item.section}
                                            onClick={() => setActiveSlide(item.slide!.id)}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </AnimatePresence>
                    </div>
                </SortableContext>
            </DndContext>

            {/* Navigation: Next */}
            <button
                onClick={() => navigateSlide('next')}
                disabled={slides.findIndex(s => s.id === activeSlideId) === slides.length - 1}
                className="timeline-nav-btn"
                title="Next slide (→)"
            >
                <ChevronRight size={16} />
            </button>

            {/* Add slide button */}
            <button
                onClick={() => addSlide()}
                className="timeline-add-btn"
                title="New slide (N)"
            >
                <Plus size={16} />
            </button>
        </motion.div>
    );
};

export default TimelineDock;
