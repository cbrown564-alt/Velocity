import { useState, useEffect, useCallback } from 'react';
import { ChartDataPoint } from '../../../types/processedData';
import { MergeEvent } from '../../../types/charts';

export interface DragState {
  isDragging: boolean;
  draggedItem: ChartDataPoint | null;
  dropTarget: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface UseChartDragMergeProps {
  enabled: boolean;
  onMerge?: (event: MergeEvent) => void;
  chartData: ChartDataPoint[];
  selectedKeys?: Set<string>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  margin: { top: number; left: number };
  /**
   * Callback to determine which item is under the cursor.
   * x and y are relative to the chart area (inside margins).
   */
  getDropTarget: (x: number, y: number) => string | null;
}

export const useChartDragMerge = ({
  enabled,
  onMerge,
  chartData,
  selectedKeys,
  svgRef,
  margin,
  getDropTarget,
}: UseChartDragMergeProps) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItem: null,
    dropTarget: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const handleDragStart = useCallback(
    (item: ChartDataPoint, event: React.MouseEvent) => {
      if (!enabled || !onMerge) return;
      event.preventDefault();

      setDragState({
        isDragging: true,
        draggedItem: item,
        dropTarget: null,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
      });
    },
    [enabled, onMerge],
  );

  useEffect(() => {
    if (!dragState.isDragging || !svgRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      // Calculate coordinates relative to the chart area (inside margins)
      const relativeX = e.clientX - svgRect.left - margin.left;
      const relativeY = e.clientY - svgRect.top - margin.top;

      const targetLabel = getDropTarget(relativeX, relativeY);

      // Don't target the same bar being dragged
      const validTarget = targetLabel !== dragState.draggedItem?.label ? targetLabel : null;

      setDragState((prev) => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
        dropTarget: validTarget,
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragState.dropTarget && dragState.draggedItem && onMerge) {
        const targetItem = chartData.find((d) => d.label === dragState.dropTarget);
        if (targetItem) {
          // Get all selected items (or just the dragged one if nothing selected)
          const sourceItems = selectedKeys?.has(dragState.draggedItem.label)
            ? chartData.filter((d) => selectedKeys.has(d.label))
            : [dragState.draggedItem];

          // Remove the target from sources if it's there
          const filteredSources = sourceItems.filter((s) => s.label !== targetItem.label);

          if (filteredSources.length > 0) {
            onMerge({
              sourceItems: filteredSources,
              targetItem,
            });
          }
        }
      }

      setDragState({
        isDragging: false,
        draggedItem: null,
        dropTarget: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      });
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
    chartData,
    margin,
    getDropTarget,
    selectedKeys,
    onMerge,
    svgRef,
  ]);

  return {
    dragState,
    handleDragStart,
  };
};
