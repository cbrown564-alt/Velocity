import React, { useMemo, useCallback, useRef } from 'react';
import * as d3 from 'd3-scale';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
// getChartColor removed
import { ChartDataPoint } from '../../../types/processedData';
import { useChartDragMerge } from '../hooks/useChartDragMerge';

/**
 * Vertical Bar (Column) Chart Renderer
 * Displays single-variable distributions as vertical columns.
 */
export const VerticalBarRenderer: React.FC<BaseChartRendererProps> = ({
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
}) => {
    const svgRef = useRef<SVGSVGElement>(null);

    // Use the first series (single column analysis) or "Total" column
    const series = processedData.series[0];
    const chartData = series?.data || [];

    // Margins
    const margin = { top: 40, right: 20, bottom: 60, left: 60 };
    const innerWidth = Math.max(width - margin.left - margin.right, 100);
    const innerHeight = Math.max(height - margin.top - margin.bottom, 100);

    // Scales
    const xScale = useMemo(() => {
        return d3.scaleBand()
            .domain(chartData.map(d => d.label))
            .range([0, innerWidth])
            .padding(0.25);
    }, [chartData, innerWidth]);

    const yScale = useMemo(() => {
        const maxVal = max(chartData, d => d.value) || 1;
        return d3.scaleLinear()
            .domain([0, maxVal * 1.1]) // Add 10% padding
            .range([innerHeight, 0]);
    }, [chartData, innerHeight]);

    // Handle interactions
    const handleBarClick = useCallback((d: any, event: React.MouseEvent) => {
        if (!interactive || !onSelectionChange) return;

        const newSelection = new Set(selectedKeys);
        if (event.metaKey || event.ctrlKey) {
            if (newSelection.has(d.label)) {
                newSelection.delete(d.label);
            } else {
                newSelection.add(d.label);
            }
        } else {
            newSelection.clear();
            newSelection.add(d.label);
        }
        onSelectionChange(newSelection);
    }, [interactive, onSelectionChange, selectedKeys]);


    const handleContextMenu = useCallback((d: any, event: React.MouseEvent) => {
        if (!interactive || !onContextMenu) return;
        event.preventDefault();
        event.stopPropagation();

        const isCurrentlySelected = selectedKeys?.has(d.label);
        const selectedItems = isCurrentlySelected
            ? chartData.filter(item => selectedKeys?.has(item.label))
            : [d];

        onContextMenu({
            selected: selectedItems,
            position: { x: event.clientX, y: event.clientY },
        });
    }, [interactive, onContextMenu, selectedKeys, chartData]);

    // Drag-to-merge Logic
    const getDropTarget = useCallback((x: number, y: number) => {
        for (const item of chartData) {
            const barX = xScale(item.label) || 0;
            const barWidth = xScale.bandwidth();
            // Check if X is within the bar's band (vertical column)
            if (x >= barX && x <= barX + barWidth) {
                return item.label;
            }
        }
        return null;
    }, [chartData, xScale]);

    const { dragState, handleDragStart } = useChartDragMerge({
        enabled: !!(interactive && onMerge),
        onMerge,
        chartData,
        selectedKeys,
        svgRef: svgRef as React.RefObject<SVGSVGElement | null>,
        margin,
        getDropTarget,
    });

    // Y-axis ticks
    const yTicks = yScale.ticks(5);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{
                overflow: 'visible',
                fontFamily: 'var(--font-mono)',
                cursor: dragState.isDragging ? 'grabbing' : 'default',
            }}
        >
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Grid lines (Horizontal) */}
                {yTicks.map(tick => (
                    <line
                        key={tick}
                        x1={0}
                        y1={yScale(tick)}
                        x2={innerWidth}
                        y2={yScale(tick)}
                        stroke="var(--viz-grid-line)"
                        strokeDasharray="2,2"
                    />
                ))}

                {/* Y-axis Labels */}
                <g transform="translate(-10, 0)">
                    {yTicks.map(tick => (
                        <text
                            key={tick}
                            x={0}
                            y={yScale(tick)}
                            dy=".32em"
                            textAnchor="end"
                            style={{ fontSize: '10px', fill: 'var(--viz-text-axis)' }}
                        >
                            {tick.toLocaleString()}
                        </text>
                    ))}
                </g>

                {/* X-axis Labels */}
                {chartData.map((d) => (
                    <foreignObject
                        key={d.label}
                        x={xScale(d.label)}
                        y={innerHeight + 8}
                        width={xScale.bandwidth()}
                        height={50}
                        style={{ overflow: 'visible' }}
                    >
                        <div
                            style={{
                                fontSize: '11px',
                                color: selectedKeys?.has(d.label) ? 'var(--text-primary)' : 'var(--viz-text-axis)',
                                fontWeight: selectedKeys?.has(d.label) ? 600 : 400,
                                fontFamily: 'var(--font-body)', // Categories = Sans
                                textAlign: 'center',
                                lineHeight: '1.2',
                                maxHeight: '48px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                            }}
                            title={d.label}
                        >
                            {d.label}
                        </div>
                    </foreignObject>
                ))}

                {/* Columns */}
                {chartData.map((d, i) => {
                    const barHeight = innerHeight - yScale(d.value);
                    const isSelected = selectedKeys?.has(d.label);
                    const isDragging = dragState.isDragging && dragState.draggedItem?.label === d.label;
                    const isDropTarget = dragState.isDragging && dragState.dropTarget === d.label;


                    return (
                        <g
                            key={d.label}
                            onClick={(e) => {
                                if (!dragState.isDragging) {
                                    handleBarClick(d, e);
                                }
                            }}
                            onContextMenu={(e) => handleContextMenu(d, e)}
                            onMouseDown={(e) => {
                                if (e.button === 0 && onMerge) {
                                    handleDragStart(d, e);
                                }
                            }}
                            style={{
                                opacity: isDragging ? 0.5 : 1,
                                transform: isDropTarget ? 'scale(1.02)' : 'scale(1)',
                                transformOrigin: 'center bottom', // Scale from bottom for columns
                                cursor: onMerge ? 'grab' : (interactive ? 'pointer' : 'default'),
                            }}
                        >
                            {/* Drop target highlight */}
                            {isDropTarget && (
                                <rect
                                    x={(xScale(d.label) || 0) - 4}
                                    y={yScale(d.value) - 4}
                                    width={xScale.bandwidth() + 8}
                                    height={barHeight + 8}
                                    fill="none"
                                    stroke="var(--status-success-text)" // Mint Green
                                    strokeWidth={2}
                                    strokeDasharray="4,2"
                                    rx={4}
                                />
                            )}

                            <rect
                                x={xScale(d.label)}
                                y={yScale(d.value)}
                                width={xScale.bandwidth()}
                                height={barHeight}
                                // Use palette colors if available, otherwise fall back to primary
                                fill={isDropTarget ? 'var(--status-success-bg)' : (colors ? colors[0] : 'var(--viz-fill-secondary)')}
                                fillOpacity={0.8}
                                stroke={isSelected ? 'var(--text-accent)' : 'none'}
                                strokeWidth={isSelected ? 2 : 0}
                                rx={1}
                                className="hover:opacity-90 chart-bar-rect"
                                style={{ transition: dragState.isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                            />

                            {/* Labels */}
                            {labelMode !== 'none' && (
                                <text
                                    x={(xScale(d.label) || 0) + xScale.bandwidth() / 2}
                                    y={yScale(d.value) - 6}
                                    textAnchor="middle"
                                    style={{
                                        fontSize: '11px',
                                        fill: isSelected ? 'var(--text-primary)' : 'var(--viz-text-value)',
                                        fontWeight: 500,
                                        fontFamily: 'var(--font-mono)'
                                    }}
                                >
                                    {labelMode === 'percent'
                                        ? `${d.percent.toFixed(1)}%`
                                        : d.value.toLocaleString()
                                    }
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
                            x={dragState.currentX - (svgRef.current?.getBoundingClientRect().left || 0) - margin.left - xScale.bandwidth() / 2}
                            y={yScale(dragState.draggedItem.value)}
                            width={xScale.bandwidth()}
                            height={innerHeight - yScale(dragState.draggedItem.value)}
                            fill="var(--viz-fill-secondary)"
                            rx={3}
                            stroke="var(--border-color-active)"
                            strokeWidth={2}
                        />
                        <text
                            x={dragState.currentX - (svgRef.current?.getBoundingClientRect().left || 0) - margin.left}
                            y={Math.min(yScale(dragState.draggedItem.value) - 10, innerHeight - 20) /* Ensure validation msg stays on screen */}
                            textAnchor="middle"
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                fill: 'var(--text-primary)',
                                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                            }}
                        >
                            {dragState.dropTarget ? 'Merge' : 'Drag to merge'}
                        </text>
                    </g>
                )}

                {/* Baseline */}
                <line
                    x1={0}
                    y1={innerHeight}
                    x2={innerWidth}
                    y2={innerHeight}
                    stroke="var(--viz-stroke-main)"
                />
            </g>
        </svg>
    );
};
