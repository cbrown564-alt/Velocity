/**
 * Workspace Slice
 *
 * Manages multi-file workspace state: stored datasets, projects,
 * and storage health monitoring.
 */

import { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { StoredDataset, Project, WorkspaceState } from '../../features/workspace';

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceSlice {
  // State
  workspace: WorkspaceState;
  activeDatasetId: string | null;
  isWorkspaceMode: boolean;

  // Actions
  setWorkspaceMode: (enabled: boolean) => void;
  setActiveDataset: (id: string | null) => void;

  // Dataset CRUD
  addStoredDataset: (dataset: Omit<StoredDataset, 'createdAt' | 'lastOpenedAt' | 'lastModifiedAt' | 'starred'> & { id?: string }) => string;
  updateStoredDataset: (id: string, updates: Partial<StoredDataset>) => void;
  removeStoredDataset: (id: string) => void;
  removeStoredDatasets: (ids: string[]) => void;
  toggleDatasetStar: (id: string) => void;
  updateDatasetAccess: (id: string) => void;

  // Project management
  createProject: (project: Omit<Project, 'id' | 'createdAt'>) => string;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  addDatasetsToProject: (datasetIds: string[], projectId: string) => void;
  removeDatasetsFromProject: (datasetIds: string[]) => void;

  // Wave management
  setDatasetWave: (datasetId: string, waveNumber: number) => void;
  setDatasetRespondentKey: (datasetId: string, variableName: string) => void;

  // Session persistence
  saveDatasetSession: (datasetId: string, session: StoredDataset['sessionState']) => void;
  getDatasetSession: (datasetId: string) => StoredDataset['sessionState'] | undefined;

  // Storage health
  updateStorageQuota: (used: number, quota: number) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialWorkspaceState: WorkspaceState = {
  datasets: [],
  projects: [],
  storageUsed: 0,
  storageQuota: 1024 * 1024 * 1024, // 1GB default
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createWorkspaceSlice: StateCreator<WorkspaceSlice> = (set, get) => ({
  // Initial state
  workspace: initialWorkspaceState,
  activeDatasetId: null,
  isWorkspaceMode: true,

  // Mode switching
  setWorkspaceMode: (enabled) => set({ isWorkspaceMode: enabled }),
  setActiveDataset: (id) => set({ activeDatasetId: id }),

  // Dataset CRUD
  addStoredDataset: (dataset) => {
    const id = dataset.id ?? uuidv4();
    const now = Date.now();
    set((state) => {
      const existingIndex = state.workspace.datasets.findIndex(d => d.id === id);
      if (existingIndex >= 0) {
        const existing = state.workspace.datasets[existingIndex];
        const updated: StoredDataset = {
          ...existing,
          ...dataset,
          id,
          lastModifiedAt: now,
        };
        const datasets = [...state.workspace.datasets];
        datasets[existingIndex] = updated;
        return {
          workspace: {
            ...state.workspace,
            datasets,
          },
        };
      }

      const newDataset: StoredDataset = {
        ...dataset,
        id,
        createdAt: now,
        lastOpenedAt: now,
        lastModifiedAt: now,
        starred: false,
      };

      return {
        workspace: {
          ...state.workspace,
          datasets: [...state.workspace.datasets, newDataset],
        },
      };
    });

    return id;
  },

  updateStoredDataset: (id, updates) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        datasets: state.workspace.datasets.map((d) =>
          d.id === id ? { ...d, ...updates, lastModifiedAt: Date.now() } : d
        ),
      },
    }));
  },

  removeStoredDataset: (id) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        datasets: state.workspace.datasets.filter((d) => d.id !== id),
        // Also remove from any projects
        projects: state.workspace.projects.map((p) => ({
          ...p,
          datasetIds: p.datasetIds.filter((did) => did !== id),
        })),
      },
      // Clear active if removed
      activeDatasetId: state.activeDatasetId === id ? null : state.activeDatasetId,
    }));
  },

  removeStoredDatasets: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({
      workspace: {
        ...state.workspace,
        datasets: state.workspace.datasets.filter((d) => !idSet.has(d.id)),
        // Also remove from any projects
        projects: state.workspace.projects.map((p) => ({
          ...p,
          datasetIds: p.datasetIds.filter((did) => !idSet.has(did)),
        })),
      },
      // Clear active if removed
      activeDatasetId:
        state.activeDatasetId && idSet.has(state.activeDatasetId)
          ? null
          : state.activeDatasetId,
    }));
  },

  toggleDatasetStar: (id) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        datasets: state.workspace.datasets.map((d) =>
          d.id === id ? { ...d, starred: !d.starred } : d
        ),
      },
    }));
  },

  updateDatasetAccess: (id) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        datasets: state.workspace.datasets.map((d) =>
          d.id === id ? { ...d, lastOpenedAt: Date.now() } : d
        ),
      },
    }));
  },

  // Project management
  createProject: (project) => {
    const id = uuidv4();
    const newProject: Project = {
      ...project,
      id,
      createdAt: Date.now(),
    };

    set((state) => ({
      workspace: {
        ...state.workspace,
        projects: [...state.workspace.projects, newProject],
        // Update datasets to reference this project
        datasets: state.workspace.datasets.map((d) =>
          project.datasetIds.includes(d.id) ? { ...d, projectId: id } : d
        ),
      },
    }));

    return id;
  },

  updateProject: (id, updates) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        projects: state.workspace.projects.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      },
    }));
  },

  removeProject: (id) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        projects: state.workspace.projects.filter((p) => p.id !== id),
        // Clear project reference from datasets
        datasets: state.workspace.datasets.map((d) =>
          d.projectId === id ? { ...d, projectId: undefined, waveNumber: undefined } : d
        ),
      },
    }));
  },

  addDatasetsToProject: (datasetIds, projectId) => {
    set((state) => {
      const project = state.workspace.projects.find((p) => p.id === projectId);
      if (!project) return state;

      return {
        workspace: {
          ...state.workspace,
          projects: state.workspace.projects.map((p) =>
            p.id === projectId
              ? { ...p, datasetIds: [...new Set([...p.datasetIds, ...datasetIds])] }
              : p
          ),
          datasets: state.workspace.datasets.map((d) =>
            datasetIds.includes(d.id) ? { ...d, projectId } : d
          ),
        },
      };
    });
  },

  removeDatasetsFromProject: (datasetIds) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        projects: state.workspace.projects.map((p) => ({
          ...p,
          datasetIds: p.datasetIds.filter((id) => !datasetIds.includes(id)),
        })),
        datasets: state.workspace.datasets.map((d) =>
          datasetIds.includes(d.id)
            ? { ...d, projectId: undefined, waveNumber: undefined, respondentKey: undefined }
            : d
        ),
      },
    }));
  },

  // Wave management
  setDatasetWave: (datasetId, waveNumber) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        datasets: state.workspace.datasets.map((d) =>
          d.id === datasetId ? { ...d, waveNumber } : d
        ),
      },
    }));
  },

  setDatasetRespondentKey: (datasetId, variableName) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        datasets: state.workspace.datasets.map((d) =>
          d.id === datasetId ? { ...d, respondentKey: variableName } : d
        ),
      },
    }));
  },

  // Session persistence
  saveDatasetSession: (datasetId, session) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        datasets: state.workspace.datasets.map((d) =>
          d.id === datasetId ? { ...d, sessionState: session, lastModifiedAt: Date.now() } : d
        ),
      },
    }));
  },

  getDatasetSession: (datasetId) => {
    const dataset = get().workspace.datasets.find((d) => d.id === datasetId);
    return dataset?.sessionState;
  },

  // Storage health
  updateStorageQuota: (used, quota) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        storageUsed: used,
        storageQuota: quota,
      },
    }));
  },
});

export default createWorkspaceSlice;
