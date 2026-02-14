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

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const queryPromise = new Promise<RunCrosstabResult>((resolve) => {
    let isSettled = false;

    const cleanup = () => {
      if (isSettled) return;
      isSettled = true;
      worker.removeEventListener('message', handler);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const handler = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== reqId) return;

      if (response.type === 'queryResult') {
        const rawData = response.data as any[];
        const mappedData: AggregatedRow[] = mapCrosstabRows(rawData, request.isWeighted);
        cleanup();
        resolve({ data: mappedData, tableStats: response.tableStats || null });
      } else if (response.type === 'error') {
        console.error('[Export] Crosstab query error:', response.message);
        cleanup();
        resolve({ data: [], tableStats: null });
      }
    };

    worker.addEventListener('message', handler);

    timeoutId = setTimeout(() => {
      console.warn(`[Export] Crosstab query timed out after ${TIMEOUT_MS}ms`);
      cleanup();
      resolve({ data: [], tableStats: null });
    }, TIMEOUT_MS);

    worker.postMessage({
      type: 'runCrosstab',
      requestId: reqId,
      options: request.options,
      context: request.context,
    } as WorkerRequest);
  });

  return queryPromise;
};
