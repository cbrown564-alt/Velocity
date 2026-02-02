
import { useState, useEffect } from 'react';
import { useVelocityStore } from '../store';
import { AggregatedRow, Variable } from '../types';
import { ProcessedAnalysisData } from '../types/processedData';
import { ChartType } from '../types/charts';
import type { WorkerRequest, WorkerResponse } from '../types/worker';

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
}

/**
 * Async hook to process analysis data using the Web Worker.
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
    chartType
}: UseProcessedAnalysisDataOptions): ProcessedAnalysisData | null {
    const worker = useVelocityStore(state => state.worker);
    const [result, setResult] = useState<ProcessedAnalysisData | null>(null);

    useEffect(() => {
        if (!worker || !data || data.length === 0 || rowVariables.length === 0) {
            setResult(null);
            return;
        }

        const requestId = Math.random().toString(36).substring(7);
        let isMounted = true;

        const handler = (event: MessageEvent<WorkerResponse>) => {
            if (!isMounted) return;
            const response = event.data;
            if (response.type === 'processedData' && response.requestId === requestId) {
                setResult(response.result);
                // We got what we wanted, clean up this specific listener
                worker.removeEventListener('message', handler);
            } else if (response.type === 'error') {
                console.error('Worker error:', response.message);
                // Don't remove listener on error, logic might retry or wait for correct response? 
                // Actually, if it's a fatal error for this request, we should probably stop?
                // But let's be safe and let the cleanup handle removal if needed.
            }
        };

        worker.addEventListener('message', handler);
        worker.postMessage({
            type: 'processData',
            requestId,
            data,
            options: {
                rowVariables,
                colVariable,
                isWeighted,
                isMultipleResponse
            },
            chartType
        } as WorkerRequest);

        return () => {
            isMounted = false;
            worker.removeEventListener('message', handler);
        };
    }, [worker, data, rowVariables, colVariable, isWeighted, isMultipleResponse, chartType]);

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
