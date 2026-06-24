import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getMotionProps, getModalPresenceProps, DURATIONS } from './lib/motion';
import { Table, X, BarChart3, LayoutGrid, Loader2, AlertCircle } from 'lucide-react';

import { useVelocityStore, type Variable, type Filter } from './store';
import {
  SESSION_FILE_EXTENSION,
  exportSession,
  hasSessionImportDiagnostics,
  importSession,
  listSessionImportDiagnostics,
  serializeSessionFile,
  type SessionImportDiagnosticsSummary,
} from './core/session';
import { encodeSessionFile } from './services/sessionFileCodec';
import {
  captureImportedSessionSemanticState,
  selectExportSessionSemantic,
  type ImportedSessionSemanticState,
} from './services/sessionSemanticState';
import * as opfsFileManager from './services/opfsFileManager';

import { WorkspaceView, ProjectLinkModal, CrossWavePanel, ExportImportModal, type StoredDataset, type Project, type WorkspaceExport } from './features/workspace';
import { HarmonizationWorkspace } from './features/harmonization';
import { DashboardShell } from './features/dashboard/DashboardShell';
import { DataDrawer } from './components/overlays/DataDrawer';
import { ToastLayer } from './components/common/ToastLayer';
import { CommandPalette } from './components/common/CommandPalette';
import { KeyboardShortcuts } from './components/common/KeyboardShortcuts';
import { RecodeModal } from './components/overlays/RecodeModal';
import { FilterModal } from './components/overlays/FilterModal';
import { ExportModal } from './components/overlays/ExportModal';
import { SessionImportModal, type SessionImportPayload } from './components/overlays/SessionImportModal';
import { SessionExportModal, type SessionExportSummary } from './components/overlays/SessionExportModal';
import { InputModal } from './components/overlays/InputModal';
import { ContextMenu } from './features/dashboard/components/ContextMenu';

import { usePersistenceManager } from './hooks/usePersistenceManager';
import { useFileUpload } from './features/workspace/hooks/useFileUpload';
import { useWorkspaceOpen } from './features/workspace/hooks/useWorkspaceOpen';
import { getPersistenceDisplayMessage } from './lib/persistenceDisplay';
import { getLoadStageHeadline } from './lib/uploadFeedback';

// App Modes
type AppMode = 'splash' | 'uploading' | 'dashboard' | 'restoring' | 'metadata';

function getSessionFilename(datasetName: string, compressed: boolean): string {
  const name = datasetName.replace(/\.[^.]+$/, '');
  const date = new Date().toISOString().slice(0, 10);
  const extension = compressed ? `${SESSION_FILE_EXTENSION}.gz` : SESSION_FILE_EXTENSION;
  return `${name}-${date}${extension}`;
}

function datasetTableName(datasetId: string): string {
  return `dataset_${datasetId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

// -- Restoration Prompt --
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
  rowCount, columnCount, datasetName, lastModified, warning, onRestore, onDiscard,
}) => {
  const lastModifiedLabel = lastModified ? new Date(lastModified).toLocaleString() : null;
  const reducedMotion = useReducedMotion();
  return (
    <motion.div {...getMotionProps({ preset: 'fade', duration: DURATIONS.enter, reducedMotion })}
      className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] z-40">
      <div className="text-center space-y-6 max-w-md w-full px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Welcome Back</h1>
          <p className="text-[var(--text-secondary)] text-lg">We found your previous session.</p>
        </div>
        <div className="bg-[var(--bg-surface)] rounded-xl p-6 text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--bg-active)] rounded-lg flex items-center justify-center">
              <Table className="w-5 h-5 text-[var(--text-accent)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">{datasetName || 'Previous Session'}</p>
              <p className="text-sm text-[var(--text-secondary)]">{rowCount.toLocaleString()} rows, {columnCount} columns</p>
              {lastModifiedLabel && <p className="text-xs text-[var(--text-secondary)]">Last opened: {lastModifiedLabel}</p>}
            </div>
          </div>
          {warning && (
            <div className="text-xs text-[var(--status-warning-text)] bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded-md p-2">{warning}</div>
          )}
        </div>
        <div className="flex gap-3">
          <motion.button onClick={onRestore} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-[var(--color-accent)] text-[var(--text-inverse)] font-medium rounded-lg hover:opacity-90 transition-opacity">
            Restore Session
          </motion.button>
          <motion.button onClick={onDiscard} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-[var(--bg-active)] text-[var(--text-primary)] font-medium rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
            Start Fresh
          </motion.button>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">Your data is stored locally in your browser.</p>
      </div>
    </motion.div>
  );
};

// -- Partial Load Notice --
interface PartialLoadNoticeProps {
  title: string;
  message: string;
  details?: string;
  canRebuild: boolean;
  onRebuild: () => void;
  onDismiss: () => void;
}

const PartialLoadNotice: React.FC<PartialLoadNoticeProps> = ({
  title, message, details, canRebuild, onRebuild, onDismiss,
}) => {
  const reducedMotion = useReducedMotion();
  return (
  <motion.div {...getBackdropProps(reducedMotion)}
    className="fixed inset-0 flex items-center justify-center bg-[var(--text-primary)]/30 z-[110] px-4">
    <motion.div {...getMotionProps({ preset: 'fadeScale', duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal, reducedMotion })}
      className="w-full max-w-lg rounded-xl border border-[var(--status-warning-border)] bg-[var(--bg-panel)] shadow-2xl p-6 space-y-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-[var(--status-warning-text)]">{title}</h2>
        <p className="text-sm text-[var(--text-primary)]">{message}</p>
        {details && <p className="text-xs text-[var(--text-secondary)] bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded-md p-2">{details}</p>}
      </div>
      <div className="flex gap-3">
        {canRebuild && (
          <button onClick={onRebuild}
            className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity">
            Rebuild From Source
          </button>
        )}
        <button onClick={onDismiss}
          className="flex-1 px-4 py-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--bg-panel)] text-[var(--status-warning-text)] text-sm font-medium hover:bg-[var(--status-warning-surface)] transition-colors">
          Continue
        </button>
      </div>
    </motion.div>
  </motion.div>
  );
};

export default function App() {
  const [mode, setMode] = React.useState<AppMode>('splash');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  // -- Store --
  const {
    isDbReady,
    initError,
    dataset,
    variableSets,
    folders,
    transformLog,
    tableConfig,
    activeFilters,
    analysisSettings,
    slides,
    sections,
    drillDown,
    recodeModal,
    filterModal,
    analysisExportModal,
    persistenceState,
    persistedDataInfo,
    persistenceError,
    engineProxy,
    activeDbPath,
    // Workspace
    workspace,
    activeDatasetId,
    setActiveDataset,
    addStoredDataset,
    updateStoredDataset,
    toggleDatasetStar,
    removeStoredDataset,
    removeStoredDatasets,
    saveDatasetSession,
    setWorkspaceMode,
    createProject,
    addDatasetsToProject,
    removeDatasetsFromProject,
    setDatasetWave,
    setDatasetRespondentKey,
    // Harmonization
    harmonization,
    openHarmonization,
    closeHarmonization,
    // Modal actions
    closeDrillDown,
    loadMoreDrillDown,
    closeRecodeModal,
    closeFilterModal,
    closeAnalysisExportModal,
    addFilter,
    addFilterToSlides,
    openFilterModal,
    loadSAV,
    recodeVariable,
    discardPersistedData,
    respawnWorker,
    loadProgress,
    touchLastActiveAt,
  } = useVelocityStore();

  // -- Hooks --
  const persistence = usePersistenceManager(mode, setMode);
  const fileUpload = useFileUpload(setMode, persistence.opfsAvailableLocal);

  // -- Session export/import --
  const [showSessionImportModal, setShowSessionImportModal] = React.useState(false);
  const [showSessionExportModal, setShowSessionExportModal] = React.useState(false);
  const [sessionImportDiagnostics, setSessionImportDiagnostics] = React.useState<SessionImportDiagnosticsSummary | null>(null);
  const [importedSessionSemantic, setImportedSessionSemantic] = React.useState<ImportedSessionSemanticState | null>(null);

  // -- Workspace local state --
  const [showProjectModal, setShowProjectModal] = React.useState(false);
  const [projectModalDatasetIds, setProjectModalDatasetIds] = React.useState<string[]>([]);
  const [showCrossWavePanel, setShowCrossWavePanel] = React.useState(false);
  const [crossWaveProject, setCrossWaveProject] = React.useState<Project | null>(null);
  const [crossWaveDatasets, setCrossWaveDatasets] = React.useState<StoredDataset[]>([]);
  const [selectedWaves, setSelectedWaves] = React.useState<[StoredDataset, StoredDataset] | undefined>(undefined);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [exportSelectedIds, setExportSelectedIds] = React.useState<string[]>([]);
  const [showCombineModal, setShowCombineModal] = React.useState(false);

  const registeredDatasetIds = useRef<Set<string>>(new Set());
  const materializedDatasetTables = useRef<Set<string>>(new Set());

  // -- Session export --
  const doExportSessionDownload = React.useCallback(async () => {
    if (!dataset) return;
    const semantic = selectExportSessionSemantic(dataset, importedSessionSemantic);
    const sessionFile = exportSession({
      dataset, variableSets, folders, transformLog, tableConfig, activeFilters, analysisSettings, slides, sections,
      workspace: {
        datasets: workspace.datasets.map((s) => ({ id: s.id, name: s.fileName || s.name, rowCount: s.rowCount, waveNumber: s.waveNumber })),
        projects: workspace.projects.map((p) => ({ id: p.id, name: p.name, color: p.color, description: p.description, createdAt: p.createdAt, datasetIds: p.datasetIds, isLongitudinal: p.isLongitudinal, respondentKeyVariable: p.respondentKeyVariable })),
      },
      activeDatasetId,
      harmonizationSession: harmonization.session,
      semantic,
      velocityVersion: import.meta.env.VITE_APP_VERSION ?? 'dev',
    });
    const sessionJson = serializeSessionFile(sessionFile);
    const { blob, compressed } = await encodeSessionFile(sessionJson, { preferGzip: true, gzipThresholdBytes: 32 * 1024 });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getSessionFilename(dataset.name, compressed);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [dataset, variableSets, folders, transformLog, tableConfig, activeFilters, analysisSettings, slides, sections, workspace.datasets, workspace.projects, activeDatasetId, harmonization.session, importedSessionSemantic]);

  const sessionExportSummary = React.useMemo((): SessionExportSummary | null => {
    if (!dataset) return null;
    const recodes = transformLog.filter((t) => t.type === 'recode');
    return {
      datasetName: dataset.name,
      rowCount: dataset.rowCount,
      columnCount: dataset.variables.filter((v) => !recodes.some((t) => t.newColId === v.id)).length,
      recodeCount: recodes.length,
      slideCount: slides.length,
      filterCount: activeFilters.length,
      sectionCount: sections.length,
    };
  }, [dataset, transformLog, slides.length, activeFilters.length, sections.length]);

  const handleExportSession = React.useCallback(() => {
    if (!dataset) return;
    setShowSessionExportModal(true);
  }, [dataset]);

  const handleOpenSessionImportModal = React.useCallback(() => {
    setSessionImportDiagnostics(null);
    setShowSessionImportModal(true);
  }, []);

  const handleSessionImport = React.useCallback(async (payload: SessionImportPayload) => {
    const previousMode = mode;
    setSessionImportDiagnostics(null);
    setMode('uploading');
    try {
      await loadSAV(payload.savFileName, payload.savBuffer, { datasetId: crypto.randomUUID() });
      const replayableTransforms = payload.sessionFile.transformLog.filter((t) => t.type === 'recode');
      for (const transform of replayableTransforms) {
        await recodeVariable(transform.sourceColId, transform.newColId, transform.config);
      }
      const importedDataset = useVelocityStore.getState().dataset;
      if (!importedDataset) throw new Error('Imported dataset is unavailable after SAV load');
      const imported = importSession(payload.sessionFile, importedDataset);
      const activeSlide = imported.patch.slides.find((s) => s.id === imported.patch.activeSlideId) ?? imported.patch.slides[0];
      const nextActiveCellId = activeSlide?.cells[0]?.id ?? null;
      useVelocityStore.setState((state) => ({
        dataset: imported.patch.dataset,
        variableSets: imported.patch.variableSets,
        folders: imported.patch.folders,
        transformLog: imported.patch.transformLog,
        tableConfig: imported.patch.tableConfig,
        activeFilters: imported.patch.activeFilters,
        analysisSettings: { ...state.analysisSettings, ...(imported.patch.analysisSettings ?? {}) },
        slides: imported.patch.slides,
        sections: imported.patch.sections,
        activeSlideId: imported.patch.activeSlideId,
        activeCellId: nextActiveCellId,
        queryResult: [],
        tableStats: null,
        activeVariableStats: null,
        harmonization: {
          ...state.harmonization,
          isOpen: false,
          session: imported.patch.harmonizationSession,
          matchingInProgress: false,
          sankeyData: null,
          selectedMappingId: null,
        },
      }));
      await useVelocityStore.getState().runAnalysis();
      setImportedSessionSemantic(captureImportedSessionSemanticState(payload.sessionFile));
      setMode('dashboard');
      setShowSessionImportModal(false);
      if (hasSessionImportDiagnostics(imported.diagnostics)) {
        setSessionImportDiagnostics(imported.diagnostics);
      }
    } catch (importError: any) {
      setMode(previousMode);
      throw new Error(importError?.message || 'Session import failed');
    }
  }, [mode, loadSAV, recodeVariable]);

  const clearImportedSessionSemantic = React.useCallback(() => {
    setImportedSessionSemantic(null);
  }, []);

  const { openDataset: handleOpenDataset } = useWorkspaceOpen({
    setMode,
    clearImportedSessionSemantic,
  });

  const sessionImportMessages = React.useMemo(
    () => (sessionImportDiagnostics ? listSessionImportDiagnostics(sessionImportDiagnostics) : []),
    [sessionImportDiagnostics]
  );

  // Session import adjustments — one summary toast (replaces overlapping fixed overlay)
  useEffect(() => {
    if (!sessionImportDiagnostics || sessionImportMessages.length === 0) return;

    const preview = sessionImportMessages
      .slice(0, 2)
      .map((item) => item.message)
      .join(' ');
    const extra =
      sessionImportMessages.length > 2
        ? ` (+${sessionImportMessages.length - 2} more)`
        : '';

    useVelocityStore.getState().addToast({
      dedupeKey: 'session-import',
      title: 'Session imported with adjustments',
      message: `${preview}${extra}`.trim(),
      type: 'warning',
      duration: 10_000,
    });
    setSessionImportDiagnostics(null);
  }, [sessionImportDiagnostics, sessionImportMessages]);

  // -- Workspace handlers --
  const materializeDatasetTable = useCallback(async (datasetId: string) => {
    if (!engineProxy) return false;
    const tableName = datasetTableName(datasetId);
    if (materializedDatasetTables.current.has(tableName)) return true;

    try {
      const status = await engineProxy.ping();
      if (!status.hasData) {
        console.log(`[App] Skipping workspace table materialization for ${tableName}: DuckDB has no active main table`);
        return false;
      }

      await engineProxy.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM main`);
      materializedDatasetTables.current.add(tableName);
      return true;
    } catch (error) {
      console.warn(`[App] Failed to materialize workspace table ${tableName}:`, error);
      materializedDatasetTables.current.delete(tableName);
      return false;
    }
  }, [engineProxy]);

  const registerDatasetInWorkspace = useCallback(() => {
    if (!dataset) return;
    if (registeredDatasetIds.current.has(dataset.id)) return;
    registeredDatasetIds.current.add(dataset.id);
    addStoredDataset({
      id: dataset.id, name: dataset.name, fileName: dataset.name, rowCount: dataset.rowCount,
      columnCount: dataset.variables.length, fileSize: 0, source: dataset.source,
      variables: dataset.variables, variableSets, folders, opfsFileKey: dataset.opfsFileKey, tableName: datasetTableName(dataset.id),
    });
    if (dataset.opfsFileKey) {
      opfsFileManager.getFileSize(dataset.opfsFileKey)
        .then(size => { if (size > 0) updateStoredDataset(dataset.id, { fileSize: size }); })
        .catch(() => { });
    }
    setActiveDataset(dataset.id);
  }, [dataset, variableSets, folders, addStoredDataset, updateStoredDataset, setActiveDataset, materializeDatasetTable]);

  useEffect(() => {
    if (dataset && mode === 'dashboard') registerDatasetInWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id, mode]);

  useEffect(() => {
    materializedDatasetTables.current.clear();
  }, [activeDbPath]);

  useEffect(() => {
    if (!dataset || mode !== 'dashboard') return;
    void materializeDatasetTable(dataset.id);
  }, [dataset?.id, mode, materializeDatasetTable]);

  const clearLoadedDatasetState = useCallback(async () => {
    useVelocityStore.setState({
      dataset: null,
      variableSets: [],
      folders: [],
      transformLog: [],
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      queryResult: [],
      tableStats: null,
      persistedDataInfo: null,
      persistenceState: 'ready',
    } as any);
    await respawnWorker(false);
  }, [respawnWorker]);

  const handleDeleteDataset = useCallback(async (id: string) => {
    if (!window.confirm('Delete this dataset from your workspace? The original file will not be affected.')) {
      return;
    }

    const storedDataset = workspace.datasets.find((entry) => entry.id === id);
    if (storedDataset) {
      await opfsFileManager.deleteDatasetPersistence(storedDataset.id, storedDataset.opfsFileKey);
    }

    removeStoredDataset(id);

    if (activeDatasetId === id || dataset?.id === id) {
      setActiveDataset(null);
      await clearLoadedDatasetState();
      setMode('splash');
      setWorkspaceMode(true);
    }
  }, [
    workspace.datasets,
    removeStoredDataset,
    activeDatasetId,
    dataset?.id,
    setActiveDataset,
    clearLoadedDatasetState,
    setWorkspaceMode,
  ]);

  const handleReturnToWorkspace = useCallback(() => {
    if (dataset && activeDatasetId) {
      saveDatasetSession(activeDatasetId, { tableConfig, activeFilters, transformLog });
      updateStoredDataset(activeDatasetId, { variables: dataset.variables, variableSets, folders });
    }
    setWorkspaceMode(true);
    setMode('splash');
  }, [
    dataset,
    activeDatasetId,
    tableConfig,
    activeFilters,
    transformLog,
    variableSets,
    folders,
    saveDatasetSession,
    updateStoredDataset,
    setWorkspaceMode,
  ]);

  const prevModeRef = useRef<AppMode>(mode);
  const splashActivityTouchedRef = useRef(false);

  useEffect(() => {
    if (mode === 'dashboard' && prevModeRef.current !== 'dashboard') {
      touchLastActiveAt();
    }

    if (mode === 'dashboard') {
      setWorkspaceMode(false);
    }

    if (mode === 'splash' && isDbReady) {
      const enteredSplash = prevModeRef.current !== 'splash';
      if (enteredSplash || !splashActivityTouchedRef.current) {
        touchLastActiveAt();
        splashActivityTouchedRef.current = true;
      }
    } else if (mode !== 'splash') {
      splashActivityTouchedRef.current = false;
    }

    prevModeRef.current = mode;
  }, [mode, isDbReady, touchLastActiveAt, setWorkspaceMode]);

  const loadStageHeadline = getLoadStageHeadline(loadProgress);

  const handleOpenProjectModal = useCallback((ids: string[]) => { setProjectModalDatasetIds(ids); setShowProjectModal(true); }, []);
  const handleCreateProject = useCallback((project: Omit<Project, 'id' | 'createdAt'>) => { createProject(project); setShowProjectModal(false); setProjectModalDatasetIds([]); }, [createProject]);
  const handleAddToProject = useCallback((ids: string[], projectId: string) => { addDatasetsToProject(ids, projectId); setShowProjectModal(false); setProjectModalDatasetIds([]); }, [addDatasetsToProject]);
  const handleUpdateWaveNumber = useCallback((id: string, wave: number) => setDatasetWave(id, wave), [setDatasetWave]);
  const handleSetRespondentKey = useCallback((id: string, key: string) => setDatasetRespondentKey(id, key), [setDatasetRespondentKey]);
  const handleUnlinkDataset = useCallback((id: string) => removeDatasetsFromProject([id]), [removeDatasetsFromProject]);

  const handleOpenCrossWavePanel = useCallback((project: Project, w1: StoredDataset, w2: StoredDataset) => {
    setCrossWaveProject(project);
    setCrossWaveDatasets(workspace.datasets.filter(d => d.projectId === project.id));
    setSelectedWaves([w1, w2]);
    setShowCrossWavePanel(true);
  }, [workspace.datasets]);

  const handleCloseCrossWavePanel = useCallback(() => {
    setShowCrossWavePanel(false); setCrossWaveProject(null); setCrossWaveDatasets([]); setSelectedWaves(undefined);
  }, []);

  const resolveWorkspaceVariables = useCallback((stored: StoredDataset): Variable[] | null => {
    if (stored.variables && stored.variables.length > 0) return stored.variables as Variable[];
    if (dataset?.id === stored.id) return dataset.variables as Variable[];
    return null;
  }, [dataset]);

  const handleOpenHarmonization = useCallback((w1: StoredDataset, w2: StoredDataset) => {
    const src = resolveWorkspaceVariables(w1);
    const tgt = resolveWorkspaceVariables(w2);
    if (!src || !tgt) { alert('Harmonization needs variable metadata for both waves. Open each dataset at least once to cache metadata.'); return; }
    openHarmonization(w1.id, w2.id);
    setShowCrossWavePanel(false);
  }, [openHarmonization, resolveWorkspaceVariables]);

  // Harmonization resolution
  const harmonizationSession = harmonization.session;
  const harmonizationSourceDataset = React.useMemo(() => harmonizationSession ? workspace.datasets.find(d => d.id === harmonizationSession.sourceDatasetId) ?? null : null, [harmonizationSession, workspace.datasets]);
  const harmonizationTargetDataset = React.useMemo(() => harmonizationSession ? workspace.datasets.find(d => d.id === harmonizationSession.targetDatasetId) ?? null : null, [harmonizationSession, workspace.datasets]);
  const harmonizationSourceVars = React.useMemo(() => harmonizationSourceDataset ? resolveWorkspaceVariables(harmonizationSourceDataset) : null, [harmonizationSourceDataset, resolveWorkspaceVariables]);
  const harmonizationTargetVars = React.useMemo(() => harmonizationTargetDataset ? resolveWorkspaceVariables(harmonizationTargetDataset) : null, [harmonizationTargetDataset, resolveWorkspaceVariables]);

  useEffect(() => {
    if (!harmonization.isOpen) return;
    if (harmonizationSourceVars && harmonizationTargetVars) return;
    closeHarmonization();
  }, [harmonization.isOpen, harmonizationSourceVars, harmonizationTargetVars, closeHarmonization]);

  const handleWorkspaceImport = useCallback((data: WorkspaceExport) => {
    data.workspace.datasets.forEach(d => {
      const existing = workspace.datasets.find(e => e.id === d.id);
      if (existing) updateStoredDataset(d.id, d);
      else addStoredDataset({ id: d.id, name: d.name, fileName: d.fileName, rowCount: d.rowCount, columnCount: d.columnCount, fileSize: d.fileSize, source: d.source, variables: d.variables, variableSets: d.variableSets, folders: d.folders, opfsFileKey: d.opfsFileKey, tableName: d.tableName });
    });
    data.workspace.projects.forEach(p => {
      if (!workspace.projects.find(e => e.id === p.id)) {
        createProject({ name: p.name, color: p.color, description: p.description, datasetIds: p.datasetIds, isLongitudinal: p.isLongitudinal, respondentKeyVariable: p.respondentKeyVariable });
      }
    });
  }, [workspace.datasets, workspace.projects, updateStoredDataset, addStoredDataset, createProject]);

  const handleBatchStar = useCallback((ids: string[], starred: boolean) => {
    ids.forEach(id => {
      const ds = workspace.datasets.find(d => d.id === id);
      if (ds && ds.starred !== starred) toggleDatasetStar(id);
    });
  }, [workspace.datasets, toggleDatasetStar]);

  const handleBatchDelete = useCallback(async (ids: string[]) => {
    if (!window.confirm(`Delete ${ids.length} datasets from your workspace?`)) return;

    await Promise.all(ids.map(async (id) => {
      const storedDataset = workspace.datasets.find((entry) => entry.id === id);
      if (storedDataset) {
        await opfsFileManager.deleteDatasetPersistence(storedDataset.id, storedDataset.opfsFileKey);
      }
    }));

    const deletingActive = ids.includes(activeDatasetId ?? '') || (dataset?.id ? ids.includes(dataset.id) : false);
    removeStoredDatasets(ids);

    if (deletingActive) {
      setActiveDataset(null);
      await clearLoadedDatasetState();
      setMode('splash');
      setWorkspaceMode(true);
    }
  }, [
    workspace.datasets,
    activeDatasetId,
    dataset?.id,
    removeStoredDatasets,
    setActiveDataset,
    clearLoadedDatasetState,
    setWorkspaceMode,
  ]);

  // -- Restore/Discard --
  const handleRestore = () => {
    const restored = persistence.attemptRestoreFromPersistence();
    setMode(restored ? 'dashboard' : 'restoring');
  };

  const handleDiscard = async () => {
    clearImportedSessionSemantic();
    try {
      await discardPersistedData();
      setMode('splash');
    } catch (error) {
      console.error('[App] Discard persisted data failed:', error);
    }
  };

  const handleDatasetFileUpload = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    clearImportedSessionSemantic();
    await fileUpload.handleFileUpload(event);
  }, [clearImportedSessionSemantic, fileUpload]);

  const handleLoadExample = React.useCallback(() => {
    clearImportedSessionSemantic();
    fileUpload.handleDemoClick();
  }, [clearImportedSessionSemantic, fileUpload]);

  // -- Filter save handler --
  const handleSaveFilter = useCallback((filter: Omit<Filter, 'id'>, applyToAll: boolean) => {
    addFilter(filter);
    if (applyToAll) {
      const filterWithId = { ...filter, id: crypto.randomUUID() };
      addFilterToSlides(slides.map(s => s.id), filterWithId);
    }
  }, [addFilter, addFilterToSlides, slides]);

  const variables = dataset?.variables || [];

  return (
    <div className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] antialiased overflow-hidden flex flex-col`}>

      <input type="file" ref={fileInputRef} onChange={handleDatasetFileUpload} className="hidden" accept=".csv,.sav" data-testid="dataset-upload-input" />

      {/* MODALS */}
      <DataDrawer
        isOpen={drillDown.isOpen} onClose={closeDrillDown} title={drillDown.title} data={drillDown.data}
        loading={drillDown.loading} totalCount={drillDown.totalCount} loadedCount={drillDown.data.length}
        onLoadMore={loadMoreDrillDown}
        filterColumns={[...drillDown.rowFilters.map(f => f.variable), ...(drillDown.colFilter ? [drillDown.colFilter.variable] : [])]}
      />

      <RecodeModal isOpen={recodeModal.isOpen} onClose={closeRecodeModal} variable={recodeModal.variable as any} onSave={async () => {}} />

      <FilterModal isOpen={filterModal.isOpen} onClose={closeFilterModal} variables={variables} onSave={handleSaveFilter} />

      <InputModal
        isOpen={showCombineModal} onClose={() => setShowCombineModal(false)}
        onSubmit={() => {}} title="Combine Variables" placeholder="Enter name for new variable set..." submitLabel="Create"
      />

      <ProjectLinkModal
        isOpen={showProjectModal}
        onClose={() => { setShowProjectModal(false); setProjectModalDatasetIds([]); }}
        datasets={workspace.datasets} projects={workspace.projects} selectedDatasetIds={projectModalDatasetIds}
        onCreateProject={handleCreateProject} onAddToProject={handleAddToProject}
        onUpdateWaveNumber={handleUpdateWaveNumber} onSetRespondentKey={handleSetRespondentKey}
      />

      {crossWaveProject && (
        <CrossWavePanel isOpen={showCrossWavePanel} onClose={handleCloseCrossWavePanel}
          project={crossWaveProject} datasets={crossWaveDatasets} selectedWaves={selectedWaves}
          onOpenDataset={handleOpenDataset} onOpenHarmonization={handleOpenHarmonization}
        />
      )}

      {harmonization.isOpen && harmonizationSourceDataset && harmonizationTargetDataset && harmonizationSourceVars && harmonizationTargetVars && (
        <HarmonizationWorkspace
          sourceVars={harmonizationSourceVars} targetVars={harmonizationTargetVars}
          sourceDatasetName={harmonizationSourceDataset.name} targetDatasetName={harmonizationTargetDataset.name}
          sourceTableName={harmonizationSourceDataset.tableName ?? datasetTableName(harmonizationSourceDataset.id)}
          targetTableName={harmonizationTargetDataset.tableName ?? datasetTableName(harmonizationTargetDataset.id)}
        />
      )}

      <ExportImportModal isOpen={showExportModal} onClose={() => { setShowExportModal(false); setExportSelectedIds([]); }}
        workspaceState={workspace} selectedDatasetIds={exportSelectedIds} onImport={handleWorkspaceImport} />

      <ExportModal isOpen={analysisExportModal.isOpen} onClose={closeAnalysisExportModal}
        config={analysisExportModal.config ?? { title: 'Analysis Report', analyses: [] }} />

      <SessionImportModal isOpen={showSessionImportModal} onClose={() => setShowSessionImportModal(false)} onImport={handleSessionImport} />

      {dataset && sessionExportSummary && (
        <SessionExportModal isOpen={showSessionExportModal} onClose={() => setShowSessionExportModal(false)}
          onExport={doExportSessionDownload} summary={sessionExportSummary} />
      )}

      {/* GLOBAL PROGRESS BAR */}
      <AnimatePresence>
        {mode === 'uploading' && (
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${Math.round((loadProgress?.progress ?? 0) * 100)}%` }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.25, ease: 'easeOut' }}
            className="fixed top-0 left-0 h-1 bg-[var(--color-accent)] z-50 shadow-[0_0_10px_var(--color-accent)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((loadProgress?.progress ?? 0) * 100)}
            aria-label="Dataset load progress"
          />
        )}
      </AnimatePresence>

      {/* UPLOADING OVERLAY */}
      <AnimatePresence>
        {mode === 'uploading' && (
          <motion.div {...getMotionProps({ preset: 'fade', duration: DURATIONS.enter, reducedMotion })}
            className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] z-40">
            <div className="text-center space-y-4 max-w-md w-full px-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-[var(--color-accent)] animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-[var(--text-primary)]" data-testid="upload-stage-headline">
                  {loadStageHeadline}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {loadProgress?.message ||
                    fileUpload.pendingSavFile?.name ||
                    dataset?.name ||
                    'Preparing analysis engine'}
                </p>
                {loadProgress?.totalRows != null && loadProgress.totalRows > 0 && (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {Math.min(loadProgress.rowsProcessed ?? 0, loadProgress.totalRows).toLocaleString()} of{' '}
                    {loadProgress.totalRows.toLocaleString()} rows
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WORKSPACE / SPLASH SCREEN */}
      <AnimatePresence mode="wait">
        {mode === 'splash' && (
          <motion.div
            key="workspace-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.12 } }}
            className="fixed inset-0 bg-[var(--bg-app)] z-40"
          >
            {isDbReady && !initError && (
              <WorkspaceView
                workspaceState={workspace}
                onOpenDataset={handleOpenDataset}
                onUploadFile={() => fileInputRef.current?.click()}
                onLoadExample={handleLoadExample}
                onCreateProject={handleOpenProjectModal}
                onDeleteDataset={handleDeleteDataset}
                onToggleStar={(id) => toggleDatasetStar(id)}
                onLinkDatasets={handleAddToProject}
                onUnlinkDataset={handleUnlinkDataset}
                onCompareWaves={handleOpenCrossWavePanel}
                onBatchStar={handleBatchStar}
                onBatchDelete={handleBatchDelete}
                onExport={(ids) => { setExportSelectedIds(ids); setShowExportModal(true); }}
                onImportSession={handleOpenSessionImportModal}
              />
            )}

            {(!isDbReady || initError) && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-app)] z-50">
                <div className="text-center space-y-4 max-w-md w-full px-6">
                  <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">Velocity.</h1>
                  <p className="text-[var(--text-secondary)] text-lg">The zero-latency research dashboard.</p>
                  {initError ? (
                    <div className="flex items-center justify-center gap-2 text-[var(--color-error)] text-sm font-medium bg-[var(--status-error-surface)] p-2 rounded-md">
                      <AlertCircle size={16} /><span>{initError}</span>
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

            {/* OPFS error overlay */}
            {dataset && (persistence.opfsRehydrateError || persistenceError) && (
              <div className="absolute bottom-6 left-6 right-6 max-w-lg mx-auto">
                <div className="text-left text-[var(--status-warning-text)] bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded-lg p-4 shadow-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      {persistence.opfsRehydrateError && (
                        <>
                          <div className="text-sm font-medium">Couldn&apos;t restore data from your saved file.</div>
                          <details className="text-xs">
                            <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                              Technical details
                            </summary>
                            <p className="mt-1 break-words opacity-90">{persistence.opfsRehydrateError}</p>
                          </details>
                        </>
                      )}
                      {!persistence.opfsRehydrateError && persistenceError && (() => {
                        const { headline, detail } = getPersistenceDisplayMessage(
                          persistenceError,
                          persistence.opfsErrorHint,
                        );
                        return (
                          <>
                            {headline && <div className="text-sm font-medium">{headline}</div>}
                            {detail && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                  Technical details
                                </summary>
                                <p className="mt-1 break-words opacity-90">{detail}</p>
                              </details>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  {dataset.opfsFileKey && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void persistence.rebuildFromOpfsSource('splash')}
                        className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-[var(--text-inverse)] text-xs font-medium hover:opacity-90 transition-opacity">
                        Retry Restore
                      </button>
                      <button type="button" onClick={handleDiscard}
                        className="px-3 py-1.5 rounded bg-[var(--bg-panel)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] text-xs font-medium hover:bg-[var(--status-warning-surface)] transition-colors">
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
            rowCount={persistedDataInfo.rowCount} columnCount={persistedDataInfo.schema.length}
            datasetName={persistedDataInfo.metadata?.datasetName || dataset?.name}
            lastModified={persistedDataInfo.metadata?.lastModified}
            warning={persistence.restorationPromptWarning}
            onRestore={handleRestore} onDiscard={handleDiscard}
          />
        )}
      </AnimatePresence>

      {/* PARTIAL LOAD NOTICE */}
      <AnimatePresence>
        {persistence.showPartialLoadNotice && dataset && (
          <PartialLoadNotice
            title="Dataset Loaded With Partial Metadata"
            message={persistence.partialLoadMessage || 'This dataset may have loaded with partial metadata.'}
            details={dataset.loadDiagnostics?.valueLabelsDropped ? `${dataset.loadDiagnostics.valueLabelsDropped.toLocaleString()} value labels were removed from cached metadata to keep the app within browser storage limits.` : undefined}
            canRebuild={Boolean(dataset.opfsFileKey)}
            onRebuild={() => { persistence.setShowPartialLoadNotice(false); void persistence.rebuildFromOpfsSource('dashboard'); }}
            onDismiss={persistence.handleDismissPartialLoadNotice}
          />
        )}
      </AnimatePresence>

      {/* METADATA-ONLY MODE */}
      <AnimatePresence>
        {mode === 'metadata' && dataset && (
          <motion.div {...getMotionProps({ preset: 'fade', duration: DURATIONS.enter, reducedMotion })}
            className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] z-40">
            <div className="text-center space-y-8 max-w-2xl w-full px-6">
              <div className="space-y-3">
                <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">Metadata Loaded</h1>
                <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
                  We loaded a small row sample to improve analytics heuristics and avoid a memory crash.
                </p>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-8 text-left space-y-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded-xl flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6 text-[var(--status-warning-text)]" />
                  </div>
                  <div className="space-y-4 flex-1">
                    <div>
                      <p className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">{dataset.name}</p>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">Full data is not loaded, so analysis actions are disabled until you continue.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <div className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color-muted)] rounded-lg text-sm text-[var(--text-primary)] flex flex-col">
                        <span className="text-xs text-[var(--text-secondary)] font-medium">Rows</span>
                        <span className="font-semibold">{dataset.rowCount.toLocaleString()}</span>
                      </div>
                      <div className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color-muted)] rounded-lg text-sm text-[var(--text-primary)] flex flex-col">
                        <span className="text-xs text-[var(--text-secondary)] font-medium">Variables</span>
                        <span className="font-semibold">{dataset.variables.length.toLocaleString()}</span>
                      </div>
                      {dataset.sampleRowCount && (
                        <div className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color-muted)] rounded-lg text-sm text-[var(--text-primary)] flex flex-col">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Sampled Rows</span>
                          <span className="font-semibold">
                            {dataset.sampleRowCount.toLocaleString()}
                            {dataset.sampleStrategy === 'spread' ? <span className="text-[var(--text-secondary)] font-normal text-xs ml-1">(spread)</span> : ''}
                          </span>
                        </div>
                      )}
                      {fileUpload.pendingSavSizeMb && (
                        <div className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color-muted)] rounded-lg text-sm text-[var(--text-primary)] flex flex-col">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">File Size</span>
                          <span className="font-semibold">{fileUpload.pendingSavSizeMb.toFixed(1)} MB</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl p-6 text-left shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Variables Preview</p>
                  <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-panel)] px-2 py-0.5 rounded-full">Showing top 20</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                  {dataset.variables.slice(0, 20).map((v) => (
                    <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border-color-muted)] bg-[var(--bg-panel)] hover:bg-[var(--bg-active)] transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color-muted)] flex items-center justify-center shrink-0">
                        {v.type === 'numeric' || v.type === 'scale' ? <BarChart3 className="w-4 h-4 text-[var(--tag-scale-text)]" /> : <LayoutGrid className="w-4 h-4 text-[var(--tag-nominal-text)]" />}
                      </div>
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={v.label || v.name}>{v.label || v.name}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{v.name} · {v.type}</p>
                      </div>
                    </div>
                  ))}
                  {dataset.variables.length > 20 && (
                    <div className="flex items-center justify-center p-2.5 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)]">
                      + {dataset.variables.length - 20} more variables
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4 pt-2 max-w-md mx-auto">
                <motion.button onClick={fileUpload.handleMetadataCancel} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex-1 py-3.5 px-6 rounded-xl text-[var(--text-primary)] font-medium hover:bg-[var(--bg-active)] transition-colors">
                  Back to Upload
                </motion.button>
                <motion.button onClick={fileUpload.handleMetadataLoadFull} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-[var(--color-accent)] text-[var(--text-inverse)] font-semibold shadow-md shadow-[var(--color-accent)]/20">
                  Load Full Data
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DASHBOARD */}
      {mode === 'dashboard' && (
        <DashboardShell
          persistence={persistence}
          onReturnToWorkspace={handleReturnToWorkspace}
          onOpenSessionImport={handleOpenSessionImportModal}
          onExportSession={handleExportSession}
        />
      )}

      {/* COMMAND PALETTE — global action surface */}
      <CommandPalette />

      {/* KEYBOARD SHORTCUTS REFERENCE */}
      <KeyboardShortcuts />

      {/* TOAST LAYER — global operation feedback */}
      <ToastLayer />
    </div>
  );
}
