/**
 * useWorkspace Hook
 *
 * Bridges workspace UI components with the Velocity store and OPFS infrastructure.
 * Handles dataset registration, storage monitoring, and session persistence.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useVelocityStore } from '../../../store';
import * as opfsFileManager from '../../../services/opfsFileManager';
import type { StoredDataset, WorkspaceState } from '../types';

interface UseWorkspaceReturn {
  // State
  workspace: WorkspaceState;
  activeDatasetId: string | null;
  isWorkspaceMode: boolean;

  // Actions
  openDataset: (dataset: StoredDataset) => Promise<void>;
  registerCurrentDataset: () => void;
  deleteDataset: (id: string) => Promise<void>;
  toggleStar: (id: string) => void;
  deleteDatasets: (ids: string[]) => Promise<void>;
  returnToWorkspace: () => void;

  // Storage
  refreshStorageQuota: () => Promise<void>;
}

/**
 * Hook for managing workspace state and dataset operations.
 */
export function useWorkspace(): UseWorkspaceReturn {
  const {
    // Workspace state
    workspace,
    activeDatasetId,
    isWorkspaceMode,
    setWorkspaceMode,
    setActiveDataset,
    addStoredDataset,
    updateStoredDataset,
    removeStoredDataset,
    removeStoredDatasets,
    toggleDatasetStar,
    updateDatasetAccess,
    saveDatasetSession,
    updateStorageQuota,

    // Data state
    dataset,
    variableSets,
    folders,
    tableConfig,
    activeFilters,
    transformLog,

    // Data actions
    openWorkspaceDataset,
  } = useVelocityStore();

  // Track if we've registered the current dataset
  const hasRegisteredDataset = useRef(false);

  /**
   * Refresh storage quota from OPFS.
   */
  const refreshStorageQuota = useCallback(async () => {
    try {
      const estimate = await opfsFileManager.getStorageEstimate();
      if (estimate) {
        updateStorageQuota(estimate.usage, estimate.quota);
      }
    } catch (error) {
      console.warn('[useWorkspace] Failed to get storage estimate:', error);
    }
  }, [updateStorageQuota]);

  // Monitor storage quota periodically
  useEffect(() => {
    refreshStorageQuota();
    const interval = setInterval(refreshStorageQuota, 30000);
    return () => clearInterval(interval);
  }, [refreshStorageQuota]);

  /**
   * Register the current dataset in the workspace registry.
   * Called after a new file is loaded.
   */
  const registerCurrentDataset = useCallback(() => {
    if (!dataset || hasRegisteredDataset.current) return;

    // Check if dataset already exists in workspace
    const existing = workspace.datasets.find(d => d.id === dataset.id);

    if (existing) {
      // Update existing entry
      updateStoredDataset(dataset.id, {
        name: dataset.name,
        rowCount: dataset.rowCount,
        columnCount: dataset.variables.length,
        variables: dataset.variables,
        variableSets,
        folders,
        opfsFileKey: dataset.opfsFileKey,
        lastOpenedAt: Date.now(),
      });
      updateDatasetAccess(dataset.id);
    } else {
      // Add new entry
      // Note: We use the dataset's existing ID to maintain consistency
      const storedDataset: Omit<StoredDataset, 'createdAt' | 'lastOpenedAt' | 'lastModifiedAt' | 'starred'> = {
        id: dataset.id,
        name: dataset.name,
        fileName: dataset.name,
        rowCount: dataset.rowCount,
        columnCount: dataset.variables.length,
        fileSize: 0, // Will be updated if we have OPFS info
        source: dataset.source,
        variables: dataset.variables,
        variableSets,
        folders,
        opfsFileKey: dataset.opfsFileKey,
        tableName: `dataset_${dataset.id.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      };

      // If we have an OPFS file key, try to get the file size
      if (dataset.opfsFileKey) {
        opfsFileManager.getFileSize(dataset.opfsFileKey)
          .then(size => {
            if (size > 0) {
              updateStoredDataset(dataset.id, { fileSize: size });
            }
          })
          .catch(() => { });
      }

      // Add to workspace with the dataset's ID
      const id = addStoredDataset(storedDataset);
      if (id !== dataset.id) {
        console.warn(`[useWorkspace] Dataset ID mismatch during registration: ${dataset.id} -> ${id}`);
      }
    }

    setActiveDataset(dataset.id);
    setWorkspaceMode(false);
    hasRegisteredDataset.current = true;
  }, [
    dataset,
    variableSets,
    folders,
    workspace.datasets,
    addStoredDataset,
    updateStoredDataset,
    updateDatasetAccess,
    setActiveDataset,
    setWorkspaceMode,
  ]);

  // Auto-register dataset when it changes
  useEffect(() => {
    if (dataset && !isWorkspaceMode) {
      registerCurrentDataset();
    }
  }, [dataset, isWorkspaceMode, registerCurrentDataset]);

  // Reset registration flag when dataset changes
  useEffect(() => {
    if (!dataset) {
      hasRegisteredDataset.current = false;
    }
  }, [dataset?.id]);

  /**
   * Save current session state before switching datasets.
   */
  const saveCurrentSession = useCallback(() => {
    if (!dataset || !activeDatasetId) return;

    saveDatasetSession(activeDatasetId, {
      tableConfig,
      activeFilters,
      transformLog,
    });
    updateStoredDataset(activeDatasetId, {
      variables: dataset.variables,
      variableSets,
      folders,
    });
  }, [dataset, activeDatasetId, tableConfig, activeFilters, transformLog, variableSets, folders, saveDatasetSession, updateStoredDataset]);

  /**
   * Open a dataset from the workspace.
   */
  const openDataset = useCallback(async (storedDataset: StoredDataset): Promise<void> => {
    saveCurrentSession();
    updateDatasetAccess(storedDataset.id);

    if (dataset?.id === storedDataset.id) {
      setWorkspaceMode(false);
      setActiveDataset(storedDataset.id);
      return;
    }

    const existingDataset = workspace.datasets.find(d => d.id === storedDataset.id);
    if (!existingDataset) {
      throw new Error('Dataset not found in workspace');
    }

    await openWorkspaceDataset(existingDataset);
    setActiveDataset(storedDataset.id);
    setWorkspaceMode(false);
  }, [
    dataset,
    workspace.datasets,
    saveCurrentSession,
    updateDatasetAccess,
    setWorkspaceMode,
    setActiveDataset,
    openWorkspaceDataset,
  ]);

  /**
   * Delete a dataset from the workspace.
   */
  const deleteDataset = useCallback(async (id: string): Promise<void> => {
    const storedDataset = workspace.datasets.find(d => d.id === id);
    if (storedDataset) {
      await opfsFileManager.deleteDatasetPersistence(storedDataset.id, storedDataset.opfsFileKey);
      removeStoredDatasets([id]);
    }

    await refreshStorageQuota();
  }, [workspace.datasets, removeStoredDatasets, refreshStorageQuota]);

  /**
   * Delete multiple datasets from the workspace.
   */
  const deleteDatasets = useCallback(async (ids: string[]): Promise<void> => {
    await Promise.all(ids.map(async (id) => {
      const storedDataset = workspace.datasets.find(d => d.id === id);
      if (storedDataset) {
        await opfsFileManager.deleteDatasetPersistence(storedDataset.id, storedDataset.opfsFileKey);
      }
    }));

    removeStoredDatasets(ids);
    await refreshStorageQuota();
  }, [workspace.datasets, removeStoredDatasets, refreshStorageQuota]);

  /**
   * Toggle star status for a dataset.
   */
  const toggleStar = useCallback((id: string) => {
    toggleDatasetStar(id);
  }, [toggleDatasetStar]);

  /**
   * Return to workspace view.
   */
  const returnToWorkspace = useCallback(() => {
    // Save current session before returning
    saveCurrentSession();
    setWorkspaceMode(true);
  }, [saveCurrentSession, setWorkspaceMode]);

  return {
    workspace,
    activeDatasetId,
    isWorkspaceMode,
    openDataset,
    registerCurrentDataset,
    deleteDataset,
    deleteDatasets,
    toggleStar,
    returnToWorkspace,
    refreshStorageQuota,
  };
}

export default useWorkspace;
