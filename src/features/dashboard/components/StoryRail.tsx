/**
 * StoryRail — the deck outline as the left rail (north-star screen 1).
 *
 * The deck's narrative structure is the primary navigation: numbered slide
 * rows with title + recipe summary, reorder by drag or ⌘↑/⌘↓, inline rename,
 * quiet persistence footer. Replaces the variable sidebar and TimelineDock.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, Trash2 } from 'lucide-react';
import { useVelocityStore } from '../../../store';
import { registerShortcut } from '../../../lib/keyboardShortcuts/registry';
import { resolveSlideTitle } from '../../../core/export/resolveSlideDefaults';
import { Slide, SlideAnalysisState } from '../../../types/slides';
import { ConfirmModal } from '../../../components/overlays/ConfirmModal';
import { PersistenceStatus } from './PersistenceStatus';
import type { PersistenceManagerState } from '../../../hooks/usePersistenceManager';

function isAnalysisStateEqual(current: SlideAnalysisState, saved: SlideAnalysisState): boolean {
  if (current.rowVars.length !== saved.rowVars.length) return false;
  if (!current.rowVars.every((v, i) => v === saved.rowVars[i])) return false;
  if (current.colVar !== saved.colVar) return false;
  if (current.weightVar !== saved.weightVar) return false;
  if (current.filters.length !== saved.filters.length) return false;
  return current.filters.every((f, i) => {
    const sf = saved.filters[i];
    return (
      f.variableId === sf.variableId &&
      f.operator === sf.operator &&
      JSON.stringify(f.value) === JSON.stringify(sf.value)
    );
  });
}

interface NamedSet {
  id: string;
  name: string;
}

function getSlideDisplayLabel(
  slide: Slide,
  variableSets: NamedSet[],
  currentTableConfig?: { rowVars: string[]; colVar: string | null },
): string {
  const hasCustomTitle = Boolean(slide.title && slide.title !== 'New Slide');
  if (hasCustomTitle) return slide.title;

  const sourceState = currentTableConfig ?? slide.analysisState;
  const rowVariables = sourceState.rowVars.map((id) => {
    const set = variableSets.find((v) => v.id === id);
    return { id, name: set?.name || id, label: set?.name || id };
  });
  const columnVariable = sourceState.colVar
    ? (() => {
        const set = variableSets.find((v) => v.id === sourceState.colVar);
        return { id: sourceState.colVar!, name: set?.name || sourceState.colVar!, label: set?.name || sourceState.colVar! };
      })()
    : null;

  return resolveSlideTitle(rowVariables, columnVariable);
}

/** Recipe summary line, e.g. "Q5 × SEG" */
function getRecipeSummary(
  slide: Slide,
  variableSets: NamedSet[],
  currentTableConfig?: { rowVars: string[]; colVar: string | null },
): string | null {
  const source = currentTableConfig ?? slide.analysisState;
  if (source.rowVars.length === 0) return null;
  const name = (id: string) => variableSets.find((v) => v.id === id)?.name || id;
  const rows = source.rowVars.map(name).join(' + ');
  return source.colVar ? `${rows} × ${name(source.colVar)}` : rows;
}

interface SlideRowProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  hasUnsavedChanges: boolean;
  canDelete: boolean;
  variableSets: NamedSet[];
  currentTableConfig?: { rowVars: string[]; colVar: string | null };
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const SlideRow: React.FC<SlideRowProps> = ({
  slide,
  index,
  isActive,
  hasUnsavedChanges,
  canDelete,
  variableSets,
  currentTableConfig,
  onSelect,
  onDuplicate,
  onDelete,
}) => {
  const updateSlideTitle = useVelocityStore((state) => state.updateSlideTitle);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });

  const displayLabel = useMemo(
    () => getSlideDisplayLabel(slide, variableSets, currentTableConfig),
    [slide, variableSets, currentTableConfig],
  );
  const recipeSummary = useMemo(
    () => getRecipeSummary(slide, variableSets, currentTableConfig),
    [slide, variableSets, currentTableConfig],
  );

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

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  const startRename = () => {
    setRenameValue(slide.title === 'New Slide' ? displayLabel : slide.title);
    setRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed) updateSlideTitle(slide.id, trimmed);
    setRenaming(false);
  };

  return (
    <>
      <li
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        {...listeners}
        data-testid={`story-rail-slide-${index + 1}`}
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startRename();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuPosition({ x: e.clientX, y: e.clientY });
          setContextMenuOpen(true);
        }}
        aria-current={isActive ? 'true' : undefined}
        aria-label={`Slide ${index + 1}: ${displayLabel}`}
        className={`flex gap-2.5 items-baseline px-2.5 py-[7px] rounded-md cursor-default transition-colors ${
          isDragging ? 'opacity-40' : ''
        } ${isActive ? 'bg-[var(--bg-panel)] shadow-[0_0_0_1px_var(--border-color)]' : 'hover:bg-[var(--bg-rail)]'}`}
      >
        <span className="w-3 shrink-0 text-right font-mono text-[11px] text-[var(--text-tertiary)]">{index + 1}</span>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              aria-label="Rename slide"
              className="w-full bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none border-b border-[var(--border-color)]"
            />
          ) : (
            <span
              className={`block text-[12.5px] leading-[1.35] truncate text-[var(--text-primary)] ${isActive ? 'font-medium' : ''}`}
            >
              {displayLabel}
              {hasUnsavedChanges && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] ml-1.5 align-middle"
                  title="Unsaved analysis changes"
                />
              )}
            </span>
          )}
          {recipeSummary && (
            <span className="block text-[11px] text-[var(--text-tertiary)] truncate mt-px">{recipeSummary}</span>
          )}
        </div>
      </li>

      {contextMenuOpen && (
        <div
          ref={menuRef}
          className="fixed z-[var(--z-menu)] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-md shadow-lg py-1 min-w-[150px]"
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          <button
            onClick={() => {
              startRename();
              setContextMenuOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-rail)] transition-colors"
          >
            <span className="flex-1 text-left">Rename</span>
            <kbd className="text-[10px] text-[var(--text-tertiary)] font-mono">↵</kbd>
          </button>
          <button
            onClick={() => {
              onDuplicate();
              setContextMenuOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-rail)] transition-colors"
          >
            <Copy size={12} />
            <span className="flex-1 text-left">Duplicate</span>
            <kbd className="text-[10px] text-[var(--text-tertiary)] font-mono">⌘D</kbd>
          </button>
          <button
            onClick={() => {
              onDelete();
              setContextMenuOpen(false);
            }}
            disabled={!canDelete}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
              canDelete
                ? 'text-[var(--color-error)] hover:bg-[var(--status-error-surface)]'
                : 'text-[var(--text-tertiary)] cursor-not-allowed'
            }`}
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      )}
    </>
  );
};

export interface StoryRailProps {
  persistence: PersistenceManagerState;
  opfsAvailable: boolean;
  persistenceMode: string;
  persistenceError: string | null;
}

export const StoryRail: React.FC<StoryRailProps> = ({
  persistence,
  opfsAvailable,
  persistenceMode,
  persistenceError,
}) => {
  const slides = useVelocityStore((state) => state.slides);
  const activeSlideId = useVelocityStore((state) => state.activeSlideId);
  const setActiveSlide = useVelocityStore((state) => state.setActiveSlide);
  const addSlide = useVelocityStore((state) => state.addSlide);
  const duplicateSlide = useVelocityStore((state) => state.duplicateSlide);
  const removeSlide = useVelocityStore((state) => state.removeSlide);
  const reorderSlides = useVelocityStore((state) => state.reorderSlides);
  const navigateSlide = useVelocityStore((state) => state.navigateSlide);
  const dataset = useVelocityStore((state) => state.dataset);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const activeFilters = useVelocityStore((state) => state.activeFilters);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [slideToDelete, setSlideToDelete] = useState<string | null>(null);

  const deckName = useMemo(() => {
    if (!dataset?.name) return 'Untitled deck';
    return dataset.name.replace(/\.(sav|csv|xlsx)$/i, '');
  }, [dataset?.name]);

  const activeSlideHasUnsavedChanges = useMemo(() => {
    const activeSlide = slides.find((s) => s.id === activeSlideId);
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = slides.findIndex((s) => s.id === active.id);
        const newIndex = slides.findIndex((s) => s.id === over.id);
        reorderSlides(oldIndex, newIndex);
      }
    },
    [slides, reorderSlides],
  );

  useEffect(() => {
    const inCanvas = () => useVelocityStore.getState().appMode !== 'variables';
    const unregister = [
      registerShortcut({
        id: 'canvas-slide-prev',
        contexts: ['canvas'],
        priority: 10,
        match: (event) => event.key === 'ArrowLeft' && !event.metaKey && !event.ctrlKey,
        handler: (event) => {
          if (!inCanvas()) return;
          event.preventDefault();
          navigateSlide('prev');
        },
      }),
      registerShortcut({
        id: 'canvas-slide-next',
        contexts: ['canvas'],
        priority: 11,
        match: (event) => event.key === 'ArrowRight' && !event.metaKey && !event.ctrlKey,
        handler: (event) => {
          if (!inCanvas()) return;
          event.preventDefault();
          navigateSlide('next');
        },
      }),
      registerShortcut({
        id: 'canvas-new-slide',
        contexts: ['canvas'],
        priority: 20,
        match: (event) => (event.key === 'n' || event.key === 'N') && !event.metaKey && !event.ctrlKey,
        handler: (event) => {
          if (!inCanvas()) return;
          event.preventDefault();
          addSlide();
        },
      }),
      registerShortcut({
        id: 'canvas-duplicate-slide',
        contexts: ['canvas'],
        priority: 21,
        match: (event) => (event.key === 'd' || event.key === 'D') && (event.metaKey || event.ctrlKey),
        handler: (event) => {
          if (!inCanvas()) return;
          const slideId = useVelocityStore.getState().activeSlideId;
          if (!slideId) return;
          event.preventDefault();
          duplicateSlide(slideId);
        },
      }),
      registerShortcut({
        id: 'canvas-delete-slide',
        contexts: ['canvas'],
        priority: 22,
        match: (event) => (event.key === 'Delete' || event.key === 'Backspace') && !event.metaKey && !event.ctrlKey,
        handler: (event) => {
          if (!inCanvas()) return;
          const { activeSlideId: slideId, slides: deckSlides } = useVelocityStore.getState();
          if (!slideId || deckSlides.length <= 1) return;
          event.preventDefault();
          setSlideToDelete(slideId);
          setDeleteModalOpen(true);
        },
      }),
      registerShortcut({
        id: 'rail-move-slide-up',
        contexts: ['canvas'],
        priority: 23,
        match: (event) => event.key === 'ArrowUp' && (event.metaKey || event.ctrlKey),
        handler: (event) => {
          if (!inCanvas()) return;
          const { activeSlideId: slideId, slides: deckSlides, reorderSlides: reorder } = useVelocityStore.getState();
          const index = deckSlides.findIndex((s) => s.id === slideId);
          if (index > 0) {
            event.preventDefault();
            reorder(index, index - 1);
          }
        },
      }),
      registerShortcut({
        id: 'rail-move-slide-down',
        contexts: ['canvas'],
        priority: 24,
        match: (event) => event.key === 'ArrowDown' && (event.metaKey || event.ctrlKey),
        handler: (event) => {
          if (!inCanvas()) return;
          const { activeSlideId: slideId, slides: deckSlides, reorderSlides: reorder } = useVelocityStore.getState();
          const index = deckSlides.findIndex((s) => s.id === slideId);
          if (index >= 0 && index < deckSlides.length - 1) {
            event.preventDefault();
            reorder(index, index + 1);
          }
        },
      }),
    ];
    return () => unregister.forEach((fn) => fn());
  }, [navigateSlide, addSlide, duplicateSlide]);

  return (
    <aside
      data-testid="story-rail"
      aria-label="Deck outline"
      className="w-[240px] shrink-0 flex flex-col px-2.5 pt-2 pb-3 border-r border-[var(--border-color-muted)]"
    >
      <div className="px-2.5 pt-2 pb-3.5 text-[13px] font-semibold tracking-[0.01em] text-[var(--text-primary)]">
        {deckName}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-0.5 overflow-y-auto min-h-0" aria-label="Slides">
            {slides.map((slide, index) => {
              const isActive = slide.id === activeSlideId;
              return (
                <SlideRow
                  key={slide.id}
                  slide={slide}
                  index={index}
                  isActive={isActive}
                  hasUnsavedChanges={isActive && activeSlideHasUnsavedChanges}
                  canDelete={slides.length > 1}
                  variableSets={variableSets}
                  currentTableConfig={
                    isActive
                      ? { rowVars: tableConfig?.rowVars ?? [], colVar: tableConfig?.colVar ?? null }
                      : undefined
                  }
                  onSelect={() => setActiveSlide(slide.id)}
                  onDuplicate={() => duplicateSlide(slide.id)}
                  onDelete={() => {
                    setSlideToDelete(slide.id);
                    setDeleteModalOpen(true);
                  }}
                />
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => addSlide()}
        title="New slide (N)"
        className="mt-1.5 px-2.5 py-[7px] text-left text-[12.5px] rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-rail)] hover:text-[var(--text-secondary)] transition-colors"
      >
        + New slide
      </button>

      <div className="mt-auto px-2.5 pt-2 text-[11px] text-[var(--text-tertiary)]">
        <PersistenceStatus
          mode={persistenceMode}
          opfsAvailable={opfsAvailable}
          dbLabel={persistence.opfsDbLabel}
          usageMb={persistence.opfsUsageMb}
          quotaMb={persistence.opfsQuotaMb}
          usagePct={persistence.opfsUsagePct}
          error={persistenceError}
          errorHint={persistence.opfsErrorHint}
          rehydrateError={persistence.opfsRehydrateError}
          datasetRows={dataset?.rowCount ?? null}
          datasetColumns={persistence.datasetVariableCount}
          estimatedCells={persistence.estimatedCells}
          labeledVariableCount={persistence.labeledVariableCount}
          totalVariableCount={persistence.datasetVariableCount}
          totalValueLabelCount={persistence.totalValueLabelCount}
          memoryRisk={persistence.memoryRisk}
          partialLoadMessage={persistence.partialLoadMessage}
          opfsFileKey={dataset?.opfsFileKey}
          onRefresh={persistence.refreshOpfsDbFiles}
          onPurge={persistence.purgeQuarantinedDbs}
          onRebuild={() => void persistence.rebuildFromOpfsSource('dashboard')}
        />
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSlideToDelete(null);
        }}
        onConfirm={() => {
          if (slideToDelete) removeSlide(slideToDelete);
        }}
        title="Delete slide"
        message="Delete this slide from the deck?"
        confirmLabel="Delete"
        variant="danger"
      />
    </aside>
  );
};
