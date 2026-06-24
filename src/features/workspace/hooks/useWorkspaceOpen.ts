/**
 * useWorkspaceOpen Hook
 *
 * Orchestrates opening a stored workspace dataset: session save, mode transitions,
 * and the openWorkspaceDataset store action. Extracted from App.tsx (STAB-ARCH-1 §8.1).
 */

import { useCallback } from 'react';
import { useVelocityStore } from '../../../store';
import type { StoredDataset } from '../types';

export type WorkspaceOpenAppMode = 'splash' | 'uploading' | 'dashboard' | 'restoring' | 'metadata';

export interface UseWorkspaceOpenOptions {
  setMode: (mode: WorkspaceOpenAppMode) => void;
  clearImportedSessionSemantic: () => void;
}

export interface UseWorkspaceOpenReturn {
  openDataset: (storedDataset: StoredDataset) => Promise<void>;
}

export function useWorkspaceOpen({
  setMode,
  clearImportedSessionSemantic,
}: UseWorkspaceOpenOptions): UseWorkspaceOpenReturn {
  const {
    dataset,
    activeDatasetId,
    tableConfig,
    activeFilters,
    transformLog,
    variableSets,
    folders,
    saveDatasetSession,
    updateDatasetAccess,
    updateStoredDataset,
    setActiveDataset,
    setWorkspaceMode,
    openWorkspaceDataset,
  } = useVelocityStore();

  const openDataset = useCallback(async (storedDataset: StoredDataset) => {
    clearImportedSessionSemantic();
    if (dataset && activeDatasetId && dataset.id !== storedDataset.id) {
      saveDatasetSession(activeDatasetId, { tableConfig, activeFilters, transformLog });
      updateStoredDataset(activeDatasetId, { variables: dataset.variables, variableSets, folders });
    }
    updateDatasetAccess(storedDataset.id);
    setActiveDataset(storedDataset.id);
    setWorkspaceMode(false);

    if (dataset?.id === storedDataset.id) {
      setWorkspaceMode(false);
      setMode('dashboard');
      return;
    }

    setMode('uploading');
    try {
      await openWorkspaceDataset(storedDataset);
      setMode('dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : undefined;
      console.error('[useWorkspaceOpen] Failed to open workspace dataset:', error);
      alert(message || 'Failed to open dataset from workspace.');
      setMode('splash');
      setWorkspaceMode(true);
    }
  }, [
    clearImportedSessionSemantic,
    dataset,
    activeDatasetId,
    tableConfig,
    activeFilters,
    transformLog,
    variableSets,
    folders,
    saveDatasetSession,
    updateDatasetAccess,
    updateStoredDataset,
    setActiveDataset,
    setWorkspaceMode,
    openWorkspaceDataset,
    setMode,
  ]);

  return { openDataset };
}

export default useWorkspaceOpen;
