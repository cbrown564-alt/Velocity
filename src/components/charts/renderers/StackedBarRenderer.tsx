import React, { useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3-scale';
import * as d3Shape from 'd3-shape';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

interface StackedBarRendererProps extends BaseChartRendererProps {
    type: 'stacked-bar' | 'stacked-bar-100';
}

/**
 * Stacked Bar Chart Renderer
 * Used for cross-tabs (row variable x column variable) and grids.
 * Shows composition of each row across column categories.
 */
export const StackedBarRenderer: React.FC<StackedBarRendererProps> = ({
    width,
    height,
    colors,
    type,
    processedData,
    interactive = true,
    selectedKeys,
    onSelectionChange,
    onContextMenu,
}) => {
    const { rows, columns, series } = processedData;

    // Get column keys and labels for the legend
    const columnKeys = columns.map(c => c.key);
    const columnLabels = columns.map(c => c.label);

    // Dynamic margin based on label lengths
    const maxRowLabelLength = Math.max(...rows.map(r => (r.label || '').length), 10);
    const leftMargin = Math.min(Math.max(maxRowLabelLength * 6, 100), 200);

    // Calculate legend width
    const legendItemWidth = 100;
    const legendWidth = Math.min(columns.length * legendItemWidth, width - leftMargin - 40);

    const margin = { top: 48, right: 40, bottom: 32, left: leftMargin };
    const innerWidth = Math.max(width - margin.left - margin.right, 200);
    const innerHeight = Math.max(height - margin.top - margin.bottom, 150);

    // Calculate bar height
    const barHeight = Math.min(Math.max(innerHeight / rows.length - 8, 24), 48);
    const actualHeight = (barHeight + 8) * rows.length;

    // Build stacked data from processedData rows
    const stackData = useMemo(() => {
        return rows.map(row => {
            const item: Record<string, any> = { label: row.label };
            columnKeys.forEach(key => {
                item[key] = row.cells[key]?.count || 0;
            });
            item._total = row.total;
            return item;
        });
    }, [rows, columnKeys]);

    // Create stack generator
    const stackGenerator = d3Shape.stack<Record<string, any>>().keys(columnKeys);
    if (type === 'stacked-bar-100') {
        stackGenerator.offset(d3Shape.stackOffsetExpand);
    }

    const stackedSeries = stackGenerator(stackData);

    // Handle row click for selection
    const handleRowClick = useCallback((rowLabel: string, event: React.MouseEvent) => {
        if (!interactive || !onSelectionChange) return;

        const newSelection = new Set(selectedKeys);
        if (event.metaKey || event.ctrlKey) {
            if (newSelection.has(rowLabel)) {
                newSelection.delete(rowLabel);
            } else {
                newSelection.add(rowLabel);
            }
        } else {
            newSelection.clear();
            newSelection.add(rowLabel);
        }
        onSelectionChange(newSelection);
    }, [interactive, onSelectionChange, selectedKeys]);

    // Handle right-click context menu
    const handleRowContextMenu = useCallback((rowLabel: string, event: React.MouseEvent) => {
        if (!interactive || !onContextMenu) return;
        event.preventDefault();
        event.stopPropagation();

        // Find the row data
        const row = rows.find(r => r.label === rowLabel);
        if (!row) return;

        // Build data point info
        const dataPoint = {
            label: rowLabel,
            value: row.total,
            percent: 100, // Full row
            rawValue: row.label,
        };

        onContextMenu({
            selected: [dataPoint],
            position: { x: event.clientX, y: event.clientY },
        });
    }, [interactive, onContextMenu, rows]);

    // Scales
    const yScale = useMemo(() => {
        return d3.scaleBand()
            .domain(stackData.map(d => d.label))
            .range([0, actualHeight])
            .padding(0.2);
    }, [stackData, actualHeight]);

    const xScale = useMemo(() => {
        const maxVal = type === 'stacked-bar-100'
            ? 1
            : (max(stackedSeries, s => max(s, d => d[1])) || 1);
        return d3.scaleLinear()
            .domain([0, maxVal])
            .range([0, innerWidth]);
    }, [stackedSeries, innerWidth, type]);

    // X-axis ticks
    const xTicks = type === 'stacked-bar-100'
        ? [0, 0.25, 0.5, 0.75, 1]
        : xScale.ticks(5);

    return (
        <svg
            width={width}
            height={Math.max(height, actualHeight + margin.top + margin.bottom)}
            className="overflow-visible font-body"
        >
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Legend (Top) */}
                <g transform={`translate(${(innerWidth - legendWidth) / 2}, -${margin.top - 8})`}>
                    {columnLabels.map((label, i) => {
                        const xOffset = i * legendItemWidth;
                        return (
                            <g key={columnKeys[i]} transform={`translate(${xOffset}, 0)`}>
                                <rect
                                    width={12}
                                    height={12}
                                    rx={2}
                                    fill={colors ? colors[i % colors.length] : getChartColor(i)}
                                />
                                <text
                                    x={18}
                                    y={10}
                                    className="text-[11px] fill-gray-600"
                                    style={{ fontFamily: 'var(--font-body)' }}
                                >
                                    {(label || '').length > 12 ? (label || '').substring(0, 10) + '...' : (label || '')}
                                </text>
                            </g>
                        );
                    })}
                </g>

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
                                y={18}
                                textAnchor="middle"
                                className="text-[10px] fill-gray-500"
                            >
                                {type === 'stacked-bar-100'
                                    ? `${Math.round(tick * 100)}%`
                                    : tick.toLocaleString()}
                            </text>
                        </g>
                    ))}
                </g>

                {/* Y Axis Labels */}
                {stackData.map((d) => (
                    <text
                        key={d.label}
                        x={-12}
                        y={(yScale(d.label) || 0) + yScale.bandwidth() / 2}
                        dy=".35em"
                        textAnchor="end"
                        className="text-xs fill-gray-700"
                        style={{ fontFamily: 'var(--font-body)' }}
                    >
                        {(d.label || '').length > 25 ? (d.label || '').substring(0, 23) + '...' : d.label}
                    </text>
                ))}

                {/* Stacked Bars */}
                {stackedSeries.map((seriesItem, seriesIndex) => (
                    <g
                        key={columnKeys[seriesIndex]}
                        fill={colors ? colors[seriesIndex % colors.length] : getChartColor(seriesIndex)}
                    >
                        {seriesItem.map((d, i) => {
                            const barWidth = xScale(d[1]) - xScale(d[0]);
                            const y = yScale(d.data.label) || 0;
                            const isSelected = selectedKeys?.has(d.data.label);

                            // Only show label if segment is wide enough
                            const showLabel = barWidth > 30;
                            const value = d[1] - d[0];
                            const displayValue = type === 'stacked-bar-100'
                                ? `${Math.round(value * 100)}%`
                                : value.toLocaleString();

                            return (
                                <g
                                    key={d.data.label}
                                    onClick={(e) => handleRowClick(d.data.label, e)}
                                    onContextMenu={(e) => handleRowContextMenu(d.data.label, e)}
                                    style={{ cursor: interactive ? 'pointer' : 'default' }}
                                >
                                    <rect
                                        y={y}
                                        x={xScale(d[0])}
                                        width={Math.max(barWidth, 0)}
                                        height={yScale.bandwidth()}
                                        className="transition-all duration-300 hover:opacity-80"
                                        rx={seriesIndex === 0 ? 3 : 0}
                                        opacity={isSelected ? 1 : 0.9}
                                        stroke={isSelected ? 'var(--gray-800)' : 'none'}
                                        strokeWidth={isSelected ? 2 : 0}
                                    />
                                    {showLabel && (
                                        <text
                                            x={xScale(d[0]) + barWidth / 2}
                                            y={y + yScale.bandwidth() / 2}
                                            dy=".35em"
                                            textAnchor="middle"
                                            className="text-[10px] font-medium fill-white pointer-events-none"
                                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                                        >
                                            {displayValue}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </g>
                ))}

                {/* Row totals (right side) */}
                {stackData.map((d) => {
                    const total = d._total;
                    const y = yScale(d.label) || 0;
                    return (
                        <text
                            key={`total-${d.label}`}
                            x={innerWidth + 8}
                            y={y + yScale.bandwidth() / 2}
                            dy=".35em"
                            className="text-[10px] fill-gray-500"
                        >
                            n={total.toLocaleString()}
                        </text>
                    );
                })}

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
