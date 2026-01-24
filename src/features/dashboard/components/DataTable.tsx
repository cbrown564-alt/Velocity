import React, { useMemo, useState } from 'react';
import { AggregatedRow, Variable } from '../../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { VariableStatsResult } from '../../../services/analysisWorker';
import { Sparkline } from '../../variableManager/Sparkline';

/** Row path entry for drill-down */
export interface RowPathEntry {
  variable: string;  // Variable ID
  value: string;     // Raw value (not label)
}

interface DataTableProps {
  data: AggregatedRow[];
  rowVariables: Variable[];
  colVariable: Variable | null;
  totalCount: number;
  viewMode?: 'table' | 'chart';
  /** Whether weighted analysis is active */
  isWeighted?: boolean;
  /** Called when a cell is clicked for drill-down */
  onCellClick?: (rowPath: RowPathEntry[], colValue: string | null) => void;
  /** Stats for the main scale variable (if applicable) */
  variableStats?: VariableStatsResult | null;
  /** If true, row keys are already labels (multiple response) - skip label resolution */
  isMultipleResponse?: boolean;
}

const CHART_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-400',
  'bg-rose-400',
  'bg-sky-400',
  'bg-violet-400',
  'bg-teal-400'
];

interface TableRowNode {
  key: string;
  label: string;
  rawValue: string;  // Original value from data
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

export const DataTable: React.FC<DataTableProps> = ({
  data,
  rowVariables,
  colVariable,
  totalCount,
  viewMode = 'table',
  isWeighted = false,
  onCellClick,
  variableStats,
  isMultipleResponse = false,
}) => {
  // UI State for expanded rows
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const tableData = useMemo(() => {
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
        if (variable && (variable.type === 'ordinal' || variable.type === 'scale')) {
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

        if (type === 'ordinal' || type === 'scale') {
          // Try to parse as numbers
          const valA = parseFloat(a.rawValue);
          const valB = parseFloat(b.rawValue);

          if (!isNaN(valA) && !isNaN(valB)) {
            return valA - valB;
          }
          // Fallback to value label index if available?
          // Or just alphanumeric if not numbers
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

  }, [data, rowVariables, colVariable, isWeighted, isMultipleResponse]);

  if (!tableData) return null;

  const getColLetter = (index: number) => String.fromCharCode(65 + index);

  // Flatten rows for Chart view (or just show top level)
  // For Chart: Let's show the top level only for now, or all leaf nodes? 
  // Let's go with Top Level for simplicity in this refactor.
  const chartRows = tableData.rows;

  // -- RENDER MODE: TABLE --
  if (viewMode === 'table') {
    const renderRow = (row: TableRowNode) => {
      const isExpanded = expandedKeys[row.key] ?? true; // Default expanded?
      const hasChildren = row.children.length > 0;
      const paddingLeft = row.depth * 24 + 16; // Indent

      // Check if this row is metric-based (has mean)
      const variantIsMetric = row.mean !== undefined || (variableStats && row.depth === 0);


      return (
        <React.Fragment key={row.key}>
          <tr className="group hover:bg-[var(--gray-50)] transition-colors">
            <td className="py-3 font-medium text-[var(--color-ink)] align-top border-r border-transparent" style={{ paddingLeft }}>
              <div className="flex items-center gap-2">
                {hasChildren && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleRow(row.key); }}
                    className="p-0.5 rounded hover:bg-[var(--gray-200)] text-[var(--gray-400)] transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
                {!hasChildren && <div className="w-4" />} {/* Spacer */}
                <span>{row.label}</span>
              </div>
            </td>
            {tableData.colKeys.map(col => {
              const cell = row.cells[col];
              return (
                <td
                  key={col}
                  className="px-4 py-3 text-right align-top cursor-pointer relative hover:bg-[var(--gray-100)] transition-colors border-l border-[var(--gray-50)]"
                  onClick={() => onCellClick?.(row.rowPath, colVariable ? col : null)}
                  title={
                    cell.stats && typeof cell.stats.effN === 'number'
                      ? `Significance Test (vs Rest)\nT-Score: ${(cell.stats.tScore ?? 0).toFixed(2)}\np-value: ${(cell.stats.pValue ?? 1).toFixed(4)}\nEff. Sample Size: ${cell.stats.effN.toFixed(1)}\n\nClick to X-Ray`
                      : "Click to X-Ray"
                  }
                >
                  <div className="flex flex-col items-end">
                    {cell.mean !== undefined ? (
                      // METRIC DISPLAY
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-[var(--color-ink)]">{cell.mean.toFixed(1)}</span>
                          <span className="text-[10px] text-[var(--gray-500)] bg-[var(--gray-100)] px-1 rounded">Mean</span>
                        </div>
                        <span className="text-[10px] text-[var(--gray-400)] font-mono tracking-tight group-hover:opacity-100 transition-opacity flex gap-2">
                          {cell.stdDev !== undefined && <span>SD: {cell.stdDev.toFixed(1)}</span>}
                          <span>n={cell.validCount ?? cell.count}</span>
                        </span>
                      </>
                    ) : (
                      // FREQUENCY DISPLAY
                      <>
                        <div className="flex items-center gap-0.5">
                          <span className="font-bold text-[var(--color-ink)]">{cell.percent.toFixed(1)}%</span>
                          {cell.sig === 'high_95' && (
                            <ArrowUp size={12} className="text-emerald-500" />
                          )}
                          {cell.sig === 'high_80' && (
                            <ArrowUp size={12} className="text-slate-400" />
                          )}
                          {cell.sig === 'low_95' && (
                            <ArrowDown size={12} className="text-rose-500" />
                          )}
                          {cell.sig === 'low_80' && (
                            <ArrowDown size={12} className="text-slate-400" />
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--gray-400)] font-mono tracking-tight opacity-0 group-hover:opacity-100 transition-opacity">n={cell.count}</span>
                      </>
                    )}
                  </div>
                </td>
              );
            })}
            {/* Only show Row Total if we have columns OR if it's a frequency table (always show 100%)
                For Metric tables without columns, the single column is already the total. */}
            {(tableData.colKeys.length > 1) && (
              <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-ink)] bg-[var(--gray-50)] align-top">
                <div className="flex flex-col items-end">
                  {row.mean ? (
                    // METRIC ROW TOTAL (Global Mean for this row)
                    // If this is the top-level row and we have variableStats, use that for precision
                    // Otherwise use the aggregated mean from the row node
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-[var(--color-ink)]">
                          {(variableStats && row.depth === 0) ? variableStats.numeric?.mean.toFixed(1) : row.mean?.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-[var(--gray-500)] bg-[var(--gray-100)] px-1 rounded">Mean</span>
                      </div>
                      <span className="text-[10px] text-[var(--gray-400)]">n={row.total}</span>
                    </>
                  ) : (
                    // FREQUENCY ROW TOTAL
                    <>
                      <span>{((row.total / tableData.grandTotal) * 100).toFixed(1)}%</span>
                      <span className="text-[10px] text-[var(--gray-400)]">n={row.total}</span>
                    </>
                  )}
                </div>
              </td>
            )}
          </tr>
          {/* Render Children */}
          {hasChildren && isExpanded && row.children.map(child => renderRow(child))}
        </React.Fragment>
      );
    };

    return (
      <motion.div
        key="table"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full overflow-hidden bg-[var(--color-paper)] border-none rounded-lg shadow-sm"
      >
        <div className="p-4 border-b border-[var(--gray-200)] flex justify-between items-end">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-ink)] font-display">
              {colVariable ? `${rowVariables.map(v => v.label).join(' > ')} by ${colVariable.label}` : `${rowVariables[0].label} Frequency`}
            </h3>
            <p className="text-xs text-[var(--gray-500)] mt-1 font-body">N = {totalCount} Respondents</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-[var(--color-paper)] border-b-2 border-[var(--gray-300)]">
              <tr className="font-body">
                <th className="px-4 py-3 font-bold text-[var(--color-charcoal)] tracking-wider text-left w-1/4 align-bottom">
                  {rowVariables[0].label}
                </th>
                {tableData.colKeys.map((col, idx) => (
                  <th key={col} className="px-4 py-3 font-bold text-[var(--color-charcoal)] text-right w-32 align-bottom">
                    <div className="flex flex-col gap-1 items-end">
                      <span>{tableData.colLabels[col]}</span>
                      {colVariable && (
                        <span className="text-[10px] text-[var(--gray-400)] font-normal border border-[var(--gray-200)] rounded px-1 min-w-[20px] text-center">
                          {getColLetter(idx)}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                {(tableData.colKeys.length > 1) && (
                  <th className="px-4 py-3 font-bold text-right w-24 text-[var(--color-ink)] bg-[var(--gray-50)] align-bottom">
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--gray-100)] font-body">
              {tableData.rows.map(row => renderRow(row))}
              <tr className="bg-[var(--gray-50)] font-semibold border-t border-[var(--gray-300)] border-b border-[var(--gray-300)]">
                <td className="px-4 py-3 text-[var(--color-ink)] pl-8">Total</td>
                {tableData.colKeys.map(col => (
                  <td key={col} className="px-4 py-3 text-right font-mono text-[var(--color-ink)]">
                    {tableData.colTotals[col]}
                  </td>
                ))}
                {(tableData.colKeys.length > 1) && (
                  <td className="px-4 py-3 text-right font-mono text-[var(--color-ink)]">
                    {/* GRAND TOTAL CELL - SHOW SPARKLINE IF STATS AVAILABLE */}
                    {variableStats && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-right">
                            <div className="text-xs font-bold">{variableStats.numeric?.mean.toFixed(1)}</div>
                            <div className="text-[9px] text-[var(--gray-500)] uppercase tracking-wide">Mean</div>
                          </div>
                          <Sparkline
                            type="scale"
                            histogramBins={variableStats.numeric?.histogramBins}
                            width={80}
                            height={24}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--gray-400)]">N={variableStats.totalCount}</span>
                      </div>
                    )}
                    {!variableStats && totalCount}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  }

  // -- RENDER MODE: CHART (STACKED BAR) --
  // Note: Only charting top-level rows for now
  return (
    <motion.div
      key="chart"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-[var(--color-paper)] border border-[var(--gray-200)] rounded-lg shadow-sm p-6"
    >
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-ink)] font-display">{rowVariables[0].label} Distribution</h3>
          {colVariable && <p className="text-sm text-[var(--gray-500)] font-body">Broken down by {colVariable.label}</p>}
        </div>

        {/* Legend */}
        {colVariable && (
          <div className="flex flex-wrap gap-3 max-w-md justify-end">
            {tableData.colKeys.map((col, idx) => (
              <div key={col} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${CHART_COLORS[idx % CHART_COLORS.length]}`}></div>
                <span className="text-xs font-medium text-[var(--gray-600)] font-body">{tableData.colLabels[col]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6 font-body">
        {chartRows.map((row) => (
          <div key={row.key} className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-[var(--color-charcoal)]">{row.label}</span>
              <span className="text-[var(--gray-400)] text-xs">n={row.total}</span>
            </div>

            {/* 100% Stacked Bar */}
            <div className="h-8 w-full bg-[var(--gray-100)] rounded-md overflow-hidden flex relative">
              {colVariable ? (
                tableData.colKeys.map((col, idx) => {
                  const count = row.cells[col].count;
                  const widthPct = row.total > 0 ? (count / row.total) * 100 : 0;
                  if (widthPct === 0) return null;

                  return (
                    <motion.div
                      key={col}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className={`h-full ${CHART_COLORS[idx % CHART_COLORS.length]} border-r border-white/20 last:border-none flex items-center justify-center`}
                    >
                      {widthPct > 8 && (
                        <span className="text-[10px] font-bold text-white/90 drop-shadow-md">
                          {widthPct.toFixed(0)}%
                        </span>
                      )}
                    </motion.div>
                  );
                })
              ) : (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(row.total / tableData.grandTotal) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full ${CHART_COLORS[0]} rounded-r-md flex items-center justify-start pl-3`}
                >
                  <span className="text-xs font-bold text-white/90">
                    {(row.total / tableData.grandTotal * 100).toFixed(1)}%
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};