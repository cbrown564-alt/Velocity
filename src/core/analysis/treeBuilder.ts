import { AggregatedRow, Variable } from '../../types';
import { isCategoricalType, isOrderedType, normalizeVariableType } from '../../types';
import { ProcessedRow, ProcessedCell } from '../../types/processedData';

export type RowPathEntry = { variable: string; value: string };
export type TableRowNode = ProcessedRow;

// Legacy export for back-compat if needed, though ProcessedRow is preferred
export type { ProcessedRow };

/**
 * Recursive function to build the hierarchical tree for the table
 */
export const buildTree = (
  subset: AggregatedRow[],
  depth: number,
  rowVariables: Variable[],
  colKeys: string[],
  colTotals: Record<string, number>,
  isWeighted: boolean,
  isMultipleResponse: boolean,
  parentKey: string,
  parentRowPath: RowPathEntry[],
): TableRowNode[] => {
  if (depth >= rowVariables.length) return [];

  // Group by current depth key
  const groups: Record<string, AggregatedRow[]> = {};
  subset.forEach((row) => {
    const key = row.rowKeys[depth];
    if (key === undefined || key === null) return; // Allow "0" (falsy) values
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  // 4a. Gather all potential keys (Data + Labels)
  const variable = rowVariables[depth];
  const allKeys = new Set<string>();

  // Add keys from actual data
  Object.keys(groups).forEach((k) => allKeys.add(k));

  // For multiple response, row keys are already labels - skip adding value labels and gap filling
  if (!isMultipleResponse) {
    // Add keys from value labels (if they don't exist in data)
    if (variable && variable.valueLabels) {
      variable.valueLabels.forEach((vl) => allKeys.add(String(vl.value)));
    }

    // 4b. GAP FILLING (for Ordinal/Scale)
    // Ensure we don't show "1, 3, 4" skipping "2" if it's a numeric scale
    if (variable && (isOrderedType(variable.type) || variable.type === 'numeric')) {
      const numericKeys = Array.from(allKeys)
        .map((k) => parseFloat(k))
        .filter((n) => !isNaN(n) && Number.isInteger(n));

      if (numericKeys.length >= 2) {
        const min = Math.min(...numericKeys);
        const max = Math.max(...numericKeys);

        // Only fill gaps for reasonable survey scale ranges (e.g., 0-100)
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
      const labelMatch = variable.valueLabels.find(
        (vl) =>
          vl.label.toLowerCase().trim() === cleanKey ||
          // Also try matching just the number part if label is like "1 - Not at all"
          vl.label.toLowerCase().startsWith(`${cleanKey} `),
      );
      if (labelMatch) {
        return parseFloat(String(labelMatch.value));
      }
    }
    return NaN;
  };

  // Convert to array and map to Nodes
  let nodes: TableRowNode[] = Array.from(allKeys).map((groupKey) => {
    const groupData = groups[groupKey] || []; // Might be empty if coming from labels only
    const uniqueKey = parentKey ? `${parentKey}-${groupKey}` : groupKey;

    // Resolve Label: For multiple response, rowKey IS the label
    let label = groupKey;

    if (!isMultipleResponse && variable && variable.valueLabels && variable.valueLabels.length > 0) {
      const foundLabel = variable.valueLabels.find((vl) => String(vl.value) === String(groupKey));
      if (foundLabel) {
        label = foundLabel.label;
      }
    }

    // Build row path for this node (append current variable/value to parent path)
    const nodeRowPath: RowPathEntry[] = [...parentRowPath, { variable: variable.id, value: groupKey }];

    // Calculate totals for this node
    const nodeCells: Record<string, ProcessedCell> = {};
    let nodeRowTotal = 0;

    colKeys.forEach((cKey) => {
      // Use weightedCount when weighted, otherwise count
      const matchingRows = groupData.filter((d) => d.colKey === cKey);

      const count = matchingRows.reduce((sum, d) => {
        const effectiveCount = isWeighted && d.weightedCount !== undefined ? d.weightedCount : d.count;
        return sum + effectiveCount;
      }, 0);

      // Check if we have metric data (take from first matching row)
      const metricRow = matchingRows[0];
      const hasMetric = metricRow && metricRow.mean !== undefined;

      nodeRowTotal += count;

      // Use column total as divisor for correct column percentages
      const divisor = colTotals[cKey];
      const percent = divisor > 0 ? (count / divisor) * 100 : 0;

      nodeCells[cKey] = {
        count,
        percent,
        sig: matchingRows[0]?.sig,
        stats: matchingRows[0]?.stats,
        ci95: matchingRows[0]?.ci95,
        ci80: matchingRows[0]?.ci80,
        sigLetters: matchingRows[0]?.sigLetters,
        columnLetter: matchingRows[0]?.columnLetter,
        // Pass through metric data
        mean: hasMetric ? metricRow.mean : undefined,
        median: hasMetric ? metricRow.median : undefined,
        stdDev: hasMetric ? metricRow.stdDev : undefined,
        min: hasMetric ? metricRow.min : undefined,
        max: hasMetric ? metricRow.max : undefined,
        q1: hasMetric ? metricRow.q1 : undefined,
        q3: hasMetric ? metricRow.q3 : undefined,
        validCount: hasMetric ? metricRow.validCount : undefined,
        histogramBins: hasMetric ? metricRow.histogramBins : undefined,
      };
    });

    // 5. Calculate Aggregate Mean for this Node (Row Total)
    let nodeMean: number | undefined;

    // If we are dealing with a Metric Table
    const hasMetricCells = Object.values(nodeCells).some((c) => c.mean !== undefined);
    if (hasMetricCells) {
      const totalN = Object.values(nodeCells).reduce((sum, c) => sum + (c.validCount || 0), 0);
      if (totalN > 0) {
        const weightedSum = Object.values(nodeCells).reduce((sum, c) => sum + (c.mean || 0) * (c.validCount || 0), 0);
        nodeMean = weightedSum / totalN;
      }
    }

    // Recurse with updated path
    const children = buildTree(
      groupData,
      depth + 1,
      rowVariables,
      colKeys,
      colTotals,
      isWeighted,
      isMultipleResponse,
      uniqueKey,
      nodeRowPath,
    );

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
      rowPath: nodeRowPath,
    };
  });

  // 4b. SORTING LOGIC
  nodes.sort((a, b) => {
    // Multiple response: always sort by frequency (descending)
    if (isMultipleResponse) {
      if (b.total !== a.total) return b.total - a.total;
      return a.label.localeCompare(b.label);
    }

    const type = normalizeVariableType(variable?.type);

    if (type === 'ordered' || type === 'numeric') {
      const valA = a.sortValue;
      const valB = b.sortValue;

      const isNumA = !isNaN(valA);
      const isNumB = !isNaN(valB);

      if (isNumA && isNumB) return valA - valB;
      if (isNumA && !isNumB) return -1;
      if (!isNumA && isNumB) return 1;

      return a.rawValue.localeCompare(b.rawValue, undefined, { numeric: true });
    }

    if (isCategoricalType(type)) {
      // Sort by Frequency (Total Count) - Descending
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.label.localeCompare(b.label);
    }

    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });

  return nodes;
};
