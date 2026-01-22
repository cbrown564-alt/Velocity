import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Table, RotateCcw, X, CheckCircle2, Search, BarChart3, LayoutGrid, Loader2, AlertCircle } from 'lucide-react';

import { MOCK_DATASET } from './constants';
import { DraggableVariable } from './features/dashboard/components/DraggableVariable';
import { VirtualizedVariableList } from './features/dashboard/components/VirtualizedVariableList';
import { DropZone } from './components/common/DropZone';
import { DataTable } from './features/dashboard/components/DataTable';

import { DataDrawer } from './components/overlays/DataDrawer';
import { RecodeModal } from './components/overlays/RecodeModal';
import { FilterModal } from './components/overlays/FilterModal';
import { FilterBar } from './components/common/FilterBar';
import { AppShell, ModeToggleButton } from './components/layout/AppShell';
import { useVelocityStore, Variable, VariableSet, PersistenceState } from './store';
import { DndContext, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor, DragEndEvent, DragStartEvent, useDroppable, closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { VariableCard } from './features/dashboard/components/DraggableVariable';
import { ContextMenu } from './features/dashboard/components/ContextMenu';
import { InputModal } from './components/overlays/InputModal';

// Smart Canvas Wrapper
const SmartCanvas: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-indigo-50/30' : ''} transition-colors duration-300`}
    >
      {children}
    </div>
  );
};

// App Modes
type AppMode = 'splash' | 'uploading' | 'dashboard' | 'restoring';

// RestorationPrompt Component
interface RestorationPromptProps {
  rowCount: number;
  columnCount: number;
  datasetName?: string;
  onRestore: () => void;
  onDiscard: () => void;
}

const RestorationPrompt: React.FC<RestorationPromptProps> = ({
  rowCount,
  columnCount,
  datasetName,
  onRestore,
  onDiscard,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-white z-40"
    >
      <div className="text-center space-y-6 max-w-md w-full px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome Back</h1>
          <p className="text-slate-500 text-lg">We found your previous session.</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Table className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-slate-800">
                {datasetName || 'Previous Session'}
              </p>
              <p className="text-sm text-slate-500">
                {rowCount.toLocaleString()} rows, {columnCount} columns
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <motion.button
            onClick={onRestore}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Restore Session
          </motion.button>
          <motion.button
            onClick={onDiscard}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-gray-100 text-slate-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Start Fresh
          </motion.button>
        </div>

        <p className="text-xs text-slate-400">
          Your data is stored locally in your browser.
        </p>
      </div>
    </motion.div>
  );
};

export default function App() {
  // Access store state and actions
  const {
    isDbReady,
    initError,
    dataset,
    variableSets,
    tableConfig,
    queryResult,
    isQuerying,
    draggingId,
    searchQuery,
    viewMode,
    recodeModal,
    drillDown,
    activeFilters,
    filterModal,
    // Persistence state
    opfsAvailable,
    persistenceState,
    persistedDataInfo,
    initWorker,
    loadCSV,
    loadSAV,
    setTableConfig,
    setDraggingId,
    setSearchQuery,
    setViewMode,
    reset,
    createVariableSet,
    openRecodeModal,
    closeRecodeModal,
    openDrillDown,
    loadMoreDrillDown,
    closeDrillDown,
    addFilter,
    removeFilter,
    openFilterModal,
    closeFilterModal,
    reorderRowVars,
    setWeightVariable,
    // Persistence actions
    restoreFromPersistence,
    discardPersistedData,
    // Context awareness: bi-directional focus between Analysis and Variable Manager
    selectedVariableSetId,
    setSelectedVariableSetId,
  } = useVelocityStore();

  const [mode, setMode] = React.useState<AppMode>('splash');
  const [selectedSetIds, setSelectedSetIds] = React.useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = React.useState<{ visible: boolean; x: number; y: number } | null>(null);

  const [activeDragSet, setActiveDragSet] = React.useState<VariableSet | null>(null);
  const [showCombineModal, setShowCombineModal] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Custom collision detection: distinguish between sidebar drags and reordering
  const customCollisionDetection = (args: any) => {
    const { active } = args;
    const activeData = active?.data?.current;

    // Check if we're dragging FROM the sidebar (adding new variable) vs reordering existing
    const isDraggingFromSidebar = activeData?.variableSet && !activeData?.type?.includes('sortable');
    const isReordering = activeData?.type === 'sortable-row';

    if (isReordering) {
      // For reordering: prioritize sortable collisions within the row shelf
      const sortableCollisions = closestCenter(args);
      if (sortableCollisions.length > 0) {
        const firstCollision = sortableCollisions[0];
        // If collision is with another row variable, use it for reordering
        if (tableConfig.rowVars.includes(firstCollision.id as string)) {
          return sortableCollisions;
        }
      }
    }

    // For sidebar drags (or when reordering but not over a sortable item):
    // Use rectIntersection which is more forgiving for larger areas
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      // Prioritize drop zones over sortable items when dragging from sidebar
      const dropZoneCollision = rectCollisions.find(c =>
        c.id === 'drop-zone-rows' || c.id === 'drop-zone-cols' || c.id === 'canvas'
      );
      if (dropZoneCollision && isDraggingFromSidebar) {
        return [dropZoneCollision];
      }
      return rectCollisions;
    }

    // Final fallback to pointer-based detection
    return pointerWithin(args);
  };

  // -- INIT WORKER --
  useEffect(() => {
    initWorker();
  }, [initWorker]);

  // -- PERSISTENCE STATE HANDLING --
  // Track whether we've processed the persistence check
  const hasProcessedPersistence = useRef(false);

  useEffect(() => {
    // Only process once when persistence state becomes 'found' or 'ready'
    if (hasProcessedPersistence.current) return;

    if (persistenceState === 'found' && persistedDataInfo) {
      // Check if we have matching localStorage dataset metadata
      const hasMatchingMetadata = dataset &&
        dataset.rowCount === persistedDataInfo.rowCount &&
        dataset.variables.length === persistedDataInfo.schema.length;

      if (hasMatchingMetadata) {
        // Auto-restore: metadata matches, go straight to dashboard
        console.log('[App] Auto-restoring: localStorage metadata matches OPFS data');
        hasProcessedPersistence.current = true;
        restoreFromPersistence();
        setMode('dashboard');
      } else {
        // Show restoration prompt
        console.log('[App] Showing restoration prompt: metadata mismatch or missing');
        setMode('restoring');
      }
    } else if (persistenceState === 'ready' && mode === 'restoring') {
      // User made a choice or no persisted data - go to appropriate mode
      hasProcessedPersistence.current = true;
      if (dataset) {
        setMode('dashboard');
      } else {
        setMode('splash');
      }
    } else if (persistenceState === 'ready' && mode === 'splash') {
      // Normal startup with no persisted data
      hasProcessedPersistence.current = true;
    }
  }, [persistenceState, persistedDataInfo, dataset, mode, restoreFromPersistence]);

  // -- HANDLE RESTORE/DISCARD ACTIONS --
  const handleRestore = () => {
    restoreFromPersistence();
    setMode('dashboard');
    hasProcessedPersistence.current = true;
  };

  const handleDiscard = async () => {
    await discardPersistedData();
    setMode('splash');
    hasProcessedPersistence.current = true;
  };

  // -- HELPER: CONVERT MOCK TO CSV (For Demo) --
  const loadMockData = async () => {
    if (MOCK_DATASET.data.length === 0) return;
    const headers = Object.keys(MOCK_DATASET.data[0]);
    const csvRows = [
      headers.join(','),
      ...MOCK_DATASET.data.map(row => headers.map(fieldName => `"${row[fieldName]}"`).join(','))
    ];
    const csvContent = csvRows.join('\n');

    await loadCSV('mock_data.csv', csvContent);
    setMode('dashboard');
  };

  // -- LOGIC: UPLOAD --
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMode('uploading');

    try {
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext === 'sav') {
        // SAV file - read as ArrayBuffer
        const buffer = await file.arrayBuffer();
        await loadSAV(file.name, buffer);
      } else {
        // CSV or other text file
        const text = await file.text();
        await loadCSV(file.name, text);
      }

      setMode('dashboard');
    } catch (err) {
      console.error(err);
      alert('Error loading file. Check console.');
      setMode('splash');
    }
  };

  const handleDemoClick = () => {
    setMode('uploading');
    setTimeout(() => {
      loadMockData();
    }, 800);
  };

  // -- LOGIC: DRAG & DROP --
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const set = active.data.current?.variableSet;
    if (set) {
      setActiveDragSet(set);
      setDraggingId(set.id); // Keep store in sync for UI states
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;

    setActiveDragSet(null);
    setDraggingId(null);

    if (!over) return;

    // Check if this is a sortable reorder event (both active and over are row variable IDs)
    const activeId = active.id as string;
    const overId = over.id as string;

    // If both IDs are in the rowVars array, this is a reorder event
    if (tableConfig.rowVars.includes(activeId) && tableConfig.rowVars.includes(overId)) {
      const oldIndex = tableConfig.rowVars.indexOf(activeId);
      const newIndex = tableConfig.rowVars.indexOf(overId);

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(tableConfig.rowVars, oldIndex, newIndex);
        reorderRowVars(newOrder);
      }
      return;
    }

    // Otherwise, handle as a drop from sidebar to shelf
    if (active.data.current?.variableSet) {
      const zoneId = over.id;
      const setId = active.data.current.variableSet.id;

      if (zoneId === 'drop-zone-rows') {
        // Add to existing rows if not already present
        if (!tableConfig.rowVars.includes(setId)) {
          setTableConfig({ rowVars: [...tableConfig.rowVars, setId] });
        }
      } else if (zoneId === 'drop-zone-cols') {
        setTableConfig({ colVar: setId });
      } else if (zoneId === 'canvas') {
        // Smart Drop Logic
        if (tableConfig.rowVars.length === 0) {
          setTableConfig({ rowVars: [setId] });
        } else {
          // Default to Column if Row is present, or replace Column if present
          setTableConfig({ colVar: setId });
        }
      }
    }
  };

  const handleVariableClick = (set: VariableSet, e: React.MouseEvent) => {
    // Always update the focused variable for bi-directional context awareness
    // This enables: click in Analysis → open Variable Manager → focused on same variable
    setSelectedVariableSetId(set.id);

    // Multi-select Logic
    if (e.metaKey || e.ctrlKey) {
      const newSelected = new Set(selectedSetIds);
      if (newSelected.has(set.id)) {
        newSelected.delete(set.id);
      } else {
        newSelected.add(set.id);
      }
      setSelectedSetIds(newSelected);
      return;
    }

    // Default Interaction: Add to analysis (First rows, then columns)
    if (tableConfig.rowVars.length === 0) {
      setTableConfig({ rowVars: [set.id] });
    } else if (!tableConfig.colVar) {
      setTableConfig({ colVar: set.id });
    } else {
      setTableConfig({ colVar: set.id });
    }
  };

  const handleContextMenu = (set: VariableSet, e: React.MouseEvent) => {
    // If clicking something not selected, select only that
    let newSelected = new Set(selectedSetIds);
    if (!selectedSetIds.has(set.id)) {
      newSelected = new Set([set.id]);
      setSelectedSetIds(newSelected);
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleCombineSets = () => {
    setShowCombineModal(true);
  };

  const handleCombineSubmit = (name: string) => {
    createVariableSet(name, Array.from(selectedSetIds).flatMap(id => {
      const set = variableSets.find(s => s.id === id);
      return set ? set.variableIds : [];
    }));
    setSelectedSetIds(new Set());
  };

  // Derive values from store
  const variables = dataset?.variables || [];
  const filename = dataset?.name || '';
  const totalRows = dataset?.rowCount || queryResult.reduce((sum, r) => sum + r.count, 0);

  const displaySets = variableSets || [];

  // Get IDs of variables currently in use on the canvas
  const inUseIds = new Set([
    ...tableConfig.rowVars,
    ...(tableConfig.colVar ? [tableConfig.colVar] : [])
  ]);

  // Filter variables based on search AND exclude those already in use
  const filteredSets = displaySets
    .filter(s => !inUseIds.has(s.id)) // Exclude variables in use
    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Handle cell click for drill down (accepts full row path for nested rows)
  const handleCellClick = (rowPath: { variable: string; value: string }[], colValue: string | null) => {
    openDrillDown(rowPath, colValue);
  };

  // Handle recode
  const handleRecodeClick = (set: VariableSet) => {
    // For MVP, if it's a set, prevent or handle differently?
    // Since Sets are 1:1 mostly, we resolve to the first var
    const variable = variables.find(v => v.id === set.variableIds[0]);
    if (variable) openRecodeModal(variable);
  };

  const handleRecodeComplete = async () => {
    // Refresh is handled by store
  };

  return (
    <div className={`min-h-screen bg-white text-slate-800 antialiased overflow-hidden flex flex-col ${draggingId ? 'select-none cursor-grabbing' : ''}`}>

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv,.sav" />

      {/* MODALS */}
      <DataDrawer
        isOpen={drillDown.isOpen}
        onClose={closeDrillDown}
        title={drillDown.title}
        data={drillDown.data}
        loading={drillDown.loading}
        totalCount={drillDown.totalCount}
        loadedCount={drillDown.data.length}
        onLoadMore={loadMoreDrillDown}
        filterColumns={[
          ...drillDown.rowFilters.map(f => f.variable),
          ...(drillDown.colFilter ? [drillDown.colFilter.variable] : [])
        ]}
      />

      <RecodeModal
        isOpen={recodeModal.isOpen}
        onClose={closeRecodeModal}
        variable={recodeModal.variable as any}
        onSave={handleRecodeComplete}
      />

      <FilterModal
        isOpen={filterModal.isOpen}
        onClose={closeFilterModal}
        variables={variables}
        onSave={addFilter}
      />

      <InputModal
        isOpen={showCombineModal}
        onClose={() => setShowCombineModal(false)}
        onSubmit={handleCombineSubmit}
        title="Combine Variables"
        placeholder="Enter name for new variable set..."
        submitLabel="Create"
      />

      {contextMenu && contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          actions={[
            {
              label: 'Combine Variables',
              onClick: handleCombineSets,
              disabled: selectedSetIds.size < 2 // Require at least 2 to combine
            }
          ]}
        />
      )}

      {/* GLOBAL PROGRESS BAR */}
      <AnimatePresence>
        {mode === 'uploading' && (
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            className="fixed top-0 left-0 h-1 bg-indigo-600 z-50 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
          />
        )}
      </AnimatePresence>

      {/* SPLASH SCREEN */}
      <AnimatePresence>
        {mode === 'splash' && (
          <motion.div
            exit={{ opacity: 0, y: -20, pointerEvents: 'none' }}
            className="fixed inset-0 flex items-center justify-center bg-white z-40"
          >
            <div className="text-center space-y-8 max-w-md w-full px-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">Velocity.</h1>
                <p className="text-slate-500 text-lg">The zero-latency research dashboard.</p>

                {initError ? (
                  <div className="flex items-center justify-center gap-2 text-red-500 text-sm font-medium bg-red-50 p-2 rounded-md">
                    <AlertCircle size={16} />
                    <span>{initError}</span>
                  </div>
                ) : (
                  !isDbReady && <p className="text-xs text-indigo-500 animate-pulse">Initializing Analysis Engine...</p>
                )}
              </div>

              <motion.button
                onClick={() => isDbReady && fileInputRef.current?.click()}
                disabled={!isDbReady}
                whileHover={{ scale: 1.02, borderColor: '#4F46E5', backgroundColor: '#EEF2FF' }}
                whileTap={{ scale: 0.98 }}
                className={`w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 group transition-all cursor-pointer bg-gray-50/30
                  ${isDbReady ? 'border-gray-300' : 'border-gray-200 opacity-50 cursor-not-allowed'}`}
              >
                <div className="p-4 bg-white rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                  {isDbReady ? <FileUp className="w-8 h-8 text-indigo-500" /> : <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />}
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-slate-700">Drop .SAV or .CSV file to analyze</p>
                  <p className="text-sm text-slate-400">
                    <span className="hover:text-indigo-600 hover:underline z-50 relative" onClick={(e) => { e.stopPropagation(); handleDemoClick(); }}>
                      or use example data
                    </span>
                  </p>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESTORATION PROMPT */}
      <AnimatePresence>
        {mode === 'restoring' && persistedDataInfo && (
          <RestorationPrompt
            rowCount={persistedDataInfo.rowCount}
            columnCount={persistedDataInfo.schema.length}
            datasetName={dataset?.name}
            onRestore={handleRestore}
            onDiscard={handleDiscard}
          />
        )}
      </AnimatePresence>

      {/* DASHBOARD */}
      {mode === 'dashboard' && (
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
              <aside className="w-72 bg-gray-50/50 border-r border-gray-200 flex flex-col shrink-0 z-30 relative">
                <div className="p-4 border-b border-gray-100 bg-white">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                      <span className="text-white font-bold text-xs">V</span>
                    </div>
                    <span className="font-semibold text-slate-800 tracking-tight">Velocity</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search variables..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-gray-100 border-none rounded-md text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-4 pt-3 shrink-0">
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

                <div className="p-3 border-t border-gray-200 bg-white">
                  <div className="flex items-center gap-3 text-xs text-gray-500 px-2">
                    <CheckCircle2 size={12} className="text-green-500" />
                    <span>{filename} ({totalRows} rows)</span>
                  </div>
                </div>
              </aside>

              {/* MAIN CANVAS */}
              <main className="flex-1 flex flex-col bg-white relative overflow-hidden z-0">
                {/* HEADER */}
                <header className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0 z-10">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Analysis</span>
                    <span>/</span>
                    <span className="text-gray-900 font-medium">Untitled Crosstab</span>
                  </div>

                  <div className="flex items-center gap-6">

                    {/* Weight Variable Selector */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-500">Weight:</label>
                      <select
                        value={dataset?.weightVariable || ''}
                        onChange={(e) => setWeightVariable(e.target.value || null)}
                        className={`text-xs px-2 py-1.5 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all min-w-[120px] ${dataset?.weightVariable ? 'border-indigo-300 text-indigo-700 font-medium' : 'border-gray-200 text-gray-600'
                          }`}
                      >
                        <option value="">None</option>
                        {variables
                          .filter(v => v.type === 'scale')
                          .map(v => (
                            <option key={v.id} value={v.id}>
                              {v.label || v.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => setViewMode('table')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <Table size={16} />
                      </button>
                      <button
                        onClick={() => setViewMode('chart')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <BarChart3 size={16} />
                      </button>
                    </div>

                    <ModeToggleButton />

                    <button
                      onClick={reset}
                      className="text-xs font-medium text-gray-500 hover:text-indigo-600 flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
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
                <SmartCanvas className="flex-1 overflow-auto bg-[#FAFAFA] relative flex flex-col">
                  <div className="w-full max-w-5xl mx-auto p-8 flex flex-col gap-6">

                    {/* COLUMN SHELF */}
                    <div className="flex gap-4 items-center pl-32">
                      <div className="w-8 flex justify-center">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider rotate-180 writing-mode-vertical">Columns</span>
                      </div>
                      <DropZone
                        id="drop-zone-cols"
                        type="column"
                        label="Drop Column Variable"
                        active={!!draggingId}
                        currentVariables={tableConfig.colVar ? [variableSets.find(s => s.id === tableConfig.colVar)!].filter(Boolean) : []}
                        onRemove={() => setTableConfig({ colVar: null })}
                      />
                    </div>

                    <div className="flex gap-4 items-start">
                      {/* ROW SHELF */}
                      <div className="w-40 flex flex-col items-end gap-2 pt-16">
                        <DropZone
                          id="drop-zone-rows"
                          type="row"
                          label="Drop Row Variable(s)"
                          active={!!draggingId}
                          currentVariables={tableConfig.rowVars.map(id => variableSets.find(s => s.id === id)).filter(Boolean) as VariableSet[]}
                          onRemove={(id) => setTableConfig({ rowVars: tableConfig.rowVars.filter(r => r !== id) })}
                        />
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider pr-1">Rows</span>
                      </div>

                      {/* RESULT AREA */}
                      <div className="flex-1 min-h-[400px]">
                        {tableConfig.rowVars.length > 0 ? (
                          <div className="relative">
                            {isQuerying && (
                              <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center backdrop-blur-sm">
                                <Loader2 className="animate-spin text-indigo-600" size={32} />
                              </div>
                            )}
                            <DataTable
                              data={queryResult}
                              rowVariables={tableConfig.rowVars
                                .map(id => variableSets.find(s => s.id === id)) // Resolve Set
                                .filter(Boolean)
                                .map(set => variables.find(v => v.id === set!.variableIds[0])) // Resolve Var
                                .filter(Boolean) as Variable[]
                              }
                              colVariable={(() => {
                                const set = variableSets.find(s => s.id === tableConfig.colVar);
                                return set ? variables.find(v => v.id === set.variableIds[0]) : null;
                              })() as any}
                              totalCount={totalRows}
                              viewMode={viewMode}
                              isWeighted={!!dataset?.weightVariable}
                              onCellClick={handleCellClick}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-64 border-2 border-dashed border-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-300 gap-4 bg-white">
                            <LayoutGrid size={48} className="opacity-20" />
                            <p className="text-sm font-medium">Drag variables to the Row shelf to start</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </SmartCanvas>
              </main>
            </motion.div>

            <DragOverlay dropAnimation={null}>
              {activeDragSet ? (
                <VariableCard
                  variableSet={activeDragSet}
                  isOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </AppShell>
      )}
    </div>
  );
}