import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3-scale';
import { select } from 'd3-selection';
import { brushY } from 'd3-brush';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

/**
 * Horizontal Bar Chart Renderer
 * Used for single-variable frequency distributions.
 * Data comes pre-sorted and with labels resolved via processedData.
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
}) => {
    const brushRef = useRef<SVGGElement>(null);

    // Use the first series (single column analysis) or "Total" column
    const series = processedData.series[0];
    const chartData = series?.data || [];

    // Dynamic margin based on label length
    const maxLabelLength = Math.max(...chartData.map(d => (d.label || '').length), 10);
    const leftMargin = Math.min(Math.max(maxLabelLength * 6, 80), 180);

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
            width={width}
            height={Math.max(height, actualHeight + margin.top + margin.bottom)}
            style={{ overflow: 'visible', fontFamily: 'var(--font-body)' }}
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
                        strokeDasharray="2,2"
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
                        style={{
                            fontSize: 'var(--font-size-xs)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: selectedKeys?.has(d.label) ? 700 : 400,
                            fill: selectedKeys?.has(d.label) ? 'var(--gray-900)' : 'var(--gray-700)',
                        }}
                    >
                        {(d.label || '').length > 25 ? (d.label || '').substring(0, 23) + '...' : d.label}
                    </text>
                ))}

                {/* Bars */}
                {chartData.map((d, i) => {
                    const barWidth = xScale(d.value);
                    const y = yScale(d.label) || 0;
                    const isSelected = selectedKeys?.has(d.label);
                    const barColor = isSelected
                        ? (colors ? colors[1] : 'var(--color-terracotta)') // Use secondary/highlight color
                        : (colors ? colors[0] : getChartColor(0));

                    return (
                        <g
                            key={d.label}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleBarClick(d, e);
                            }}
                            onContextMenu={(e) => handleBarContextMenu(d, e)}
                        >
                            {/* Bar background (subtle) */}
                            <rect
                                y={y}
                                height={yScale.bandwidth()}
                                width={innerWidth}
                                fill={isSelected ? 'var(--gray-100)' : 'var(--gray-50)'}
                                rx={3}
                            />
                            {/* Actual bar */}
                            <rect
                                y={y}
                                height={yScale.bandwidth()}
                                width={barWidth}
                                fill={barColor}
                                rx={3}
                                style={{
                                    transition: 'all 0.3s',
                                    cursor: interactive ? 'pointer' : 'default',
                                }}
                            />
                            {/* Value label */}
                            <text
                                x={barWidth + 8}
                                y={y + yScale.bandwidth() / 2}
                                dy=".35em"
                                style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: isSelected ? 700 : 500,
                                    fill: isSelected ? 'var(--gray-900)' : 'var(--gray-600)',
                                }}
                            >
                                {d.value.toLocaleString()}
                                <tspan style={{ fill: 'var(--gray-400)', fontWeight: 400 }}>
                                    {' '}({d.percent.toFixed(1)}%)
                                </tspan>
                            </text>
                        </g>
                    );
                })}

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
