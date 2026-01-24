import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3-scale';
import { select } from 'd3-selection';
import { brushY } from 'd3-brush';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';
import { ChartDataPoint } from '../../../hooks/useProcessedAnalysisData';

interface DragState {
    isDragging: boolean;
    draggedItem: ChartDataPoint | null;
    dropTarget: string | null;
    startY: number;
    currentY: number;
}

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
}) => {
    const brushRef = useRef<SVGGElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Drag-to-merge state
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        draggedItem: null,
        dropTarget: null,
        startY: 0,
        currentY: 0,
    });

    // Use the first series (single column analysis) or "Total" column
    const series = processedData.series[0];
    const chartData = series?.data || [];

    // Dynamic margin based on label length
    const maxLabelLength = Math.max(...chartData.map(d => (d.label || '').length), 10);
    const leftMargin = Math.min(Math.max(maxLabelLength * 6, 80), 220); // More space for labels

    const margin = { top: 24, right: 60, bottom: 24, left: leftMargin };
    const innerWidth = Math.max(width - margin.left - margin.right, 100);
    const innerHeight = Math.max(height - margin.top - margin.bottom, 100);

    // Calculate bar height with min/max constraints
    const barHeight = Math.min(Math.max(innerHeight / chartData.length - 8, 20), 40);
    const actualHeight = (barHeight + 8) * chartData.length;

    // Scales
    const yScale = useMemo(() => {
        return d3.scaleBand()
            .domain(chartData.map(d => d.label))
            .range([0, actualHeight])
            .padding(0.25);
    }, [chartData, actualHeight]);

    const xScale = useMemo(() => {
        const maxVal = max(chartData, d => d.value) || 1;
        return d3.scaleLinear()
            .domain([0, maxVal * 1.1]) // Add 10% padding
            .range([0, innerWidth]);
    }, [chartData, innerWidth]);

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

    // Handle right-click on individual bars
    const handleBarContextMenu = useCallback((d: any, event: React.MouseEvent) => {
        if (!interactive || !onContextMenu) return;
        event.preventDefault();
        event.stopPropagation();

        // If clicking on a bar that isn't already selected, use just that bar
        // If clicking on a selected bar, use all selected items
        const isCurrentlySelected = selectedKeys?.has(d.label);
        const selectedItems = isCurrentlySelected
            ? chartData.filter(item => selectedKeys?.has(item.label))
            : [d];

        onContextMenu({
            selected: selectedItems,
            position: { x: event.clientX, y: event.clientY },
        });
    }, [interactive, onContextMenu, chartData, selectedKeys]);

    // Handle right-click on chart background (uses current selection)
    const handleBackgroundContextMenu = useCallback((event: React.MouseEvent) => {
        if (!interactive || !onContextMenu) return;
        event.preventDefault();

        const selectedItems = chartData.filter(d => selectedKeys?.has(d.label));
        if (selectedItems.length === 0) return; // Nothing selected, don't show menu

        onContextMenu({
            selected: selectedItems,
            position: { x: event.clientX, y: event.clientY },
        });
    }, [interactive, onContextMenu, chartData, selectedKeys]);

    // ==================== Drag-to-Merge Handlers ====================

    // Start dragging a bar
    const handleDragStart = useCallback((item: ChartDataPoint, event: React.MouseEvent) => {
        if (!interactive || !onMerge) return;
        event.preventDefault();

        setDragState({
            isDragging: true,
            draggedItem: item,
            dropTarget: null,
            startY: event.clientY,
            currentY: event.clientY,
        });
    }, [interactive, onMerge]);

    // Track mouse movement during drag
    useEffect(() => {
        if (!dragState.isDragging || !svgRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            const svgRect = svgRef.current?.getBoundingClientRect();
            if (!svgRect) return;

            // Calculate which bar the cursor is over
            const relativeY = e.clientY - svgRect.top - margin.top;
            let foundTarget: string | null = null;

            for (const item of chartData) {
                const barY = yScale(item.label) || 0;
                const barHeight = yScale.bandwidth();
                if (relativeY >= barY && relativeY <= barY + barHeight) {
                    // Don't target the same bar being dragged
                    if (item.label !== dragState.draggedItem?.label) {
                        foundTarget = item.label;
                    }
                    break;
                }
            }

            setDragState(prev => ({
                ...prev,
                currentY: e.clientY,
                dropTarget: foundTarget,
            }));
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (dragState.dropTarget && dragState.draggedItem && onMerge) {
                const targetItem = chartData.find(d => d.label === dragState.dropTarget);
                if (targetItem) {
                    // Get all selected items (or just the dragged one if nothing selected)
                    const sourceItems = selectedKeys?.has(dragState.draggedItem.label)
                        ? chartData.filter(d => selectedKeys.has(d.label))
                        : [dragState.draggedItem];

                    // Remove the target from sources if it's there
                    const filteredSources = sourceItems.filter(s => s.label !== targetItem.label);

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
                startY: 0,
                currentY: 0,
            });
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState.isDragging, dragState.draggedItem, dragState.dropTarget, chartData, yScale, margin.top, selectedKeys, onMerge]);


    // D3 Brush Implementation
    useEffect(() => {
        if (!brushRef.current || !interactive || !onSelectionChange) return;

        const brush = brushY()
            .extent([[0, 0], [innerWidth, actualHeight]]) // Limit brush to data area
            .on('end', (event) => {
                if (!event.selection) return;

                const [y0, y1] = event.selection;
                // Find bars intersecting the selection
                const selected = chartData.filter(d => {
                    const y = yScale(d.label) || 0;
                    const h = yScale.bandwidth();
                    // Select if center of bar is in selection, or substantial overlap
                    // Simple overlap:
                    return y + h > y0 && y < y1;
                });

                onSelectionChange(new Set(selected.map(d => d.label)));

                // Clear brush visual
                select(brushRef.current).call(brush.move as any, null);
            });

        const brushGroup = select(brushRef.current);
        brushGroup.call(brush as any);

        return () => {
            brushGroup.on('.brush', null);
        };
    }, [innerWidth, actualHeight, interactive, onSelectionChange, chartData, yScale]);


    // X-axis ticks
    const xTicks = xScale.ticks(5);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={Math.max(height, actualHeight + margin.top + margin.bottom)}
            style={{
                overflow: 'visible',
                fontFamily: 'var(--font-body)',
                cursor: dragState.isDragging ? 'grabbing' : 'default',
            }}
            onContextMenu={handleBackgroundContextMenu}
        >
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Grid lines */}
                {xTicks.map(tick => (
                    <line
                        key={tick}
                        x1={xScale(tick)}
                        y1={0}
                        x2={xScale(tick)}
                        y2={actualHeight}
                        stroke="var(--gray-100)"
                        strokeDasharray="0"
                    />
                ))}

                {/* X-axis */}
                <g transform={`translate(0,${actualHeight})`}>
                    <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="var(--gray-200)" />
                    {xTicks.map(tick => (
                        <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                            <line y2={4} stroke="var(--gray-300)" />
                            <text
                                y={16}
                                textAnchor="middle"
                                style={{ fontSize: '10px', fill: 'var(--gray-500)' }}
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
                        className="text-xs font-body fill-gray-700"
                        style={{
                            fontWeight: selectedKeys?.has(d.label) ? 600 : 400,
                            fill: selectedKeys?.has(d.label) ? 'var(--gray-900)' : 'var(--gray-700)',
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

                    // Determine bar color based on state
                    // Single color for all bars in this chart type
                    const barColor = colors ? colors[0] : getChartColor(0);

                    return (
                        <g
                            key={d.label}
                            onClick={(e) => {
                                if (!dragState.isDragging) {
                                    e.stopPropagation();
                                    handleBarClick(d, e);
                                }
                            }}
                            onContextMenu={(e) => handleBarContextMenu(d, e)}
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
                                    stroke="var(--color-success)"
                                    strokeWidth={2}
                                    strokeDasharray="4,2"
                                    rx={5}
                                />
                            )}

                            {/* Actual bar - Square, no shadow */}
                            <rect
                                y={y}
                                height={yScale.bandwidth()}
                                width={barWidth}
                                fill={isDropTarget ? 'var(--color-success)' : barColor}
                                stroke={isSelected ? 'var(--gray-900)' : 'none'}
                                strokeWidth={isSelected ? 2 : 0}
                                style={{
                                    transition: dragState.isDragging ? 'none' : 'width 0.3s ease-out',
                                    cursor: onMerge ? 'grab' : (interactive ? 'pointer' : 'default'),
                                }}
                                className="hover:opacity-90"
                            />

                            {/* Label Logic */}
                            {labelMode !== 'none' && (
                                <text
                                    x={barWidth + 8}
                                    y={y + yScale.bandwidth() / 2}
                                    dy=".35em"
                                    style={{
                                        fontSize: 'var(--text-xs)',
                                        fontFamily: 'var(--font-body)',
                                        fill: isSelected ? 'var(--gray-900)' : 'var(--gray-600)',
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
                            x={0}
                            y={dragState.currentY - (svgRef.current?.getBoundingClientRect().top || 0) - margin.top - yScale.bandwidth() / 2}
                            width={xScale(dragState.draggedItem.value)}
                            height={yScale.bandwidth()}
                            fill="var(--color-terracotta)"
                            rx={3}
                            stroke="var(--gray-800)"
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
                <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={actualHeight}
                    stroke="var(--gray-300)"
                />
            </g>
        </svg>
    );
};
