import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProcessedAnalysisData } from './useProcessedAnalysisData';
import { useVelocityStore } from '../store';
import type { AggregatedRow, Variable } from '../types';
import type { ProcessedAnalysisData } from '../types/processedData';

const rowVariable: Variable = {
  id: 'gender',
  name: 'gender',
  label: 'Gender',
  type: 'nominal',
  valueLabels: [{ value: 1, label: 'Male' }],
  missingValues: {},
};

const rawRows: AggregatedRow[] = [{ rowKeys: ['1'], colKey: 'Total', count: 10 }];

const processed: ProcessedAnalysisData = {
  rows: [],
  series: [],
  columns: [],
  grandTotal: 10,
  isMetric: false,
  isGrid: false,
  rowVariables: [rowVariable],
  colVariable: null,
  isMultipleResponse: false,
};

describe('useProcessedAnalysisData', () => {
  beforeEach(() => {
    useVelocityStore.setState({ browserEngine: null });
    vi.clearAllMocks();
  });

  it('uses matching crosstab-processed data without sending rows back to the worker', async () => {
    const processData = vi.fn().mockResolvedValue({ result: null });
    useVelocityStore.setState({ browserEngine: { processData } as never });

    const { result } = renderHook(() =>
      useProcessedAnalysisData({
        data: rawRows,
        rowVariables: [rowVariable],
        colVariable: null,
        initialProcessedData: processed,
      }),
    );

    await waitFor(() => expect(result.current).toBe(processed));
    expect(processData).not.toHaveBeenCalled();
  });
});
