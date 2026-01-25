/**
 * Shared data processing hook for analysis visualizations.
 *
 * Extracts common processing logic (label resolution, sorting, gap-filling, pivoting)
 * into a single source of truth that both DataTable and Chart renderers consume.
 */

import { useMemo } from 'react';
import { AggregatedRow, Variable, VariableSet, HistogramBin } from '../types';

// ============================================================================
// Types
// ============================================================================

/** A processed cell with resolved data */
export interface ProcessedCell {
    count: number;
    percent: number;
    /** Significance marker */
    sig?: 'high_95' | 'high_80' | 'low_95' | 'low_80';
    /** Detailed stats for tooltips */
    stats?: {
        tScore: number;
        pValue: number;
        effN: number;
    };
    /** Scale variable stats */
    mean?: number;
    median?: number;
    stdDev?: number;
    min?: number;
    max?: number;
    q1?: number;
    q3?: number;
    validCount?: number;
    /** Histogram bins for distribution charts */
    histogramBins?: HistogramBin[];
}

/** A processed row in tree structure (for tables) */
export interface ProcessedRow {
    /** Unique key for React */
    key: string;
    /** Display label (resolved from valueLabels) */
    label: string;
    /** Raw value from data */
    rawValue: string;
    /** Depth in tree (0 = root) */
    depth: number;
    /** Cell data keyed by column key */
    cells: Record<string, ProcessedCell>;
    /** Row total count */
    total: number;
    /** Row mean (for metric tables) */
    mean?: number;
    /** Child rows */
    children: ProcessedRow[];
    /** Full path from root (for drill-down) */
    rowPath: { variable: string; value: string }[];
}

/** A column definition */
export interface ProcessedColumn {
    /** Column key (raw value) */
    key: string;
    /** Display label */
    label: string;
    /** Column total */
    total: number;
}

/** A data point for chart series */
export interface ChartDataPoint {
    /** Display label */
    label: string;
    /** Raw value */
    rawValue: string;
    /** Count value */
    value: number;
    /** Percentage of column total */
    percent: number;
    /** Significance marker */
    sig?: string;
    // For Box Plot / Distribution
    stats?: {
        min?: number;
        q1?: number;
        median?: number;
        q3?: number;
        max?: number;
        mean?: number;
        n?: number;
    };
    // For Histogram/Violin/Ridgeline Bins
    x0?: number;
    x1?: number;
    count?: number;
    // Nested bins for this point (if it represents a group)
    histogramBins?: HistogramBin[];
    // For Scatter/Hexbin
    x?: number;
    y?: number;
}

/** A chart series (one per column) */
export interface ChartSeries {
    /** Column key */
    key: string;
    /** Column label */
    label: string;
    /** Data points (one per row category) */
    data: ChartDataPoint[];
    // For Grouped Box Plot where series = group
    stats?: {
        min?: number;
        q1?: number;
        median?: number;
        q3?: number;
        max?: number;
        mean?: number;
        n?: number;
    };
}

/** The complete processed analysis data */
export interface ProcessedAnalysisData {
    /** Tree structure for tables */
    rows: ProcessedRow[];
    /** Flat series for charts */
    series: ChartSeries[];
    /** Column definitions */
    columns: ProcessedColumn[];
    /** Grand total count */
    grandTotal: number;
    /** Whether this is a metric (scale) analysis */
    isMetric: boolean;
    /** Whether this is a grid structure (Items × Scale) */
    isGrid: boolean;
    /** Source variables for reference */
    rowVariables: Variable[];
    colVariable: Variable | null;
    isMultipleResponse: boolean;
}

// ============================================================================
// Hook
// ============================================================================

interface UseProcessedAnalysisDataOptions {
    data: AggregatedRow[];
    rowVariables: Variable[];
    colVariable: Variable | null;
    isWeighted?: boolean;
    /** If true, row keys are already labels (multiple response) - skip label resolution */
    isMultipleResponse?: boolean;
}

/**
 * Processes raw aggregated data into a normalized format for visualization.
 * Handles label resolution, sorting, gap-filling, and pivoting.
 */
export function useProcessedAnalysisData({
    data,
    rowVariables,
    colVariable,
    isWeighted = false,
    isMultipleResponse = false,

}: UseProcessedAnalysisDataOptions): ProcessedAnalysisData | null {
    return useMemo(() => {
        if (!rowVariables.length || data.length === 0) {
            return null;
        }

        // ====================================================================
        // 1. Extract Column Keys
        // ====================================================================
        let colKeys: string[] = ['Total'];
        const uniqueDataKeys = Array.from(new Set(data.map(d => d.colKey))).sort() as string[];

        // Use data keys if we have columns or multiple implicit columns
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
            colTotals[d.colKey] = (colTotals[d.colKey] || 0) + effectiveCount;
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
        const buildTree = (
            subset: AggregatedRow[],
            depth: number,
            parentKey: string,
            parentRowPath: { variable: string; value: string }[]
        ): ProcessedRow[] => {
            if (depth >= rowVariables.length) return [];

            const variable = rowVariables[depth];

            // Group by current depth key
            const groups: Record<string, AggregatedRow[]> = {};
            subset.forEach(row => {
                const key = row.rowKeys[depth];
                if (key === undefined || key === null) return;
                if (!groups[key]) groups[key] = [];
                groups[key].push(row);
            });

            // Gather all potential keys (data + labels for gap filling)
            const allKeys = new Set<string>(Object.keys(groups));

            // For multiple response, row keys are already labels - skip label resolution and gap filling
            if (!isMultipleResponse) {
                // Add keys from value labels (for showing 0-count categories)
                if (variable?.valueLabels) {
                    variable.valueLabels.forEach(vl => allKeys.add(String(vl.value)));
                }

                // Gap filling for ordinal/numeric
                if (variable && (variable.type === 'ordinal' || variable.type === 'numeric')) {
                    const numericKeys = Array.from(allKeys)
                        .map(k => parseFloat(k))
                        .filter(n => !isNaN(n) && Number.isInteger(n));

                    if (numericKeys.length >= 2) {
                        const min = Math.min(...numericKeys);
                        const max = Math.max(...numericKeys);

                        // Only fill gaps for reasonable ranges
                        if (max - min < 100) {
                            for (let i = min; i <= max; i++) {
                                allKeys.add(String(i));
                            }
                        }
                    }
                }
            }

            // Build nodes
            let nodes: ProcessedRow[] = Array.from(allKeys).map(groupKey => {
                const groupData = groups[groupKey] || [];
                const uniqueKey = parentKey ? `${parentKey}-${groupKey}` : groupKey;

                // Resolve label - for multiple response, rowKey IS the label
                let label = groupKey;
                if (!isMultipleResponse && variable?.valueLabels?.length > 0) {
                    const foundLabel = variable.valueLabels.find(
                        vl => String(vl.value) === String(groupKey)
                    );
                    if (foundLabel) label = foundLabel.label;
                }

                // Build row path
                const nodeRowPath = [
                    ...parentRowPath,
                    { variable: variable.id, value: groupKey }
                ];

                // Calculate cells
                const nodeCells: Record<string, ProcessedCell> = {};
                let nodeRowTotal = 0;

                colKeys.forEach(cKey => {
                    const matchingRows = groupData.filter(d => d.colKey === cKey);
                    const count = matchingRows.reduce((sum, d) => {
                        const effectiveCount = isWeighted && d.weightedCount !== undefined
                            ? d.weightedCount
                            : d.count;
                        return sum + effectiveCount;
                    }, 0);

                    nodeRowTotal += count;

                    const divisor = colTotals[cKey] || 1;
                    const percent = (count / divisor) * 100;

                    const metricRow = matchingRows[0];
                    const hasMetric = metricRow?.mean !== undefined;

                    nodeCells[cKey] = {
                        count,
                        percent,
                        sig: matchingRows[0]?.sig,
                        stats: matchingRows[0]?.stats,
                        mean: hasMetric ? metricRow.mean : undefined,
                        median: hasMetric ? metricRow.median : undefined,
                        stdDev: hasMetric ? metricRow.stdDev : undefined,
                        min: hasMetric ? metricRow.min : undefined,
                        max: hasMetric ? metricRow.max : undefined,
                        q1: hasMetric ? metricRow.q1 : undefined,
                        q3: hasMetric ? metricRow.q3 : undefined,
                        validCount: hasMetric ? metricRow.validCount : undefined,
                        histogramBins: metricRow?.histogramBins,
                    };
                });

                // Calculate row mean (for metric tables)
                let nodeMean: number | undefined;
                const hasMetricCells = Object.values(nodeCells).some(c => c.mean !== undefined);
                if (hasMetricCells) {
                    const totalN = Object.values(nodeCells).reduce(
                        (sum, c) => sum + (c.validCount || 0), 0
                    );
                    if (totalN > 0) {
                        const weightedSum = Object.values(nodeCells).reduce(
                            (sum, c) => sum + ((c.mean || 0) * (c.validCount || 0)), 0
                        );
                        nodeMean = weightedSum / totalN;
                    }
                }

                // Recurse for children
                const children = buildTree(groupData, depth + 1, uniqueKey, nodeRowPath);

                return {
                    key: uniqueKey,
                    label,
                    rawValue: groupKey,
                    depth,
                    cells: nodeCells,
                    total: nodeRowTotal,
                    mean: nodeMean,
                    children,
                    rowPath: nodeRowPath,
                };
            });

            // Sort nodes
            nodes.sort((a, b) => {
                // Multiple response: always sort by frequency (descending)
                if (isMultipleResponse) {
                    if (b.total !== a.total) return b.total - a.total;
                    return a.label.localeCompare(b.label);
                }

                const type = variable?.type || 'nominal';

                if (type === 'ordinal' || type === 'numeric') {
                    const valA = parseFloat(a.rawValue);
                    const valB = parseFloat(b.rawValue);
                    if (!isNaN(valA) && !isNaN(valB)) return valA - valB;
                    return a.rawValue.localeCompare(b.rawValue, undefined, { numeric: true });
                }

                if (type === 'nominal') {
                    // Sort by frequency (descending), then alphabetical
                    if (b.total !== a.total) return b.total - a.total;
                    return a.label.localeCompare(b.label);
                }

                return a.label.localeCompare(b.label, undefined, { numeric: true });
            });

            return nodes;
        };

        const rows = buildTree(data, 0, '', []);

        // ====================================================================
        // 5. Build Chart Series (flattened for renderers)
        // ====================================================================
        // Each column becomes a series with data points for each top-level row
        const series: ChartSeries[] = columns.map(col => ({
            key: col.key,
            label: col.label,
            data: rows.map(row => ({
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
        const isMetric = rows.some(r => r.mean !== undefined);

        // Check if this is a grid structure (synthetic variables from grid)
        const isGrid = rowVariables.some(v => v.synthetic && v.sourceGridId);

        return {
            rows,
            series,
            columns,
            grandTotal,
            isMetric,
            isGrid,
            rowVariables,
            colVariable,
            isMultipleResponse,
        };
    }, [data, rowVariables, colVariable, isWeighted, isMultipleResponse]);
}

// ============================================================================
// Utility: Get flat rows for simple charts
// ============================================================================

/**
 * Flattens the tree to get all leaf nodes (for nested row variables).
 * For single-level rows, this returns the top-level rows.
 */
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
