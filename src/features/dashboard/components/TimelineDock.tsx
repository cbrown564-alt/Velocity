/**
 * TimelineDock Component
 *
 * An inline film-strip rail for navigating between slides in the analysis deck.
 * Sits as a fixed footer below the analysis content — never floats or overlaps.
 *
 * Features:
 * - Compact slide capsules with number + icon
 * - Drag-to-reorder via dnd-kit
 * - Section dividers
 * - Keyboard navigation (←/→, N for new)
 * - Theme-aware styling (Mission Control, Soft Machine, Liquid Glass)
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../../lib/motion';
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
import { Plus, BarChart3, Table2, Copy, Trash2 } from 'lucide-react';
import { useVelocityStore } from '../../../store';
import { resolveSlideTitle } from '../../../core/export/resolveSlideDefaults';
import { Slide, SlideSection, SlideAnalysisState } from '../../../types/slides';
import { ConfirmModal } from '../../../components/overlays/ConfirmModal';

// ============================================================================
// Helper: Compare analysis states for unsaved detection
// ============================================================================

function isAnalysisStateEqual(
    current: SlideAnalysisState,
    saved: SlideAnalysisState
): boolean {
    if (current.rowVars.length !== saved.rowVars.length) return false;
    if (!current.rowVars.every((v, i) => v === saved.rowVars[i])) return false;
    if (current.colVar !== saved.colVar) return false;
    if (current.weightVar !== saved.weightVar) return false;
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
// SlideThumb - Compact sortable slide capsule
// ============================================================================

interface SlideThumbProps {
    slide: Slide;
    index: number;
    isActive: boolean;
    hasUnsavedChanges?: boolean;
    canDelete: boolean;
    section?: SlideSection;
    variableSets?: Array<{ id: string; name: string }>;
    currentTableConfig?: { rowVars: string[]; colVar: string | null };
    onClick: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

export function getSlideDisplayLabel(
    slide: Slide,
    variableSets: Array<{ id: string; name: string }> = [],
    currentTableConfig?: { rowVars: string[]; colVar: string | null }
): string {
    const hasCustomTitle = Boolean(slide.title && slide.title !== 'New Slide');
    if (hasCustomTitle) {
        return slide.title;
    }

    const sourceState = currentTableConfig ?? slide.analysisState;
    const { rowVars, colVar } = sourceState;
    const rowVariables = rowVars.map((id) => {
        const variableSet = variableSets.find((value) => value.id === id);
        return {
            id,
            name: variableSet?.name || id,
            label: variableSet?.name || id,
        };
    });
    const columnVariable = colVar
        ? (() => {
            const variableSet = variableSets.find((value) => value.id === colVar);
            return {
                id: colVar,
                name: variableSet?.name || colVar,
                label: variableSet?.name || colVar,
            };
        })()
        : null;

    return resolveSlideTitle(rowVariables, columnVariable);
}

const SlideThumb: React.FC<SlideThumbProps> = ({ slide, index, isActive, hasUnsavedChanges, canDelete, section, variableSets = [], currentTableConfig, onClick, onDuplicate, onDelete }) => {
    const reducedMotion = useReducedMotion();
    const [contextMenuOpen, setContextMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

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

    const firstCellType = slide.cells[0]?.content.type;
    const Icon = firstCellType === 'chart' ? BarChart3 : Table2;

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuPosition({ x: e.clientX, y: e.clientY });
        setContextMenuOpen(true);
    };

    useEffect(() => {
        if (!contextMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setContextMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [contextMenuOpen]);

    // Generate a short desc based on data state
    const displayLabel = useMemo(() => {
        return getSlideDisplayLabel(slide, variableSets, currentTableConfig);
    }, [slide, variableSets, currentTableConfig]);

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`relative group ${isDragging ? 'z-50' : ''}`}
            >
                <motion.button
                    onClick={onClick}
                    onContextMenu={handleContextMenu}
                    whileHover={reducedMotion ? undefined : { y: -1 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                    transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
                    className={`
                        relative flex items-center gap-1.5
                        h-7 px-2.5 rounded-md
                        text-[11px] font-medium
                        transition-all duration-150
                        cursor-pointer select-none
                        border
                        ${isActive
                            ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/25 text-[var(--color-accent)]'
                            : 'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]'
                        }
                        ${isDragging ? 'opacity-40' : ''}
                    `}
                    style={{
                        fontFamily: 'var(--font-mono, monospace)',
                    }}
                >
                    {/* Section color pip */}
                    {section && (
                        <span
                            className="w-1 h-1 rounded-full shrink-0"
                            style={{ backgroundColor: section.color || 'var(--color-accent)' }}
                        />
                    )}

                    {/* Icon */}
                    <Icon
                        size={12}
                        strokeWidth={isActive ? 2 : 1.5}
                        className="shrink-0"
                    />

                    {/* Number */}
                    <span className="tabular-nums">{index + 1}</span>

                    {/* Truncated auto-title (only show on active or hover) */}
                    <span className={`
                        max-w-[70px] truncate transition-all duration-150
                        ${isActive ? 'opacity-100' : 'max-w-0 opacity-0 group-hover:max-w-[70px] group-hover:opacity-70'}
                    `}
                        style={{ fontFamily: 'var(--font-body, sans-serif)', fontWeight: 400 }}
                    >
                        {displayLabel}
                    </span>

                    {/* Unsaved indicator */}
                    {hasUnsavedChanges && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning-text)] shrink-0" />
                    )}
                </motion.button>

                {/* Tooltip — shows full title on hover for inactive slides */}
                {!isActive && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                        <div
                            className="text-[10px] py-0.5 px-2 rounded shadow-lg"
                            style={{
                                background: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                            }}
                        >
                            {displayLabel}
                        </div>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenuOpen && (
                    <motion.div
                        ref={menuRef}
                        {...getMotionProps({ preset: 'fadeScale', duration: DURATIONS.instant, reducedMotion })}
                        className="fixed z-[100] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[140px]"
                        style={{ left: menuPosition.x, top: menuPosition.y - 80 }}
                    >
                        <button
                            onClick={() => {
                                onDuplicate();
                                setContextMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-colors"
                        >
                            <Copy size={12} />
                            Duplicate
                        </button>
                        <button
                            onClick={() => {
                                onDelete();
                                setContextMenuOpen(false);
                            }}
                            disabled={!canDelete}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${canDelete
                                ? 'text-[var(--color-error)] hover:bg-[var(--status-error-surface)]'
                                : 'text-[var(--text-secondary)] opacity-50 cursor-not-allowed'
                                }`}
                        >
                            <Trash2 size={12} />
                            Delete
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

// ============================================================================
// SectionDivider - Compact vertical tick
// ============================================================================

const SectionDivider: React.FC<{ section: SlideSection }> = ({ section }) => (
    <div className="flex items-center justify-center mx-0.5 group relative self-stretch">
        <div
            className="w-px h-3.5 rounded-full"
            style={{ backgroundColor: section.color || 'var(--border-color)' }}
        />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            <div
                className="text-[9px] py-0.5 px-1.5 rounded shadow-lg uppercase tracking-wider font-medium"
                style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                }}
            >
                {section.title}
            </div>
        </div>
    </div>
);

// ============================================================================
// TimelineDock - Inline film-strip rail
// ============================================================================

export const TimelineDock: React.FC = () => {
    const reducedMotion = useReducedMotion();
    const slides = useVelocityStore((state) => state.slides);
    const sections = useVelocityStore((state) => state.sections);
    const activeSlideId = useVelocityStore((state) => state.activeSlideId);
    const setActiveSlide = useVelocityStore((state) => state.setActiveSlide);
    const addSlide = useVelocityStore((state) => state.addSlide);
    const duplicateSlide = useVelocityStore((state) => state.duplicateSlide);
    const removeSlide = useVelocityStore((state) => state.removeSlide);
    const reorderSlides = useVelocityStore((state) => state.reorderSlides);
    const navigateSlide = useVelocityStore((state) => state.navigateSlide);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [slideToDelete, setSlideToDelete] = useState<string | null>(null);

    const tableConfig = useVelocityStore((state) => state.tableConfig);
    const activeFilters = useVelocityStore((state) => state.activeFilters);
    const dataset = useVelocityStore((state) => state.dataset);
    const variableSets = useVelocityStore((state) => state.variableSets);

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

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = slides.findIndex((s) => s.id === active.id);
            const newIndex = slides.findIndex((s) => s.id === over.id);
            reorderSlides(oldIndex, newIndex);
        }
    }, [slides, reorderSlides]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            switch (e.key) {
                case 'ArrowLeft': e.preventDefault(); navigateSlide('prev'); break;
                case 'ArrowRight': e.preventDefault(); navigateSlide('next'); break;
                case 'n': case 'N': if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); addSlide(); } break;
                case 'd': case 'D': if (!e.metaKey && !e.ctrlKey && activeSlideId) { e.preventDefault(); duplicateSlide(activeSlideId); } break;
                case 'Delete': case 'Backspace': if (!e.metaKey && !e.ctrlKey && activeSlideId && slides.length > 1) { e.preventDefault(); setSlideToDelete(activeSlideId); setDeleteModalOpen(true); } break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [navigateSlide, addSlide, duplicateSlide, activeSlideId, slides.length]);

    const itemsWithDividers = useMemo(() => {
        const result: Array<{ type: 'slide' | 'divider'; slide?: Slide; section?: SlideSection; index?: number }> = [];
        let lastSectionId: string | undefined = undefined;

        slides.forEach((slide, index) => {
            if (slide.sectionId && slide.sectionId !== lastSectionId) {
                const section = sections.find(s => s.id === slide.sectionId);
                if (section) result.push({ type: 'divider', section });
            }
            lastSectionId = slide.sectionId;
            const section = sections.find(s => s.id === slide.sectionId);
            result.push({ type: 'slide', slide, section, index });
        });

        return result;
    }, [slides, sections]);

    const activeIndex = slides.findIndex(s => s.id === activeSlideId);

    if (slides.length === 0) return null;

    return (
        <>
            {/* Film-strip rail — sits in document flow as flex child */}
            <div
                className="shrink-0 border-t border-[var(--border-color)] shadow-[0_-4px_20px_rgba(0,0,0,0.02)]"
                style={{ background: 'var(--bg-panel)' }}
            >
                <div className="flex items-center h-14 px-4 gap-3 max-w-[1400px] mx-auto">
                    {/* Slide counter label */}
                    <span
                        className="text-xs font-semibold uppercase tracking-wider shrink-0 select-none bg-[var(--bg-active)] px-2 py-1 rounded"
                        style={{
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono, monospace)',
                        }}
                    >
                        {activeIndex + 1} / {slides.length}
                    </span>

                    {/* Slide capsules */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none py-1">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={slides.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                                {itemsWithDividers.map((item, i) => {
                                    if (item.type === 'divider' && item.section) {
                                        return <SectionDivider key={`divider-${item.section.id}`} section={item.section} />;
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
                                                canDelete={slides.length > 1}
                                                section={item.section}
                                                variableSets={variableSets}
                                                currentTableConfig={isActive
                                                    ? {
                                                        rowVars: tableConfig?.rowVars ?? [],
                                                        colVar: tableConfig?.colVar ?? null,
                                                    }
                                                    : undefined}
                                                onClick={() => setActiveSlide(item.slide!.id)}
                                                onDuplicate={() => duplicateSlide(item.slide!.id)}
                                                onDelete={() => { setSlideToDelete(item.slide!.id); setDeleteModalOpen(true); }}
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </SortableContext>
                        </DndContext>
                    </div>

                    {/* Add slide button */}
                    <div className="pl-2 border-l border-[var(--border-color)] shrink-0">
                        <button
                            onClick={() => addSlide()}
                            className="
                              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                              bg-[var(--color-accent)] text-[var(--text-inverse)] shadow-sm hover:shadow 
                              transition-all duration-150 hover:bg-opacity-90 active:scale-95
                          "
                            title="New Slide (N)"
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            <span className="hidden sm:inline">New Slide</span>
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setSlideToDelete(null); }}
                onConfirm={() => { if (slideToDelete) removeSlide(slideToDelete); }}
                title="Delete Slide"
                message="Are you sure you want to delete this slide? This action cannot be undone."
                confirmLabel="Delete"
                variant="danger"
            />
        </>
    );
};

export default TimelineDock;
