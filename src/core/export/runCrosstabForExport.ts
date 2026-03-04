import type { AggregatedRow, Dataset, Filter, TableStats, VariableSet } from '../../types';
import type { WorkerRequest, WorkerResponse } from '../../types/worker';
import { buildCrosstabRequest } from '../analysis/buildCrosstabRequest';
import { mapCrosstabRows } from '../analysis/mapCrosstabRows';

const EXPORT_TIMEOUT_MS = 30_000;

interface AnalysisSignificanceSettings {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.90 | 0.80;
}

interface RunCrosstabParams {
  worker: Worker;
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
  worker,
  dataset,
  variableSets,
  rowVars,
  colVar,
  filters,
  weightVar,
  analysisSettings,
}: RunCrosstabParams): Promise<RunCrosstabResult> => {
  if (!worker || rowVars.length === 0) {
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

  return new Promise<RunCrosstabResult>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;

      if (response.type === 'queryResult') {
        clearTimeout(timeoutId);
        const rawData = response.data as any[];
        const mappedData: AggregatedRow[] = mapCrosstabRows(rawData, request.isWeighted);
        worker.removeEventListener('message', handler);
        resolve({ data: mappedData, tableStats: response.tableStats || null });
      } else if (response.type === 'error') {
        clearTimeout(timeoutId);
        console.error('[Export] Crosstab query error:', response.message);
        worker.removeEventListener('message', handler);
        resolve({ data: [], tableStats: null });
      }
    };

    // Post the message before registering the listener. Because JS is
    // single-threaded, no worker response can be processed between postMessage
    // and addEventListener — any prior stale messages in the queue will have
    // already fired before this task started.
    worker.postMessage({
      type: 'runCrosstab',
      options: request.options,
      context: request.context,
      analysisSettings: request.analysisSettings,
    } as WorkerRequest);

    worker.addEventListener('message', handler);

    timeoutId = setTimeout(() => {
      worker.removeEventListener('message', handler);
      console.error('[Export] Worker did not respond within 30 seconds. Export aborted.');
      resolve({ data: [], tableStats: null });
    }, EXPORT_TIMEOUT_MS);
  });
};
