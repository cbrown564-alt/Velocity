/**
 * DashboardShell — Analysis canvas with story rail, recipe inspector, DnD, and main canvas.
 */

import React from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';

import { useVelocityStore } from '../../store';
import { useDashboardDnD } from './hooks/useDashboardDnD';
import { useAnalysisExportAction } from './hooks/useAnalysisExportAction';

import { StoryRail } from './components/StoryRail';
import { RecipeInspector } from './components/RecipeInspector';
import { DashboardToolbar } from './components/DashboardToolbar';
import { SlideContainer } from './components/SlideContainer';
import { AppShell } from '../../components/layout/AppShell';
import { CommandPalette } from '../../components/common/CommandPalette';
import { VariableCard } from './components/DraggableVariable';
import { ContextMenu } from './components/ContextMenu';

import type { PersistenceManagerState } from '../../hooks/usePersistenceManager';

const SmartCanvas: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-[var(--bg-active)]/30' : ''} transition-colors duration-150`}
    >
      {children}
    </div>
  );
};

export interface DashboardShellProps {
  persistence: PersistenceManagerState;
  onReturnToWorkspace: () => void;
  onOpenSessionImport: () => void;
  onExportSession: () => void;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  persistence,
  onReturnToWorkspace,
  onOpenSessionImport,
  onExportSession,
}) => {
  const dataset = useVelocityStore((state) => state.dataset);
  const isQuerying = useVelocityStore((state) => state.isQuerying);
  const slides = useVelocityStore((state) => state.slides);
  const activeSlideId = useVelocityStore((state) => state.activeSlideId);
  const focusMode = useVelocityStore((state) => state.focusMode);
  const toggleFocusMode = useVelocityStore((state) => state.toggleFocusMode);
  const tableDensity = useVelocityStore((state) => state.tableDensity);
  const setTableDensity = useVelocityStore((state) => state.setTableDensity);
  const reset = useVelocityStore((state) => state.reset);
  const transformLog = useVelocityStore((state) => state.transformLog);
  const lastSeenTransformCount = useVelocityStore((state) => state.lastSeenTransformCount);
  const markTransformsSeen = useVelocityStore((state) => state.markTransformsSeen);
  const opfsAvailable = useVelocityStore((state) => state.opfsAvailable);
  const persistenceMode = useVelocityStore((state) => state.persistenceMode);
  const persistenceError = useVelocityStore((state) => state.persistenceError);

  const [recipeOpen, setRecipeOpen] = React.useState(false);
  const draggingId = useVelocityStore((state) => state.draggingId);
  const recipePanelExpanded = recipeOpen || !!draggingId;

  React.useEffect(() => {
    if (lastSeenTransformCount < 0) {
      markTransformsSeen(transformLog.length);
    }
  }, [lastSeenTransformCount, transformLog.length, markTransformsSeen]);

  const activeSlide = React.useMemo(() => slides.find((s) => s.id === activeSlideId) || null, [slides, activeSlideId]);

  const { openExport, canExport: canOpenExport } = useAnalysisExportAction();
  const handleExport = openExport;

  const {
    sensors,
    customCollisionDetection,
    activeDragSet,
    variableContextMenu,
    setVariableContextMenu,
    rememberedWeightVar,
    weightEnabled,
    handleDragStart,
    handleDragEnd,
    handleRecodeClick,
    handleToggleWeight,
    handleWeightRemove,
  } = useDashboardDnD();

  const prevDensityRef = React.useRef<'compact' | 'generous'>('compact');
  const wasFocusedRef = React.useRef(focusMode);
  const tableDensityRef = React.useRef(tableDensity);

  React.useEffect(() => {
    tableDensityRef.current = tableDensity;
  }, [tableDensity]);

  React.useEffect(() => {
    const wasFocused = wasFocusedRef.current;
    const isFocused = focusMode;

    if (!wasFocused && isFocused) {
      prevDensityRef.current = tableDensityRef.current;
      setTableDensity('generous');
    } else if (wasFocused && !isFocused) {
      setTableDensity(prevDensityRef.current);
    }

    wasFocusedRef.current = isFocused;
  }, [focusMode, setTableDensity]);

  return (
    <AppShell>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-screen">
          <StoryRail
            persistence={persistence}
            opfsAvailable={opfsAvailable}
            persistenceMode={persistenceMode}
            persistenceError={persistenceError}
          />

          <main
            id="main-content"
            className="flex-1 flex flex-col bg-[var(--bg-app)] relative overflow-hidden z-0 min-w-0"
          >
            <DashboardToolbar
              dataset={dataset}
              activeSlideId={activeSlideId}
              activeSlide={activeSlide}
              focusMode={focusMode}
              canOpenExport={canOpenExport}
              recipeOpen={recipeOpen}
              onToggleRecipe={() => setRecipeOpen((open) => !open)}
              onReturnToWorkspace={onReturnToWorkspace}
              onOpenSessionImport={onOpenSessionImport}
              onExportSession={onExportSession}
              onExport={handleExport}
              onToggleFocusMode={toggleFocusMode}
              onReset={reset}
            />

            <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden" data-testid="dashboard-workspace">
              <SmartCanvas
                className={`flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col ${focusMode ? 'p-2' : 'p-4'}`}
              >
                <div className="flex-1 w-full min-h-0 flex flex-col">
                  <div className="flex-1 relative min-h-0 flex flex-col">
                    {isQuerying && (
                      <div className="absolute inset-0 bg-[var(--bg-panel)]/50 z-[var(--z-sticky)] flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="animate-spin text-[var(--text-secondary)]" size={32} />
                      </div>
                    )}
                    <div className="flex-1 min-h-0 flex flex-col">
                      <SlideContainer className="flex-1 min-h-0" />
                    </div>
                  </div>
                </div>
              </SmartCanvas>

              <div
                className={`relative z-10 shrink-0 h-full overflow-hidden transition-[width] duration-150 ease-out ${
                  recipePanelExpanded ? 'w-[280px]' : 'w-0'
                }`}
                data-recipe-expanded={recipePanelExpanded ? 'true' : 'false'}
              >
                <RecipeInspector
                  open={recipeOpen}
                  weightEnabled={weightEnabled}
                  rememberedWeightVar={rememberedWeightVar}
                  onWeightRemove={handleWeightRemove}
                  onToggleWeight={handleToggleWeight}
                />
              </div>
            </div>
          </main>
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }}>
          {activeDragSet ? <VariableCard variableSet={activeDragSet} isOverlay /> : null}
        </DragOverlay>

        <CommandPalette withinDnd />

        {variableContextMenu && (
          <ContextMenu
            x={variableContextMenu.x}
            y={variableContextMenu.y}
            onClose={() => setVariableContextMenu(null)}
            actions={[
              {
                label: 'Recode variable',
                icon: <Pencil size={14} />,
                disabled:
                  variableContextMenu.set.structure !== 'single' || variableContextMenu.set.variableIds.length === 0,
                onClick: () => handleRecodeClick(variableContextMenu.set),
              },
            ]}
          />
        )}
      </DndContext>
    </AppShell>
  );
};
