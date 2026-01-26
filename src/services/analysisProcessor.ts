import { AggregatedRow, Variable } from '../types';
import { ProcessedAnalysisData, ProcessedColumn, ChartSeries, ProcessedRow } from '../types/processedData';
import { buildTree } from './treeBuilder';

interface ProcessAnalysisOptions {
    data: AggregatedRow[];
    rowVariables: Variable[];
    colVariable: Variable | null;
    isWeighted?: boolean;
    isMultipleResponse?: boolean;
}

/**
 * Pure function to process aggregated data into visualization-ready structure.
 * 
 * Performs:
 * 1. Column extraction and label resolution
 * 2. Total calculations
 * 3. Hierarchical tree building (via treeBuilder)
 * 4. Chart series generation
 */
export const processAnalysisData = ({
    data,
    rowVariables,
    colVariable,
    isWeighted = false,
    isMultipleResponse = false
}: ProcessAnalysisOptions): ProcessedAnalysisData | null => {
    if (!rowVariables.length || data.length === 0) {
        return null;
    }

    // ====================================================================
    // 1. Extract Column Keys
    // ====================================================================
    let colKeys: string[] = ['Total'];
    const uniqueDataKeys = Array.from(new Set(data.map(d => d.colKey))).sort() as string[];

    // Use data keys if we have columns or multiple implicit columns
    // or if we have a single data key that is NOT 'Total' (e.g. renamed implicit column)
    if (colVariable || uniqueDataKeys.length > 1 ||
        (uniqueDataKeys.length === 1 && uniqueDataKeys[0] !== 'Total')) {
        colKeys = uniqueDataKeys;
    }

    // ====================================================================
    // 2. Compute Column Totals
    // ====================================================================
    const colTotals: Record<string, number> = {};
    colKeys.forEach(k => colTotals[k] = 0);
    let grandTotal = 0;

    data.forEach(d => {
        const effectiveCount = isWeighted && d.weightedCount !== undefined
            ? d.weightedCount
            : d.count;
        const key = colKeys.includes(d.colKey) ? d.colKey : 'Total';
        // Note: if data has keys not in colKeys (shouldn't happen with logic above), careful
        if (colTotals[key] !== undefined) {
            colTotals[key] += effectiveCount;
        }
        grandTotal += effectiveCount;
    });

    // ====================================================================
    // 3. Resolve Column Labels
    // ====================================================================
    const columns: ProcessedColumn[] = colKeys.map(key => {
        let label = key;
        if (colVariable?.valueLabels) {
            const found = colVariable.valueLabels.find(vl => String(vl.value) === String(key));
            if (found) label = found.label;
        }
        return { key, label, total: colTotals[key] || 0 };
    });

    // ====================================================================
    // 4. Build Tree Structure
    // ====================================================================
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

    // ====================================================================
    // 5. Build Chart Series (flattened for renderers)
    // ====================================================================
    // Each column becomes a series with data points for each top-level row
    // Note: treeBuilder returns TableRowNode[], which is aliased to ProcessedRow
    const topLevelRows = rows as ProcessedRow[];

    const series: ChartSeries[] = columns.map(col => ({
        key: col.key,
        label: col.label,
        data: topLevelRows.map(row => ({
            label: row.label,
            rawValue: row.rawValue,
            value: row.cells[col.key]?.count || 0,
            percent: row.cells[col.key]?.percent || 0,
            sig: row.cells[col.key]?.sig,
            stats: {
                min: row.cells[col.key]?.min,
                max: row.cells[col.key]?.max,
                mean: row.cells[col.key]?.mean,
                median: row.cells[col.key]?.median,
                q1: row.cells[col.key]?.q1,
                q3: row.cells[col.key]?.q3,
                n: row.cells[col.key]?.validCount,
            },
            histogramBins: row.cells[col.key]?.histogramBins,
        })),
    }));

    // Check if this is a metric analysis
    const isMetric = topLevelRows.some(r => r.mean !== undefined);

    // Check if this is a grid structure (synthetic variables from grid)
    const isGrid = rowVariables.some(v => v.synthetic && v.sourceGridId);

    return {
        rows: topLevelRows,
        series,
        columns,
        grandTotal,
        isMetric,
        isGrid: !!isGrid,
        rowVariables,
        colVariable,
        isMultipleResponse,
    };
};
