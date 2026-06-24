import type { DatabaseAdapter } from '../core/DatabaseAdapter';
import type { ExportSessionInput } from '../core/session';
import type { ConceptStore } from '../core/semantic/concepts';
import type {
  Filter,
  Dataset,
  Variable,
  VariableSet,
  Folder,
} from '../types';
import type {
  SemanticAnnotation,
  Concept,
} from '../types/semantic';
import type { ResultEnvelope } from './types';

export type EngineAnalysisSettings = {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.90 | 0.80;
};

export type SemanticStateSnapshot = {
  annotations: Record<string, SemanticAnnotation>;
  concepts: Concept[];
};

export type LoadableNodeAdapter = DatabaseAdapter & {
  loadCSV?: (filePath: string, tableName?: string) => Promise<number>;
  loadSav?: (
    filePath: string,
    tableName?: string
  ) => Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number }>;
};

export interface WorkspaceDatasetEntry {
  id: string;
  name: string;
  tableName: string;
  rowCount: number;
  variables: Variable[];
  variableSets: VariableSet[];
  source: Dataset['source'];
  metadataOnly: boolean;
  filePath: string;
  waveNumber?: number;
}

export type VelocityEngineState = {
  dataset: Dataset | null;
  variableSets: VariableSet[];
  folders: Folder[];
  transformLog: ExportSessionInput['transformLog'];
  tableConfig: ExportSessionInput['tableConfig'];
  activeFilters: Filter[];
  analysisSettings: Partial<EngineAnalysisSettings> | undefined;
  slides: ExportSessionInput['slides'];
  sections: ExportSessionInput['sections'];
  harmonizationSession: ExportSessionInput['harmonizationSession'];
  workspaceDatasets: Map<string, WorkspaceDatasetEntry>;
  activeWorkspaceDatasetId: string | null;
  pendingFullLoadPath: string | null;
  semanticAnnotations: Map<string, SemanticAnnotation>;
  conceptStore: ConceptStore;
};

/**
 * Structural host interface for extracted engine modules.
 * Avoids circular imports from VelocityEngine.ts (DeckBuilder pattern).
 */
export interface VelocityEngineHost {
  readonly adapter: DatabaseAdapter;
  readonly runtime: 'node' | 'wasm';
  readonly engineVersion: string;
  readonly dataDir: string | null;
  readonly state: VelocityEngineState;

  wrap<T>(
    operation: string,
    inputs: Record<string, unknown>,
    fn: () => Promise<T>,
    warnings?: string[]
  ): Promise<ResultEnvelope<T>>;

  wrapSync<T>(
    operation: string,
    inputs: Record<string, unknown>,
    fn: () => T,
    warnings?: string[]
  ): ResultEnvelope<T>;

  requireDataset(): Dataset;
  requireDatasetWithRows(): Dataset;
  requireVariable(id: string): Variable;
  resetSessionState(): void;
  resolveSafePath(inputPath: string): string;
}
