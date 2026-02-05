/**
 * useWorkspace Hook
 *
 * Bridges workspace UI components with the Velocity store and OPFS infrastructure.
 * Handles dataset registration, storage monitoring, and session persistence.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useVelocityStore } from '../../../store';
import * as opfsFileManager from '../../../services/opfsFileManager';
import type { StoredDataset, WorkspaceState } from '../components/WorkspaceView';

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
    toggleDatasetStar,
    updateDatasetAccess,
    saveDatasetSession,
    getDatasetSession,
    updateStorageQuota,

    // Data state
    dataset,
    variableSets,
    tableConfig,
    activeFilters,
    transformLog,

    // Data actions
    loadSAV,
    rehydrateDatasetFromOpfs,
    reset,
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
        lastOpenedAt: Date.now(),
      });
      updateDatasetAccess(dataset.id);
    } else {
      // Add new entry
      // Note: We use the dataset's existing ID to maintain consistency
      const storedDataset: Omit<StoredDataset, 'id' | 'createdAt' | 'lastOpenedAt' | 'lastModifiedAt' | 'starred'> = {
        name: dataset.name,
        fileName: dataset.name,
        rowCount: dataset.rowCount,
        columnCount: dataset.variables.length,
        fileSize: 0, // Will be updated if we have OPFS info
        source: dataset.source,
      };

      // If we have an OPFS file key, try to get the file size
      if (dataset.opfsFileKey) {
        opfsFileManager.getFileSize(dataset.opfsFileKey)
          .then(size => {
            if (size > 0) {
              updateStoredDataset(dataset.id, { fileSize: size });
            }
          })
          .catch(() => {});
      }

      // Add to workspace with the dataset's ID
      const id = addStoredDataset(storedDataset);

      // If the generated ID differs, update the mapping
      // This ensures consistency between workspace and data store
      if (id !== dataset.id) {
        console.log(`[useWorkspace] Registered dataset with new ID: ${id}`);
      }
    }

    setActiveDataset(dataset.id);
    setWorkspaceMode(false);
    hasRegisteredDataset.current = true;
  }, [
    dataset,
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
  }, [dataset, activeDatasetId, tableConfig, activeFilters, transformLog, saveDatasetSession]);

  /**
   * Open a dataset from the workspace.
   */
  const openDataset = useCallback(async (storedDataset: StoredDataset): Promise<void> => {
    // Save current session before switching
    saveCurrentSession();

    // Update access time
    updateDatasetAccess(storedDataset.id);

    // Check if this is the currently loaded dataset
    if (dataset?.id === storedDataset.id) {
      setWorkspaceMode(false);
      setActiveDataset(storedDataset.id);
      return;
    }

    // We need to load this dataset
    // First, find the OPFS file key from the stored dataset or try to match by name
    const existingDataset = workspace.datasets.find(d => d.id === storedDataset.id);

    if (!existingDataset) {
      throw new Error('Dataset not found in workspace');
    }

    // Try to restore from OPFS
    // For now, we rely on the user re-uploading if the file isn't available
    // TODO: Store OPFS file key in StoredDataset

    setActiveDataset(storedDataset.id);
    setWorkspaceMode(false);

    // Restore session state if available
    const session = getDatasetSession(storedDataset.id);
    if (session) {
      console.log('[useWorkspace] Restoring session for dataset:', storedDataset.name);
      // Session restoration will be handled by the App component
    }
  }, [
    dataset,
    workspace.datasets,
    saveCurrentSession,
    updateDatasetAccess,
    setWorkspaceMode,
    setActiveDataset,
    getDatasetSession,
  ]);

  /**
   * Delete a dataset from the workspace.
   */
  const deleteDataset = useCallback(async (id: string): Promise<void> => {
    const storedDataset = workspace.datasets.find(d => d.id === id);

    if (storedDataset) {
      // TODO: Clean up OPFS files associated with this dataset

      // Remove from workspace
      removeStoredDataset(id);

      // If this was the active dataset, clear it
      if (activeDatasetId === id) {
        setActiveDataset(null);
      }
    }

    await refreshStorageQuota();
  }, [workspace.datasets, activeDatasetId, removeStoredDataset, setActiveDataset, refreshStorageQuota]);

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
    toggleStar,
    returnToWorkspace,
    refreshStorageQuota,
  };
}

export default useWorkspace;
