// Data contracts now live in the shared kernel (arch_01 §5) so the store can use
// them without importing from this feature. Re-exported here for feature/UI
// consumers that already import from the workspace barrel.
import type { StoredDataset, Project, WorkspaceState } from '../../types/workspace';

export type { StoredDataset, Project, WorkspaceState };

export interface WorkspaceViewProps {
  workspaceState: WorkspaceState;
  onOpenDataset: (dataset: StoredDataset) => void;
  onUploadFile: () => void;
  onLoadExample: () => void;
  onCreateProject: (selectedDatasetIds: string[]) => void;
  onDeleteDataset: (id: string) => void;
  onToggleStar: (id: string) => void;
  onLinkDatasets: (datasetIds: string[], projectId: string) => void;
  onUnlinkDataset: (datasetId: string) => void;
  /** Callback when user wants to compare waves */
  onCompareWaves?: (project: Project, wave1: StoredDataset, wave2: StoredDataset) => void;
  /** Callback for batch star operation */
  onBatchStar?: (ids: string[], starred: boolean) => void;
  /** Callback for batch delete operation */
  onBatchDelete?: (ids: string[]) => void;
  /** Callback to open export modal */
  onExport?: (selectedIds: string[]) => void;
  /** Callback to open the portable session import flow */
  onImportSession?: () => void;
}
