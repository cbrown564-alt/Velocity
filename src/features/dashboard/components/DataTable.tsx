import React, { useMemo, useState, useRef, useCallback } from 'react';
import { AggregatedRow, Variable, TableStats } from '../../../types';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { VariableStatsResult } from '../../../types/worker';
import { AnalysisChart } from '../../../components/charts/AnalysisChart';
import { useProcessedAnalysisData } from '../../../hooks/useProcessedAnalysisData';
import { recommendChart } from '../../../services/chartRecommender';
import { useTableDragMerge, TableDragItem } from '../../../hooks/useTableDragMerge';
import { useMergeOrchestration } from '../../../hooks/useMergeOrchestration';
import { InputModal } from '../../../components/overlays/InputModal';
import { RowPathEntry, TableRowNode } from '../../../services/treeBuilder';
import { Tooltip } from '../../../components/common/Tooltip';
import { StatisticsTooltip } from '../../../components/common/StatisticsTooltip';
import { MethodologyDrawer } from '../../../components/common/MethodologyPanel';
import { StatisticsStatusBar } from '../../../components/common/StatisticsStatusBar';
import { useVelocityStore } from '../../../store';
import mergeStyles from './DataTable.module.css';
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
  /** Table-level statistics (chi-square, etc.) */
  tableStats?: TableStats | null;
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
  tableStats,
}) => {
  const analysisSettings = useVelocityStore((state) => state.analysisSettings);
  const overlapCorrected = useMemo(
    () => data.some((row) => row.stats?.isOverlapCorrected),
    [data]
  );

  // UI State for expanded rows
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  // State for methodology panel visibility
  const [showMethodology, setShowMethodology] = useState(false);

  const toggleRow = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // State for Column Highlight (Crosshair effect)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  // Merge: selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Merge orchestration (modal + recode)
  const firstRowVarId = rowVariables[0]?.id;
  const { mergeModal, openMerge, closeMerge, confirmMerge } = useMergeOrchestration(firstRowVarId);

  // Merge drag hook
  const { dragState, handleDragStart } = useTableDragMerge({
    enabled: true,
    containerRef: tableContainerRef,
    onMerge: openMerge,
    selectedRows,
    selectedCols,
  });

  // Toggle row selection
  const toggleRowSelection = useCallback((rawValue: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rawValue)) next.delete(rawValue);
      else next.add(rawValue);
      return next;
    });
  }, []);

  // Toggle column selection
  const toggleColSelection = useCallback((colKey: string) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(colKey)) next.delete(colKey);
      else next.add(colKey);
      return next;
    });
  }, []);

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

  // Aggregate Data for Table View (Derived from Worker Result)
  const tableData = useMemo(() => {
    if (!processedData) return null;

    const colKeys = processedData.columns.map(c => c.key);
    const colLabels = processedData.columns.reduce((acc, col) => {
      acc[col.key] = col.label;
      return acc;
    }, {} as Record<string, string>);
    const colTotals = processedData.columns.reduce((acc, col) => {
      acc[col.key] = col.total;
      return acc;
    }, {} as Record<string, number>);

    // Extract column letters from first row's cells (for pairwise comparison display)
    const colLetters: Record<string, string> = {};
    if (processedData.rows.length > 0) {
      const firstRow = processedData.rows[0];
      Object.entries(firstRow.cells).forEach(([key, cell]) => {
        if (cell.columnLetter) {
          colLetters[key] = cell.columnLetter;
        }
      });
    }

    return {
      colKeys,
      colLabels,
      colLetters,
      rows: processedData.rows,
      colTotals,
      grandTotal: processedData.grandTotal
    };
  }, [processedData]);

  if (!tableData) return null;



  // -- RENDER MODE: TABLE --
  if (viewMode === 'table') {
    const renderRow = (row: TableRowNode) => {
      const isExpanded = expandedKeys[row.key] ?? true; // Default expanded?
      const hasChildren = row.children.length > 0;
      const paddingLeft = row.depth * 24 + 8; // Match the px-2 (8px) padding of the header
      const rowVarId = rowVariables[row.depth]?.id ?? rowVariables[0]?.id ?? '';
      const isRowDragging = dragState.isDragging && dragState.draggedItem?.rawValue === row.rawValue && dragState.draggedItem?.axis === 'row';
      const isRowDropTarget = dragState.dropTarget === row.rawValue && dragState.draggedItem?.axis === 'row';
      const isRowSelected = selectedRows.has(row.rawValue);

      const rowHeaderClasses = [
        'py-1 font-medium text-[var(--text-primary)] align-top',
        mergeStyles.mergeHeader,
        isRowDragging ? mergeStyles.mergeDragging : '',
        isRowDropTarget ? mergeStyles.mergeDropTarget : '',
        isRowSelected ? mergeStyles.mergeSelected : '',
      ].filter(Boolean).join(' ');

      return (
        <React.Fragment key={row.key}>
          <tr className="group data-row-interactive">
            <td
              className={rowHeaderClasses}
              style={{ paddingLeft }}
              data-merge-key={row.rawValue}
              data-merge-depth={row.depth}
              data-merge-axis="row"
              data-merge-label={row.label}
              data-merge-var={rowVarId}
              onMouseDown={(e) => {
                // Only left button, ignore if clicking expand toggle
                if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
                handleDragStart({
                  label: row.label,
                  rawValue: row.rawValue,
                  depth: row.depth,
                  variableId: rowVarId,
                  axis: 'row',
                }, e);
              }}
              onClick={(e) => {
                // Toggle selection on click (not drag)
                if (!dragState.isDragging && !(e.target as HTMLElement).closest('button')) {
                  toggleRowSelection(row.rawValue);
                }
              }}
            >
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

              const isSignificant = Boolean(cell.sig) || Boolean(cell.sigLetters && cell.sigLetters.length > 0);
              const textClass = isZero
                ? 'text-[var(--text-secondary)] opacity-50'
                : (isSignificant ? 'stat-significant' : 'text-[var(--text-primary)]');

              const secondaryTextClass = isZero ? 'text-[var(--text-secondary)] opacity-40' : 'text-[var(--text-secondary)]';

              // Determine if we have stats for tooltip
              const hasStats = cell.stats && typeof cell.stats.effN === 'number';
              const cellValue = cell.mean !== undefined ? cell.mean : cell.percent;

              const cellContent = (
                <div className="flex flex-row items-baseline justify-start gap-2 text-left w-full">
                  {cell.mean !== undefined ? (
                    // METRIC DISPLAY
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className={`font-bold tabular-nums text-right w-[42px] ${textClass}`}>{cell.mean.toFixed(1)}</span>
                        {cell.sigLetters && (
                          <span className="text-[10px] font-mono font-semibold text-[var(--color-success)]">{cell.sigLetters}</span>
                        )}
                        {!isZero && !cell.sigLetters && <span className={`text-[10px] ${secondaryTextClass} bg-[var(--bg-panel)] px-1 rounded`}>Mean</span>}
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
                        {cell.sigLetters ? (
                          <span className="text-[10px] font-mono font-semibold text-[var(--color-success)]">{cell.sigLetters}</span>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                      <span className={`text-[10px] ${secondaryTextClass} font-mono tracking-tight opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>n={cell.count}</span>
                    </>
                  )}
                </div>
              );

              return (
                <td
                  key={col}
                  className={`px-2 py-1 text-left align-middle cursor-pointer relative data-cell border-l border-[var(--border-subtle)] transition-colors
                    ${hoveredCol === col ? 'bg-[var(--bg-surface)]' : ''}
                  `}
                  onMouseEnter={() => setHoveredCol(col)}
                  onMouseLeave={() => setHoveredCol(null)}
                  onClick={() => onCellClick?.(row.rowPath, colVariable ? col : null)}
                  title={!hasStats ? "Click to X-Ray" : undefined}
                >
                  {hasStats ? (
                    <Tooltip
                      content={
                        <StatisticsTooltip
                          stats={cell.stats!}
                          sig={cell.sig}
                          value={cellValue}
                          isMetric={cell.mean !== undefined}
                          ci95={cell.ci95}
                          ci80={cell.ci80}
                        />
                      }
                      position="top"
                      delay={300}
                      maxWidth={320}
                    >
                      {cellContent}
                    </Tooltip>
                  ) : (
                    cellContent
                  )}
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
        className="w-full overflow-hidden bg-transparent border-none rounded-lg shadow-sm"
      >
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[60vh] custom-scrollbar" style={{ position: 'relative' }}>
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-[var(--bg-panel)] border-b border-[var(--border-grid)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md">
              <tr className="font-body">
                <th className="px-2 py-2 font-bold text-[var(--text-accent)] tracking-wider text-left w-64 align-bottom sticky top-0 bg-[var(--bg-panel)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md z-10 box-border border-b border-[var(--border-grid)]">
                  {rowVariables[0].label}
                </th>
                {tableData.colKeys.map((col) => {
                  const isColDragging = dragState.isDragging && dragState.draggedItem?.rawValue === col && dragState.draggedItem?.axis === 'column';
                  const isColDropTarget = dragState.dropTarget === col && dragState.draggedItem?.axis === 'column';
                  const isColSelected = selectedCols.has(col);
                  const colVarId = colVariable?.id ?? '';

                  return (
                    <th
                      key={col}
                      className={[
                        'px-2 py-2 font-bold text-[var(--text-accent)] text-left w-28 align-bottom sticky top-0 bg-[var(--bg-panel)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md z-10 border-b border-[var(--border-grid)] transition-colors',
                        hoveredCol === col ? 'bg-[var(--bg-active)]' : '',
                        colVariable ? mergeStyles.mergeHeader : '',
                        isColDragging ? mergeStyles.mergeDragging : '',
                        isColDropTarget ? mergeStyles.mergeDropTarget : '',
                        isColSelected ? mergeStyles.colSelected : '',
                      ].filter(Boolean).join(' ')}
                      data-merge-key={col}
                      data-merge-axis="column"
                      data-merge-label={tableData.colLabels[col]}
                      data-merge-var={colVarId}
                      data-merge-depth="0"
                      onMouseDown={(e) => {
                        if (e.button !== 0 || !colVariable) return;
                        handleDragStart({
                          label: tableData.colLabels[col],
                          rawValue: col,
                          depth: 0,
                          variableId: colVarId,
                          axis: 'column',
                        }, e);
                      }}
                      onClick={() => {
                        if (!dragState.isDragging && colVariable) {
                          toggleColSelection(col);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-0.5 items-start">
                        {tableData.colLetters[col] && (
                          <span className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] px-1 rounded">
                            {tableData.colLetters[col]}
                          </span>
                        )}
                        <span>{tableData.colLabels[col]}</span>
                      </div>
                    </th>
                  );
                })}
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
        {/* Statistics Status Bar */}
        <StatisticsStatusBar
          analysisSettings={analysisSettings}
          tableStats={tableStats}
          colVariable={colVariable}
          overlapCorrected={overlapCorrected}
          onMethodologyClick={() => setShowMethodology(!showMethodology)}
        />

        {/* Methodology Drawer */}
        <MethodologyDrawer
          isOpen={showMethodology}
          onClose={() => setShowMethodology(false)}
        />

        {/* Drag ghost */}
        {dragState.isDragging && dragState.draggedItem && (
          <div
            className={mergeStyles.mergeGhost}
            style={{ left: dragState.currentX, top: dragState.currentY }}
          >
            {dragState.draggedItem.label}
            {(() => {
              const selected = dragState.draggedItem.axis === 'row' ? selectedRows : selectedCols;
              const extra = selected.has(dragState.draggedItem.rawValue) ? selected.size - 1 : 0;
              return extra > 0 ? ` +${extra}` : '';
            })()}
          </div>
        )}

        {/* Merge Group Modal */}
        <InputModal
          isOpen={mergeModal.isOpen}
          onClose={closeMerge}
          onSubmit={confirmMerge}
          title="Create Group"
          placeholder="Enter group name..."
          initialValue={mergeModal.targetItem?.label || ''}
          submitLabel="Create Group"
        />

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
        rowVariables={rowVariables}
        colVariable={colVariable}
        isWeighted={isWeighted}
        isMultipleResponse={isMultipleResponse}
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
