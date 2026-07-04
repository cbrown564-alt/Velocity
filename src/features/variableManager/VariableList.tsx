/**
 * Dense virtualized variable list for the two-pane Variable Manager.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff } from 'lucide-react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { useVelocityStore } from '../../store';
import type { Dataset, VariableSet } from '../../types/dataset';
import type { VariableStatsResult } from '../../types/worker';
import { VariableTypeIcon } from '../../components/common/VariableTypeIcon';
import { filterVariableSets } from './variableSetFilters';
import { getVariableRowDisplay } from './variableRowMeta';
import listStyles from './VariableList.module.css';

const ROW_HEIGHT = 32;
const OVERSCAN_COUNT = 8;

interface VariableRowItemProps {
  variableSet: VariableSet;
  display: ReturnType<typeof getVariableRowDisplay>;
  isActive: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onHover: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const VariableRowItem: React.FC<VariableRowItemProps> = ({
  variableSet,
  display,
  isActive,
  isSelected,
  onClick,
  onHover,
  onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: variableSet.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 250 : undefined,
  };

  const rowClass = [
    listStyles.row,
    isActive ? listStyles.rowActive : '',
    isSelected && !isActive ? listStyles.rowSelected : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      data-variable-set-id={variableSet.id}
      className={rowClass}
      onClick={onClick}
      onMouseEnter={onHover}
      onContextMenu={onContextMenu}
      role="option"
      aria-selected={isActive}
    >
      <span className={listStyles.glyph}>
        <VariableTypeIcon
          type={variableSet.type}
          structure={variableSet.structure as 'single' | 'multiple' | 'grid'}
          size={14}
        />
      </span>
      <span className={listStyles.monoName} title={display.monoName}>
        {display.monoName}
        {variableSet.hidden && <EyeOff size={11} className={listStyles.hiddenIcon} aria-label="Hidden" />}
      </span>
      <span className={listStyles.label} title={display.label}>
        {display.label}
      </span>
      {display.meta && (
        <span className={listStyles.meta} title={display.meta}>
          {display.meta}
        </span>
      )}
    </div>
  );
};

type VariableListRowProps = {
  filteredSets: VariableSet[];
  dataset: Dataset | null;
  selectedVariableSetId: string | null;
  selectedVariableSetIds: string[];
  getStatsForSet: (vs: VariableSet) => VariableStatsResult | null | undefined;
  onClickSet: (vs: VariableSet, e: React.MouseEvent) => void;
  onHoverSet: (vs: VariableSet) => void;
  onContextMenuSet: (vs: VariableSet, e: React.MouseEvent) => void;
};

const VariableListRow = ({
  index,
  style,
  filteredSets,
  dataset,
  selectedVariableSetId,
  selectedVariableSetIds,
  getStatsForSet,
  onClickSet,
  onHoverSet,
  onContextMenuSet,
}: RowComponentProps<VariableListRowProps>): React.ReactElement => {
  const vs = filteredSets[index];
  if (!vs) return <></>;

  const stats = getStatsForSet(vs);
  const display = getVariableRowDisplay(vs, dataset, stats);

  return (
    <div style={style}>
      <VariableRowItem
        variableSet={vs}
        display={display}
        isActive={selectedVariableSetId === vs.id}
        isSelected={selectedVariableSetIds.includes(vs.id)}
        onClick={(e) => onClickSet(vs, e)}
        onHover={() => onHoverSet(vs)}
        onContextMenu={(e) => onContextMenuSet(vs, e)}
      />
    </div>
  );
};

export const VariableList: React.FC = () => {
  const dataset = useVelocityStore((state) => state.dataset);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const activeFolderId = useVelocityStore((state) => state.activeFolderId);
  const managerSearchQuery = useVelocityStore((state) => state.managerSearchQuery);
  const selectedVariableSetId = useVelocityStore((state) => state.selectedVariableSetId);
  const selectedVariableSetIds = useVelocityStore((state) => state.selectedVariableSetIds);
  const setSelectedVariableSetId = useVelocityStore((state) => state.setSelectedVariableSetId);
  const setSelectedVariableId = useVelocityStore((state) => state.setSelectedVariableId);
  const toggleVariableSetSelection = useVelocityStore((state) => state.toggleVariableSetSelection);
  const selectVariableSetRange = useVelocityStore((state) => state.selectVariableSetRange);
  const selectSingleVariableSet = useVelocityStore((state) => state.selectSingleVariableSet);
  const getVariableStats = useVelocityStore((state) => state.getVariableStats);
  const variableStats = useVelocityStore((state) => state.variableStats);
  const facetFilters = useVelocityStore((state) => state.facetFilters);
  const convertMultipleToGrid = useVelocityStore((state) => state.convertMultipleToGrid);
  const setHoveredVariableSetId = useVelocityStore((state) => state.setHoveredVariableSetId);

  const listRef = useListRef(null);

  const filteredSets = useMemo(
    () =>
      filterVariableSets(variableSets, {
        dataset,
        activeFolderId,
        searchQuery: managerSearchQuery,
        facetFilters,
        variableStats,
      }),
    [variableSets, dataset, activeFolderId, managerSearchQuery, facetFilters, variableStats],
  );

  const filteredIds = useMemo(() => filteredSets.map((vs) => vs.id), [filteredSets]);

  useEffect(() => {
    if (!selectedVariableSetId || !dataset) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const index = filteredSets.findIndex((vs) => vs.id === selectedVariableSetId);
        if (index >= 0) {
          listRef.current?.scrollToRow({ index, align: 'auto', behavior: 'smooth' });
        }
      });
    });
  }, [selectedVariableSetId, dataset, filteredSets, listRef]);

  const getStatsForSet = useCallback(
    (variableSet: VariableSet): VariableStatsResult | null | undefined => {
      if (variableSet.variableIds.length !== 1) return undefined;
      return variableStats[variableSet.variableIds[0]] ?? null;
    },
    [variableStats],
  );

  const handleHover = useCallback(
    (variableSet: VariableSet) => {
      setHoveredVariableSetId(variableSet.id);
      if (variableSet.variableIds.length === 1) {
        const variableId = variableSet.variableIds[0];
        if (!variableStats[variableId]) {
          getVariableStats(variableId).catch(() => {});
        }
      }
    },
    [getVariableStats, setHoveredVariableSetId, variableStats],
  );

  const handleRowsRendered = useCallback(
    ({ startIndex, stopIndex }: { startIndex: number; stopIndex: number }) => {
      for (let i = startIndex; i <= stopIndex; i++) {
        const vs = filteredSets[i];
        if (vs?.variableIds.length === 1) {
          const variableId = vs.variableIds[0];
          if (!variableStats[variableId]) {
            getVariableStats(variableId).catch(() => {});
          }
        }
      }
    },
    [filteredSets, variableStats, getVariableStats],
  );

  const selectVariableForSet = useCallback(
    (variableSet: VariableSet) => {
      if (variableSet.variableIds.length > 0) {
        setSelectedVariableId(variableSet.variableIds[0]);
      } else {
        setSelectedVariableId(null);
      }
    },
    [setSelectedVariableId],
  );

  const handleClick = useCallback(
    (variableSet: VariableSet, e: React.MouseEvent) => {
      if (e.shiftKey) {
        selectVariableSetRange(variableSet.id, filteredIds);
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        toggleVariableSetSelection(variableSet.id, true);
        return;
      }

      setSelectedVariableSetId(variableSet.id);
      selectSingleVariableSet(variableSet.id);
      selectVariableForSet(variableSet);
    },
    [
      selectVariableSetRange,
      filteredIds,
      toggleVariableSetSelection,
      setSelectedVariableSetId,
      selectSingleVariableSet,
      selectVariableForSet,
    ],
  );

  const handleContextMenu = useCallback(
    (variableSet: VariableSet, e: React.MouseEvent) => {
      e.preventDefault();

      if (variableSet.structure === 'multiple') {
        const confirmed = window.confirm(
          `Convert "${variableSet.name}" to a grid to show all response values?\n\n` +
            `This will change from showing only "${variableSet.countedValue ? 'selected' : 'positive'}" responses to showing all response options.`,
        );
        if (confirmed) {
          convertMultipleToGrid(variableSet.id);
        }
      }
    },
    [convertMultipleToGrid],
  );

  const rowProps = useMemo<VariableListRowProps>(
    () => ({
      filteredSets,
      dataset,
      selectedVariableSetId: selectedVariableSetId ?? null,
      selectedVariableSetIds,
      getStatsForSet,
      onClickSet: handleClick,
      onHoverSet: handleHover,
      onContextMenuSet: handleContextMenu,
    }),
    [
      filteredSets,
      dataset,
      selectedVariableSetId,
      selectedVariableSetIds,
      getStatsForSet,
      handleClick,
      handleHover,
      handleContextMenu,
    ],
  );

  if (!dataset) {
    return <div className={listStyles.emptyState}>No data loaded</div>;
  }

  if (filteredSets.length === 0) {
    return (
      <div className={listStyles.emptyState}>
        {managerSearchQuery ? 'No matching variables' : 'No variables in this folder'}
      </div>
    );
  }

  return (
    <List
      listRef={listRef}
      rowCount={filteredSets.length}
      rowHeight={ROW_HEIGHT}
      overscanCount={OVERSCAN_COUNT}
      onRowsRendered={handleRowsRendered}
      rowComponent={VariableListRow}
      rowProps={rowProps}
      style={{ height: '100%' }}
    />
  );
};

export { ROW_HEIGHT };
