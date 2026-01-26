import React, { useMemo, useState } from 'react';
import { AggregatedRow, Variable } from '../../../types';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { VariableStatsResult } from '../../../services/analysisWorker';
import { AnalysisChart } from '../../../components/charts/AnalysisChart';
import { useProcessedAnalysisData } from '../../../hooks/useProcessedAnalysisData';
import { recommendChart } from '../../../services/chartRecommender';
import { useAggregatedTableData, RowPathEntry, TableRowNode } from '../hooks/useAggregatedTableData';
export type { RowPathEntry, TableRowNode };

/**
 * DataTable Component
 * 
 * Displays aggregated analysis results in a hierarchical table or chart.
 * Uses useAggregatedTableData for data processing to separate logic from view.
 */

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
  /** Whether the variables form a grid structure */
  isGrid?: boolean;
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
  isGrid = false,
}) => {
  // UI State for expanded rows
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Process data for Visualization (Chart & Future Table)
  const processedData = useProcessedAnalysisData({
    data,
    rowVariables,
    colVariable,
    isWeighted,
    isMultipleResponse,
  });

  // Determine default chart type
  const chartConfig = useMemo(() => {
    if (!processedData) return { type: 'horizontal-bar' as const };

    return {
      type: recommendChart({
        rowVars: rowVariables,
        colVar: colVariable,
        isMultiResponse: isMultipleResponse,
        isGrid,
      }).default
    };
  }, [processedData, rowVariables, colVariable, isMultipleResponse]);

  // Aggregate Data for Table View using custom hook
  const tableData = useAggregatedTableData({
    data,
    rowVariables,
    colVariable,
    isWeighted,
    isMultipleResponse,
    variableStats
  });

  if (!tableData) return null;

  // State for Column Highlight (Crosshair effect)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  // -- RENDER MODE: TABLE --
  if (viewMode === 'table') {
    const renderRow = (row: TableRowNode) => {
      const isExpanded = expandedKeys[row.key] ?? true; // Default expanded?
      const hasChildren = row.children.length > 0;
      const paddingLeft = row.depth * 24 + 8; // Match the px-2 (8px) padding of the header

      return (
        <React.Fragment key={row.key}>
          <tr className="group mission-control-row">
            <td className="py-1 font-medium text-[var(--text-primary)] align-top" style={{ paddingLeft }}>
              <div className="flex items-center gap-2">
                {hasChildren && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleRow(row.key); }}
                    className="p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
                {(!hasChildren && row.depth > 0) && <div className="w-4" />} {/* Spacer only for nested rows */}
                <span>{row.label}</span>
              </div>
            </td>
            {tableData.colKeys.map(col => {
              const cell = row.cells[col];
              // Dim zeros logic
              const isZero = cell.mean !== undefined
                ? (Math.abs(cell.mean) === 0)
                : (cell.percent === 0);

              const textClass = isZero ? 'text-[var(--text-secondary)] opacity-50' : 'text-[var(--text-primary)]';
              const secondaryTextClass = isZero ? 'text-[var(--text-secondary)] opacity-40' : 'text-[var(--text-secondary)]';

              return (
                <td
                  key={col}
                  className={`px-2 py-1 text-left align-middle cursor-pointer relative data-cell border-l border-[var(--border-subtle)] transition-colors
                    ${hoveredCol === col ? 'bg-[var(--bg-surface)]' : ''}
                  `}
                  onMouseEnter={() => setHoveredCol(col)}
                  onMouseLeave={() => setHoveredCol(null)}
                  onClick={() => onCellClick?.(row.rowPath, colVariable ? col : null)}
                  title={
                    cell.stats && typeof cell.stats.effN === 'number'
                      ? `Significance Test (vs Rest)\nT-Score: ${(cell.stats.tScore ?? 0).toFixed(2)}\np-value: ${(cell.stats.pValue ?? 1).toFixed(4)}\nEff. Sample Size: ${cell.stats.effN.toFixed(1)}\n\nClick to X-Ray`
                      : "Click to X-Ray"
                  }
                >
                  <div className="flex flex-row items-baseline justify-start gap-2 text-left w-full">
                    {cell.mean !== undefined ? (
                      // METRIC DISPLAY
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className={`font-bold tabular-nums text-right w-[42px] ${textClass}`}>{cell.mean.toFixed(1)}</span>
                          {!isZero && <span className={`text-[10px] ${secondaryTextClass} bg-[var(--bg-panel)] px-1 rounded`}>Mean</span>}
                        </div>
                        <span className={`text-[10px] ${secondaryTextClass} font-mono tracking-tight group-hover:opacity-100 transition-opacity flex gap-2`}>
                          {cell.stdDev !== undefined && <span>SD: {cell.stdDev.toFixed(1)}</span>}
                          <span>n={cell.validCount ?? cell.count}</span>
                        </span>
                      </>
                    ) : (
                      // FREQUENCY DISPLAY
                      <>
                        <div className="flex items-center gap-0.5">
                          <span className={`font-bold tabular-nums text-right w-[48px] ${textClass}`}>{cell.percent.toFixed(1)}%</span>
                          {cell.sig === 'high_95' && (
                            <ArrowUp size={12} className="text-[var(--color-success)]" />
                          )}
                          {cell.sig === 'high_80' && (
                            <ArrowUp size={12} className="text-[var(--text-secondary)]" />
                          )}
                          {cell.sig === 'low_95' && (
                            <ArrowDown size={12} className="text-[var(--color-error)]" />
                          )}
                          {cell.sig === 'low_80' && (
                            <ArrowDown size={12} className="text-[var(--text-secondary)]" />
                          )}

                        </div>
                        <span className={`text-[10px] ${secondaryTextClass} font-mono tracking-tight opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>n={cell.count}</span>
                      </>
                    )}
                  </div>
                </td>
              );
            })}
            {/* Only show Row Total if we have columns OR if it's a frequency table (always show 100%)
                For Metric tables without columns, the single column is already the total. */}
            {(tableData.colKeys.length > 1) && (
              <td className="px-2 py-1 text-left font-mono font-semibold text-[var(--text-primary)] bg-[var(--bg-active)]/30 align-middle data-cell">
                <div className="flex flex-row items-baseline justify-start gap-2 text-left w-full">
                  {row.mean ? (
                    // METRIC ROW TOTAL (Global Mean for this row)
                    // If this is the top-level row and we have variableStats, use that for precision
                    // Otherwise use the aggregated mean from the row node
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-[var(--text-primary)]">
                          {(variableStats && row.depth === 0) ? variableStats.numeric?.mean.toFixed(1) : row.mean?.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-panel)] px-1 rounded">Mean</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-secondary)]">n={row.total}</span>
                    </>
                  ) : (
                    // FREQUENCY ROW TOTAL
                    <>
                      <span>{((row.total / tableData.grandTotal) * 100).toFixed(1)}%</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">n={row.total}</span>
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
        className="w-full overflow-hidden bg-[var(--bg-app)] border-none rounded-lg shadow-sm"
      >
        <div className="p-4 border-b border-[var(--border-grid)] flex justify-between items-end">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] font-display">
              {colVariable ? `${rowVariables.map(v => v.label).join(' > ')} by ${colVariable.label}` : `${rowVariables[0].label} Frequency`}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 font-body">N = {totalCount} Respondents</p>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-[var(--bg-panel)] border-b border-[var(--border-grid)]">
              <tr className="font-body">
                <th className="px-2 py-2 font-bold text-[var(--text-accent)] tracking-wider text-left w-64 align-bottom sticky top-0 bg-[var(--bg-panel)] z-10 box-border border-b border-[var(--border-grid)]">
                  {rowVariables[0].label}
                </th>
                {tableData.colKeys.map((col, idx) => (
                  <th key={col} className={`px-2 py-2 font-bold text-[var(--text-accent)] text-left w-28 align-bottom sticky top-0 bg-[var(--bg-panel)] z-10 border-b border-[var(--border-grid)] transition-colors ${hoveredCol === col ? 'bg-[var(--bg-active)]' : ''}`}>
                    <div className="flex flex-col gap-1 items-start">
                      <span>{tableData.colLabels[col]}</span>
                    </div>
                  </th>
                ))}
                {(tableData.colKeys.length > 1) && (
                  <th className="px-2 py-2 font-bold text-left w-24 text-[var(--text-primary)] bg-[var(--bg-active)] align-bottom sticky top-0 z-10 border-b border-[var(--border-grid)] shadow-[inset_0_-2px_0_var(--border-grid)]">
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-grid)] font-body">
              {tableData.rows.map(row => renderRow(row))}
              <tr className="bg-[var(--bg-surface)] font-semibold border-t border-[var(--border-grid)] border-b border-[var(--border-grid)]">
                <td className="px-2 py-1 text-[var(--text-primary)]">Total</td>
                {tableData.colKeys.map(col => (
                  <td key={col} className="px-2 py-1 text-left font-mono text-[var(--text-primary)]">
                    {tableData.colTotals[col]}
                  </td>
                ))}
                {(tableData.colKeys.length > 1) && (
                  <td className="px-2 py-1 text-left font-mono text-[var(--text-primary)]">
                    {/* GRAND TOTAL CELL */}
                    {totalCount}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  }

  // -- RENDER MODE: CHART --
  return (
    <motion.div
      key="chart"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-[500px] bg-[var(--bg-active)] border border-[var(--gray-200)] rounded-lg shadow-sm p-6"
    >
      <AnalysisChart
        data={data}
        processedData={processedData}
        config={{
          type: chartConfig.type,
          showLegend: true,
          showTooltip: true,
          enableVisualETL: true
        }}
        variableStats={variableStats}
      />
    </motion.div>
  );
};