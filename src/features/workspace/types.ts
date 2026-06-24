import type { Folder, Variable, VariableSet } from '../../types';

export interface StoredDataset {
  id: string;
  name: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  fileSize: number; // bytes
  source: 'sav' | 'csv' | 'arrow';
  createdAt: number;
  lastOpenedAt: number;
  lastModifiedAt: number;
  projectId?: string;
  starred: boolean;
  /** Wave number for linked longitudinal studies */
  waveNumber?: number;
  /** Key variable for linking respondents across waves */
  respondentKey?: string;
  /** Thumbnail data for preview (sparkline of first variable) */
  thumbnail?: number[];
  /** Session state to restore */
  sessionState?: {
    tableConfig: { rowVars: string[]; colVar: string | null };
    activeFilters: unknown[];
    transformLog: unknown[];
  };
  /** Optional variable metadata for cross-wave harmonization */
  variables?: Variable[];
  /** Original variable grouping metadata from ingest/manager state */
  variableSets?: VariableSet[];
  /** Original folder metadata from variable organization */
  folders?: Folder[];
  /** OPFS key for restoring this dataset's source file */
  opfsFileKey?: string;
  /** DuckDB table containing this dataset's rows */
  tableName?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: number;
  datasetIds: string[];
  /** For wave-linked projects */
  isLongitudinal: boolean;
  respondentKeyVariable?: string;
}

export interface WorkspaceState {
  datasets: StoredDataset[];
  projects: Project[];
  storageUsed: number;
  storageQuota: number;
}

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
