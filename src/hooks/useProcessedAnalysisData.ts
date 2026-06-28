import { useState, useEffect } from 'react';
import { useVelocityStore } from '../store';
import { AggregatedRow, Variable } from '../types';
import { ProcessedAnalysisData } from '../types/processedData';
import { ChartType } from '../types/charts';

// Re-export types for backward compatibility (if any consumers were missed)
export type { ProcessedAnalysisData, ChartDataPoint, ChartSeries } from '../types/processedData';

interface UseProcessedAnalysisDataOptions {
  data: AggregatedRow[];
  rowVariables: Variable[];
  colVariable: Variable | null;
  isWeighted?: boolean;
  isMultipleResponse?: boolean;
  /** If provided, the worker will return data transformed for this chart type */
  chartType?: ChartType;
  /** Already-processed worker result returned with the crosstab response. */
  initialProcessedData?: ProcessedAnalysisData | null;
}

/**
 * Async hook to process analysis data using the EngineProxy.
 *
 * Offloads:
 * 1. Tree Building (Hierarchical structure)
 * 2. Chart Data Transformation (Pivoting, Scaling)
 */
export function useProcessedAnalysisData({
  data,
  rowVariables,
  colVariable,
  isWeighted = false,
  isMultipleResponse = false,
  chartType,
  initialProcessedData,
}: UseProcessedAnalysisDataOptions): ProcessedAnalysisData | null {
  const browserEngine = useVelocityStore((state) => state.browserEngine);
  const [result, setResult] = useState<ProcessedAnalysisData | null>(null);

  useEffect(() => {
    const matchesInitial =
      initialProcessedData &&
      !chartType &&
      initialProcessedData.isMultipleResponse === isMultipleResponse &&
      initialProcessedData.rowVariables.map((variable) => variable.id).join('\u0000') ===
        rowVariables.map((variable) => variable.id).join('\u0000') &&
      (initialProcessedData.colVariable?.id ?? null) === (colVariable?.id ?? null);

    if (matchesInitial) {
      setResult(initialProcessedData);
      return;
    }

    if (!browserEngine || !data || data.length === 0 || rowVariables.length === 0) {
      setResult(null);
      return;
    }

    let isMounted = true;

    browserEngine
      .processData(data, { rowVariables, colVariable, isWeighted, isMultipleResponse }, chartType)
      .then((response) => {
        if (isMounted) {
          setResult(response.result);
        }
      })
      .catch((err) => {
        console.error('Engine processData error:', err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [browserEngine, data, rowVariables, colVariable, isWeighted, isMultipleResponse, chartType, initialProcessedData]);

  return result;
}

// Utility: Get flat rows (kept here as it's a lightweight helper)
import { ProcessedRow } from '../types/processedData';

export function getFlatRows(rows: ProcessedRow[]): ProcessedRow[] {
  const result: ProcessedRow[] = [];

  function traverse(row: ProcessedRow) {
    if (row.children.length === 0) {
      result.push(row);
    } else {
      row.children.forEach(traverse);
    }
  }

  rows.forEach(traverse);
  return result.length > 0 ? result : rows;
}
