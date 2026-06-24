import React, { useMemo, useState, useRef, useCallback } from 'react';
import { AggregatedRow, Variable, TableStats } from '../../../types';
import type { VariableStatsResult } from '../../../types/worker';
import { useProcessedAnalysisData } from '../../../hooks/useProcessedAnalysisData';
import { useTableDragMerge } from '../../../hooks/useTableDragMerge';
import { useMergeOrchestration } from '../../../hooks/useMergeOrchestration';
import { InputModal } from '../../../components/overlays/InputModal';
import { ChartContextMenu } from '../../../components/overlays/ChartContextMenu';
import { RowPathEntry } from '../../../core/analysis/treeBuilder';
import { StatisticsStatusBar } from '../../../components/common/StatisticsStatusBar';
import { useReducedMotion } from '../../../lib/motion';
import { useVelocityStore } from '../../../store';
import mergeStyles from './DataTable.module.css';
import { toUiCaps } from '../../../core/text/displayCase';
import { CrosstabRow } from './CrosstabRow';
import { CrosstabCell } from './CrosstabCell';
import { computeCrosstabColumnWidths } from './crosstabColumnWidths';
import { AnalysisOutputFrame } from './AnalysisOutputFrame';
export type { RowPathEntry, TableRowNode } from '../../../core/analysis/treeBuilder';

/**
 * DataTable Component
 * 
 * Displays aggregated analysis results in a hierarchical table.
 * Uses useProcessedAnalysisData for data processing to separate logic from view.
 */

interface DataTableProps {
  data: AggregatedRow[];
  rowVariables: Variable[];
  colVariable: Variable | null;
  totalCount: number;
  /** Whether weighted analysis is active */
  isWeighted?: boolean;
  /** Called when a cell is clicked for drill-down */
  onCellClick?: (rowPath: RowPathEntry[], colValue: string | null) => void;
  /** Stats for the main scale variable (if applicable) */
  variableStats?: VariableStatsResult | null;
  /** If true, row keys are already labels (multiple response) - skip label resolution */
  isMultipleResponse?: boolean;
  /** Table-level statistics (chi-square, etc.) */
  tableStats?: TableStats | null;
  /** Table density: compact (exploration) or generous (presentation) */
  density?: 'compact' | 'generous';
  /** Bleed output frame to slide edges (Focus mode) */
  frameBleed?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  data,
  rowVariables,
  colVariable,
  totalCount,
  isWeighted = false,
  onCellClick,
  variableStats,
  isMultipleResponse = false,
  tableStats,
  density = 'compact',
  frameBleed = false,
}) => {
  const analysisSettings = useVelocityStore((state) => state.analysisSettings);
  const transformLog = useVelocityStore((state) => state.transformLog);
  const deleteGroupedVariable = useVelocityStore((state) => state.deleteGroupedVariable);
  const splitGroupValue = useVelocityStore((state) => state.splitGroupValue);
  const overlapCorrected = useMemo(
    () => data.some((row) => row.stats?.isOverlapCorrected),
    [data]
  );

  // UI State for expanded rows
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  // Row context menu state (for ungroup/split on derived variables)
  const [rowContextMenu, setRowContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    variableId: string;
    rowLabel: string;
  } | null>(null);

  const reducedMotion = useReducedMotion();

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

  // Process data for table view via worker
  const processedData = useProcessedAnalysisData({
    data,
    rowVariables,
    colVariable,
    isWeighted,
    isMultipleResponse,
  });

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

  // Stable key that changes whenever the underlying query result changes,
  // triggering cell entry animations (Settling Scale) in CrosstabCell.
  const animationKey = useMemo(() => {
    if (!tableData?.rows.length) return undefined;
    const first = tableData.rows[0]?.key ?? '';
    const last = tableData.rows[tableData.rows.length - 1]?.key ?? '';
    return `${first}-${last}-${tableData.rows.length}-${tableData.colKeys.length}-${tableData.grandTotal}`;
  }, [tableData]);

  const columnWidths = useMemo(() => {
    if (!tableData) return null;
    const hasTotalColumn = tableData.colKeys.length > 1;
    return computeCrosstabColumnWidths(tableData.colKeys, tableData.colLabels, hasTotalColumn);
  }, [tableData]);

  const haloClass = useCallback((sig?: string | null): string => {
    if (sig === 'high_95' || sig === 'low_95') return 'bg-[var(--halo-high)]';
    if (sig === 'high_80' || sig === 'low_80') return 'bg-[var(--halo-mid)]';
    return '';
  }, []);

  const handleRowContextMenu = useCallback((params: {
    variableId: string;
    rowLabel: string;
    x: number;
    y: number;
  }) => {
    setRowContextMenu({
      isOpen: true,
      position: { x: params.x, y: params.y },
      variableId: params.variableId,
      rowLabel: params.rowLabel,
    });
  }, []);

  if (!tableData) return null;

    return (
      <AnalysisOutputFrame
        bleed={frameBleed}
        density={density}
        reducedMotion={reducedMotion}
        className="h-full min-h-0"
        footer={
          <StatisticsStatusBar
            analysisSettings={analysisSettings}
            tableStats={tableStats}
            colVariable={colVariable}
            overlapCorrected={overlapCorrected}
          />
        }
      >
        <div ref={tableContainerRef} className={`${mergeStyles.tableScrollRegion} custom-scrollbar`}>
          <table className={`${mergeStyles.crosstabTable} w-full text-sm text-left border-collapse`}>
            <thead className="text-xs bg-[var(--bg-panel)] border-b border-[var(--border-grid)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md">
              <tr className="font-body">
                <th
                  style={{ width: columnWidths?.rowLabel }}
                  className={`px-2 ${density === 'generous' ? 'py-4' : 'py-2.5'} font-bold text-[var(--text-secondary)] tracking-wider text-left align-bottom sticky top-0 bg-[var(--bg-panel)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md z-10 box-border border-b border-[var(--border-grid)] uppercase text-[11px] font-body`}
                >
                  {toUiCaps(rowVariables[0].label)}
                </th>
                {tableData.colKeys.map((col) => {
                  const isColDragging = dragState.isDragging && dragState.draggedItem?.rawValue === col && dragState.draggedItem?.axis === 'column';
                  const isColDropTarget = dragState.dropTarget === col && dragState.draggedItem?.axis === 'column';
                  const isColSelected = selectedCols.has(col);
                  const colVarId = colVariable?.id ?? '';

                  return (
                    <th
                      key={col}
                      style={{ width: columnWidths?.columns[col] }}
                      className={[
                        `px-2 ${density === 'generous' ? 'py-3' : 'py-2'} font-bold font-mono text-[var(--text-secondary)] text-left align-bottom sticky top-0 bg-[var(--bg-panel)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md z-10 border-b border-l border-[var(--border-grid)] transition-colors`,
                        hoveredCol === col ? 'bg-[var(--bg-active)] border-l-[var(--border-color-active)]' : 'border-l-transparent',
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
                        <span className="text-[11px] uppercase tracking-wider font-bold">{toUiCaps(tableData.colLabels[col])}</span>
                      </div>
                    </th>
                  );
                })}
                {(tableData.colKeys.length > 1) && (
                  <th
                    style={{ width: columnWidths?.total }}
                    className="px-2 py-2.5 font-bold font-mono text-left text-[var(--text-secondary)] bg-[var(--bg-active)] align-bottom sticky top-0 z-10 border-b border-[var(--border-grid)] shadow-[inset_0_-2px_0_var(--border-grid)] text-[11px] uppercase tracking-wider"
                  >
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-grid)] font-body">
              {tableData.rows.map(row => (
                <CrosstabRow
                  key={row.key}
                  row={row}
                  tableData={tableData}
                  rowVariables={rowVariables}
                  colVariable={colVariable}
                  expandedKeys={expandedKeys}
                  onToggleRow={toggleRow}
                  dragState={dragState}
                  onDragStart={handleDragStart}
                  selectedRows={selectedRows}
                  onToggleRowSelection={toggleRowSelection}
                  hoveredCol={hoveredCol}
                  onHoverCol={setHoveredCol}
                  onCellClick={onCellClick}
                  density={density}
                  animationKey={animationKey}
                  reducedMotion={reducedMotion}
                  haloClass={haloClass}
                  variableStats={variableStats}
                  transformLog={transformLog}
                  onRowContextMenu={handleRowContextMenu}
                />
              ))}
              <tr className={`${mergeStyles.totalRow} bg-[var(--bg-surface)] font-semibold border-t border-[var(--border-grid)] border-b border-[var(--border-grid)]`}>
                <td className={`total-row-label px-2 ${density === 'generous' ? 'py-2.5' : 'py-1.5'} text-[var(--text-secondary)] font-body text-xs font-bold uppercase tracking-wide`}>Total</td>
                {tableData.colKeys.map(col => (
                  <td key={col} className={`total-row-cell px-2 ${density === 'generous' ? 'py-2.5' : 'py-1.5'} text-right align-middle data-cell`}>
                    <CrosstabCell
                      key={`coltotal-${animationKey}-${col}`}
                      variant="count"
                      count={tableData.colTotals[col]}
                      size="marginal"
                      animationTrigger={animationKey}
                      reducedMotion={reducedMotion}
                    />
                  </td>
                ))}
                {(tableData.colKeys.length > 1) && (
                  <td className={`total-row-cell px-2 ${density === 'generous' ? 'py-2.5' : 'py-1.5'} text-right align-middle data-cell bg-[var(--bg-active)]/30`}>
                    <CrosstabCell
                      key={`grand-${animationKey}`}
                      variant="count"
                      count={totalCount}
                      size="marginal"
                      animationTrigger={animationKey}
                      reducedMotion={reducedMotion}
                    />
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>

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

        {/* Row context menu for grouped/derived variables */}
        {rowContextMenu && (() => {
          const transform = transformLog.find(t => t.newColId === rowContextMenu.variableId);
          const isGrouped = transform?.config.mode === 'categorical' && transform.config.mappings &&
            Object.values(transform.config.mappings).filter(v => v === rowContextMenu.rowLabel).length > 1;
          const options = [
            {
              label: 'Delete group variable',
              onClick: async () => {
                setRowContextMenu(null);
                await deleteGroupedVariable(rowContextMenu.variableId);
              },
              danger: true as const,
            },
            ...(isGrouped ? [{
              label: `Split "${rowContextMenu.rowLabel}" back to original values`,
              onClick: async () => {
                setRowContextMenu(null);
                await splitGroupValue(rowContextMenu.variableId, rowContextMenu.rowLabel);
              },
            }] : []),
          ];
          return (
            <ChartContextMenu
              isOpen={rowContextMenu.isOpen}
              position={rowContextMenu.position}
              title={rowContextMenu.rowLabel}
              options={options}
              onClose={() => setRowContextMenu(null)}
            />
          );
        })()}

      </AnalysisOutputFrame>
    );
};
