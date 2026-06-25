import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DURATIONS, getMotionProps, useReducedMotion } from '../../lib/motion';
import { DashboardShell } from '../../features/dashboard/DashboardShell';
import type { PersistenceManagerState } from '../../hooks/usePersistenceManager';
import type { FileUploadState } from '../../features/workspace/hooks/useFileUpload';
import type { Dataset } from '../../types/dataset';
import type { LoadProgressState } from '../../store/slices/data/types';
import type { PersistenceState } from '../../store/slices/data/types';
import type { WorkspaceState, Project, StoredDataset } from '../../features/workspace';
import type { AppPhase } from '../types';
import { MetadataScreen } from '../screens/MetadataScreen';
import { PartialLoadNotice } from '../screens/PartialLoadNotice';
import { RestorationPrompt } from '../screens/RestorationPrompt';
import { SplashScreen } from '../screens/SplashScreen';
import { UploadOverlay } from '../screens/UploadOverlay';
import { UploadProgressBar } from '../screens/UploadProgressBar';

export interface AppModeRouterProps {
  phase: AppPhase;
  isDbReady: boolean;
  initError: string | null;
  dataset: Dataset | null;
  workspace: WorkspaceState;
  persistedDataInfo: {
    rowCount: number;
    schema: unknown[];
    metadata?: { datasetName?: string; lastModified?: number };
  } | null;
  persistenceError: string | null;
  persistenceState: PersistenceState;
  loadProgress: LoadProgressState | null;
  loadStageHeadline: string;
  persistence: PersistenceManagerState;
  fileUpload: FileUploadState;
  onOpenDataset: (storedDataset: StoredDataset) => Promise<void>;
  onUploadFile: () => void;
  onLoadExample: () => void;
  onCreateProject: (ids: string[]) => void;
  onDeleteDataset: (id: string) => Promise<void>;
  onToggleStar: (id: string) => void;
  onLinkDatasets: (ids: string[], projectId: string) => void;
  onUnlinkDataset: (id: string) => void;
  onCompareWaves: (project: Project, w1: StoredDataset, w2: StoredDataset) => void;
  onBatchStar: (ids: string[], starred: boolean) => void;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onExport: (ids: string[]) => void;
  onImportSession: () => void;
  onRestore: () => void;
  onDiscard: () => void;
  onReturnToWorkspace: () => void;
  onOpenSessionImport: () => void;
  onExportSession: () => void;
}

export const AppModeRouter: React.FC<AppModeRouterProps> = ({
  phase,
  isDbReady,
  initError,
  dataset,
  workspace,
  persistedDataInfo,
  persistenceError,
  persistenceState,
  loadProgress,
  loadStageHeadline,
  persistence,
  fileUpload,
  onOpenDataset,
  onUploadFile,
  onLoadExample,
  onCreateProject,
  onDeleteDataset,
  onToggleStar,
  onLinkDatasets,
  onUnlinkDataset,
  onCompareWaves,
  onBatchStar,
  onBatchDelete,
  onExport,
  onImportSession,
  onRestore,
  onDiscard,
  onReturnToWorkspace,
  onOpenSessionImport,
  onExportSession,
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <>
    <AnimatePresence>
      {phase === 'uploading' && <UploadProgressBar progress={loadProgress} />}
    </AnimatePresence>

    <AnimatePresence>
      {phase === 'uploading' && (
        <UploadOverlay
          loadStageHeadline={loadStageHeadline}
          loadProgress={loadProgress}
          pendingSavFileName={fileUpload.pendingSavFile?.name}
          datasetName={dataset?.name}
        />
      )}
    </AnimatePresence>

    <AnimatePresence mode="wait">
      {phase === 'splash' && (
        <SplashScreen
          isDbReady={isDbReady}
          initError={initError}
          workspace={workspace}
          dataset={dataset}
          persistenceError={persistenceError}
          persistenceState={persistenceState}
          loadProgress={loadProgress}
          opfsRehydrateError={persistence.opfsRehydrateError}
          opfsErrorHint={persistence.opfsErrorHint ?? undefined}
          onOpenDataset={onOpenDataset}
          onUploadFile={onUploadFile}
          onLoadExample={onLoadExample}
          onCreateProject={onCreateProject}
          onDeleteDataset={onDeleteDataset}
          onToggleStar={onToggleStar}
          onLinkDatasets={onLinkDatasets}
          onUnlinkDataset={onUnlinkDataset}
          onCompareWaves={onCompareWaves}
          onBatchStar={onBatchStar}
          onBatchDelete={onBatchDelete}
          onExport={onExport}
          onImportSession={onImportSession}
          onRebuildFromOpfs={persistence.rebuildFromOpfsSource}
          onDiscard={onDiscard}
        />
      )}
      {phase === 'dashboard' && (
        <motion.div
          key="analysis-dashboard"
          {...getMotionProps({
            preset: 'fade',
            duration: reducedMotion ? DURATIONS.instant : DURATIONS.fast,
            reducedMotion,
          })}
          className="h-full"
        >
          <DashboardShell
            persistence={persistence}
            onReturnToWorkspace={onReturnToWorkspace}
            onOpenSessionImport={onOpenSessionImport}
            onExportSession={onExportSession}
          />
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {phase === 'restoring' && persistedDataInfo && (
        <RestorationPrompt
          rowCount={persistedDataInfo.rowCount}
          columnCount={persistedDataInfo.schema.length}
          datasetName={persistedDataInfo.metadata?.datasetName || dataset?.name}
          lastModified={persistedDataInfo.metadata?.lastModified}
          warning={persistence.restorationPromptWarning}
          onRestore={onRestore}
          onDiscard={onDiscard}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {persistence.showPartialLoadNotice && dataset && (
        <PartialLoadNotice
          title="Dataset Loaded With Partial Metadata"
          message={
            persistence.partialLoadMessage ||
            'This dataset may have loaded with partial metadata.'
          }
          details={
            dataset.loadDiagnostics?.valueLabelsDropped
              ? `${dataset.loadDiagnostics.valueLabelsDropped.toLocaleString()} value labels were removed from cached metadata to keep the app within browser storage limits.`
              : undefined
          }
          canRebuild={Boolean(dataset.opfsFileKey)}
          onRebuild={() => {
            persistence.setShowPartialLoadNotice(false);
            void persistence.rebuildFromOpfsSource('dashboard');
          }}
          onDismiss={persistence.handleDismissPartialLoadNotice}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {phase === 'metadata' && dataset && (
        <MetadataScreen
          dataset={dataset}
          pendingSavSizeMb={fileUpload.pendingSavSizeMb ?? undefined}
          onCancel={fileUpload.handleMetadataCancel}
          onLoadFull={fileUpload.handleMetadataLoadFull}
        />
      )}
    </AnimatePresence>

    </>
  );
};
