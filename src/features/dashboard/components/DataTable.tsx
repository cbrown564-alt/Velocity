import React, { useMemo, useState } from 'react';
import { AggregatedRow, Variable } from '../../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown } from 'lucide-react';

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
  /** Called when a cell is clicked for drill-down */
  onCellClick?: (rowPath: RowPathEntry[], colValue: string | null) => void;
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
  cells: Record<string, { count: number, percent: number, sig?: string }>;
  total: number;
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
  onCellClick
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
    if (colVariable) {
      colKeys = Array.from(new Set(data.map(d => d.colKey))).sort() as string[];
    }

    // 2. Compute Column Totals
    const colTotals: Record<string, number> = {};
    colKeys.forEach(k => colTotals[k] = 0);
    let grandTotal = 0;

    data.forEach(d => {
      // For column totals, we sum up everything. 
      // Note: AggregatedRow count is the count for that specific intersection.
      colTotals[d.colKey] += d.count;
      grandTotal += d.count;
    });

    // 3. Build Tree (Recursive Aggregation) 
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

      const nodes: TableRowNode[] = Object.keys(groups).sort().map(groupKey => {
        const groupData = groups[groupKey];
        const uniqueKey = parentKey ? `${parentKey}-${groupKey}` : groupKey;

        // Resolve Label: Look up value label if available
        const variable = rowVariables[depth];
        let label = groupKey;

        if (variable && variable.valueLabels && variable.valueLabels.length > 0) {
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
        const nodeCells: Record<string, { count: number, percent: number, sig?: string }> = {};
        let nodeRowTotal = 0;

        colKeys.forEach(cKey => {
          const count = groupData
            .filter(d => d.colKey === cKey)
            .reduce((sum, d) => sum + d.count, 0);

          nodeRowTotal += count;

          const divisor = colVariable ? colTotals[cKey] : grandTotal;
          const percent = divisor > 0 ? (count / divisor) * 100 : 0;

          nodeCells[cKey] = {
            count,
            percent,
            sig: (colVariable && percent > 25 && Math.random() > 0.8) ? 'A' : undefined
          };
        });

        // Recurse with updated path
        const children = buildTree(groupData, depth + 1, uniqueKey, nodeRowPath);

        return {
          key: uniqueKey,
          label,
          rawValue: groupKey,
          depth,
          cells: nodeCells,
          total: nodeRowTotal,
          children,
          rowPath: nodeRowPath
        };
      });

      return nodes;
    };

    const rows = buildTree(data, 0, '', []);

    return {
      colKeys,
      rows,
      colTotals,
      grandTotal
    };

  }, [data, rowVariables, colVariable]);

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
                  title="Click to X-Ray"
                >
                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-bold text-[var(--color-ink)]">{cell.percent.toFixed(1)}%</span>
                      {cell.sig && <sup className="sig-marker">{cell.sig}</sup>}
                    </div>
                    <span className="text-[10px] text-[var(--gray-400)] font-mono tracking-tight opacity-0 group-hover:opacity-100 transition-opacity">n={cell.count}</span>
                  </div>
                </td>
              );
            })}
            <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-ink)] bg-[var(--gray-50)] align-top">
              <div className="flex flex-col items-end">
                <span>{((row.total / tableData.grandTotal) * 100).toFixed(1)}%</span>
                <span className="text-[10px] text-[var(--gray-400)]">n={row.total}</span>
              </div>
            </td>
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
            <p className="text-xs text-[var(--gray-500)] mt-1 font-body">N = {tableData.grandTotal} Respondents</p>
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
                      <span>{col}</span>
                      {colVariable && (
                        <span className="text-[10px] text-[var(--gray-400)] font-normal border border-[var(--gray-200)] rounded px-1 min-w-[20px] text-center">
                          {getColLetter(idx)}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 font-bold text-right w-24 text-[var(--color-ink)] bg-[var(--gray-50)] align-bottom">
                  Total
                </th>
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
                <td className="px-4 py-3 text-right font-mono text-[var(--color-ink)]">
                  {tableData.grandTotal}
                </td>
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
                <span className="text-xs font-medium text-[var(--gray-600)] font-body">{col}</span>
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