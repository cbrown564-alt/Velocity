import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Table, RotateCcw, X, CheckCircle2, Search, BarChart3, LayoutGrid, Loader2, AlertCircle, Moon, Sun, Home } from 'lucide-react';
import { useTheme } from './context/ThemeContext';

import { MOCK_DATASET } from './constants';
import { DraggableVariable } from './features/dashboard/components/DraggableVariable';
import { VirtualizedVariableList } from './features/dashboard/components/VirtualizedVariableList';
import { DropZone } from './components/common/DropZone';
import { SlideContainer } from './features/dashboard/components/SlideContainer';
import { TimelineDock } from './features/dashboard/components/TimelineDock';
// import { DataTable } from './features/dashboard/components/DataTable'; // Keeping import for now if needed by other components, but effectively replaced

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
import * as opfsFileManager from './services/opfsFileManager';
import { WorkspaceView, ProjectLinkModal, CrossWavePanel, type StoredDataset, type Project } from './features/workspace';

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
type AppMode = 'splash' | 'uploading' | 'dashboard' | 'restoring' | 'metadata';

// RestorationPrompt Component
interface RestorationPromptProps {
  rowCount: number;
  columnCount: number;
  datasetName?: string;
  lastModified?: number;
  warning?: string | null;
  onRestore: () => void;
  onDiscard: () => void;
}

const RestorationPrompt: React.FC<RestorationPromptProps> = ({
  rowCount,
  columnCount,
  datasetName,
  lastModified,
  warning,
  onRestore,
  onDiscard,
}) => {
  const lastModifiedLabel = lastModified ? new Date(lastModified).toLocaleString() : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-white z-40"
    >
      <div className="text-center space-y-6 max-w-md w-full px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Welcome Back</h1>
          <p className="text-[var(--text-secondary)] text-lg">We found your previous session.</p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-xl p-6 text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Table className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {datasetName || 'Previous Session'}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {rowCount.toLocaleString()} rows, {columnCount} columns
              </p>
              {lastModifiedLabel && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Last opened: {lastModifiedLabel}
                </p>
              )}
            </div>
          </div>
          {warning && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2">
              {warning}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <motion.button
            onClick={onRestore}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-[var(--color-accent)] text-[var(--text-inverse)] font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Restore Session
          </motion.button>
          <motion.button
            onClick={onDiscard}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-[var(--bg-active)] text-[var(--text-primary)] font-medium rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
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
  const { theme, toggleTheme } = useTheme();
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
    activeVariableStats,
    filterModal,
    // Persistence state
    opfsAvailable,
    persistenceMode,
    persistenceError,
    activeDbPath,
    persistenceState,
    persistedDataInfo,
    initWorker,
    loadCSV,
    loadSAV,
    loadSAVMetadata,
    loadSAVSample,
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
    rehydrateDatasetFromOpfs,
    // Context awareness: bi-directional focus between Analysis and Variable Manager
    selectedVariableSetId,
    setSelectedVariableSetId,
    // Workspace state
    workspace,
    isWorkspaceMode,
    setWorkspaceMode,
    activeDatasetId,
    setActiveDataset,
    addStoredDataset,
    updateStoredDataset,
    toggleDatasetStar,
    removeStoredDataset,
    updateDatasetAccess,
    saveDatasetSession,
    updateStorageQuota,
    // Project management
    createProject,
    addDatasetsToProject,
    removeDatasetsFromProject,
    setDatasetWave,
    setDatasetRespondentKey,
  } = useVelocityStore();

  const [mode, setMode] = React.useState<AppMode>('splash');
  const [selectedSetIds, setSelectedSetIds] = React.useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = React.useState<{ visible: boolean; x: number; y: number } | null>(null);

  const [activeDragSet, setActiveDragSet] = React.useState<VariableSet | null>(null);
  const [showCombineModal, setShowCombineModal] = React.useState(false);
  // Weight toggle: remember the variable when disabled so we can re-enable without re-dragging
  const [weightEnabled, setWeightEnabled] = React.useState(true);
  const [rememberedWeightVar, setRememberedWeightVar] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingSavFile, setPendingSavFile] = React.useState<File | null>(null);
  const [pendingSavSizeMb, setPendingSavSizeMb] = React.useState<number | null>(null);
  const [opfsStorageKey, setOpfsStorageKey] = React.useState<string | null>(null);
  const [opfsAvailableLocal, setOpfsAvailableLocal] = React.useState<boolean>(false);
  const [opfsEstimate, setOpfsEstimate] = React.useState<{ usage: number; quota: number } | null>(null);
  const [opfsDbFiles, setOpfsDbFiles] = React.useState<{ name: string; size: number; lastModified: number }[] | null>(null);
  const [opfsDbListError, setOpfsDbListError] = React.useState<string | null>(null);
  const [opfsDbPurgeError, setOpfsDbPurgeError] = React.useState<string | null>(null);
  const [opfsRehydrateError, setOpfsRehydrateError] = React.useState<string | null>(null);

  // Project modal state
  const [showProjectModal, setShowProjectModal] = React.useState(false);
  const [projectModalDatasetIds, setProjectModalDatasetIds] = React.useState<string[]>([]);

  // Cross-wave panel state
  const [showCrossWavePanel, setShowCrossWavePanel] = React.useState(false);
  const [crossWaveProject, setCrossWaveProject] = React.useState<Project | null>(null);
  const [crossWaveDatasets, setCrossWaveDatasets] = React.useState<StoredDataset[]>([]);
  const [selectedWaves, setSelectedWaves] = React.useState<[StoredDataset, StoredDataset] | undefined>(undefined);

  const SAV_WARN_MB = 50;
  const SAV_HARD_MB = 200;
  const SAV_SAMPLE_ROWS = 1000;

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

  const opfsUsageMb = opfsEstimate ? opfsEstimate.usage / (1024 * 1024) : null;
  const opfsQuotaMb = opfsEstimate ? opfsEstimate.quota / (1024 * 1024) : null;
  const opfsUsagePct = opfsEstimate && opfsEstimate.quota > 0
    ? Math.min(100, Math.round((opfsEstimate.usage / opfsEstimate.quota) * 100))
    : null;
  const opfsDbLabel = activeDbPath?.startsWith('opfs://')
    ? activeDbPath.replace('opfs://', '')
    : activeDbPath;

  const restoreWarning = React.useMemo(() => {
    if (!persistedDataInfo?.metadata || !dataset) return null;
    const meta = persistedDataInfo.metadata;
    const mismatches: string[] = [];
    if (meta.datasetId && dataset.id !== meta.datasetId) {
      mismatches.push('dataset id');
    }
    if (dataset.rowCount !== meta.rowCount) {
      mismatches.push('row count');
    }
    if (dataset.variables.length !== meta.columnCount) {
      mismatches.push('column count');
    }
    if (mismatches.length === 0) return null;
    return `Local data differs from OPFS metadata (${mismatches.join(', ')}). Restoring will use OPFS data.`;
  }, [persistedDataInfo, dataset]);

  const opfsErrorHint = React.useMemo(() => {
    if (!persistenceError) return null;
    const normalized = persistenceError.toLowerCase();

    if (normalized.includes('opfs disabled by feature flag') || normalized.includes('does not support opfs db persistence')) {
      return 'DuckDB OPFS database-file persistence is disabled on this build. Velocity will use in-memory DuckDB and restore from the OPFS source file when available.';
    }

    if (
      normalized.includes('access handle') ||
      normalized.includes('writable stream') ||
      normalized.includes('another open access handle')
    ) {
      return 'OPFS database is locked (often another tab is using it). Close other Velocity tabs and reload to re-enable fast OPFS DB restore.';
    }

    if (normalized.includes('not a valid duckdb database file') || normalized.includes('corrupt')) {
      return 'OPFS database looks corrupted or partially written. Velocity will fall back to rebuilding from the OPFS source file when possible. You can also purge quarantined DBs.';
    }

    if (normalized.includes('insecure context')) {
      return 'OPFS requires a secure context (HTTPS or localhost).';
    }

    if (normalized.includes('unsupported') || normalized.includes('getdirectory')) {
      return 'OPFS is not supported in this browser/environment (private browsing can also disable it).';
    }

    return null;
  }, [persistenceError]);

  const rebuildFromOpfsSource = React.useCallback(async (fallbackMode: AppMode) => {
    if (!dataset?.opfsFileKey) return;
    setOpfsRehydrateError(null);
    setMode('uploading');
    try {
      await rehydrateDatasetFromOpfs();
      setMode('dashboard');
    } catch (error: any) {
      const message = error?.message || String(error) || 'Failed to restore from OPFS source file';
      setOpfsRehydrateError(message);
      setMode(fallbackMode);
    }
  }, [dataset?.opfsFileKey, rehydrateDatasetFromOpfs]);

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
        c.id === 'drop-zone-rows' || c.id === 'drop-zone-cols' || c.id === 'drop-zone-weight' || c.id === 'canvas'
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

  // -- CHECK OPFS AVAILABILITY --
  useEffect(() => {
    opfsFileManager.isAvailable().then(setOpfsAvailableLocal);
  }, []);

  useEffect(() => {
    let mounted = true;
    const refreshEstimate = () => {
      opfsFileManager.getStorageEstimate().then((estimate) => {
        if (mounted) setOpfsEstimate(estimate);
      });
    };

    refreshEstimate();
    const interval = window.setInterval(refreshEstimate, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const refreshOpfsDbFiles = async () => {
    try {
      setOpfsDbListError(null);
      const files = await opfsFileManager.listDbFiles();
      setOpfsDbFiles(files);
    } catch (error: any) {
      setOpfsDbListError(error?.message || 'Failed to list OPFS DB files');
      setOpfsDbFiles(null);
    }
  };

  const purgeQuarantinedDbs = async () => {
    try {
      setOpfsDbPurgeError(null);
      const files = opfsDbFiles ?? await opfsFileManager.listDbFiles();
      const quarantined = files.filter((file) => file.name.includes('.corrupt_'));
      await Promise.all(quarantined.map((file) => opfsFileManager.deleteDbFile(file.name)));
      await refreshOpfsDbFiles();
    } catch (error: any) {
      setOpfsDbPurgeError(error?.message || 'Failed to purge quarantined DBs');
    }
  };

  // -- PERSISTENCE STATE HANDLING --
  // Track whether we've processed the persistence check
  const hasProcessedPersistence = useRef(false);

  useEffect(() => {
    // Only process once when persistence state becomes 'found' or 'ready'
    if (hasProcessedPersistence.current) return;

    if (persistenceState === 'found' && persistedDataInfo) {
      const persistedMeta = persistedDataInfo.metadata;
      // Check if we have matching localStorage dataset metadata
      const hasMatchingMetadata = dataset && (persistedMeta
        ? (
          dataset.rowCount === persistedMeta.rowCount &&
          dataset.variables.length === persistedMeta.columnCount &&
          (persistedMeta.datasetId ? dataset.id === persistedMeta.datasetId : true)
        )
        : (
          dataset.rowCount === persistedDataInfo.rowCount &&
          dataset.variables.length === persistedDataInfo.schema.length
        ));

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
      if (dataset?.opfsFileKey) {
        console.log('[App] Rehydrating DuckDB from OPFS source file');
        hasProcessedPersistence.current = true;
        void rebuildFromOpfsSource('splash');
      } else {
        // Normal startup with no persisted data
        hasProcessedPersistence.current = true;
      }
    }
  }, [persistenceState, persistedDataInfo, dataset, mode, restoreFromPersistence, rebuildFromOpfsSource]);

  // -- HANDLE RESTORE/DISCARD ACTIONS --
  const handleRestore = () => {
    setOpfsRehydrateError(null);
    restoreFromPersistence();
    setMode('dashboard');
    hasProcessedPersistence.current = true;
  };

  const handleDiscard = async () => {
    setOpfsRehydrateError(null);
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

    setOpfsRehydrateError(null);
    setMode('uploading');

    try {
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext === 'sav') {
        const datasetId = crypto.randomUUID();
        const fileSizeMb = file.size / (1024 * 1024);
        const shouldWarn = fileSizeMb >= SAV_WARN_MB;
        const mustMetadataOnly = fileSizeMb >= SAV_HARD_MB;

        setPendingSavFile(file);
        setPendingSavSizeMb(fileSizeMb);

        let buffer: ArrayBuffer | null = null;
        let storageKey: string | null = null;

        // Store in OPFS for local-first restore (best-effort).
        if (opfsAvailableLocal) {
          try {
            if (dataset?.opfsFileKey) {
              // App is currently single-dataset. Clean up the previous source file to avoid unbounded OPFS growth.
              await opfsFileManager.deleteFile(dataset.opfsFileKey).catch(() => { });
            }

            let canStore = true;
            const estimate = await opfsFileManager.getStorageEstimate();
            if (estimate) {
              const available = estimate.quota - estimate.usage;
              const required = Math.ceil(file.size * 1.2);
              if (available < required) {
                canStore = false;
                console.warn('📁 [App] Skipping OPFS storage due to low quota');
              }
            }

            if (canStore) {
              storageKey = opfsFileManager.generateStorageKey(file.name);
              buffer = await file.arrayBuffer();
              await opfsFileManager.storeFile(storageKey, buffer);
              setOpfsStorageKey(storageKey);
              console.log(`📁 [App] Stored file in OPFS: ${storageKey}`);
            }
          } catch (opfsErr) {
            console.warn('📁 [App] Failed to store in OPFS, will fall back to file reference:', opfsErr);
            storageKey = null;
            setOpfsStorageKey(null);
          }
        }

        if (!buffer) {
          buffer = await file.arrayBuffer();
        }

        if (mustMetadataOnly) {
          await loadSAVSample(file.name, buffer, SAV_SAMPLE_ROWS);
          setMode('metadata');
          return;
        }

        if (shouldWarn) {
          const proceed = window.confirm(
            `This file is ${fileSizeMb.toFixed(1)} MB. Full ingestion may crash the tab. Load full data anyway?`
          );
          if (!proceed) {
            await loadSAVSample(file.name, buffer, SAV_SAMPLE_ROWS);
            setMode('metadata');
            return;
          }
        }

        await loadSAV(file.name, buffer, { datasetId, opfsFileKey: storageKey || undefined });
        setOpfsStorageKey(null);
        setPendingSavFile(null);
        setPendingSavSizeMb(null);
      } else {
        setPendingSavFile(null);
        setPendingSavSizeMb(null);
        setOpfsStorageKey(null);
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

  const handleMetadataLoadFull = async () => {
    if (!pendingSavFile && !opfsStorageKey) return;
    setMode('uploading');

    try {
      // Read from OPFS if available, otherwise from file reference
      let buffer: ArrayBuffer;
      let fileName: string;

      if (opfsStorageKey) {
        console.log(`📁 [App] Reading from OPFS: ${opfsStorageKey}`);
        buffer = await opfsFileManager.readFile(opfsStorageKey);
        fileName = pendingSavFile?.name || 'restored.sav';
      } else if (pendingSavFile) {
        buffer = await pendingSavFile.arrayBuffer();
        fileName = pendingSavFile.name;
      } else {
        throw new Error('No file available to load');
      }

      await loadSAV(fileName, buffer, { opfsFileKey: opfsStorageKey || undefined });
      // Keep OPFS source file for local-first restore.
      setOpfsStorageKey(null);
      setPendingSavFile(null);
      setPendingSavSizeMb(null);
      setMode('dashboard');
    } catch (err) {
      console.error(err);
      alert('Error loading file. Check console.');
      setMode('splash');
    }
  };

  const handleMetadataCancel = async () => {
    await discardPersistedData();
    // Clean up OPFS storage
    if (opfsStorageKey) {
      await opfsFileManager.deleteFile(opfsStorageKey).catch(() => { });
      setOpfsStorageKey(null);
    }
    setPendingSavFile(null);
    setPendingSavSizeMb(null);
    setMode('splash');
  };

  // -- WORKSPACE HANDLERS --

  // Track which datasets we've registered to avoid infinite loops
  const registeredDatasetIds = useRef<Set<string>>(new Set());

  // Register current dataset in workspace when loaded
  // Note: We use a ref to track registration to avoid dependency on workspace.datasets
  // which would cause infinite re-renders when we modify workspace state
  const registerDatasetInWorkspace = useCallback(() => {
    if (!dataset) return;

    // Skip if already registered this session
    if (registeredDatasetIds.current.has(dataset.id)) {
      return;
    }

    // Mark as registered immediately to prevent re-entry
    registeredDatasetIds.current.add(dataset.id);

    // Register new dataset (the store will handle deduplication)
    addStoredDataset({
      name: dataset.name,
      fileName: dataset.name,
      rowCount: dataset.rowCount,
      columnCount: dataset.variables.length,
      fileSize: 0, // Will be updated from OPFS if available
      source: dataset.source,
    });

    // Try to get file size from OPFS
    if (dataset.opfsFileKey) {
      opfsFileManager.getFileSize(dataset.opfsFileKey)
        .then(size => {
          if (size > 0) {
            updateStoredDataset(dataset.id, { fileSize: size });
          }
        })
        .catch(() => { });
    }

    setActiveDataset(dataset.id);
  }, [dataset, addStoredDataset, updateStoredDataset, setActiveDataset]);

  // Open dataset from workspace
  const handleOpenDataset = useCallback(async (storedDataset: StoredDataset) => {
    // Save current session before switching
    if (dataset && activeDatasetId) {
      saveDatasetSession(activeDatasetId, {
        tableConfig,
        activeFilters,
        transformLog: [],
      });
    }

    updateDatasetAccess(storedDataset.id);
    setActiveDataset(storedDataset.id);
    setWorkspaceMode(false);

    // If this is the currently loaded dataset, just switch modes
    if (dataset?.id === storedDataset.id) {
      setMode('dashboard');
      return;
    }

    // Otherwise, we need to load the dataset
    // For now, show a message that user needs to re-upload
    // TODO: Implement proper dataset switching with OPFS lookup
    setMode('dashboard');
  }, [dataset, activeDatasetId, tableConfig, activeFilters, saveDatasetSession, updateDatasetAccess, setActiveDataset, setWorkspaceMode]);

  // Delete dataset from workspace
  const handleDeleteDataset = useCallback(async (id: string) => {
    if (window.confirm('Delete this dataset from your workspace? The original file will not be affected.')) {
      removeStoredDataset(id);
      if (activeDatasetId === id) {
        setActiveDataset(null);
      }
    }
  }, [removeStoredDataset, activeDatasetId, setActiveDataset]);

  // Toggle dataset star
  const handleToggleDatasetStar = useCallback((id: string) => {
    toggleDatasetStar(id);
  }, [toggleDatasetStar]);

  // Return to workspace
  const handleReturnToWorkspace = useCallback(() => {
    // Save current session
    if (dataset && activeDatasetId) {
      saveDatasetSession(activeDatasetId, {
        tableConfig,
        activeFilters,
        transformLog: [],
      });
    }
    setWorkspaceMode(true);
    setMode('splash');
  }, [dataset, activeDatasetId, tableConfig, activeFilters, saveDatasetSession, setWorkspaceMode]);

  // Open project creation modal
  const handleOpenProjectModal = useCallback((datasetIds: string[]) => {
    setProjectModalDatasetIds(datasetIds);
    setShowProjectModal(true);
  }, []);

  // Create a new project
  const handleCreateProject = useCallback((project: Omit<Project, 'id' | 'createdAt'>) => {
    createProject(project);
    setShowProjectModal(false);
    setProjectModalDatasetIds([]);
  }, [createProject]);

  // Add datasets to existing project
  const handleAddToProject = useCallback((datasetIds: string[], projectId: string) => {
    addDatasetsToProject(datasetIds, projectId);
    setShowProjectModal(false);
    setProjectModalDatasetIds([]);
  }, [addDatasetsToProject]);

  // Update wave number for a dataset
  const handleUpdateWaveNumber = useCallback((datasetId: string, waveNumber: number) => {
    setDatasetWave(datasetId, waveNumber);
  }, [setDatasetWave]);

  // Set respondent key for a dataset
  const handleSetRespondentKey = useCallback((datasetId: string, variableName: string) => {
    setDatasetRespondentKey(datasetId, variableName);
  }, [setDatasetRespondentKey]);

  // Unlink dataset from project
  const handleUnlinkDataset = useCallback((datasetId: string) => {
    removeDatasetsFromProject([datasetId]);
  }, [removeDatasetsFromProject]);

  // Open cross-wave comparison panel
  const handleOpenCrossWavePanel = useCallback((project: Project, wave1: StoredDataset, wave2: StoredDataset) => {
    const projectDatasets = workspace.datasets.filter(d => d.projectId === project.id);
    setCrossWaveProject(project);
    setCrossWaveDatasets(projectDatasets);
    setSelectedWaves([wave1, wave2]);
    setShowCrossWavePanel(true);
  }, [workspace.datasets]);

  // Close cross-wave panel
  const handleCloseCrossWavePanel = useCallback(() => {
    setShowCrossWavePanel(false);
    setCrossWaveProject(null);
    setCrossWaveDatasets([]);
    setSelectedWaves(undefined);
  }, []);

  // Register dataset when it changes
  // Note: We intentionally exclude registerDatasetInWorkspace from deps
  // to avoid infinite loops. The ref-based tracking handles deduplication.
  useEffect(() => {
    if (dataset && mode === 'dashboard') {
      registerDatasetInWorkspace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id, mode]);

  // Refresh storage quota periodically
  // Note: Run once on mount and periodically thereafter
  useEffect(() => {
    const refresh = async () => {
      const estimate = await opfsFileManager.getStorageEstimate();
      if (estimate) {
        updateStorageQuota(estimate.usage, estimate.quota);
      }
    };

    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Otherwise, handle as a drop from sidebar to shelf
    if (active.data.current?.variableSet) {
      const zoneId = over.id;
      const variableSet = active.data.current.variableSet;
      const setId = variableSet.id;

      // GRID AUTO-EXPANSION LOGIC
      if (variableSet.structure === 'grid') {
        const itemsId = `${setId}_items`;
        const scaleId = `${setId}_scale`;

        if (zoneId === 'drop-zone-rows') {
          // Standard Grid: Scale on Rows, Items on Columns
          // We append Scale to existing rows (nesting support)
          // But we force Items to Columns (overwriting)
          if (!tableConfig.rowVars.includes(scaleId)) {
            setTableConfig({
              rowVars: [...tableConfig.rowVars, scaleId],
              colVar: itemsId
            });
          }
        } else if (zoneId === 'drop-zone-cols') {
          // Transposed Grid: Scale on Columns, Items on Rows
          // We set Scale on Col
          // We add Items to Rows
          setTableConfig({
            colVar: scaleId,
            rowVars: tableConfig.rowVars.includes(itemsId) ? tableConfig.rowVars : [...tableConfig.rowVars, itemsId]
          });
        } else if (zoneId === 'canvas') {
          // Smart Drop: Defaults to Scale × Items
          setTableConfig({
            rowVars: [scaleId],
            colVar: itemsId
          });
        }
        return;
      }

      // WEIGHT DROP LOGIC
      if (zoneId === 'drop-zone-weight') {
        // Only accept numeric (scale) variables as weights
        const variable = dataset?.variables.find(v => v.id === variableSet.variableIds[0]);
        if (variable && (variable.type === 'numeric' || variable.type === 'scale')) {
          const varId = variableSet.variableIds[0];
          setWeightVariable(varId);
          setRememberedWeightVar(varId);
          setWeightEnabled(true);
        }
        return;
      }

      // STANDARD LOGIC
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
    // Default Interaction: Add to analysis (First rows, then columns)
    if (set.structure === 'grid') {
      const itemsId = `${set.id}_items`;
      const scaleId = `${set.id}_scale`;

      // Auto-expand to Scale × Items
      // User intent on single click is usually "Show me this variable".
      // For a grid, "Show me" means Scale × Items (rating scale in rows, items in columns).

      setTableConfig({
        rowVars: [scaleId],
        colVar: itemsId
      });
    } else {
      if (tableConfig.rowVars.length === 0) {
        setTableConfig({ rowVars: [set.id] });
      } else if (!tableConfig.colVar) {
        setTableConfig({ colVar: set.id });
      } else {
        setTableConfig({ colVar: set.id });
      }
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

  // Weight toggle handler
  const handleToggleWeight = () => {
    if (weightEnabled && dataset?.weightVariable) {
      // Disabling: remember the var, clear from store
      setRememberedWeightVar(dataset.weightVariable);
      setWeightVariable(null);
      setWeightEnabled(false);
    } else if (!weightEnabled && rememberedWeightVar) {
      // Re-enabling: restore remembered var
      setWeightVariable(rememberedWeightVar);
      setWeightEnabled(true);
    }
  };

  const handleWeightRemove = () => {
    setWeightVariable(null);
    setRememberedWeightVar(null);
    setWeightEnabled(true);
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

  // Filter variables based on search AND exclude those already in use AND exclude hidden variables
  const filteredSets = displaySets
    .filter(s => !inUseIds.has(s.id)) // Exclude variables in use
    .filter(s => !s.hidden) // Exclude hidden variables (managed in Data Mode)
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
    <div className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] antialiased overflow-hidden flex flex-col ${draggingId ? 'select-none cursor-grabbing' : ''}`}>

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

      <ProjectLinkModal
        isOpen={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          setProjectModalDatasetIds([]);
        }}
        datasets={workspace.datasets}
        projects={workspace.projects}
        selectedDatasetIds={projectModalDatasetIds}
        onCreateProject={handleCreateProject}
        onAddToProject={handleAddToProject}
        onUpdateWaveNumber={handleUpdateWaveNumber}
        onSetRespondentKey={handleSetRespondentKey}
      />

      {crossWaveProject && (
        <CrossWavePanel
          isOpen={showCrossWavePanel}
          onClose={handleCloseCrossWavePanel}
          project={crossWaveProject}
          datasets={crossWaveDatasets}
          selectedWaves={selectedWaves}
          onOpenDataset={handleOpenDataset}
        />
      )}

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
            className="fixed top-0 left-0 h-1 bg-[var(--color-accent)] z-50 shadow-[0_0_10px_var(--color-accent)]"
          />
        )}
      </AnimatePresence>

      {/* UPLOADING / RESTORING OVERLAY */}
      <AnimatePresence>
        {mode === 'uploading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] z-40"
          >
            <div className="text-center space-y-4 max-w-md w-full px-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-[var(--color-accent)] animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-[var(--text-primary)]">Loading dataset…</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {pendingSavFile?.name || dataset?.name || 'Preparing analysis engine'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WORKSPACE / SPLASH SCREEN */}
      <AnimatePresence>
        {mode === 'splash' && (
          <motion.div
            exit={{ opacity: 0, y: -20, pointerEvents: 'none' }}
            className="fixed inset-0 bg-[var(--bg-app)] z-40"
          >
            {/* Show initialization status if not ready */}
            {(!isDbReady || initError) && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-app)] z-50">
                <div className="text-center space-y-4 max-w-md w-full px-6">
                  <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">Velocity.</h1>
                  <p className="text-[var(--text-secondary)] text-lg">The zero-latency research dashboard.</p>
                  {initError ? (
                    <div className="flex items-center justify-center gap-2 text-red-500 text-sm font-medium bg-red-50 p-2 rounded-md">
                      <AlertCircle size={16} />
                      <span>{initError}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 text-[var(--color-accent)] animate-spin" />
                      <p className="text-sm text-[var(--color-accent)]">Initializing Analysis Engine...</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Show WorkspaceView when ready */}
            {isDbReady && !initError && (
              <WorkspaceView
                workspaceState={workspace}
                onOpenDataset={handleOpenDataset}
                onUploadFile={() => fileInputRef.current?.click()}
                onLoadExample={handleDemoClick}
                onCreateProject={handleOpenProjectModal}
                onDeleteDataset={handleDeleteDataset}
                onToggleStar={handleToggleDatasetStar}
                onLinkDatasets={handleAddToProject}
                onUnlinkDataset={handleUnlinkDataset}
                onCompareWaves={handleOpenCrossWavePanel}
              />
            )}

            {/* Error overlay for OPFS issues */}
            {dataset && (opfsRehydrateError || persistenceError) && (
              <div className="absolute bottom-6 left-6 right-6 max-w-lg mx-auto">
                <div className="text-left text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-4 shadow-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      {opfsRehydrateError && (
                        <div className="text-sm font-medium">Couldn't restore data from OPFS source file.</div>
                      )}
                      {opfsRehydrateError && (
                        <div className="text-xs break-words">{opfsRehydrateError}</div>
                      )}
                      {!opfsRehydrateError && persistenceError && (
                        <div className="text-xs break-words">OPFS: {persistenceError}</div>
                      )}
                      {opfsErrorHint && (
                        <div className="text-xs">{opfsErrorHint}</div>
                      )}
                    </div>
                  </div>

                  {dataset.opfsFileKey && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void rebuildFromOpfsSource('splash')}
                        className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-[var(--text-inverse)] text-xs font-medium hover:opacity-90 transition-opacity"
                      >
                        Retry Restore
                      </button>
                      <button
                        type="button"
                        onClick={handleDiscard}
                        className="px-3 py-1.5 rounded bg-white border border-amber-200 text-amber-900 text-xs font-medium hover:bg-amber-100 transition-colors"
                      >
                        Start Fresh
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESTORATION PROMPT */}
      <AnimatePresence>
        {mode === 'restoring' && persistedDataInfo && (
          <RestorationPrompt
            rowCount={persistedDataInfo.rowCount}
            columnCount={persistedDataInfo.schema.length}
            datasetName={persistedDataInfo.metadata?.datasetName || dataset?.name}
            lastModified={persistedDataInfo.metadata?.lastModified}
            warning={restoreWarning}
            onRestore={handleRestore}
            onDiscard={handleDiscard}
          />
        )}
      </AnimatePresence>

      {/* METADATA-ONLY MODE */}
      <AnimatePresence>
        {mode === 'metadata' && dataset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] z-40"
          >
            <div className="text-center space-y-6 max-w-xl w-full px-6">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Metadata Loaded</h1>
                <p className="text-[var(--text-secondary)] text-lg">
                  We loaded a small row sample to improve heuristics and avoid a memory crash.
                </p>
              </div>

              <div className="bg-[var(--bg-surface)] rounded-xl p-6 text-left space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{dataset.name}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {dataset.rowCount.toLocaleString()} rows · {dataset.variables.length.toLocaleString()} variables
                      {dataset.sampleRowCount ? ` · ${dataset.sampleRowCount.toLocaleString()} sampled rows` : ''}
                      {dataset.sampleStrategy === 'spread' ? ' (spread sampling)' : ''}
                      {pendingSavSizeMb ? ` · ${pendingSavSizeMb.toFixed(1)} MB` : ''}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Full data is not loaded, so analysis actions are disabled until you continue.
                </p>
              </div>

              <div className="bg-[var(--bg-panel)] rounded-xl p-4 text-left">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                  Variables Preview
                </p>
                <div className="max-h-48 overflow-auto divide-y divide-[var(--border-color-muted)]">
                  {dataset.variables.slice(0, 20).map((v) => (
                    <div key={v.id} className="py-2 text-sm text-[var(--text-primary)]">
                      {v.label || v.name}
                    </div>
                  ))}
                  {dataset.variables.length > 20 && (
                    <div className="py-2 text-xs text-[var(--text-secondary)]">
                      + {dataset.variables.length - 20} more
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  onClick={handleMetadataLoadFull}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-3 rounded-lg bg-[var(--color-accent)] text-white font-medium shadow-sm"
                >
                  Load Full Data
                </motion.button>
                <motion.button
                  onClick={handleMetadataCancel}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-3 rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium border border-[var(--border-color)]"
                >
                  Back to Upload
                </motion.button>
              </div>
            </div>
          </motion.div>
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
              <aside className="w-72 bg-[var(--bg-panel)] border-r border-[var(--border-color)] flex flex-col shrink-0 z-30 relative">
                <div className="p-4 border-b border-[var(--border-color-muted)] bg-[var(--bg-app)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-[var(--color-accent)] rounded flex items-center justify-center">
                      <span className="text-[var(--text-inverse)] font-bold text-xs">V</span>
                    </div>
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
                  <div className="mt-3 px-2 py-2 rounded-md border border-[var(--border-color-muted)] bg-[var(--bg-surface)]">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      OPFS Storage Health
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)] space-y-1">
                      <div>Mode: <span className="text-[var(--text-primary)]">{persistenceMode}</span></div>
                      <div>Available: <span className="text-[var(--text-primary)]">{opfsAvailable ? 'Yes' : 'No'}</span></div>
                      {opfsDbLabel && (
                        <div>DB: <span className="text-[var(--text-primary)]">{opfsDbLabel}</span></div>
                      )}
                      {opfsUsageMb !== null && opfsQuotaMb !== null ? (
                        <div>
                          Storage: <span className="text-[var(--text-primary)]">{opfsUsageMb.toFixed(1)} / {opfsQuotaMb.toFixed(1)} MB</span>
                          {opfsUsagePct !== null ? ` (${opfsUsagePct}%)` : ''}
                        </div>
                      ) : (
                        <div>Storage: <span className="text-[var(--text-primary)]">Unavailable</span></div>
                      )}
                      {persistenceError && (
                        <div className="text-amber-700">Warning: {persistenceError}</div>
                      )}
                      {opfsErrorHint && (
                        <div className="text-[11px] text-amber-700">{opfsErrorHint}</div>
                      )}
                      {opfsRehydrateError && (
                        <div className="text-amber-700">Restore error: {opfsRehydrateError}</div>
                      )}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={refreshOpfsDbFiles}
                          className="text-[11px] px-2 py-1 rounded border border-[var(--border-color-muted)] text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors"
                        >
                          List OPFS DBs
                        </button>
                        <button
                          type="button"
                          onClick={purgeQuarantinedDbs}
                          className="ml-2 text-[11px] px-2 py-1 rounded border border-[var(--border-color-muted)] text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors"
                        >
                          Purge Quarantined
                        </button>
                        {dataset?.opfsFileKey && (
                          <button
                            type="button"
                            onClick={() => void rebuildFromOpfsSource('dashboard')}
                            className="ml-2 text-[11px] px-2 py-1 rounded border border-[var(--border-color-muted)] text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors"
                            title="Rebuild DuckDB from the persisted source file (slow but reliable fallback)"
                          >
                            Rebuild from OPFS File
                          </button>
                        )}
                      </div>
                      {opfsDbListError && (
                        <div className="text-amber-700">List error: {opfsDbListError}</div>
                      )}
                      {opfsDbPurgeError && (
                        <div className="text-amber-700">Purge error: {opfsDbPurgeError}</div>
                      )}
                      {opfsDbFiles && opfsDbFiles.length > 0 && (
                        <div className="pt-1 text-[11px] text-[var(--text-secondary)] space-y-1">
                          {opfsDbFiles.map((file) => (
                            <div key={file.name}>
                              <span className="text-[var(--text-primary)]">{file.name}</span>
                              {' '}({(file.size / (1024 * 1024)).toFixed(1)} MB)
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await opfsFileManager.deleteDbFile(file.name);
                                    await refreshOpfsDbFiles();
                                  } catch (error: any) {
                                    setOpfsDbPurgeError(error?.message || 'Failed to delete OPFS DB file');
                                  }
                                }}
                                className="ml-2 text-[11px] text-amber-700 hover:text-amber-900"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {opfsDbFiles && opfsDbFiles.length === 0 && (
                        <div className="text-[11px] text-[var(--text-secondary)]">No OPFS DB files found</div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>

              {/* MAIN CANVAS */}
              <main className="flex-1 flex flex-col bg-[var(--bg-app)] relative overflow-hidden z-0">
                {/* HEADER */}
                <header className="h-14 border-b border-[var(--border-color-muted)] flex items-center justify-between px-6 bg-[var(--bg-app)] shrink-0 z-10">
                  <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                    <button
                      onClick={handleReturnToWorkspace}
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
                        onClick={() => setViewMode('table')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                      >
                        <Table size={16} />
                      </button>
                      <button
                        onClick={() => setViewMode('chart')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'chart' ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                      >
                        <BarChart3 size={16} />
                      </button>
                    </div>

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

                      {/* Weight Shelf - inline after rows */}
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
                      {tableConfig.rowVars.length > 0 ? (
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
                      ) : (
                        <div className="flex-1 border-2 border-dashed border-[var(--border-color-muted)] rounded-xl flex flex-col items-center justify-center text-[var(--text-secondary)] gap-4 bg-[var(--bg-panel)]/50">
                          <LayoutGrid size={48} className="opacity-20" />
                          <p className="text-sm font-medium">Drag variables to the shelves above to start analysis</p>
                        </div>
                      )}
                    </div>
                  </SmartCanvas>
                </div>
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
        </AppShell >
      )
      }
    </div >
  );
}
