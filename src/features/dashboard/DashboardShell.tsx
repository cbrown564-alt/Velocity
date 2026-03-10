/**
 * DashboardShell — Analysis canvas with sidebar, shelves, DnD, and main canvas.
 * Extracted from App.tsx to reduce the monolith.
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Table, RotateCcw, CheckCircle2, BarChart3, Loader2, AlertCircle, Moon, Sun, Home, FileDown, Download, Upload } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { DndContext, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor, DragEndEvent, DragStartEvent, useDroppable, closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { useVelocityStore, type VariableSet, type Filter } from '../../store';
import { useResolvedVariables } from './hooks/useResolvedVariables';
import { buildExportConfig } from '../../core/export/buildExportConfig';
import { filterSyntheticGridShellSets } from '../variableManager/variableSetFilters';
import { allowsNumericStats } from '../../types';

import { VirtualizedVariableList } from './components/VirtualizedVariableList';
import { DropZone } from '../../components/common/DropZone';
import { SlideContainer } from './components/SlideContainer';
import { TimelineDock } from './components/TimelineDock';
import { PersistenceStatus } from './components/PersistenceStatus';
import { StorageStatusIndicator } from '../../components/common/StorageStatusIndicator';
import { FilterBar } from '../../components/common/FilterBar';
import { Logo } from '../../components/common/Logo';
import { AppShell, ModeToggleButton } from '../../components/layout/AppShell';
import { VariableCard } from './components/DraggableVariable';

import type { PersistenceManagerState } from '../../hooks/usePersistenceManager';

// Smart Canvas Wrapper
const SmartCanvas: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-indigo-50/30' : ''} transition-colors duration-300`}
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
  const { theme, toggleTheme } = useTheme();

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
  } = useVelocityStore();

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
    });
  }, [activeSlide?.title, activeSlide?.visualizationType, activeSlide?.chartType, dataset?.name, queryResult, resolvedRowVars, resolvedColVar, isWeighted, isMultipleResponse]);

  // -- Local DnD state --
  const [activeDragSet, setActiveDragSet] = React.useState<VariableSet | null>(null);
  const [selectedSetIds, setSelectedSetIds] = React.useState<Set<string>>(new Set());
  const [showCombineModal, setShowCombineModal] = React.useState(false);
  const [weightEnabled, setWeightEnabled] = React.useState(true);
  const [rememberedWeightVar, setRememberedWeightVar] = React.useState<string | null>(null);

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
        const itemsId = `${setId}_items`;
        const scaleId = `${setId}_scale`;
        if (zoneId === 'drop-zone-rows') {
          if (!tableConfig.rowVars.includes(scaleId)) {
            setTableConfig({ rowVars: [...tableConfig.rowVars, scaleId], colVar: itemsId });
          }
        } else if (zoneId === 'drop-zone-cols') {
          setTableConfig({
            colVar: scaleId,
            rowVars: tableConfig.rowVars.includes(itemsId) ? tableConfig.rowVars : [...tableConfig.rowVars, itemsId]
          });
        } else if (zoneId === 'canvas') {
          setTableConfig({ rowVars: [scaleId], colVar: itemsId });
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
      const itemsId = `${set.id}_items`;
      const scaleId = `${set.id}_scale`;
      setTableConfig({ rowVars: [scaleId], colVar: itemsId });
    } else {
      if (tableConfig.rowVars.length === 0) {
        setTableConfig({ rowVars: [set.id] });
      } else {
        setTableConfig({ colVar: set.id });
      }
    }
  };

  const handleContextMenu = (set: VariableSet, e: React.MouseEvent) => {
    if (!selectedSetIds.has(set.id)) {
      setSelectedSetIds(new Set([set.id]));
    }
    // Context menu rendering handled by parent ModalLayer
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
  }, [slides]);

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-screen"
        >
          {/* SIDEBAR */}
          <aside className="w-72 bg-[var(--bg-panel)] border-r border-[var(--border-color)] flex flex-col shrink-0 z-30 relative">
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
                  onRecode={handleRecodeClick}
                  onClick={handleVariableClick}
                  onContextMenu={handleContextMenu}
                />
              </div>
            </div>

            <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-app)]">
              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] px-2">
                <CheckCircle2 size={12} className="text-[var(--color-success)]" />
                <span>{filename} ({totalRows} rows)</span>
              </div>
              {dataset?.sampleRowCount && (
                <div className="flex items-center gap-2 text-xs text-amber-600 px-2 mt-2 bg-amber-50 rounded py-1">
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
          </aside>

          {/* MAIN CANVAS */}
          <main className="flex-1 flex flex-col bg-[var(--bg-app)] relative overflow-hidden z-0">
            {/* HEADER */}
            <header className="h-14 border-b border-[var(--border-color-muted)] flex items-center justify-between px-6 bg-[var(--bg-app)] shrink-0 z-10">
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

              <div className="flex items-center gap-6">
                <div className="flex items-center bg-[var(--bg-surface)] p-1 rounded-lg">
                  <button
                    onClick={() => {
                      if (activeSlideId) {
                        useVelocityStore.getState().setSlideVisualizationType(activeSlideId, 'table');
                      }
                    }}
                    className={`p-1.5 rounded-md transition-all ${activeSlide?.visualizationType === 'table' ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    <Table size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (activeSlideId) {
                        useVelocityStore.getState().setSlideVisualizationType(activeSlideId, 'chart');
                      }
                    }}
                    className={`p-1.5 rounded-md transition-all ${activeSlide?.visualizationType === 'chart' ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    <BarChart3 size={16} />
                  </button>
                </div>

                <button
                  onClick={onOpenSessionImport}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors"
                  title="Import portable session"
                >
                  <Upload size={14} />
                  Import Session
                </button>

                <button
                  onClick={onExportSession}
                  disabled={!dataset}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export portable session"
                >
                  <Download size={14} />
                  Export Session
                </button>

                <button
                  onClick={() => openAnalysisExportModal(buildCurrentExportConfig())}
                  disabled={!canOpenExport}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export current slide"
                >
                  <FileDown size={14} />
                  Export
                </button>

                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                  title={`Switch to ${theme.id === 'soft-machine' ? 'Mission Control' : 'Soft Machine'}`}
                >
                  {theme.id === 'soft-machine' ? <Moon size={18} /> : <Sun size={18} />}
                </button>

                <ModeToggleButton />

                <button
                  onClick={reset}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <RotateCcw size={12} />
                  Reset
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
              {/* SHELF */}
              <div className="shrink-0 bg-[var(--bg-app)] border-b border-[var(--border-color)] px-6 py-4 flex flex-col gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-10">
                {/* Columns Shelf */}
                <div className="flex items-center gap-4">
                  <div className="w-16 flex justify-end shrink-0">
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

                {/* Rows Shelf */}
                <div className="flex items-center gap-4">
                  <div className="w-16 flex justify-end shrink-0">
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
              <SmartCanvas className="flex-1 relative overflow-hidden p-6 flex flex-col">
                <div className="flex-1 w-full h-full flex flex-col min-h-0">
                  <div className="flex-1 relative bg-[var(--bg-panel)] rounded-xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col">
                    {isQuerying && (
                      <div className="absolute inset-0 bg-[var(--bg-panel)]/50 z-20 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="animate-spin text-[var(--color-accent)]" size={32} />
                      </div>
                    )}
                    <div className="flex-1 min-h-0">
                      <SlideContainer className="h-full w-full" />
                    </div>
                    <TimelineDock />
                  </div>
                </div>
              </SmartCanvas>
            </div>
          </main>
        </motion.div>

        <DragOverlay dropAnimation={null}>
          {activeDragSet ? (
            <VariableCard variableSet={activeDragSet} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </AppShell>
  );
};
