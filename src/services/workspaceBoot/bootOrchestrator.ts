/**
 * Boot state machine — deterministic restore strategy with time budgets.
 */

import type { Dataset } from '../../types/dataset';
import type { PersistedDataInfo, PersistenceState } from '../../store/slices/data/types';
import { recordBootTransition, type BootRestoreStrategy } from '../pilotOnboarding';

export type { BootRestoreStrategy };

export type AppBootMode = 'splash' | 'uploading' | 'dashboard' | 'restoring' | 'metadata';

export type BootRestorePlan =
  | { kind: 'wait' }
  | { kind: 'rebuild-from-source'; fallbackMode: AppBootMode; forceReload?: boolean }
  | { kind: 'restore-from-cache'; nextMode: AppBootMode }
  | { kind: 'set-mode'; mode: AppBootMode }
  | { kind: 'complete' }
  | { kind: 'noop' };

export interface BootRestoreInput {
  persistenceState: PersistenceState;
  persistedDataInfo: PersistedDataInfo | null;
  dataset: Dataset | null;
  mode: AppBootMode;
  isWorkspaceMode: boolean;
  persistentStorageGranted: boolean | null;
  persistentStorageResolved: boolean;
}

function hasMatchingPersistedMetadata(dataset: Dataset, persistedDataInfo: PersistedDataInfo): boolean {
  const persistedMeta = persistedDataInfo.metadata;
  if (persistedMeta) {
    return (
      dataset.rowCount === persistedMeta.rowCount &&
      dataset.variables.length === persistedMeta.columnCount &&
      (persistedMeta.datasetId ? dataset.id === persistedMeta.datasetId : true)
    );
  }
  return (
    dataset.rowCount === persistedDataInfo.rowCount && dataset.variables.length === persistedDataInfo.schema.length
  );
}

function emitTransition(from: string, to: BootRestoreStrategy, reason: string, extra?: Record<string, unknown>): void {
  recordBootTransition({ from, to, reason, ...extra });
}

export function resolveRebuildSuccessMode(isWorkspaceMode: boolean): AppBootMode {
  return isWorkspaceMode ? 'splash' : 'dashboard';
}

export function resolveBootRestoreStrategy(input: BootRestoreInput): BootRestorePlan {
  const {
    persistenceState,
    persistedDataInfo,
    dataset,
    mode,
    isWorkspaceMode,
    persistentStorageGranted,
    persistentStorageResolved,
  } = input;

  if (persistenceState === 'corrupt' && dataset?.opfsFileKey) {
    emitTransition('corrupt', 'rebuild-from-source', 'duckdb_cache_corrupt');
    return {
      kind: 'rebuild-from-source',
      fallbackMode: mode === 'dashboard' ? 'dashboard' : 'splash',
      forceReload: true,
    };
  }

  if (mode === 'uploading' || mode === 'metadata') {
    return { kind: 'wait' };
  }

  if (mode === 'dashboard' && dataset && (persistenceState === 'found' || persistenceState === 'ready')) {
    return { kind: 'complete' };
  }

  if (persistenceState === 'found' && persistedDataInfo) {
    const shouldWaitForStorageDecision = Boolean(dataset?.opfsFileKey) && !persistentStorageResolved;
    if (shouldWaitForStorageDecision) {
      return { kind: 'wait' };
    }

    if (dataset) {
      const hasMatchingMetadata = hasMatchingPersistedMetadata(dataset, persistedDataInfo);
      const shouldPreferSourceRebuild = Boolean(dataset.opfsFileKey) && persistentStorageGranted === false;

      if (hasMatchingMetadata && shouldPreferSourceRebuild) {
        emitTransition('found', 'rebuild-from-source', 'persistent_storage_denied');
        return { kind: 'rebuild-from-source', fallbackMode: 'splash', forceReload: true };
      }

      if (hasMatchingMetadata) {
        emitTransition('found', 'open-cache', 'metadata_match');
        const nextMode = isWorkspaceMode ? 'splash' : 'dashboard';
        return { kind: 'restore-from-cache', nextMode };
      }
    }

    emitTransition('found', 'fresh', 'metadata_mismatch');
    return { kind: 'set-mode', mode: 'restoring' };
  }

  if (persistenceState === 'ready' && mode === 'restoring') {
    const nextMode = dataset ? 'dashboard' : 'splash';
    emitTransition('restoring', dataset ? 'open-cache' : 'fresh', 'persistence_ready');
    return { kind: 'set-mode', mode: nextMode };
  }

  if (persistenceState === 'ready' && mode === 'splash') {
    if (dataset?.opfsFileKey) {
      emitTransition('splash', 'rebuild-from-source', 'opfs_source_available');
      return { kind: 'rebuild-from-source', fallbackMode: 'splash' };
    }
    emitTransition('splash', 'fresh', 'no_opfs_source');
    return { kind: 'complete' };
  }

  return { kind: 'noop' };
}
