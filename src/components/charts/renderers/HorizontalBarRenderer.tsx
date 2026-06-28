import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3-scale';
import { getBarEntranceMotionProps } from '../../../lib/chartBarEntrance';
import { select, pointer } from 'd3-selection';
import { brushY } from 'd3-brush';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { ChartDataPoint } from '../../../types/processedData';
import { useChartDragMerge } from '../hooks/useChartDragMerge';
import { useChartSelection } from '../hooks/useChartSelection';
import { ChartPlotArea } from '../shared/ChartPlotArea';

/**
 * Horizontal Bar Chart Renderer
 * Used for single-variable frequency distributions.
 * Data comes pre-sorted and with labels resolved via processedData.
 * Supports Visual ETL: drag-to-merge bars.
 */
export const HorizontalBarRenderer: React.FC<BaseChartRendererProps> = ({
  width,
  height,
  colors,
  processedData,
  interactive = true,
  selectedKeys,
  onSelectionChange,
  onContextMenu,
  onMerge,
  labelMode = 'count',
  hoveredKey,
  onHoverChange,
  animateBarEntrance = false,
}) => {
  const BarRect = animateBarEntrance ? motion.rect : 'rect';
  const brushRef = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Keep a ref to selectedKeys so the D3 brush contextmenu handler can read
  // the current selection without needing it in the brush effect's dep array.
  const selectedKeysRef = useRef(selectedKeys);
  useEffect(() => {
    selectedKeysRef.current = selectedKeys;
  }, [selectedKeys]);

  // Use the first series (single column analysis) or "Total" column
  const chartData = useMemo(() => {
    const series = processedData.series[0];
    return series?.data || [];
  }, [processedData.series]);

  // Dynamic margin based on label length
  const maxLabelLength = Math.max(...chartData.map((d) => (d.label || '').length), 10);
  const leftMargin = Math.min(Math.max(maxLabelLength * 7, 100), 240); // Slightly wider for mono font

  const margin = { top: 24, right: 60, bottom: 24, left: leftMargin };
  const innerWidth = Math.max(width - margin.left - margin.right, 100);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 100);

  // Calculate bar height with min/max constraints
  const barHeight = Math.min(Math.max(innerHeight / chartData.length - 8, 20), 40);
  const actualHeight = (barHeight + 8) * chartData.length;

  // Scales
  const yScale = useMemo(() => {
    return d3
      .scaleBand()
      .domain(chartData.map((d) => d.label))
      .range([0, actualHeight])
      .padding(0.25);
  }, [chartData, actualHeight]);

  const xScale = useMemo(() => {
    const maxVal = max(chartData, (d) => d.value) || 1;
    return d3
      .scaleLinear()
      .domain([0, maxVal * 1.1]) // Add 10% padding
      .range([0, innerWidth]);
  }, [chartData, innerWidth]);

  const { handleToggle, handleItemContextMenu } = useChartSelection<ChartDataPoint>({
    interactive,
    selectedKeys,
    onSelectionChange,
    onContextMenu,
  });

  // Drag-to-Merge Logic
  const getDropTarget = useCallback(
    (x: number, y: number) => {
      for (const item of chartData) {
        const barY = yScale(item.label) || 0;
        const barHeight = yScale.bandwidth();
        if (y >= barY && y <= barY + barHeight) {
          return item.label;
        }
      }
      return null;
    },
    [chartData, yScale],
  );

  const { dragState, handleDragStart } = useChartDragMerge({
    enabled: !!(interactive && onMerge),
    onMerge,
    chartData,
    selectedKeys,
    svgRef: svgRef as React.RefObject<SVGSVGElement | null>,
    margin,
    getDropTarget,
  });

  // D3 Brush Implementation
  useEffect(() => {
    if (!brushRef.current || !interactive || !onSelectionChange) return;

    const brush = brushY()
      .extent([
        [0, 0],
        [innerWidth, actualHeight],
      ]) // Limit brush to data area
      .on('end', (event) => {
        if (!event.selection) return;

        const [y0, y1] = event.selection;
        // Find bars intersecting the selection
        const selected = chartData.filter((d) => {
          const y = yScale(d.label) || 0;
          const h = yScale.bandwidth();
          // Select if center of bar is in selection, or substantial overlap
          // Simple overlap:
          return y + h > y0 && y < y1;
        });

        onSelectionChange(new Set(selected.map((d) => d.label)));

        // Clear brush visual
        select(brushRef.current).call(brush.move as any, null);
      });

    const brushGroup = select(brushRef.current);
    brushGroup.call(brush as any);

    // The brush overlay captures all pointer events, so React's onMouseEnter
    // on bars never fires. Track hover and right-click here via the brush group.
    brushGroup
      .on('mousemove.hover', (event) => {
        if (!onHoverChange) return;
        const [, mouseY] = pointer(event);
        const hovered = chartData.find((d) => {
          const y = yScale(d.label) || 0;
          return mouseY >= y && mouseY < y + yScale.bandwidth();
        });
        onHoverChange(hovered ? (hovered.code !== undefined ? String(hovered.code) : hovered.label) : null);
      })
      .on('mouseleave.hover', () => {
        if (onHoverChange) onHoverChange(null);
      })
      .on('contextmenu.context', (event) => {
        if (!onContextMenu) return;
        event.preventDefault();
        const [, mouseY] = pointer(event);
        const hovered = chartData.find((d) => {
          const y = yScale(d.label) || 0;
          return mouseY >= y && mouseY < y + yScale.bandwidth();
        });
        // If right-clicking on a selected bar, include all selected items.
        // Otherwise use just the bar under cursor.
        const currentSelection = selectedKeysRef.current;
        const selectedItems =
          hovered && currentSelection?.has(hovered.label)
            ? chartData.filter((item) => currentSelection?.has(item.label))
            : hovered
              ? [hovered]
              : chartData.filter((item) => currentSelection?.has(item.label));
        if (selectedItems.length === 0) return;
        onContextMenu({
          selected: selectedItems,
          position: { x: event.clientX, y: event.clientY },
        });
      });

    return () => {
      brushGroup.on('.brush', null);
      brushGroup.on('.hover', null);
      brushGroup.on('.context', null);
    };
  }, [innerWidth, actualHeight, interactive, onSelectionChange, chartData, yScale, onHoverChange, onContextMenu]);

  // X-axis ticks
  const xTicks = xScale.ticks(5);

  return (
    <div style={{ width, height, overflowY: 'auto', overflowX: 'hidden' }}>
      <svg
        ref={svgRef}
        width={width}
        height={Math.max(height, actualHeight + margin.top + margin.bottom)}
        style={{
          display: 'block',
          overflow: 'visible',
          fontFamily: 'var(--font-mono)', // Changed to Mono for data precision
          cursor: dragState.isDragging ? 'grabbing' : 'default',
        }}
      >
        <ChartPlotArea margin={margin}>
          {/* Grid lines */}
          {xTicks.map((tick) => (
            <line
              key={tick}
              x1={xScale(tick)}
              y1={0}
              x2={xScale(tick)}
              y2={actualHeight}
              stroke="var(--viz-grid-line)"
              strokeDasharray="2,2" // Dashed for subtlety in dark mode
            />
          ))}

          <g transform={`translate(0,${actualHeight})`}>
            <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="var(--viz-stroke-main)" />
            {xTicks.map((tick) => (
              <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                <line y2={4} stroke="var(--viz-stroke-main)" />
                <text
                  y={16}
                  textAnchor="middle"
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)', // Mono
                    fill: 'var(--viz-text-axis)',
                  }}
                >
                  {tick}
                </text>
              </g>
            ))}
          </g>

          {/* Y Axis Labels */}
          {chartData.map((d) => (
            <text
              key={d.label}
              x={-12}
              y={(yScale(d.label) || 0) + yScale.bandwidth() / 2}
              dy=".35em"
              textAnchor="end"
              className="text-xs"
              style={{
                fontFamily: 'var(--font-body)', // Keep labels as Sans for readability
                fontWeight: selectedKeys?.has(d.label) ? 600 : 400,
                fill: selectedKeys?.has(d.label) ? 'var(--text-primary)' : 'var(--viz-text-axis)',
              }}
            >
              {(d.label || '').length > 35 ? (d.label || '').substring(0, 32) + '...' : d.label}
            </text>
          ))}

          {/* Bars */}
          {chartData.map((d, i) => {
            const barWidth = xScale(d.value);
            const y = yScale(d.label) || 0;
            const isSelected = selectedKeys?.has(d.label);
            const isDragging = dragState.isDragging && dragState.draggedItem?.label === d.label;
            const isDropTarget = dragState.isDragging && dragState.dropTarget === d.label;
            const entranceProps = getBarEntranceMotionProps('horizontal', i, animateBarEntrance);

            // Determine bar color based on state
            // Single color for all bars in this chart type

            return (
              <g
                key={d.label}
                onClick={(e) => {
                  if (!dragState.isDragging) {
                    e.stopPropagation();
                    handleToggle(d.label, e);
                  }
                }}
                onContextMenu={(e) => handleItemContextMenu(d, chartData, e)}
                onMouseEnter={() => onHoverChange && onHoverChange(d.code !== undefined ? String(d.code) : d.label)}
                onMouseLeave={() => onHoverChange && onHoverChange(null)}
                onMouseDown={(e) => {
                  // Only start drag with left button
                  if (e.button === 0 && onMerge) {
                    handleDragStart(d, e);
                  }
                }}
                style={{
                  opacity: isDragging ? 0.5 : 1,
                  transform: isDropTarget ? 'scale(1.02)' : 'scale(1)',
                  transformOrigin: 'left center',
                }}
              >
                {/* Drop target highlight */}
                {isDropTarget && (
                  <rect
                    y={y - 4}
                    height={yScale.bandwidth() + 8}
                    width={innerWidth + 8}
                    x={-4}
                    fill="none"
                    stroke="var(--status-success-text)" // Mint Green
                    strokeWidth={2}
                    strokeDasharray="4,2"
                    rx={4}
                  />
                )}

                {/* Actual bar: Transparent Fill + Solid Stroke */}
                <BarRect
                  y={y}
                  height={yScale.bandwidth()}
                  width={barWidth}
                  fill={
                    isDropTarget
                      ? 'var(--status-success-bg)'
                      : d.isMissing
                        ? 'var(--bg-active)'
                        : colors
                          ? colors[0]
                          : 'var(--viz-fill-secondary)'
                  }
                  fillOpacity={
                    hoveredKey === (d.code !== undefined ? String(d.code) : d.label)
                      ? 1
                      : hoveredKey
                        ? 0.3
                        : d.isMissing
                          ? 0.3
                          : 0.8
                  }
                  stroke={
                    isSelected
                      ? 'var(--text-accent)'
                      : hoveredKey === (d.code !== undefined ? String(d.code) : d.label)
                        ? 'var(--viz-fill-primary)'
                        : d.isMissing
                          ? 'var(--text-tertiary)'
                          : 'none'
                  }
                  strokeWidth={
                    isSelected || hoveredKey === (d.code !== undefined ? String(d.code) : d.label) || d.isMissing
                      ? 2
                      : 0
                  }
                  strokeDasharray={d.isMissing ? '4,2' : 'none'}
                  rx={1}
                  className="hover:opacity-90"
                  initial={entranceProps.initial}
                  animate={entranceProps.animate}
                  transition={entranceProps.transition}
                  style={{
                    transformOrigin: entranceProps.style?.transformOrigin,
                    transformBox: entranceProps.style?.transformBox,
                    transition: dragState.isDragging ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: onMerge ? 'grab' : interactive ? 'pointer' : 'default',
                  }}
                />

                {/* Label Logic */}
                {labelMode !== 'none' && (
                  <text
                    x={barWidth + 8}
                    y={y + yScale.bandwidth() / 2}
                    dy=".35em"
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)', // Data numbers = Mono
                      fill: isSelected ? 'var(--text-primary)' : 'var(--viz-text-value)',
                    }}
                  >
                    {labelMode === 'percent' ? `${d.percent.toFixed(1)}%` : d.value.toLocaleString()}
                  </text>
                )}
              </g>
            );
          })}

          {/* Drag ghost indicator */}
          {dragState.isDragging && dragState.draggedItem && (
            <g
              style={{
                pointerEvents: 'none',
                opacity: 0.8,
              }}
            >
              <rect
                x={0}
                y={
                  dragState.currentY -
                  (svgRef.current?.getBoundingClientRect().top || 0) -
                  margin.top -
                  yScale.bandwidth() / 2
                }
                width={xScale(dragState.draggedItem.value)}
                height={yScale.bandwidth()}
                fill="var(--viz-fill-secondary)" // Solid Cyan for dragging
                rx={3}
                stroke="var(--border-color-active)"
                strokeWidth={2}
              />
              <text
                x={xScale(dragState.draggedItem.value) / 2}
                y={dragState.currentY - (svgRef.current?.getBoundingClientRect().top || 0) - margin.top}
                textAnchor="middle"
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  fill: 'white',
                }}
              >
                {dragState.dropTarget ? 'Merge into this category' : 'Drag to another bar to merge'}
              </text>
            </g>
          )}

          {/* Brush Loop Overlay */}
          <g ref={brushRef} className="brush" />

          {/* Baseline */}
          <line x1={0} y1={0} x2={0} y2={actualHeight} stroke="var(--viz-stroke-main)" />
        </ChartPlotArea>
      </svg>
    </div>
  );
};
