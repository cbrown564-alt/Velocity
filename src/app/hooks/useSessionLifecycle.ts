import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  exportSession,
  hasSessionImportDiagnostics,
  importSession,
  listSessionImportDiagnostics,
  serializeSessionFile,
  type SessionImportDiagnosticsSummary,
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
  handleExportSession: () => void;
  handleOpenSessionImportModal: () => void;
  handleSessionImport: (payload: SessionImportPayload) => Promise<void>;
  doExportSessionDownload: () => Promise<void>;
  handleRestore: () => void;
  handleDiscard: () => Promise<void>;
  handleDatasetFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleLoadExample: () => void;
}

export function useSessionLifecycle({
  phase,
  setPhase,
  persistence,
  fileUpload,
  closeSessionImportOverlay,
  openSessionExportOverlay,
}: UseSessionLifecycleOptions): UseSessionLifecycleReturn {
  const {
    dataset,
    variableSets,
    folders,
    transformLog,
    tableConfig,
    activeFilters,
    analysisSettings,
    slides,
    sections,
    workspace,
    activeDatasetId,
    harmonization,
    loadSAV,
    recodeVariable,
    discardPersistedData,
  } = useVelocityStore();

  const [sessionImportDiagnostics, setSessionImportDiagnostics] = useState<SessionImportDiagnosticsSummary | null>(
    null,
  );
  const [importedSessionSemantic, setImportedSessionSemantic] = useState<ImportedSessionSemanticState | null>(null);

  const clearImportedSessionSemantic = useCallback(() => {
    setImportedSessionSemantic(null);
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
      harmonizationSession: harmonization.session,
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
    harmonization.session,
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
    setSessionImportDiagnostics(null);
  }, []);

  const handleSessionImport = useCallback(
    async (payload: SessionImportPayload) => {
      const previousPhase = phase;
      setSessionImportDiagnostics(null);
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
        setPhase('dashboard');
        closeSessionImportOverlay();
        if (hasSessionImportDiagnostics(imported.diagnostics)) {
          setSessionImportDiagnostics(imported.diagnostics);
        }
      } catch (importError: unknown) {
        setPhase(previousPhase);
        const message = importError instanceof Error ? importError.message : undefined;
        throw new Error(message || 'Session import failed', { cause: importError });
      }
    },
    [phase, loadSAV, recodeVariable, setPhase, closeSessionImportOverlay],
  );

  const sessionImportMessages = useMemo(
    () => (sessionImportDiagnostics ? listSessionImportDiagnostics(sessionImportDiagnostics) : []),
    [sessionImportDiagnostics],
  );

  useEffect(() => {
    if (!sessionImportDiagnostics || sessionImportMessages.length === 0) return;

    const preview = sessionImportMessages
      .slice(0, 2)
      .map((item) => item.message)
      .join(' ');
    const extra = sessionImportMessages.length > 2 ? ` (+${sessionImportMessages.length - 2} more)` : '';

    useVelocityStore.getState().addToast({
      dedupeKey: 'session-import',
      title: 'Session imported with adjustments',
      message: `${preview}${extra}`.trim(),
      type: 'warning',
      duration: 10_000,
    });
    setSessionImportDiagnostics(null);
  }, [sessionImportDiagnostics, sessionImportMessages]);

  const handleRestore = useCallback(() => {
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
      await fileUpload.handleFileUpload(event);
    },
    [clearImportedSessionSemantic, fileUpload],
  );

  const handleLoadExample = useCallback(() => {
    clearImportedSessionSemantic();
    fileUpload.handleDemoClick();
  }, [clearImportedSessionSemantic, fileUpload]);

  return {
    importedSessionSemantic,
    clearImportedSessionSemantic,
    sessionExportSummary,
    handleExportSession,
    handleOpenSessionImportModal,
    handleSessionImport,
    doExportSessionDownload,
    handleRestore,
    handleDiscard,
    handleDatasetFileUpload,
    handleLoadExample,
  };
}
