import { useMemo } from 'react';
import { AggregatedRow, Variable } from '../../../types';
import type { VariableStatsResult } from '../../../services/analysisWorker';

export interface RowPathEntry {
    variable: string;  // Variable ID
    value: string;     // Raw value (not label)
}

export interface TableRowNode {
    key: string;
    label: string;
    rawValue: string;  // Original value from data
    sortValue: number; // Computed numeric value for sorting
    depth: number;
    cells: Record<string, {
        count: number;
        percent: number;
        sig?: string;
        stats?: {
            tScore: number;
            pValue: number;
            effN: number;
        };
        mean?: number;
        median?: number;
        stdDev?: number;
        min?: number;
        max?: number;
        validCount?: number;
    }>;
    total: number;
    /** Calculated mean for the row (weighted average of children or direct) */
    mean?: number;
    children: TableRowNode[];
    isExpanded?: boolean;
    /** Full path from root to this node for drill-down */
    rowPath: RowPathEntry[];
}

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

        // 4. Build Tree (Recursive Aggregation) 
        // We need to group by level 0, then level 1...

        const buildTree = (
            subset: AggregatedRow[],
            depth: number,
            parentKey: string,
            parentRowPath: RowPathEntry[]
        ): TableRowNode[] => {
            if (depth >= rowVariables.length) return [];

            // Group by current depth key
            const groups: Record<string, AggregatedRow[]> = {};
            subset.forEach(row => {
                const key = row.rowKeys[depth];
                if (key === undefined || key === null) return; // Allow "0" (falsy) values
                if (!groups[key]) groups[key] = [];
                groups[key].push(row);
            });

            // 4a. Gather all potential keys (Data + Labels)
            // This ensures we show "0" count rows if they have a label (e.g., "Very Underweight" = 0)
            const variable = rowVariables[depth];
            const allKeys = new Set<string>();

            // Add keys from actual data
            Object.keys(groups).forEach(k => allKeys.add(k));

            // For multiple response, row keys are already labels - skip adding value labels and gap filling
            if (!isMultipleResponse) {
                // Add keys from value labels (if they don't exist in data)
                if (variable && variable.valueLabels) {
                    variable.valueLabels.forEach(vl => allKeys.add(String(vl.value)));
                }

                // 4b. GAP FILLING (for Ordinal/Scale)
                // Ensure we don't show "1, 3, 4" skipping "2" if it's a numeric scale
                if (variable && (variable.type === 'ordinal' || variable.type === 'numeric' || variable.type === 'scale')) {
                    const numericKeys = Array.from(allKeys)
                        .map(k => parseFloat(k))
                        .filter(n => !isNaN(n) && Number.isInteger(n));

                    if (numericKeys.length >= 2) {
                        const min = Math.min(...numericKeys);
                        const max = Math.max(...numericKeys);

                        // Only fill gaps for reasonable survey scale ranges (e.g., 0-100)
                        // Prevents massive loops if data has outliers (e.g. 0 and 999999)
                        if (max - min < 100) {
                            for (let i = min; i <= max; i++) {
                                allKeys.add(String(i));
                            }
                        }
                    }
                }
            }

            // Helper to compute sort value
            const getMetricValue = (key: string): number => {
                const cleanKey = key.trim().toLowerCase();
                // 1. Try direct number parse
                const val = parseFloat(cleanKey);
                if (!isNaN(val)) return val;

                // 2. Try to find value from ANY matching label
                if (variable?.valueLabels) {
                    const labelMatch = variable.valueLabels.find(vl =>
                        vl.label.toLowerCase().trim() === cleanKey ||
                        // Also try matching just the number part if label is like "1 - Not at all"
                        vl.label.toLowerCase().startsWith(`${cleanKey} `)
                    );
                    if (labelMatch) {
                        return parseFloat(String(labelMatch.value));
                    }
                }
                return NaN;
            };

            // Convert to array and map to Nodes
            let nodes: TableRowNode[] = Array.from(allKeys).map(groupKey => {
                const groupData = groups[groupKey] || []; // Might be empty if coming from labels only
                const uniqueKey = parentKey ? `${parentKey}-${groupKey}` : groupKey;

                // Resolve Label: For multiple response, rowKey IS the label
                let label = groupKey;

                if (!isMultipleResponse && variable && variable.valueLabels && variable.valueLabels.length > 0) {
                    const foundLabel = variable.valueLabels.find(vl => String(vl.value) === String(groupKey));
                    if (foundLabel) {
                        label = foundLabel.label;
                    }
                }

                // Build row path for this node (append current variable/value to parent path)
                const nodeRowPath: RowPathEntry[] = [
                    ...parentRowPath,
                    { variable: variable.id, value: groupKey }
                ];

                // Calculate totals for this node
                const nodeCells: Record<string, {
                    count: number;
                    percent: number;
                    sig?: string;
                    stats?: {
                        tScore: number;
                        pValue: number;
                        effN: number;
                    };
                    mean?: number;
                    median?: number;
                    stdDev?: number;
                    min?: number;
                    max?: number;
                    validCount?: number;
                }> = {};
                let nodeRowTotal = 0;

                colKeys.forEach(cKey => {
                    // Use weightedCount when weighted, otherwise count
                    const matchingRows = groupData.filter(d => d.colKey === cKey);

                    const count = matchingRows.reduce((sum, d) => {
                        const effectiveCount = isWeighted && d.weightedCount !== undefined ? d.weightedCount : d.count;
                        return sum + effectiveCount;
                    }, 0);

                    // Check if we have metric data (take from first matching row)
                    const metricRow = matchingRows[0];
                    const hasMetric = metricRow && metricRow.mean !== undefined;

                    nodeRowTotal += count;

                    // Use column total as divisor for correct column percentages (even in Grids)
                    // Fallback to grandTotal only if colTotal is missing (should not happen if colKeys exist)
                    const divisor = colTotals[cKey];
                    const percent = divisor > 0 ? (count / divisor) * 100 : 0;

                    nodeCells[cKey] = {
                        count,
                        percent,
                        sig: matchingRows[0]?.sig,
                        stats: matchingRows[0]?.stats,
                        // Pass through metric data
                        mean: hasMetric ? metricRow.mean : undefined,
                        median: hasMetric ? metricRow.median : undefined,
                        stdDev: hasMetric ? metricRow.stdDev : undefined,
                        min: hasMetric ? metricRow.min : undefined,
                        max: hasMetric ? metricRow.max : undefined,
                        validCount: hasMetric ? metricRow.validCount : undefined,
                    };
                });

                // 5. Calculate Aggregate Mean for this Node (Row Total)
                // If children have means, we should weight-average them?
                // Actually, for the "Total" column of the row, we want the mean of ALL data in this row group.
                // But we don't have the raw data here to calc mean.
                // However, if we are in Metric Mode, the Query Builder groups by Col but NOT by Row (since Row is just the Label).
                // So for "Age" (depth 0), groups['Age'] contains all the column splits.
                // We can't easily sum means.
                // BUT, usually we have a "Total" column in the data? No.

                // HACK: For now, if we have variableStats and this is depth 0, we can use that.
                // For nested rows, we might need a smarter query.
                // Let's attach the `mean` to the row node itself if possible.
                let nodeMean: number | undefined;

                // If we are dealing with a Metric Table (inferred by presence of mean in cells)
                const hasMetricCells = Object.values(nodeCells).some(c => c.mean !== undefined);
                if (hasMetricCells) {
                    // If we have variableStats and this is the root, use it?
                    // Or calculate weighted average from cells? (Approximate)
                    const totalN = Object.values(nodeCells).reduce((sum, c) => sum + (c.validCount || 0), 0);
                    if (totalN > 0) {
                        const weightedSum = Object.values(nodeCells).reduce((sum, c) => sum + ((c.mean || 0) * (c.validCount || 0)), 0);
                        nodeMean = weightedSum / totalN;
                    }
                }

                // Recurse with updated path
                const children = buildTree(groupData, depth + 1, uniqueKey, nodeRowPath);

                return {
                    key: uniqueKey,
                    label,
                    rawValue: groupKey,
                    sortValue: getMetricValue(groupKey),
                    depth,
                    cells: nodeCells,
                    total: nodeRowTotal,
                    mean: nodeMean, // Attach mean to row node
                    children,
                    rowPath: nodeRowPath
                };
            });

            // 4b. SORTING LOGIC
            // Multiple response: Always sort by frequency (descending)
            // Default: Sort by alphanumeric
            // Ordinal/Scale: Sort by numeric value
            // Nominal: Sort by Frequency (Total Count)
            nodes.sort((a, b) => {
                // Multiple response: always sort by frequency (descending)
                if (isMultipleResponse) {
                    if (b.total !== a.total) return b.total - a.total;
                    return a.label.localeCompare(b.label);
                }

                const type = variable?.type || 'nominal';

                if (type === 'ordinal' || type === 'numeric' || type === 'scale') {
                    const valA = a.sortValue;
                    const valB = b.sortValue;

                    // If only one is valid number, prioritize the number (put at top)
                    const isNumA = !isNaN(valA);
                    const isNumB = !isNaN(valB);

                    if (isNumA && isNumB) {
                        return valA - valB;
                    }
                    if (isNumA && !isNumB) return -1; // Numbers first
                    if (!isNumA && isNumB) return 1;

                    // Fallback to alphanumeric
                    return a.rawValue.localeCompare(b.rawValue, undefined, { numeric: true });
                }

                if (type === 'nominal') {
                    // Sort by Frequency (Total Count) - Descending
                    // Secondary sort: Alphabetical by label
                    if (b.total !== a.total) {
                        return b.total - a.total;
                    }
                    return a.label.localeCompare(b.label);
                }

                // Default: Alphanumeric
                return a.label.localeCompare(b.label, undefined, { numeric: true });
            });

            return nodes;
        };

        const rows = buildTree(data, 0, '', []);

        return {
            colKeys,
            colLabels,
            rows,
            colTotals,
            grandTotal
        };

    }, [data, rowVariables, colVariable, isWeighted, isMultipleResponse, variableStats]);
};
