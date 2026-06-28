import { useState, useEffect, useCallback, RefObject } from 'react';
import { MergeEvent } from '../types/charts';

export interface TableDragItem {
  label: string;
  rawValue: string;
  depth: number;
  variableId: string;
  axis: 'row' | 'column';
}

export interface TableDragState {
  isDragging: boolean;
  draggedItem: TableDragItem | null;
  dropTarget: string | null;
  currentX: number;
  currentY: number;
}

const INITIAL_STATE: TableDragState = {
  isDragging: false,
  draggedItem: null,
  dropTarget: null,
  currentX: 0,
  currentY: 0,
};

interface UseTableDragMergeProps {
  enabled: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onMerge?: (event: MergeEvent) => void;
  selectedRows?: Set<string>;
  selectedCols?: Set<string>;
}

/**
 * Table-specific drag-to-merge. Mirrors useChartDragMerge but targets
 * HTML table cells via data-merge-* attributes.
 */
export const useTableDragMerge = ({
  enabled,
  containerRef,
  onMerge,
  selectedRows,
  selectedCols,
}: UseTableDragMergeProps) => {
  const [dragState, setDragState] = useState<TableDragState>(INITIAL_STATE);

  const handleDragStart = useCallback(
    (item: TableDragItem, event: React.MouseEvent) => {
      if (!enabled || !onMerge) return;
      event.preventDefault();

      setDragState({
        isDragging: true,
        draggedItem: item,
        dropTarget: null,
        currentX: event.clientX,
        currentY: event.clientY,
      });
    },
    [enabled, onMerge],
  );

  useEffect(() => {
    if (!dragState.isDragging || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const mergeEl = el?.closest('[data-merge-key]') as HTMLElement | null;

      let validTarget: string | null = null;

      if (mergeEl && dragState.draggedItem) {
        const targetAxis = mergeEl.getAttribute('data-merge-axis');
        const targetDepth = mergeEl.getAttribute('data-merge-depth');
        const targetKey = mergeEl.getAttribute('data-merge-key');
        const targetVar = mergeEl.getAttribute('data-merge-var');

        // Same axis, same depth, same variable, different key
        if (
          targetAxis === dragState.draggedItem.axis &&
          targetDepth === String(dragState.draggedItem.depth) &&
          targetVar === dragState.draggedItem.variableId &&
          targetKey !== dragState.draggedItem.rawValue
        ) {
          validTarget = targetKey;
        }
      }

      setDragState((prev) => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
        dropTarget: validTarget,
      }));
    };

    const handleMouseUp = () => {
      if (dragState.dropTarget && dragState.draggedItem && onMerge) {
        const container = containerRef.current;
        if (!container) return;

        // Find target element to read its label
        const targetEl = container.querySelector(
          `[data-merge-key="${CSS.escape(dragState.dropTarget)}"][data-merge-axis="${dragState.draggedItem.axis}"]`,
        ) as HTMLElement | null;

        const targetLabel = targetEl?.getAttribute('data-merge-label') ?? dragState.dropTarget;

        // Build source items: if dragged item is selected, include all selected same-axis items
        const selected = dragState.draggedItem.axis === 'row' ? selectedRows : selectedCols;
        let sourceKeys: string[];

        if (selected?.has(dragState.draggedItem.rawValue) && selected.size > 1) {
          sourceKeys = [...selected].filter((k) => k !== dragState.dropTarget);
        } else {
          sourceKeys = [dragState.draggedItem.rawValue];
        }

        // Resolve labels for source items
        const sourceItems = sourceKeys
          .map((key) => {
            const el = container.querySelector(
              `[data-merge-key="${CSS.escape(key)}"][data-merge-axis="${dragState.draggedItem!.axis}"]`,
            ) as HTMLElement | null;
            return { label: el?.getAttribute('data-merge-label') ?? key, rawValue: key };
          })
          .filter((s) => s.rawValue !== dragState.dropTarget);

        if (sourceItems.length > 0) {
          onMerge({
            sourceItems,
            targetItem: { label: targetLabel, rawValue: dragState.dropTarget },
            variableId: dragState.draggedItem.variableId,
          });
        }
      }

      setDragState(INITIAL_STATE);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragState.isDragging,
    dragState.draggedItem,
    dragState.dropTarget,
    containerRef,
    onMerge,
    selectedRows,
    selectedCols,
  ]);

  return { dragState, handleDragStart };
};
