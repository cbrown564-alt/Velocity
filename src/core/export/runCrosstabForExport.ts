import type { AggregatedRow, Dataset, Filter, TableStats, VariableSet } from '../../types';
import type { CrosstabEnginePort } from './crosstabEnginePort';
import { buildCrosstabRequest } from '../analysis/buildCrosstabRequest';
import { mapCrosstabRows } from '../analysis/mapCrosstabRows';
import type { CrosstabSqlRow } from '../analysis/crosstab/types';

interface AnalysisSignificanceSettings {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.90 | 0.80;
}

interface RunCrosstabParams {
  engine: CrosstabEnginePort;
  dataset: Dataset;
  variableSets: VariableSet[];
  rowVars: string[];
  colVar: string | null;
  filters: Filter[];
  weightVar: string | null;
  analysisSettings?: AnalysisSignificanceSettings;
}

interface RunCrosstabResult {
  data: AggregatedRow[];
  tableStats?: TableStats | null;
}

export const runCrosstabForExport = async ({
  engine,
  dataset,
  variableSets,
  rowVars,
  colVar,
  filters,
  weightVar,
  analysisSettings,
}: RunCrosstabParams): Promise<RunCrosstabResult> => {
  if (!engine || rowVars.length === 0) {
    return { data: [], tableStats: null };
  }

  const request = buildCrosstabRequest({
    dataset,
    variableSets,
    rowVars,
    colVar,
    filters,
    weightVar,
    analysisSettings,
  });

  try {
    const response = await engine.runCrosstab(
      request.options,
      request.context,
      request.analysisSettings,
    );
    const rawData = response.data.rows as unknown as CrosstabSqlRow[];
    const mappedData: AggregatedRow[] = mapCrosstabRows(rawData, request.isWeighted);
    return { data: mappedData, tableStats: response.data.tableStats };
  } catch (error: any) {
    console.error('[Export] Crosstab query error:', error.message);
    return { data: [], tableStats: null };
  }
};
