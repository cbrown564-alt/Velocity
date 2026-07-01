/**
 * useWorkspace Hook
 *
 * Bridges workspace UI components with the Velocity store and OPFS infrastructure.
 * Handles dataset registration, storage monitoring, and session persistence.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useVelocityStore } from '../../../store';
import { persistDatasetSession } from '../../../store/datasetSessionCoordinator';
import * as opfsFileManager from '../../../services/opfsFileManager';
import type { StoredDataset, WorkspaceState } from '../types';

interface UseWorkspaceReturn {
  // State
  workspace: WorkspaceState;
  activeDatasetId: string | null;
  isWorkspaceMode: boolean;

  // Actions
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
  const workspace = useVelocityStore((state) => state.workspace);
  const activeDatasetId = useVelocityStore((state) => state.activeDatasetId);
  const isWorkspaceMode = useVelocityStore((state) => state.isWorkspaceMode);
  const setWorkspaceMode = useVelocityStore((state) => state.setWorkspaceMode);
  const setActiveDataset = useVelocityStore((state) => state.setActiveDataset);
  const addStoredDataset = useVelocityStore((state) => state.addStoredDataset);
  const updateStoredDataset = useVelocityStore((state) => state.updateStoredDataset);
  const removeStoredDatasets = useVelocityStore((state) => state.removeStoredDatasets);
  const toggleDatasetStar = useVelocityStore((state) => state.toggleDatasetStar);
  const updateDatasetAccess = useVelocityStore((state) => state.updateDatasetAccess);
  const saveDatasetSession = useVelocityStore((state) => state.saveDatasetSession);
  const updateStorageQuota = useVelocityStore((state) => state.updateStorageQuota);
  const dataset = useVelocityStore((state) => state.dataset);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const folders = useVelocityStore((state) => state.folders);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const activeFilters = useVelocityStore((state) => state.activeFilters);
  const transformLog = useVelocityStore((state) => state.transformLog);

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
    const existing = workspace.datasets.find((d) => d.id === dataset.id);

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

      opfsFileManager
        .getDatasetPersistenceSize(dataset.id, dataset.opfsFileKey)
        .then((size) => {
          if (size > 0) {
            updateStoredDataset(dataset.id, { fileSize: size });
          }
        })
        .catch(() => {});

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
  }, [dataset]);

  /**
   * Save current session state before switching datasets.
   */
  const saveCurrentSession = useCallback(() => {
    persistDatasetSession(
      {
        dataset,
        activeDatasetId,
        tableConfig,
        activeFilters,
        transformLog,
        variableSets,
        folders,
      },
      { saveDatasetSession, updateStoredDataset },
    );
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
  ]);

  /**
   * Delete a dataset from the workspace.
   */
  const deleteDataset = useCallback(
    async (id: string): Promise<void> => {
      const storedDataset = workspace.datasets.find((d) => d.id === id);
      if (storedDataset) {
        await opfsFileManager.deleteDatasetPersistence(storedDataset.id, storedDataset.opfsFileKey);
        removeStoredDatasets([id]);
      }

      await refreshStorageQuota();
    },
    [workspace.datasets, removeStoredDatasets, refreshStorageQuota],
  );

  /**
   * Delete multiple datasets from the workspace.
   */
  const deleteDatasets = useCallback(
    async (ids: string[]): Promise<void> => {
      await Promise.all(
        ids.map(async (id) => {
          const storedDataset = workspace.datasets.find((d) => d.id === id);
          if (storedDataset) {
            await opfsFileManager.deleteDatasetPersistence(storedDataset.id, storedDataset.opfsFileKey);
          }
        }),
      );

      removeStoredDatasets(ids);
      await refreshStorageQuota();
    },
    [workspace.datasets, removeStoredDatasets, refreshStorageQuota],
  );

  /**
   * Toggle star status for a dataset.
   */
  const toggleStar = useCallback(
    (id: string) => {
      toggleDatasetStar(id);
    },
    [toggleDatasetStar],
  );

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
    registerCurrentDataset,
    deleteDataset,
    deleteDatasets,
    toggleStar,
    returnToWorkspace,
    refreshStorageQuota,
  };
}

export default useWorkspace;
