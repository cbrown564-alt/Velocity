/**
 * DashboardShell — Analysis canvas with sidebar, shelves, DnD, and main canvas.
 * Composes extracted Sidebar, Toolbar, AnalysisShelf, and useDashboardDnD.
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { getMotionProps, DURATIONS } from '../../lib/motion';
import { Loader2, Pencil } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';

import { useVelocityStore } from '../../store';
import { useResolvedVariables } from './hooks/useResolvedVariables';
import { useDashboardDnD } from './hooks/useDashboardDnD';
import { buildExportConfig } from '../../core/export/buildExportConfig';
import { resolveExportBranding } from '../../core/export/resolveThemeColors';
import { filterSyntheticGridShellSets } from '../../core/services/syntheticGridShellFilters';

import { DashboardSidebar } from './components/DashboardSidebar';
import { DashboardToolbar } from './components/DashboardToolbar';
import { AnalysisShelf } from './components/AnalysisShelf';
import { SlideContainer } from './components/SlideContainer';
import { TimelineDock } from './components/TimelineDock';
import { FilterBar } from '../../components/common/FilterBar';
import { AppShell } from '../../components/layout/AppShell';
import { VariableCard } from './components/DraggableVariable';
import { ContextMenu } from './components/ContextMenu';

import type { PersistenceManagerState } from '../../hooks/usePersistenceManager';

const SmartCanvas: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-[var(--bg-active)]/30' : ''} transition-colors duration-300`}
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
  const { theme } = useTheme();

  const {
    dataset,
    variableSets,
    tableConfig,
    queryResult,
    isQuerying,
    draggingId,
    searchQuery,
    activeFilters,
    slides,
    activeSlideId,
    selectedVariableSetId,
    focusMode,
    toggleFocusMode,
    tableDensity,
    toggleTableDensity,
    setTableDensity,
    addToast,
    setTableConfig,
    setSearchQuery,
    reset,
    openFilterModal,
    removeFilter,
    openAnalysisExportModal,
    setSelectedVariableSetId,
    hoveredVariableSetId,
    transformLog,
    lastSeenTransformCount,
    markTransformsSeen,
    opfsAvailable,
    persistenceMode,
    persistenceError,
  } = useVelocityStore();

  React.useEffect(() => {
    if (lastSeenTransformCount < 0) {
      markTransformsSeen(transformLog.length);
    }
  }, [lastSeenTransformCount, transformLog.length, markTransformsSeen]);

  const { resolvedRowVars, resolvedColVar, firstRowVarSet } = useResolvedVariables();
  const isMultipleResponse = firstRowVarSet?.structure === 'multiple';
  const isWeighted = !!dataset?.weightVariable;

  const activeSlide = React.useMemo(
    () => slides.find((s) => s.id === activeSlideId) || null,
    [slides, activeSlideId]
  );

  const canOpenExport = !!dataset;

  const buildCurrentExportConfig = useCallback(() => {
    const title = activeSlide?.title || dataset?.name || 'Analysis Report';
    return buildExportConfig({
      title,
      data: queryResult,
      rowVariables: resolvedRowVars,
      colVariable: resolvedColVar,
      isWeighted,
      isMultipleResponse,
      viewType: activeSlide?.visualizationType,
      chartType: activeSlide?.chartType,
      branding: resolveExportBranding(theme),
    });
  }, [activeSlide?.title, activeSlide?.visualizationType, activeSlide?.chartType, dataset?.name, queryResult, resolvedRowVars, resolvedColVar, isWeighted, isMultipleResponse, theme]);

  const {
    sensors,
    customCollisionDetection,
    activeDragSet,
    selectedSetIds,
    variableContextMenu,
    setVariableContextMenu,
    weightEnabled,
    rememberedWeightVar,
    handleDragStart,
    handleDragEnd,
    handleVariableClick,
    handleContextMenu,
    handleRecodeClick,
    handleToggleWeight,
    handleWeightRemove,
  } = useDashboardDnD();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [sidebarUserToggled, setSidebarUserToggled] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 1279px)');
    const apply = () => {
      if (!sidebarUserToggled) setSidebarCollapsed(media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [sidebarUserToggled]);

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

  const toggleSidebar = () => {
    setSidebarUserToggled(true);
    setSidebarCollapsed((collapsed) => !collapsed);
  };

  const handleExport = useCallback(() => {
    openAnalysisExportModal(buildCurrentExportConfig());
    addToast({ message: 'Export dialog opened', type: 'info' });
  }, [openAnalysisExportModal, buildCurrentExportConfig, addToast]);

  const variables = dataset?.variables || [];
  const filename = dataset?.name || '';
  const totalRows = dataset?.rowCount || queryResult.reduce((sum, r) => sum + r.count, 0);
  const displaySets = filterSyntheticGridShellSets(variableSets || [], dataset);

  const inUseIds = new Set([
    ...tableConfig.rowVars,
    ...(tableConfig.colVar ? [tableConfig.colVar] : [])
  ]);

  const filteredSets = displaySets
    .filter(s => !inUseIds.has(s.id))
    .filter(s => !s.hidden)
    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const weightSetId = dataset?.weightVariable
    ? variableSets.find(s => s.variableIds.includes(dataset.weightVariable!))?.id ?? null
    : null;

  return (
    <AppShell>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <motion.div
          {...getMotionProps({ preset: 'fade', duration: DURATIONS.enter })}
          className="flex h-screen"
        >
          <DashboardSidebar
            focusMode={focusMode}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filteredSets={filteredSets}
            selectedSetIds={selectedSetIds}
            selectedVariableSetId={selectedVariableSetId}
            hoveredVariableSetId={hoveredVariableSetId}
            onRecode={handleRecodeClick}
            onVariableClick={handleVariableClick}
            onContextMenu={handleContextMenu}
            rowIds={new Set(tableConfig.rowVars)}
            colId={tableConfig.colVar}
            weightId={weightSetId}
            filename={filename}
            totalRows={totalRows}
            dataset={dataset}
            persistence={persistence}
            opfsAvailable={opfsAvailable}
            persistenceMode={persistenceMode}
            persistenceError={persistenceError}
          />

          <main className="flex-1 flex flex-col bg-[var(--bg-app)] relative overflow-hidden z-0">
            <DashboardToolbar
              dataset={dataset}
              activeSlideId={activeSlideId}
              activeSlide={activeSlide}
              focusMode={focusMode}
              tableDensity={tableDensity}
              canOpenExport={canOpenExport}
              onReturnToWorkspace={onReturnToWorkspace}
              onOpenSessionImport={onOpenSessionImport}
              onExportSession={onExportSession}
              onExport={handleExport}
              onToggleFocusMode={toggleFocusMode}
              onToggleTableDensity={toggleTableDensity}
              onReset={reset}
            />

            <FilterBar
              filters={activeFilters}
              variables={variables}
              onAddFilter={openFilterModal}
              onRemoveFilter={removeFilter}
            />

            <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)]">
              <AnalysisShelf
                focusMode={focusMode}
                draggingId={draggingId}
                tableConfig={tableConfig}
                variableSets={variableSets}
                dataset={dataset}
                rememberedWeightVar={rememberedWeightVar}
                weightEnabled={weightEnabled}
                onSetTableConfig={setTableConfig}
                onWeightRemove={handleWeightRemove}
                onToggleWeight={handleToggleWeight}
              />

              <SmartCanvas className={`flex-1 relative overflow-hidden flex flex-col ${focusMode ? 'p-2' : 'p-6'}`}>
                <div className="flex-1 w-full h-full flex flex-col min-h-0">
                  <div className={`flex-1 relative overflow-hidden flex flex-col ${
                    focusMode
                      ? 'bg-transparent border-0 shadow-none rounded-none'
                      : 'bg-[var(--bg-panel)] rounded-xl border border-[var(--border-color)] shadow-sm'
                  }`}>
                    {isQuerying && (
                      <div className="absolute inset-0 bg-[var(--bg-panel)]/50 z-20 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="animate-spin text-[var(--color-accent)]" size={32} />
                      </div>
                    )}
                    <div className="flex-1 min-h-0">
                      <SlideContainer className="h-full w-full" />
                    </div>
                    <div className={`transition-all duration-300 ${focusMode ? 'h-0 opacity-0 overflow-hidden' : ''}`}>
                      <TimelineDock />
                    </div>
                  </div>
                </div>
              </SmartCanvas>
            </div>
          </main>
        </motion.div>

        <DragOverlay
          dropAnimation={{
            duration: 300,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {activeDragSet ? (
            <motion.div
              initial={{ scale: 1.02, boxShadow: '0 8px 24px color-mix(in srgb, var(--text-primary) 12%, transparent)' }}
              animate={{ scale: 1.05, boxShadow: '0 12px 32px color-mix(in srgb, var(--text-primary) 18%, transparent)' }}
              exit={{ scale: 1, boxShadow: '0 4px 12px color-mix(in srgb, var(--text-primary) 8%, transparent)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <VariableCard variableSet={activeDragSet} isOverlay />
            </motion.div>
          ) : null}
        </DragOverlay>

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
                  variableContextMenu.set.structure !== 'single' ||
                  variableContextMenu.set.variableIds.length === 0,
                onClick: () => handleRecodeClick(variableContextMenu.set),
              },
            ]}
          />
        )}
      </DndContext>
    </AppShell>
  );
};
