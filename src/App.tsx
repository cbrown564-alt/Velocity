import React, { useCallback, useRef } from 'react';
import { useVelocityStore } from './store';
import { usePersistenceManager } from './hooks/usePersistenceManager';
import { useFileUpload } from './features/workspace/hooks/useFileUpload';
import { useWorkspaceOpen } from './features/workspace/hooks/useWorkspaceOpen';
import { warmUpEngineOnIntent } from './services/engineWarmUp';
import { getLoadStageHeadline } from './lib/uploadFeedback';
import { ToastLayer } from './components/common/ToastLayer';
import { KeyboardShortcuts } from './components/common/KeyboardShortcuts';
import { DesktopRecommendationBanner } from './components/common/DesktopRecommendationBanner';
import { AppModeRouter } from './app/components/AppModeRouter';
import { ModalHost } from './app/components/ModalHost';
import { useAppOverlay } from './app/hooks/useAppOverlay';
import { useSessionLifecycle } from './app/hooks/useSessionLifecycle';
import { useWorkspaceOrchestration } from './app/hooks/useWorkspaceOrchestration';
import type { AppPhase } from './app/types';

export default function App() {
  const [phase, setPhase] = React.useState<AppPhase>('splash');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const overlay = useAppOverlay();
  const persistence = usePersistenceManager(phase, setPhase);
  const fileUpload = useFileUpload(setPhase, persistence.opfsAvailableLocal);

  const session = useSessionLifecycle({
    phase,
    setPhase,
    persistence,
    fileUpload,
    closeSessionImportOverlay: overlay.closeOverlay,
    openSessionExportOverlay: overlay.openSessionExport,
  });

  const workspaceOrchestration = useWorkspaceOrchestration({
    phase,
    setPhase,
    openProjectLink: overlay.openProjectLink,
    openCrossWave: overlay.openCrossWave,
    openWorkspaceExport: overlay.openWorkspaceExport,
    closeCrossWaveOverlay: overlay.closeOverlay,
    closeProjectLinkOverlay: overlay.closeOverlay,
  });

  const { openDataset: handleOpenDataset } = useWorkspaceOpen({
    setMode: setPhase,
    clearImportedSessionSemantic: session.clearImportedSessionSemantic,
  });

  const engineStatus = useVelocityStore((state) => state.engineStatus);
  const initError = useVelocityStore((state) => state.initError);
  const dataset = useVelocityStore((state) => state.dataset);
  const workspace = useVelocityStore((state) => state.workspace);
  const persistedDataInfo = useVelocityStore((state) => state.persistedDataInfo);
  const persistenceError = useVelocityStore((state) => state.persistenceError);
  const persistenceState = useVelocityStore((state) => state.persistenceState);
  const loadProgress = useVelocityStore((state) => state.loadProgress);
  const drillDown = useVelocityStore((state) => state.drillDown);
  const recodeModal = useVelocityStore((state) => state.recodeModal);
  const filterModal = useVelocityStore((state) => state.filterModal);
  const analysisExportModal = useVelocityStore((state) => state.analysisExportModal);
  const closeDrillDown = useVelocityStore((state) => state.closeDrillDown);
  const loadMoreDrillDown = useVelocityStore((state) => state.loadMoreDrillDown);
  const closeRecodeModal = useVelocityStore((state) => state.closeRecodeModal);
  const closeFilterModal = useVelocityStore((state) => state.closeFilterModal);
  const closeAnalysisExportModal = useVelocityStore((state) => state.closeAnalysisExportModal);
  const toggleDatasetStar = useVelocityStore((state) => state.toggleDatasetStar);
  const cancelWorkerBoot = useVelocityStore((state) => state.cancelWorkerBoot);

  const loadStageHeadline = getLoadStageHeadline(loadProgress);
  const variables = dataset?.variables ?? [];

  const handleOpenSessionImportModal = useCallback(() => {
    void warmUpEngineOnIntent('session-import');
    session.handleOpenSessionImportModal();
    overlay.openSessionImport();
  }, [session, overlay]);

  const handleUploadFile = useCallback(() => {
    void warmUpEngineOnIntent('file-picker');
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] antialiased overflow-hidden flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        onChange={session.handleDatasetFileUpload}
        className="hidden"
        accept=".csv,.sav"
        data-testid="dataset-upload-input"
      />

      <DesktopRecommendationBanner />

      <ModalHost
        overlay={overlay.overlay}
        closeOverlay={overlay.closeOverlay}
        workspace={workspace}
        variables={variables}
        sessionExportSummary={session.sessionExportSummary}
        drillDown={drillDown}
        recodeModal={recodeModal}
        filterModal={filterModal}
        analysisExportModal={analysisExportModal}
        onCloseDrillDown={closeDrillDown}
        onLoadMoreDrillDown={loadMoreDrillDown}
        onCloseRecodeModal={closeRecodeModal}
        onSaveRecode={workspaceOrchestration.handleRecodeSave}
        onCloseFilterModal={closeFilterModal}
        onSaveFilter={workspaceOrchestration.handleSaveFilter}
        onCloseAnalysisExportModal={closeAnalysisExportModal}
        onSessionImport={session.handleSessionImport}
        onSessionExportDownload={session.doExportSessionDownload}
        onCreateProject={workspaceOrchestration.handleCreateProject}
        onAddToProject={workspaceOrchestration.handleAddToProject}
        onUpdateWaveNumber={workspaceOrchestration.handleUpdateWaveNumber}
        onSetRespondentKey={workspaceOrchestration.handleSetRespondentKey}
        onOpenDataset={handleOpenDataset}
        onWorkspaceImport={workspaceOrchestration.handleWorkspaceImport}
      />

      <AppModeRouter
        phase={phase}
        engineStatus={engineStatus}
        initError={initError}
        dataset={dataset}
        workspace={workspace}
        persistedDataInfo={persistedDataInfo}
        persistenceError={persistenceError}
        persistenceState={persistenceState}
        loadProgress={loadProgress}
        loadStageHeadline={loadStageHeadline}
        persistence={persistence}
        fileUpload={fileUpload}
        onOpenDataset={handleOpenDataset}
        onUploadFile={handleUploadFile}
        onLoadExample={session.handleLoadExample}
        onCreateProject={workspaceOrchestration.handleOpenProjectModal}
        onDeleteDataset={workspaceOrchestration.handleDeleteDataset}
        onToggleStar={toggleDatasetStar}
        onLinkDatasets={workspaceOrchestration.handleAddToProject}
        onUnlinkDataset={workspaceOrchestration.handleUnlinkDataset}
        onCompareWaves={workspaceOrchestration.handleOpenCrossWavePanel}
        onBatchStar={workspaceOrchestration.handleBatchStar}
        onBatchDelete={workspaceOrchestration.handleBatchDelete}
        onExport={overlay.openWorkspaceExport}
        onImportSession={handleOpenSessionImportModal}
        onFileDrop={session.handleFileDrop}
        onRestore={session.handleRestore}
        onDiscard={() => void session.handleDiscard()}
        onReturnToWorkspace={workspaceOrchestration.handleReturnToWorkspace}
        onOpenSessionImport={handleOpenSessionImportModal}
        onExportSession={session.handleExportSession}
        onRetryEngine={() => void warmUpEngineOnIntent('manual-retry').catch(() => {})}
        onUseMemoryMode={() =>
          void warmUpEngineOnIntent('memory-recovery', { persistenceMode: 'memory' }).catch(() => {})
        }
        onCancelEngineBoot={cancelWorkerBoot}
      />

      {/* Inside the dashboard, the palette mounts within DashboardShell's
          DndContext so rows can be dragged onto the slide. */}
      <KeyboardShortcuts />
      <ToastLayer />
    </div>
  );
}
