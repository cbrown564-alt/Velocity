import type { AnalysisSettings, Filter, TableConfig } from '../../store/slices/analysisSlice';
import type { DataTransform, Dataset, Folder, Variable, VariableSet } from '../../store/slices/dataSlice';
import type { HarmonizationSession } from '../../types/harmonization';
import type { SemanticSessionBlock } from '../../types/semantic';
import type { Slide, SlideSection } from '../../types/slides';

export const SESSION_FORMAT_VERSION = 2 as const;
export const SESSION_FORMAT_VERSION_V1 = 1 as const;
export const SESSION_FILE_EXTENSION = '.velocity';

export interface SessionDatasetFingerprint {
  columnCount: number;
  columnNames: string[];
  checksum?: string;
}

export interface SessionDatasetDescriptor {
  originalFilename: string;
  rowCount: number;
  source: Dataset['source'];
  fingerprint: SessionDatasetFingerprint;
}

export interface SessionDatasetLink {
  datasetFilename: string;
  datasetRowCount: number;
  role: string;
}

export interface SessionWorkspaceProject {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: number;
  datasetIds: string[];
  isLongitudinal: boolean;
  respondentKeyVariable?: string;
}

export interface SessionWorkspaceSnapshot {
  projects: SessionWorkspaceProject[];
  datasetLinks: SessionDatasetLink[];
}

export interface VelocitySessionFile {
  formatVersion: typeof SESSION_FORMAT_VERSION | typeof SESSION_FORMAT_VERSION_V1;
  exportedAt: string;
  velocityVersion: string;
  dataset: SessionDatasetDescriptor;
  variables: Variable[];
  variableSets: VariableSet[];
  folders: Folder[];
  transformLog: DataTransform[];
  tableConfig: TableConfig;
  activeFilters: Filter[];
  weightVariable?: string | null;
  analysisSettings?: Partial<AnalysisSettings>;
  slides: Slide[];
  sections: SlideSection[];
  workspace?: SessionWorkspaceSnapshot;
  harmonizationSession?: HarmonizationSession | null;
  /** Phase 4: Semantic annotations and concepts (v2+, optional) */
  semantic?: SemanticSessionBlock;
}

export interface SessionWorkspaceInput {
  datasets: Array<{
    id: string;
    name: string;
    rowCount: number;
    waveNumber?: number;
  }>;
  projects: SessionWorkspaceProject[];
}

export interface ExportSessionInput {
  dataset: Dataset;
  variableSets: VariableSet[];
  folders: Folder[];
  transformLog: DataTransform[];
  tableConfig: TableConfig;
  activeFilters: Filter[];
  analysisSettings?: Partial<AnalysisSettings>;
  slides: Slide[];
  sections: SlideSection[];
  workspace?: SessionWorkspaceInput;
  activeDatasetId?: string | null;
  harmonizationSession?: HarmonizationSession | null;
  /** Phase 4: Semantic annotations and concepts — omit if empty */
  semantic?: SemanticSessionBlock;
  velocityVersion?: string;
  exportedAt?: Date;
  checksum?: string;
}
