import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

import type { Variable } from '../../../types';
import type { VariableStatsResult } from '../../../types/worker';
import type { DataTransform } from '../../../types/dataset';
import { RowPathEntry, TableRowNode } from '../../../core/analysis/treeBuilder';
import { Tooltip } from '../../../components/common/Tooltip';
import { StatisticsTooltip } from '../../../components/common/StatisticsTooltip';
import { TableDragItem, TableDragState } from '../../../hooks/useTableDragMerge';
import { CrosstabCell } from './CrosstabCell';
import mergeStyles from './DataTable.module.css';

export interface CrosstabTableData {
  colKeys: string[];
  colLabels: Record<string, string>;
  colLetters: Record<string, string>;
  grandTotal: number;
}

export interface CrosstabRowProps {
  row: TableRowNode;
  tableData: CrosstabTableData;
  rowVariables: Variable[];
  colVariable: Variable | null;
  expandedKeys: Record<string, boolean>;
  onToggleRow: (key: string) => void;
  dragState: TableDragState;
  onDragStart: (item: TableDragItem, event: React.MouseEvent) => void;
  selectedRows: Set<string>;
  onToggleRowSelection: (rawValue: string) => void;
  hoveredCol: string | null;
  onHoverCol: (col: string | null) => void;
  onCellClick?: (rowPath: RowPathEntry[], colValue: string | null) => void;
  density: 'compact' | 'generous';
  animationKey: string | undefined;
  reducedMotion: boolean;
  haloClass: (sig?: string | null) => string;
  variableStats?: VariableStatsResult | null;
  transformLog: DataTransform[];
  onRowContextMenu: (params: { variableId: string; rowLabel: string; x: number; y: number }) => void;
  /**
   * When false, the component renders only its own `<tr>` and not its child
   * rows. Used by the virtualized table path, where the row tree is flattened
   * upstream and each visible row is rendered independently. Defaults to true
   * (recursive rendering) for the non-virtualized path.
   */
  renderChildren?: boolean;
  /**
   * Column (horizontal) virtualization (Phase 4 Task 3). When columns are
   * windowed, `visibleColKeys` is the on-screen slice of `tableData.colKeys`
   * and `colLeftPadding` / `colRightPadding` are the px widths of the
   * off-screen columns, rendered as spacer cells. Defaults to rendering every
   * column with no spacers, so the common (non-windowed) path is unchanged.
   */
  visibleColKeys?: string[];
  colLeftPadding?: number;
  colRightPadding?: number;
}

export const CrosstabRow: React.FC<CrosstabRowProps> = ({
  row,
  tableData,
  rowVariables,
  colVariable,
  expandedKeys,
  onToggleRow,
  dragState,
  onDragStart,
  selectedRows,
  onToggleRowSelection,
  hoveredCol,
  onHoverCol,
  onCellClick,
  density,
  animationKey,
  reducedMotion,
  haloClass,
  variableStats,
  transformLog,
  onRowContextMenu,
  renderChildren = true,
  visibleColKeys,
  colLeftPadding = 0,
  colRightPadding = 0,
}) => {
  const cols = visibleColKeys ?? tableData.colKeys;
  const isExpanded = expandedKeys[row.key] ?? true;
  const hasChildren = row.children.length > 0;
  const paddingLeft = row.depth * 24 + 8;
  const rowVarId = rowVariables[row.depth]?.id ?? rowVariables[0]?.id ?? '';
  const isRowDragging =
    dragState.isDragging && dragState.draggedItem?.rawValue === row.rawValue && dragState.draggedItem?.axis === 'row';
  const isRowDropTarget = dragState.dropTarget === row.rawValue && dragState.draggedItem?.axis === 'row';
  const isRowSelected = selectedRows.has(row.rawValue);

  const rowHeaderClasses = [
    'py-1.5 font-semibold text-[var(--text-primary)] align-top text-sm font-body',
    mergeStyles.mergeHeader,
    isRowDragging ? mergeStyles.mergeDragging : '',
    isRowDropTarget ? mergeStyles.mergeDropTarget : '',
    isRowSelected ? mergeStyles.mergeSelected : '',
  ]
    .filter(Boolean)
    .join(' ');

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
            if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
            onDragStart(
              {
                label: row.label,
                rawValue: row.rawValue,
                depth: row.depth,
                variableId: rowVarId,
                axis: 'row',
              },
              e,
            );
          }}
          onClick={(e) => {
            if (!dragState.isDragging && !(e.target as HTMLElement).closest('button')) {
              onToggleRowSelection(row.rawValue);
            }
          }}
          onContextMenu={(e) => {
            const transform = transformLog.find((t) => t.newColId === rowVarId);
            if (!transform) return;
            e.preventDefault();
            onRowContextMenu({
              variableId: rowVarId,
              rowLabel: row.label,
              x: e.clientX,
              y: e.clientY,
            });
          }}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleRow(row.key);
                }}
                className="p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition-colors"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {!hasChildren && row.depth > 0 && <div className="w-4" />}
            <span className="leading-snug">{row.label}</span>
          </div>
        </td>
        {colLeftPadding > 0 && (
          <td aria-hidden style={{ width: colLeftPadding, padding: 0 }} className="border-l border-[var(--border-subtle)]" />
        )}
        {cols.map((col) => {
          const cell = row.cells[col];
          const isZero = cell.mean !== undefined ? Math.abs(cell.mean) === 0 : cell.percent === 0;

          const isSignificant = Boolean(cell.sig) || Boolean(cell.sigLetters && cell.sigLetters.length > 0);
          const hasStats = cell.stats && typeof cell.stats.effN === 'number';
          const cellValue = cell.mean !== undefined ? cell.mean : cell.percent;

          const cellContent =
            cell.mean !== undefined ? (
              <CrosstabCell
                key={`cell-${animationKey}-${row.key}-${col}`}
                variant="metric"
                isZero={isZero}
                isSignificant={isSignificant}
                mean={cell.mean}
                count={cell.count}
                validCount={cell.validCount}
                stdDev={cell.stdDev}
                sigLetters={cell.sigLetters}
                showMeanBadge
                animationTrigger={animationKey}
                reducedMotion={reducedMotion}
              />
            ) : (
              <CrosstabCell
                key={`cell-${animationKey}-${row.key}-${col}`}
                variant="frequency"
                isZero={isZero}
                isSignificant={isSignificant}
                percent={cell.percent}
                count={cell.count}
                sig={cell.sig}
                sigLetters={cell.sigLetters}
                animationTrigger={animationKey}
                reducedMotion={reducedMotion}
              />
            );

          const halo = haloClass(cell.sig || cell.sigLetters || null);
          return (
            <td
              key={col}
              className={`px-2 ${density === 'generous' ? 'py-2.5' : 'py-1'} text-right align-middle cursor-pointer relative data-cell border-l transition-colors
                ${hoveredCol === col ? 'bg-[var(--bg-surface)] border-[var(--border-color-active)]' : 'border-[var(--border-subtle)]'}
                ${halo}
              `}
              onMouseEnter={() => onHoverCol(col)}
              onMouseLeave={() => onHoverCol(null)}
              onClick={() => onCellClick?.(row.rowPath, colVariable ? col : null)}
              title={!hasStats ? 'Click to X-Ray' : undefined}
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
        {colRightPadding > 0 && (
          <td aria-hidden style={{ width: colRightPadding, padding: 0 }} className="border-l border-[var(--border-subtle)]" />
        )}
        {tableData.colKeys.length > 1 && (
          <td
            className={`px-2 ${density === 'generous' ? 'py-2.5' : 'py-1'} text-right bg-[var(--bg-active)]/30 align-middle data-cell`}
          >
            {row.mean !== undefined ? (
              <CrosstabCell
                key={`total-${animationKey}-${row.key}`}
                variant="metric"
                mean={variableStats && row.depth === 0 ? variableStats.numeric?.mean : row.mean}
                count={row.total}
                showMeanBadge
                animationTrigger={animationKey}
                reducedMotion={reducedMotion}
              />
            ) : (
              <CrosstabCell
                key={`total-${animationKey}-${row.key}`}
                variant="frequency"
                percent={(row.total / tableData.grandTotal) * 100}
                count={row.total}
                animationTrigger={animationKey}
                reducedMotion={reducedMotion}
              />
            )}
          </td>
        )}
      </tr>
      {renderChildren &&
        hasChildren &&
        isExpanded &&
        row.children.map((child) => (
          <CrosstabRow
            key={child.key}
            row={child}
            tableData={tableData}
            rowVariables={rowVariables}
            colVariable={colVariable}
            expandedKeys={expandedKeys}
            onToggleRow={onToggleRow}
            dragState={dragState}
            onDragStart={onDragStart}
            selectedRows={selectedRows}
            onToggleRowSelection={onToggleRowSelection}
            hoveredCol={hoveredCol}
            onHoverCol={onHoverCol}
            onCellClick={onCellClick}
            density={density}
            animationKey={animationKey}
            reducedMotion={reducedMotion}
            haloClass={haloClass}
            variableStats={variableStats}
            transformLog={transformLog}
            onRowContextMenu={onRowContextMenu}
            visibleColKeys={visibleColKeys}
            colLeftPadding={colLeftPadding}
            colRightPadding={colRightPadding}
          />
        ))}
    </React.Fragment>
  );
};
