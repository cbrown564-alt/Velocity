import { useMemo } from 'react';
import { AggregatedRow, Variable } from '../../../types';
import type { VariableStatsResult } from '../../../services/analysisWorker';

import { buildTree, RowPathEntry, TableRowNode } from '../../../services/treeBuilder';
export type { RowPathEntry, TableRowNode };

export interface TableDataResult {
    colKeys: string[];
    colLabels: Record<string, string>;
    rows: TableRowNode[];
    colTotals: Record<string, number>;
    grandTotal: number;
}

interface UseAggregatedTableDataProps {
    data: AggregatedRow[];
    rowVariables: Variable[];
    colVariable: Variable | null;
    isWeighted?: boolean;
    isMultipleResponse?: boolean;
    variableStats?: VariableStatsResult | null;
}

export const useAggregatedTableData = ({
    data,
    rowVariables,
    colVariable,
    isWeighted = false,
    isMultipleResponse = false,
    variableStats
}: UseAggregatedTableDataProps): TableDataResult | null => {
    return useMemo(() => {
        if (!rowVariables.length) return null;

        // 1. Extract Column Keys
        let colKeys: string[] = ['Total'];

        // Check if we have implicit columns (from Grid/Multiple unpivot) even if colVariable is null
        const uniqueDataKeys = Array.from(new Set(data.map(d => d.colKey))).sort() as string[];

        // Use data keys if:
        // a) We have an explicit column variable
        // b) We have multiple data keys (implicit columns)
        // c) We have a single data key that is NOT 'Total' (renamed implicit column)
        if (colVariable || uniqueDataKeys.length > 1 || (uniqueDataKeys.length === 1 && uniqueDataKeys[0] !== 'Total')) {
            colKeys = uniqueDataKeys;
        }

        // 2. Compute Column Totals (use weighted counts when weighted)
        const colTotals: Record<string, number> = {};
        colKeys.forEach(k => colTotals[k] = 0);
        let grandTotal = 0;

        data.forEach(d => {
            // Use weightedCount if available, otherwise count
            const effectiveCount = isWeighted && d.weightedCount !== undefined ? d.weightedCount : d.count;
            colTotals[d.colKey] += effectiveCount;
            grandTotal += effectiveCount;
        });

        // 3. Resolve Column Labels
        const colLabels: Record<string, string> = {};
        colKeys.forEach(key => {
            let label = key;
            if (colVariable && colVariable.valueLabels) {
                const found = colVariable.valueLabels.find(vl => String(vl.value) === String(key));
                if (found) label = found.label;
            }
            colLabels[key] = label;
        });

        // 4. Build Tree using external service
        const rows = buildTree(
            data,
            0,
            rowVariables,
            colKeys,
            colTotals,
            isWeighted,
            isMultipleResponse,
            '',
            []
        );

        return {
            colKeys,
            colLabels,
            rows,
            colTotals,
            grandTotal
        };

    }, [data, rowVariables, colVariable, isWeighted, isMultipleResponse, variableStats]);
};
