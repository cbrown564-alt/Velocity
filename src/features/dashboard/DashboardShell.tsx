/**
 * DashboardShell — Analysis canvas with sidebar, shelves, DnD, and main canvas.
 * Extracted from App.tsx to reduce the monolith.
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../lib/motion';
import { Search, Table, RotateCcw, CheckCircle2, BarChart3, Loader2, AlertCircle, Home, FileDown, Download, Upload, Plus, Maximize2, Minimize2, Pencil, ChevronLeft, ChevronRight, Rows3 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { DndContext, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor, DragEndEvent, DragStartEvent, useDroppable, closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { useVelocityStore, type VariableSet, type Filter } from '../../store';
import { useResolvedVariables } from './hooks/useResolvedVariables';
import { buildExportConfig } from '../../core/export/buildExportConfig';
import { resolveExportBranding } from '../../core/export/resolveThemeColors';
import { filterSyntheticGridShellSets } from '../variableManager/variableSetFilters';
import { allowsNumericStats } from '../../types';
import { applyGridSetDrop, gridSetToTableConfig } from '../../services/gridUtils';

import { VirtualizedVariableList } from './components/VirtualizedVariableList';
import { DropZone } from '../../components/common/DropZone';
import { SlideContainer } from './components/SlideContainer';
import { TimelineDock } from './components/TimelineDock';
import { PersistenceStatus } from './components/PersistenceStatus';
import { StorageStatusIndicator } from '../../components/common/StorageStatusIndicator';
import { FilterBar } from '../../components/common/FilterBar';
import { Logo } from '../../components/common/Logo';
import { AppShell, ModeToggleButton } from '../../components/layout/AppShell';
import { ThemeSwitcher } from '../../components/common/ThemeSwitcher';
import { VariableCard } from './components/DraggableVariable';
import { ContextMenu } from './components/ContextMenu';

import type { PersistenceManagerState } from '../../hooks/usePersistenceManager';

// Smart Canvas Wrapper
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
    setDraggingId,
    setSearchQuery,
    reset,
    createVariableSet,
    openRecodeModal,
    openFilterModal,
    removeFilter,
    openAnalysisExportModal,
    closeAnalysisExportModal,
    analysisExportModal,
    reorderRowVars,
    setWeightVariable,
    setSelectedVariableSetId,
    hoveredVariableSetId,
    transformLog,
    lastSeenTransformCount,
    markTransformsSeen,
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

  // -- Local DnD state --
  const [activeDragSet, setActiveDragSet] = React.useState<VariableSet | null>(null);
  const [selectedSetIds, setSelectedSetIds] = React.useState<Set<string>>(new Set());
  const [variableContextMenu, setVariableContextMenu] = React.useState<{
    set: VariableSet;
    x: number;
    y: number;
  } | null>(null);
  const [showCombineModal, setShowCombineModal] = React.useState(false);
  const [weightEnabled, setWeightEnabled] = React.useState(true);
  const [rememberedWeightVar, setRememberedWeightVar] = React.useState<string | null>(null);
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

  // Focus Breathing: auto-switch to generous density in Focus Mode, restore on exit
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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const customCollisionDetection = (args: any) => {
    const { active } = args;
    const activeData = active?.data?.current;
    const isDraggingFromSidebar = activeData?.variableSet && !activeData?.type?.includes('sortable');
    const isReordering = activeData?.type === 'sortable-row';

    if (isReordering) {
      const sortableCollisions = closestCenter(args);
      if (sortableCollisions.length > 0) {
        const firstCollision = sortableCollisions[0];
        if (tableConfig.rowVars.includes(firstCollision.id as string)) {
          return sortableCollisions;
        }
      }
    }

    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      const dropZoneCollision = rectCollisions.find(c =>
        c.id === 'drop-zone-rows' || c.id === 'drop-zone-cols' || c.id === 'drop-zone-weight' || c.id === 'canvas'
      );
      if (dropZoneCollision && isDraggingFromSidebar) {
        return [dropZoneCollision];
      }
      return rectCollisions;
    }

    return pointerWithin(args);
  };

  // -- DnD handlers --
  const handleDragStart = (event: DragStartEvent) => {
    const set = event.active.data.current?.variableSet;
    if (set) {
      setActiveDragSet(set);
      setDraggingId(set.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveDragSet(null);
    setDraggingId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Sortable reorder
    if (tableConfig.rowVars.includes(activeId) && tableConfig.rowVars.includes(overId)) {
      const oldIndex = tableConfig.rowVars.indexOf(activeId);
      const newIndex = tableConfig.rowVars.indexOf(overId);
      if (oldIndex !== newIndex) {
        reorderRowVars(arrayMove(tableConfig.rowVars, oldIndex, newIndex));
      }
      return;
    }

    // Drop from sidebar
    if (active.data.current?.variableSet) {
      const zoneId = over.id;
      const variableSet = active.data.current.variableSet;
      const setId = variableSet.id;

      // Grid auto-expansion
      if (variableSet.structure === 'grid') {
        if (zoneId === 'drop-zone-rows' || zoneId === 'drop-zone-cols' || zoneId === 'canvas') {
          setTableConfig(applyGridSetDrop(setId, zoneId, tableConfig));
        }
        return;
      }

      // Weight drop
      if (zoneId === 'drop-zone-weight') {
        const variable = dataset?.variables.find(v => v.id === variableSet.variableIds[0]);
        if (variable && allowsNumericStats(variable.type, variable.orderedScoring)) {
          const varId = variableSet.variableIds[0];
          setWeightVariable(varId);
          setRememberedWeightVar(varId);
          setWeightEnabled(true);
        }
        return;
      }

      // Standard drop
      if (zoneId === 'drop-zone-rows') {
        if (!tableConfig.rowVars.includes(setId)) {
          setTableConfig({ rowVars: [...tableConfig.rowVars, setId] });
        }
      } else if (zoneId === 'drop-zone-cols') {
        setTableConfig({ colVar: setId });
      } else if (zoneId === 'canvas') {
        if (tableConfig.rowVars.length === 0) {
          setTableConfig({ rowVars: [setId] });
        } else {
          setTableConfig({ colVar: setId });
        }
      }
    }
  };

  const handleVariableClick = (set: VariableSet, e: React.MouseEvent) => {
    setSelectedVariableSetId(set.id);

    if (e.metaKey || e.ctrlKey) {
      const newSelected = new Set(selectedSetIds);
      if (newSelected.has(set.id)) newSelected.delete(set.id);
      else newSelected.add(set.id);
      setSelectedSetIds(newSelected);
      return;
    }

    if (set.structure === 'grid') {
      setTableConfig(gridSetToTableConfig(set.id, 'full'));
    } else {
      if (tableConfig.rowVars.length === 0) {
        setTableConfig({ rowVars: [set.id] });
      } else {
        setTableConfig({ colVar: set.id });
      }
    }
  };

  const handleContextMenu = (set: VariableSet, e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedSetIds.has(set.id)) {
      setSelectedSetIds(new Set([set.id]));
    }
    setVariableContextMenu({ set, x: e.clientX, y: e.clientY });
  };

  const handleRecodeClick = (set: VariableSet) => {
    const variable = dataset?.variables.find(v => v.id === set.variableIds[0]);
    if (variable) openRecodeModal(variable);
  };

  const handleToggleWeight = () => {
    if (weightEnabled && dataset?.weightVariable) {
      setRememberedWeightVar(dataset.weightVariable);
      setWeightVariable(null);
      setWeightEnabled(false);
    } else if (!weightEnabled && rememberedWeightVar) {
      setWeightVariable(rememberedWeightVar);
      setWeightEnabled(true);
    }
  };

  const handleWeightRemove = () => {
    setWeightVariable(null);
    setRememberedWeightVar(null);
    setWeightEnabled(true);
  };

  const handleSaveFilter = useCallback((filter: Omit<Filter, 'id'>, applyToAll: boolean) => {
    const { addFilter, addFilterToSlides } = useVelocityStore.getState();
    addFilter(filter);
    if (applyToAll) {
      const filterWithId = { ...filter, id: crypto.randomUUID() };
      const slideIds = slides.map(s => s.id);
      addFilterToSlides(slideIds, filterWithId);
    }
    addToast({ message: `Filter applied${applyToAll ? ' to all slides' : ''}`, type: 'success' });
  }, [slides, addToast]);

  const handleExport = useCallback(() => {
    openAnalysisExportModal(buildCurrentExportConfig());
    addToast({ message: 'Export dialog opened', type: 'info' });
  }, [openAnalysisExportModal, buildCurrentExportConfig, addToast]);

  // -- Derived --
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

  const {
    persistentStorageGranted,
    opfsDbLabel,
    opfsUsageMb,
    opfsQuotaMb,
    opfsUsagePct,
    opfsRehydrateError,
    opfsErrorHint,
    datasetVariableCount,
    labeledVariableCount,
    totalValueLabelCount,
    estimatedCells,
    memoryRisk,
    partialLoadMessage,
    refreshOpfsDbFiles,
    purgeQuarantinedDbs,
    rebuildFromOpfsSource,
  } = persistence;

  const { opfsAvailable, persistenceMode, persistenceError } = useVelocityStore();

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
          {/* SIDEBAR */}
          <aside
            className={`surface-panel bg-[var(--bg-panel)] border-r border-[var(--border-color)] flex flex-col shrink-0 z-30 relative transition-all duration-300 ${
              focusMode ? 'w-0 opacity-0 overflow-hidden' : sidebarCollapsed ? 'w-14 opacity-100' : 'w-72 opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={toggleSidebar}
              className="absolute -right-3 top-4 z-40 w-6 h-6 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--color-accent)] flex items-center justify-center shadow-sm"
              aria-label={sidebarCollapsed ? 'Expand variable sidebar' : 'Collapse variable sidebar'}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {!sidebarCollapsed && (
            <>
            <div className="p-4 border-b border-[var(--border-color-muted)] bg-[var(--bg-app)]">
              <div className="flex items-center gap-2 mb-4">
                <Logo size={24} />
                <span className="font-semibold text-[var(--text-primary)] tracking-tight">Velocity</span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Search variables..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg-surface)] border-none rounded-md text-sm focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:bg-[var(--bg-panel)] transition-all outline-none text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-4 pt-3 shrink-0">
                Survey Questions ({filteredSets.length})
              </p>
              <div className="flex-1 min-h-0 px-3">
                <VirtualizedVariableList
                  variableSets={filteredSets}
                  selectedIds={selectedSetIds}
                  focusedId={selectedVariableSetId}
                  hoveredId={hoveredVariableSetId}
                  onRecode={handleRecodeClick}
                  onClick={handleVariableClick}
                  onContextMenu={handleContextMenu}
                  rowIds={new Set(tableConfig.rowVars)}
                  colId={tableConfig.colVar}
                  weightId={dataset?.weightVariable ? variableSets.find(s => s.variableIds.includes(dataset.weightVariable!))?.id ?? null : null}
                />
              </div>
            </div>

            <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-app)]">
              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] px-2">
                <CheckCircle2 size={12} className="text-[var(--color-success)]" />
                <span className="truncate">{filename} ({totalRows} rows)</span>
              </div>
              {dataset?.sampleRowCount && (
                <div className="flex items-center gap-2 text-xs text-[var(--status-warning-text)] px-2 mt-2 bg-[var(--status-warning-surface)] rounded py-1">
                  <AlertCircle size={12} />
                  <span>Heuristics based on {dataset.sampleRowCount.toLocaleString()} sample rows</span>
                </div>
              )}
              <StorageStatusIndicator
                hasDataset={Boolean(dataset)}
                persistentStorageGranted={persistentStorageGranted}
                opfsAvailable={opfsAvailable}
              />
              <div className="mt-auto">
                <PersistenceStatus
                  mode={persistenceMode}
                  opfsAvailable={opfsAvailable}
                  dbLabel={opfsDbLabel}
                  usageMb={opfsUsageMb}
                  quotaMb={opfsQuotaMb}
                  usagePct={opfsUsagePct}
                  error={persistenceError}
                  errorHint={opfsErrorHint}
                  rehydrateError={opfsRehydrateError}
                  datasetRows={dataset?.rowCount ?? null}
                  datasetColumns={datasetVariableCount}
                  estimatedCells={estimatedCells}
                  labeledVariableCount={labeledVariableCount}
                  totalVariableCount={datasetVariableCount}
                  totalValueLabelCount={totalValueLabelCount}
                  memoryRisk={memoryRisk}
                  partialLoadMessage={partialLoadMessage}
                  opfsFileKey={dataset?.opfsFileKey}
                  onRefresh={refreshOpfsDbFiles}
                  onPurge={purgeQuarantinedDbs}
                  onRebuild={() => void rebuildFromOpfsSource('dashboard')}
                />
              </div>
            </div>
            </>
            )}
          </aside>

          {/* MAIN CANVAS */}
          <main className="flex-1 flex flex-col bg-[var(--bg-app)] relative overflow-hidden z-0">
            {/* HEADER */}
            <header className="relative z-30 h-14 border-b border-[var(--border-color-muted)] flex items-center justify-between px-6 bg-[var(--bg-app)] shrink-0 overflow-visible">
              <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                <button
                  onClick={onReturnToWorkspace}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                  title="Return to Workspace"
                >
                  <Home size={16} />
                </button>
                <span className="text-[var(--border-color)]">/</span>
                <span className="text-[var(--text-primary)] font-medium">{dataset?.name || 'Untitled'}</span>
              </div>

              <div className="flex items-center gap-2 xl:gap-4 shrink-0">
                <div className="flex items-center bg-[var(--bg-surface)] p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeSlideId) {
                        useVelocityStore.getState().setSlideVisualizationType(activeSlideId, 'table');
                      }
                    }}
                    aria-label="Table view"
                    aria-pressed={activeSlide?.visualizationType === 'table'}
                    className={`p-1.5 rounded-md transition-all ${activeSlide?.visualizationType === 'table' ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    <Table size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeSlideId) {
                        useVelocityStore.getState().setSlideVisualizationType(activeSlideId, 'chart');
                      }
                    }}
                    aria-label="Chart view"
                    aria-pressed={activeSlide?.visualizationType === 'chart'}
                    className={`p-1.5 rounded-md transition-all ${activeSlide?.visualizationType === 'chart' ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    <BarChart3 size={16} aria-hidden />
                  </button>
                </div>

                <button
                  onClick={onOpenSessionImport}
                  className="flex items-center gap-2 px-2 xl:px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors"
                  title="Import portable session"
                  aria-label="Import Session"
                >
                  <Upload size={14} aria-hidden />
                  <span className="hidden xl:inline">Import Session</span>
                </button>

                <button
                  onClick={onExportSession}
                  disabled={!dataset}
                  className="flex items-center gap-2 px-2 xl:px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export portable session"
                  aria-label="Export Session"
                >
                  <Download size={14} aria-hidden />
                  <span className="hidden xl:inline">Export Session</span>
                </button>

                <button
                  onClick={handleExport}
                  disabled={!canOpenExport}
                  className="flex items-center gap-2 px-2 xl:px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export current slide"
                  aria-label="Export"
                >
                  <FileDown size={14} aria-hidden />
                  <span className="hidden xl:inline">Export</span>
                </button>

                <ThemeSwitcher />

                <button
                  onClick={toggleFocusMode}
                  className={`p-2 rounded-lg transition-colors ${focusMode ? 'bg-[var(--color-accent)] text-[var(--text-inverse)]' : 'hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--color-accent)]'}`}
                  title={focusMode ? 'Exit Focus Mode (F)' : 'Enter Focus Mode (F)'}
                  aria-label={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
                  aria-pressed={focusMode}
                >
                  {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                <button
                  onClick={toggleTableDensity}
                  className={`p-2 rounded-lg transition-colors ${tableDensity === 'generous' ? 'bg-[var(--color-accent)] text-[var(--text-inverse)]' : 'hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--color-accent)]'}`}
                  title={tableDensity === 'generous' ? 'Switch to Compact View' : 'Switch to Presentation View'}
                  aria-label={tableDensity === 'generous' ? 'Compact View' : 'Presentation View'}
                  aria-pressed={tableDensity === 'generous'}
                >
                  <Rows3 size={18} />
                </button>

                <ModeToggleButton />

                <button
                  onClick={reset}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-md hover:bg-[var(--bg-surface)] transition-colors"
                  title="Reset analysis"
                  aria-label="Reset"
                >
                  <RotateCcw size={12} aria-hidden />
                  <span className="hidden xl:inline">Reset</span>
                </button>
              </div>
            </header>

            {/* FILTER BAR */}
            <FilterBar
              filters={activeFilters}
              variables={variables}
              onAddFilter={openFilterModal}
              onRemoveFilter={removeFilter}
            />

            {/* WORKSPACE */}
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)]">
              {/* SHELF — adaptive collapse when empty and not dragging */}
              <div className={`shrink-0 surface-panel bg-[var(--bg-app)] border-b border-[var(--border-color)] flex flex-col gap-3 shadow-xs z-0 transition-all duration-300 overflow-hidden ${focusMode ? 'h-0 py-0 opacity-0 border-none' : ''} ${!focusMode ? 'px-4 xl:px-6 py-4 opacity-100' : ''}`}>
                {/* Collapsed indicator when shelves are empty and not dragging */}
                {!focusMode && !draggingId && tableConfig.rowVars.length === 0 && !tableConfig.colVar && !(dataset?.weightVariable || rememberedWeightVar) && (
                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <Plus size={14} className="text-[var(--color-accent)]" />
                    <span className="font-medium">Drag variables to rows, columns, or weight to begin</span>
                  </div>
                )}
                {/* Columns Shelf — collapse when empty */}
                <div className={`flex items-center gap-3 transition-all duration-200 ${!tableConfig.colVar && !draggingId ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}>
                  <div className="shrink-0 min-w-[4.5rem]">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Columns</span>
                  </div>
                  <div className="flex-1 max-w-3xl">
                    <DropZone
                      id="drop-zone-cols"
                      type="column"
                      label="Drop Column Variable"
                      active={!!draggingId}
                      currentVariables={tableConfig.colVar ? [variableSets.find(s => s.id === tableConfig.colVar)!].filter(Boolean) : []}
                      onRemove={() => setTableConfig({ colVar: null })}
                    />
                  </div>
                </div>

                {/* Rows Shelf — collapse when empty */}
                <div className={`flex items-center gap-3 transition-all duration-200 ${tableConfig.rowVars.length === 0 && !draggingId ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}>
                  <div className="shrink-0 min-w-[4.5rem]">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Rows</span>
                  </div>
                  <div className="flex-1 max-w-3xl">
                    <DropZone
                      id="drop-zone-rows"
                      type="row"
                      label="Drop Row Variables"
                      active={!!draggingId}
                      currentVariables={tableConfig.rowVars.map(id => variableSets.find(s => s.id === id)).filter(Boolean) as VariableSet[]}
                      onRemove={(id) => setTableConfig({ rowVars: tableConfig.rowVars.filter(r => r !== id) })}
                    />
                  </div>

                  {/* Weight Shelf */}
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <div className="shrink-0">
                      <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Weight</span>
                    </div>
                    <DropZone
                      id="drop-zone-weight"
                      type="weight"
                      label="Weight"
                      active={!!draggingId}
                      currentVariables={
                        (dataset?.weightVariable || rememberedWeightVar)
                          ? [variableSets.find(s => s.variableIds.includes(dataset?.weightVariable || rememberedWeightVar || ''))].filter(Boolean) as VariableSet[]
                          : []
                      }
                      onRemove={handleWeightRemove}
                      weightEnabled={weightEnabled && !!dataset?.weightVariable}
                      onToggleWeight={handleToggleWeight}
                    />
                  </div>
                </div>
              </div>

              {/* MAIN CANVAS AREA */}
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
