/**
 * Workspace data contracts (shared kernel — see arch_01 §5).
 *
 * These describe stored datasets and projects and are depended on by both the
 * workspace feature (UI) and the store. They live in the kernel so the store
 * (layer 4) does not have to import from the feature (layer 2). Feature-specific
 * UI shapes (e.g. WorkspaceViewProps) stay in src/features/workspace/types.ts.
 */
import type { DatasetSessionState } from './workspaceSession';
import type { Folder, Variable, VariableSet } from './dataset';

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
  sessionState?: DatasetSessionState;
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
