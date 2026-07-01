import React, { useMemo, useState, useRef, useCallback } from 'react';
import { AggregatedRow, Variable, TableStats } from '../../../types';
import type { VariableStatsResult } from '../../../types/worker';
import { useProcessedAnalysisData } from '../../../hooks/useProcessedAnalysisData';
import { useTableDragMerge } from '../../../hooks/useTableDragMerge';
import { useMergeOrchestration } from '../../../hooks/useMergeOrchestration';
import { InputModal } from '../../../components/overlays/InputModal';
import { ChartContextMenu } from '../../../components/overlays/ChartContextMenu';
import { RowPathEntry, type TableRowNode } from '../../../core/analysis/treeBuilder';
import { StatisticsStatusBar } from '../../../components/common/StatisticsStatusBar';
import { useReducedMotion } from '../../../lib/motion';
import { useVelocityStore } from '../../../store';
import mergeStyles from './DataTable.module.css';
import { toUiCaps } from '../../../core/text/displayCase';
import { CrosstabRow } from './CrosstabRow';
import { CrosstabCell } from './CrosstabCell';
import { computeCrosstabColumnWidths } from './crosstabColumnWidths';
import { countTreeNodes, shouldAnimateCrosstab } from './crosstabMotionPolicy';
import { ESTIMATED_ROW_HEIGHT, flattenVisibleRows, shouldVirtualizeRows } from './crosstabVirtualization';
import { useCrosstabRowWindow } from './useCrosstabRowWindow';
import {
  VIRTUALIZED_COL_WIDTH,
  VIRTUALIZED_ROW_LABEL_WIDTH,
  VIRTUALIZED_TOTAL_COL_WIDTH,
  shouldVirtualizeCols,
  virtualizedTableWidth,
} from './crosstabColumnVirtualization';
import { useCrosstabColWindow } from './useCrosstabColWindow';
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
  const showCellN = analysisSettings.showCellN ?? true;
  const showColumnBases = analysisSettings.showColumnBases ?? true;
  const processedQueryResult = useVelocityStore((state) => state.processedQueryResult);
  const transformLog = useVelocityStore((state) => state.transformLog);
  const deleteGroupedVariable = useVelocityStore((state) => state.deleteGroupedVariable);
  const splitGroupValue = useVelocityStore((state) => state.splitGroupValue);
  const overlapCorrected = useMemo(() => data.some((row) => row.stats?.isOverlapCorrected), [data]);

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
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // State for Column Highlight (Crosshair effect)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  // Merge: selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);

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
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rawValue)) next.delete(rawValue);
      else next.add(rawValue);
      return next;
    });
  }, []);

  // Toggle column selection
  const toggleColSelection = useCallback((colKey: string) => {
    setSelectedCols((prev) => {
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
    initialProcessedData: processedQueryResult,
  });

  // Aggregate Data for Table View (Derived from Worker Result)
  const tableData = useMemo(() => {
    if (!processedData) return null;

    const colKeys = processedData.columns.map((c) => c.key);
    const colLabels = processedData.columns.reduce(
      (acc, col) => {
        acc[col.key] = col.label;
        return acc;
      },
      {} as Record<string, string>,
    );
    const colTotals = processedData.columns.reduce(
      (acc, col) => {
        acc[col.key] = col.total;
        return acc;
      },
      {} as Record<string, number>,
    );

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
      grandTotal: processedData.grandTotal,
    };
  }, [processedData]);

  // Stable key that changes whenever the underlying query result changes,
  // triggering cell entry animations (Settling Scale) in CrosstabCell.
  // Left undefined for large result matrices so every cell renders static
  // (no per-cell Framer Motion instance) and the table stays responsive
  // (Phase 4: Rendering Scalability).
  const animationKey = useMemo(() => {
    if (!tableData?.rows.length) return undefined;
    const nodeCount = countTreeNodes(tableData.rows);
    if (!shouldAnimateCrosstab(nodeCount, tableData.colKeys.length)) return undefined;
    const first = tableData.rows[0]?.key ?? '';
    const last = tableData.rows[tableData.rows.length - 1]?.key ?? '';
    return `${first}-${last}-${tableData.rows.length}-${tableData.colKeys.length}-${tableData.grandTotal}`;
  }, [tableData]);

  const columnWidths = useMemo(() => {
    if (!tableData) return null;
    const hasTotalColumn = tableData.colKeys.length > 1;
    // Column virtualization (Phase 4 Task 3): very wide banners switch from
    // proportional percentage widths to a uniform fixed pixel width per data
    // column so the windowing math (and the off-screen spacer cells) can assume
    // a single column width, the horizontal analog of the fixed row-height
    // assumption used by row virtualization.
    if (shouldVirtualizeCols(tableData.colKeys.length)) {
      const columns: Record<string, string> = {};
      for (const key of tableData.colKeys) columns[key] = `${VIRTUALIZED_COL_WIDTH}px`;
      return {
        rowLabel: `${VIRTUALIZED_ROW_LABEL_WIDTH}px`,
        columns,
        total: hasTotalColumn ? `${VIRTUALIZED_TOTAL_COL_WIDTH}px` : undefined,
      };
    }
    return computeCrosstabColumnWidths(tableData.colKeys, tableData.colLabels, hasTotalColumn);
  }, [tableData]);

  // Row virtualization: flatten the visible (expanded) row tree and window it
  // for large tables so only the on-screen rows are in the DOM. Small tables
  // keep the recursive, fully-featured rendering path (Phase 4: Rendering
  // Scalability, Task 2).
  const flatRows = useMemo<TableRowNode[]>(
    () => (tableData ? flattenVisibleRows(tableData.rows, expandedKeys) : []),
    [tableData, expandedKeys],
  );
  const virtualizeRows = shouldVirtualizeRows(flatRows.length);
  const rowHeight = ESTIMATED_ROW_HEIGHT[density];
  const rowWindow = useCrosstabRowWindow({
    enabled: virtualizeRows,
    containerRef: tableContainerRef,
    headerRef,
    rowCount: flatRows.length,
    rowHeight,
  });

  // Column virtualization: very wide banners window the on-screen slice of body
  // columns and render left/right spacer cells for the off-screen columns
  // (Phase 4: Rendering Scalability, Task 3). The row-label and Total columns
  // are never windowed. Tables at or below the threshold render every column
  // with proportional widths, so the common case is unchanged.
  const colCount = tableData?.colKeys.length ?? 0;
  const virtualizeCols = shouldVirtualizeCols(colCount);
  const colWindow = useCrosstabColWindow({
    enabled: virtualizeCols,
    containerRef: tableContainerRef,
    colCount,
    colWidth: VIRTUALIZED_COL_WIDTH,
    leftOffset: VIRTUALIZED_ROW_LABEL_WIDTH,
  });
  const visibleColKeys = useMemo(
    () =>
      tableData && virtualizeCols
        ? tableData.colKeys.slice(colWindow.startIndex, colWindow.endIndex)
        : (tableData?.colKeys ?? []),
    [tableData, virtualizeCols, colWindow.startIndex, colWindow.endIndex],
  );
  const colLeftPadding = virtualizeCols ? colWindow.leftPadding : 0;
  const colRightPadding = virtualizeCols ? colWindow.rightPadding : 0;

  const haloClass = useCallback((sig?: string | null): string => {
    if (sig === 'high_95' || sig === 'low_95') return 'bg-[var(--halo-high)]';
    if (sig === 'high_80' || sig === 'low_80') return 'bg-[var(--halo-mid)]';
    return '';
  }, []);

  const handleRowContextMenu = useCallback((params: { variableId: string; rowLabel: string; x: number; y: number }) => {
    setRowContextMenu({
      isOpen: true,
      position: { x: params.x, y: params.y },
      variableId: params.variableId,
      rowLabel: params.rowLabel,
    });
  }, []);

  if (!tableData) return null;

  const hasTotalColumn = tableData.colKeys.length > 1;
  // Number of columns actually rendered in a body row: row-label + optional
  // left spacer + visible body columns + optional right spacer + total. Used as
  // the colSpan for the row-virtualization spacer rows (browsers clamp colSpan
  // to the real column count, but this keeps it exact).
  const renderedColumnCount =
    1 + (colLeftPadding > 0 ? 1 : 0) + visibleColKeys.length + (colRightPadding > 0 ? 1 : 0) + (hasTotalColumn ? 1 : 0);
  // Fixed natural table width when columns are virtualized so the horizontal
  // scrollbar stays stable regardless of which column slice is on screen.
  const tableWidth = virtualizeCols ? virtualizedTableWidth(colCount, hasTotalColumn) : undefined;

  const renderRow = (row: TableRowNode, withChildren: boolean) => (
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
      renderChildren={withChildren}
      visibleColKeys={visibleColKeys}
      colLeftPadding={colLeftPadding}
      colRightPadding={colRightPadding}
      showCellN={showCellN}
    />
  );

  /** Spacer cell for off-screen columns (header or body). */
  const colSpacer = (width: number, isHeader: boolean) =>
    width > 0 ? (
      isHeader ? (
        <th
          aria-hidden
          style={{ width, padding: 0 }}
          className="sticky top-0 z-10 bg-[var(--bg-panel)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] border-b border-[var(--border-grid)]"
        />
      ) : (
        <td aria-hidden style={{ width, padding: 0 }} className="border-l border-[var(--border-subtle)]" />
      )
    ) : null;

  return (
    <AnalysisOutputFrame
      bleed={frameBleed}
      density={density}
      reducedMotion={reducedMotion}
      frameClassName={virtualizeRows ? undefined : 'shrink-wrap'}
      className={virtualizeRows ? 'h-full min-h-0' : ''}
      footer={
        <StatisticsStatusBar
          analysisSettings={analysisSettings}
          tableStats={tableStats}
          colVariable={colVariable}
          overlapCorrected={overlapCorrected}
        />
      }
    >
      <div
        ref={tableContainerRef}
        data-testid="crosstab-scroll-region"
        className={`${mergeStyles.tableScrollRegion} ${virtualizeRows ? '' : mergeStyles.tableScrollNatural} custom-scrollbar`}
      >
        <table
          style={tableWidth ? { width: tableWidth } : undefined}
          className={`${mergeStyles.crosstabTable} w-full text-sm text-left border-collapse`}
        >
          <thead
            ref={headerRef}
            className="text-xs bg-[var(--bg-panel)] border-b border-[var(--border-grid)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md"
          >
            <tr className="font-body">
              <th
                style={{ width: columnWidths?.rowLabel }}
                className={`px-2 ${density === 'generous' ? 'py-4' : 'py-2.5'} font-bold text-[var(--text-secondary)] tracking-wider text-left align-bottom sticky top-0 bg-[var(--bg-panel)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md z-10 box-border border-b border-[var(--border-grid)] uppercase text-[11px] font-body`}
              >
                {toUiCaps(rowVariables[0].label)}
              </th>
              {colSpacer(colLeftPadding, true)}
              {visibleColKeys.map((col) => {
                const isColDragging =
                  dragState.isDragging &&
                  dragState.draggedItem?.rawValue === col &&
                  dragState.draggedItem?.axis === 'column';
                const isColDropTarget = dragState.dropTarget === col && dragState.draggedItem?.axis === 'column';
                const isColSelected = selectedCols.has(col);
                const colVarId = colVariable?.id ?? '';

                return (
                  <th
                    key={col}
                    style={{ width: columnWidths?.columns[col] }}
                    className={[
                      `px-2 ${density === 'generous' ? 'py-3' : 'py-2'} font-bold font-mono text-[var(--text-secondary)] text-left align-bottom sticky top-0 bg-[var(--bg-panel)] data-[theme=liquid-glass]:bg-[var(--mat-panel-bg)] data-[theme=liquid-glass]:backdrop-blur-md z-10 border-b border-l border-[var(--border-grid)] transition-colors`,
                      hoveredCol === col
                        ? 'bg-[var(--bg-active)] border-l-[var(--border-color-active)]'
                        : 'border-l-transparent',
                      colVariable ? mergeStyles.mergeHeader : '',
                      isColDragging ? mergeStyles.mergeDragging : '',
                      isColDropTarget ? mergeStyles.mergeDropTarget : '',
                      isColSelected ? mergeStyles.colSelected : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-merge-key={col}
                    data-merge-axis="column"
                    data-merge-label={tableData.colLabels[col]}
                    data-merge-var={colVarId}
                    data-merge-depth="0"
                    onMouseDown={(e) => {
                      if (e.button !== 0 || !colVariable) return;
                      handleDragStart(
                        {
                          label: tableData.colLabels[col],
                          rawValue: col,
                          depth: 0,
                          variableId: colVarId,
                          axis: 'column',
                        },
                        e,
                      );
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
                      <span className="text-[11px] uppercase tracking-wider font-bold">
                        {toUiCaps(tableData.colLabels[col])}
                      </span>
                    </div>
                  </th>
                );
              })}
              {colSpacer(colRightPadding, true)}
              {tableData.colKeys.length > 1 && (
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
            {virtualizeRows ? (
              <>
                {rowWindow.topPadding > 0 && (
                  <tr aria-hidden style={{ height: rowWindow.topPadding, borderTopWidth: 0 }}>
                    <td colSpan={renderedColumnCount} style={{ padding: 0, borderWidth: 0 }} />
                  </tr>
                )}
                {flatRows.slice(rowWindow.startIndex, rowWindow.endIndex).map((row) => renderRow(row, false))}
                {rowWindow.bottomPadding > 0 && (
                  <tr aria-hidden style={{ height: rowWindow.bottomPadding, borderTopWidth: 0 }}>
                    <td colSpan={renderedColumnCount} style={{ padding: 0, borderWidth: 0 }} />
                  </tr>
                )}
              </>
            ) : (
              tableData.rows.map((row) => renderRow(row, true))
            )}
            {showColumnBases ? (
              <tr
                className={`${mergeStyles.totalRow} bg-[var(--bg-surface)] font-semibold border-t border-[var(--border-grid)] border-b border-[var(--border-grid)]`}
              >
                <td
                  className={`total-row-label px-2 ${density === 'generous' ? 'py-2.5' : 'py-1.5'} text-[var(--text-secondary)] font-body text-xs font-bold uppercase tracking-wide`}
                >
                  Total
                </td>
                {colSpacer(colLeftPadding, false)}
                {visibleColKeys.map((col) => (
                  <td
                    key={col}
                    className={`total-row-cell px-2 ${density === 'generous' ? 'py-2.5' : 'py-1.5'} text-right align-middle data-cell`}
                  >
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
                {colSpacer(colRightPadding, false)}
                {tableData.colKeys.length > 1 && (
                  <td
                    className={`total-row-cell px-2 ${density === 'generous' ? 'py-2.5' : 'py-1.5'} text-right align-middle data-cell bg-[var(--bg-active)]/30`}
                  >
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
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Drag ghost */}
      {dragState.isDragging && dragState.draggedItem && (
        <div className={mergeStyles.mergeGhost} style={{ left: dragState.currentX, top: dragState.currentY }}>
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
      {rowContextMenu &&
        (() => {
          const transform = transformLog.find((t) => t.newColId === rowContextMenu.variableId);
          const isGrouped =
            transform?.config.mode === 'categorical' &&
            transform.config.mappings &&
            Object.values(transform.config.mappings).filter((v) => v === rowContextMenu.rowLabel).length > 1;
          const options = [
            {
              label: 'Delete group variable',
              onClick: async () => {
                setRowContextMenu(null);
                await deleteGroupedVariable(rowContextMenu.variableId);
              },
              danger: true as const,
            },
            ...(isGrouped
              ? [
                  {
                    label: `Split "${rowContextMenu.rowLabel}" back to original values`,
                    onClick: async () => {
                      setRowContextMenu(null);
                      await splitGroupValue(rowContextMenu.variableId, rowContextMenu.rowLabel);
                    },
                  },
                ]
              : []),
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
