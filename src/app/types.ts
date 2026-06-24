import type { Project, StoredDataset } from '../features/workspace';

/** Top-level application phase (replaces scattered mode booleans). */
export type AppPhase = 'splash' | 'uploading' | 'dashboard' | 'restoring' | 'metadata';

/** Locally hosted overlays — store-driven modals stay in ModalHost via store selectors. */
export type AppOverlay =
  | { kind: 'none' }
  | { kind: 'sessionImport' }
  | { kind: 'sessionExport' }
  | { kind: 'projectLink'; datasetIds: string[] }
  | {
      kind: 'crossWave';
      project: Project;
      datasets: StoredDataset[];
      selectedWaves?: [StoredDataset, StoredDataset];
    }
  | { kind: 'workspaceExport'; selectedIds: string[] }
  | { kind: 'combine' };

export const NO_OVERLAY: AppOverlay = { kind: 'none' };
