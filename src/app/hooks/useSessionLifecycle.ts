import { useCallback, useMemo, useState } from 'react';
import {
  buildSessionImportRailSummary,
  exportSession,
  importSession,
  serializeSessionFile,
  type SessionImportRailSummary,
} from '../../core/session';
import { encodeSessionFile } from '../../services/sessionFileCodec';
import {
  captureImportedSessionSemanticState,
  selectExportSessionSemantic,
  type ImportedSessionSemanticState,
} from '../../services/sessionSemanticState';
import { useVelocityStore } from '../../store';
import type { SessionImportPayload, SessionExportSummary } from '../../components/overlays/sessionModalTypes';
import type { PersistenceManagerState } from '../../hooks/usePersistenceManager';
import type { FileUploadState } from '../../features/workspace/hooks/useFileUpload';
import type { AppPhase } from '../types';
import { getSessionFilename } from '../utils';
import { warmUpEngineOnIntent } from '../../services/engineWarmUp';

export interface UseSessionLifecycleOptions {
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;
  persistence: PersistenceManagerState;
  fileUpload: FileUploadState;
  closeSessionImportOverlay: () => void;
  openSessionExportOverlay: () => void;
}

export interface UseSessionLifecycleReturn {
  importedSessionSemantic: ImportedSessionSemanticState | null;
  clearImportedSessionSemantic: () => void;
  sessionExportSummary: SessionExportSummary | null;
  sessionImportSummary: SessionImportRailSummary | null;
  dismissSessionImportSummary: () => void;
  handleExportSession: () => void;
  handleOpenSessionImportModal: () => void;
  handleSessionImport: (payload: SessionImportPayload) => Promise<void>;
  doExportSessionDownload: () => Promise<void>;
  handleRestore: () => void;
  handleDiscard: () => Promise<void>;
  handleDatasetFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleLoadExample: () => void;
  handleFileDrop: (file: File) => void;
}

export function useSessionLifecycle({
  phase,
  setPhase,
  persistence,
  fileUpload,
  closeSessionImportOverlay,
  openSessionExportOverlay,
}: UseSessionLifecycleOptions): UseSessionLifecycleReturn {
  const dataset = useVelocityStore((state) => state.dataset);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const folders = useVelocityStore((state) => state.folders);
  const transformLog = useVelocityStore((state) => state.transformLog);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const activeFilters = useVelocityStore((state) => state.activeFilters);
  const analysisSettings = useVelocityStore((state) => state.analysisSettings);
  const slides = useVelocityStore((state) => state.slides);
  const sections = useVelocityStore((state) => state.sections);
  const workspace = useVelocityStore((state) => state.workspace);
  const activeDatasetId = useVelocityStore((state) => state.activeDatasetId);
  const loadSAV = useVelocityStore((state) => state.loadSAV);
  const recodeVariable = useVelocityStore((state) => state.recodeVariable);
  const discardPersistedData = useVelocityStore((state) => state.discardPersistedData);

  const [sessionImportSummary, setSessionImportSummary] = useState<SessionImportRailSummary | null>(null);
  const [importedSessionSemantic, setImportedSessionSemantic] = useState<ImportedSessionSemanticState | null>(null);

  const dismissSessionImportSummary = useCallback(() => {
    setSessionImportSummary(null);
  }, []);

  const clearImportedSessionSemantic = useCallback(() => {
    setImportedSessionSemantic(null);
    setSessionImportSummary(null);
  }, []);

  const doExportSessionDownload = useCallback(async () => {
    if (!dataset) return;
    const semantic = selectExportSessionSemantic(dataset, importedSessionSemantic);
    const sessionFile = exportSession({
      dataset,
      variableSets,
      folders,
      transformLog,
      tableConfig,
      activeFilters,
      analysisSettings,
      slides,
      sections,
      workspace: {
        datasets: workspace.datasets.map((s) => ({
          id: s.id,
          name: s.fileName || s.name,
          rowCount: s.rowCount,
          waveNumber: s.waveNumber,
        })),
        projects: workspace.projects.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          description: p.description,
          createdAt: p.createdAt,
          datasetIds: p.datasetIds,
          isLongitudinal: p.isLongitudinal,
          respondentKeyVariable: p.respondentKeyVariable,
        })),
      },
      activeDatasetId,
      harmonizationSession: null,
      semantic,
      velocityVersion: import.meta.env.VITE_APP_VERSION ?? 'dev',
    });
    const sessionJson = serializeSessionFile(sessionFile);
    const { blob, compressed } = await encodeSessionFile(sessionJson, {
      preferGzip: true,
      gzipThresholdBytes: 32 * 1024,
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getSessionFilename(dataset.name, compressed);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [
    dataset,
    variableSets,
    folders,
    transformLog,
    tableConfig,
    activeFilters,
    analysisSettings,
    slides,
    sections,
    workspace.datasets,
    workspace.projects,
    activeDatasetId,
    importedSessionSemantic,
  ]);

  const sessionExportSummary = useMemo((): SessionExportSummary | null => {
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

  const handleExportSession = useCallback(() => {
    if (!dataset) return;
    openSessionExportOverlay();
  }, [dataset, openSessionExportOverlay]);

  const handleOpenSessionImportModal = useCallback(() => {
    setSessionImportSummary(null);
  }, []);

  const handleSessionImport = useCallback(
    async (payload: SessionImportPayload) => {
      const previousPhase = phase;
      setSessionImportSummary(null);
      setPhase('uploading');
      try {
        await loadSAV(payload.savFileName, payload.savBuffer, { datasetId: crypto.randomUUID() });
        const replayableTransforms = payload.sessionFile.transformLog.filter((t) => t.type === 'recode');
        for (const transform of replayableTransforms) {
          await recodeVariable(transform.sourceColId, transform.newColId, transform.config);
        }
        const importedDataset = useVelocityStore.getState().dataset;
        if (!importedDataset) throw new Error('Imported dataset is unavailable after SAV load');
        const imported = importSession(payload.sessionFile, importedDataset);
        const activeSlide =
          imported.patch.slides.find((s) => s.id === imported.patch.activeSlideId) ?? imported.patch.slides[0];
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
          processedQueryResult: null,
          tableStats: null,
          activeVariableStats: null,
        }));
        await useVelocityStore.getState().runAnalysis();
        setImportedSessionSemantic(captureImportedSessionSemanticState(payload.sessionFile));
        setSessionImportSummary(
          buildSessionImportRailSummary(payload.sessionFile, imported.patch.slides, imported.diagnostics),
        );
        setPhase('dashboard');
        closeSessionImportOverlay();
      } catch (importError: unknown) {
        setPhase(previousPhase);
        const message = importError instanceof Error ? importError.message : undefined;
        throw new Error(message || 'Session import failed', { cause: importError });
      }
    },
    [phase, loadSAV, recodeVariable, setPhase, closeSessionImportOverlay],
  );

  const handleRestore = useCallback(() => {
    void warmUpEngineOnIntent('restore-prompt');
    const restored = persistence.attemptRestoreFromPersistence();
    setPhase(restored ? 'dashboard' : 'restoring');
  }, [persistence, setPhase]);

  const handleDiscard = useCallback(async () => {
    clearImportedSessionSemantic();
    try {
      await discardPersistedData();
      setPhase('splash');
    } catch (error) {
      console.error('[App] Discard persisted data failed:', error);
    }
  }, [clearImportedSessionSemantic, discardPersistedData, setPhase]);

  const handleDatasetFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      clearImportedSessionSemantic();
      await warmUpEngineOnIntent('file-upload');
      await fileUpload.handleFileUpload(event);
    },
    [clearImportedSessionSemantic, fileUpload],
  );

  const handleLoadExample = useCallback(() => {
    void warmUpEngineOnIntent('load-example');
    clearImportedSessionSemantic();
    fileUpload.handleDemoClick();
  }, [clearImportedSessionSemantic, fileUpload]);

  const handleFileDrop = useCallback(
    (file: File) => {
      void warmUpEngineOnIntent('file-drop');
      clearImportedSessionSemantic();
      void fileUpload.handleDroppedFile(file);
    },
    [clearImportedSessionSemantic, fileUpload],
  );

  return {
    importedSessionSemantic,
    clearImportedSessionSemantic,
    sessionExportSummary,
    sessionImportSummary,
    dismissSessionImportSummary,
    handleExportSession,
    handleOpenSessionImportModal,
    handleSessionImport,
    doExportSessionDownload,
    handleRestore,
    handleDiscard,
    handleDatasetFileUpload,
    handleLoadExample,
    handleFileDrop,
  };
}
