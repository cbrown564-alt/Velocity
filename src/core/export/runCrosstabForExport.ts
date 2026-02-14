import type { AggregatedRow, Dataset, Filter, TableStats, VariableSet } from '../../types';
import type { WorkerRequest, WorkerResponse } from '../../types/worker';
import { buildCrosstabRequest } from '../analysis/buildCrosstabRequest';
import { mapCrosstabRows } from '../analysis/mapCrosstabRows';

interface RunCrosstabParams {
  worker: Worker;
  dataset: Dataset;
  variableSets: VariableSet[];
  rowVars: string[];
  colVar: string | null;
  filters: Filter[];
  weightVar: string | null;
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
  });

  const reqId = crypto.randomUUID();
  const TIMEOUT_MS = 30_000;

  const queryPromise = new Promise<RunCrosstabResult>((resolve) => {
    const handler = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== reqId) return;

      if (response.type === 'queryResult') {
        const rawData = response.data as any[];
        const mappedData: AggregatedRow[] = mapCrosstabRows(rawData, request.isWeighted);

        worker.removeEventListener('message', handler);
        resolve({ data: mappedData, tableStats: response.tableStats || null });
      } else if (response.type === 'error') {
        console.error('[Export] Crosstab query error:', response.message);
        worker.removeEventListener('message', handler);
        resolve({ data: [], tableStats: null });
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'runCrosstab',
      requestId: reqId,
      options: request.options,
      context: request.context,
    } as WorkerRequest);
  });

  const timeoutPromise = new Promise<RunCrosstabResult>((resolve) => {
    setTimeout(() => {
      console.warn(`[Export] Crosstab query timed out after ${TIMEOUT_MS}ms`);
      resolve({ data: [], tableStats: null });
    }, TIMEOUT_MS);
  });

  return Promise.race([queryPromise, timeoutPromise]);
};
