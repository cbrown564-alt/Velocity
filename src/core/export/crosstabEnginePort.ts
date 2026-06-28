import type { CrosstabQueryOptions } from '../sql/queryBuilder';
import type { AggregatedRow, TableStats, Variable, VariableSet } from '../../types';

interface CrosstabContext {
  variables: Record<string, Variable>;
  variableSets: Record<string, VariableSet>;
}

interface AnalysisSignificanceSettings {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.9 | 0.8;
}

/** Minimal engine seam for export-time crosstab queries (no services dependency). */
export interface CrosstabEnginePort {
  runCrosstab(
    options: CrosstabQueryOptions & { includeDistributions?: boolean },
    context: CrosstabContext,
    analysisSettings?: AnalysisSignificanceSettings,
  ): Promise<{
    data: {
      rows: AggregatedRow[];
      tableStats: TableStats | null;
    };
  }>;
}
