import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, BarChart3, LayoutGrid, Loader2 } from 'lucide-react';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../lib/motion';
import { getPersistenceDisplayMessage } from '../../lib/persistenceDisplay';
import { getLoadStageHeadline } from '../../lib/uploadFeedback';
import type { Dataset } from '../../types/dataset';
import type { WorkspaceState, Project, StoredDataset } from '../../features/workspace';
import { WorkspaceView } from '../../features/workspace';
import type { LoadProgressState, PersistenceState } from '../../store/slices/data/types';

export interface SplashScreenProps {
  isDbReady: boolean;
  initError: string | null;
  persistenceState: PersistenceState;
  loadProgress: LoadProgressState | null;
  workspace: WorkspaceState;
  dataset: Dataset | null;
  persistenceError: string | null;
  opfsRehydrateError: string | null;
  opfsErrorHint: string | undefined;
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
  onRebuildFromOpfs: (mode: 'splash' | 'dashboard') => void;
  onDiscard: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isDbReady,
  initError,
  persistenceState,
  loadProgress,
  workspace,
  dataset,
  persistenceError,
  opfsRehydrateError,
  opfsErrorHint,
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
  onRebuildFromOpfs,
  onDiscard,
}) => {
  const reducedMotion = useReducedMotion();
  const initHeadline = loadProgress ? getLoadStageHeadline(loadProgress) : getEngineInitHeadline(persistenceState);
  const initDetail = loadProgress?.message || getEngineInitDetail(persistenceState);
  const initPercent = loadProgress ? Math.max(0, Math.min(100, Math.round(loadProgress.progress * 100))) : null;

  return (
    <motion.div
      key="workspace-splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.12 } }}
      className="fixed inset-0 bg-[var(--bg-app)] z-40"
    >
      {isDbReady && !initError && (
        <WorkspaceView
          workspaceState={workspace}
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
        />
      )}

      {(!isDbReady || initError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-app)] z-50">
          <div className="text-center space-y-4 max-w-md w-full px-6">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">Velocity.</h1>
            <p className="text-[var(--text-secondary)] text-lg">The zero-latency research dashboard.</p>
            {initError ? (
              <div className="flex items-center justify-center gap-2 text-[var(--color-error)] text-sm font-medium bg-[var(--status-error-surface)] p-2 rounded-md">
                <AlertCircle size={16} />
                <span>{initError}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-[var(--color-accent)] animate-spin" />
                <p className="text-sm text-[var(--color-accent)]" data-testid="engine-init-headline">
                  {initHeadline}
                </p>
              </div>
            )}
            {!initError && (
              <div className="space-y-1">
                <p className="text-xs text-[var(--text-secondary)]" data-testid="engine-init-detail">
                  {initDetail}
                </p>
                {initPercent !== null && (
                  <p className="text-xs text-[var(--text-tertiary)]" data-testid="engine-init-progress">
                    {initPercent}% complete
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {dataset && (opfsRehydrateError || persistenceError) && (
        <div className="absolute bottom-6 left-6 right-6 max-w-lg mx-auto">
          <div className="text-left text-[var(--status-warning-text)] bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded-lg p-4 shadow-lg space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                {opfsRehydrateError && (
                  <>
                    <div className="text-sm font-medium">Couldn&apos;t restore data from your saved file.</div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        Technical details
                      </summary>
                      <p className="mt-1 break-words opacity-90">{opfsRehydrateError}</p>
                    </details>
                  </>
                )}
                {!opfsRehydrateError && persistenceError && (() => {
                  const { headline, detail } = getPersistenceDisplayMessage(persistenceError, opfsErrorHint);
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
                <button
                  type="button"
                  onClick={() => void onRebuildFromOpfs('splash')}
                  className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-[var(--text-inverse)] text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Retry Restore
                </button>
                <button
                  type="button"
                  onClick={onDiscard}
                  className="px-3 py-1.5 rounded bg-[var(--bg-panel)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] text-xs font-medium hover:bg-[var(--status-warning-surface)] transition-colors"
                >
                  Start Fresh
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

function getEngineInitHeadline(persistenceState: PersistenceState): string {
  switch (persistenceState) {
    case 'checking':
      return 'Starting analysis engine...';
    case 'found':
      return 'Restoring local workspace...';
    case 'restoring':
      return 'Restoring dataset...';
    case 'ready':
      return 'Preparing workspace...';
    case 'corrupt':
      return 'Recovering storage...';
    case 'error':
      return 'Engine initialization failed';
    case 'idle':
    default:
      return 'Initializing Analysis Engine...';
  }
}

function getEngineInitDetail(persistenceState: PersistenceState): string {
  switch (persistenceState) {
    case 'checking':
      return 'Checking local storage and persistence availability.';
    case 'found':
      return 'Verifying saved dataset metadata before opening.';
    case 'restoring':
      return 'Applying your last saved analysis context.';
    case 'ready':
      return 'Finalizing startup checks.';
    case 'corrupt':
      return 'Attempting safe recovery from corrupted cache files.';
    case 'error':
      return 'Review the error above and reload to retry initialization.';
    case 'idle':
    default:
      return 'Booting worker runtime and preparing the analysis engine.';
  }
}
