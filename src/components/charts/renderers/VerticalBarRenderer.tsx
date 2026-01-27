import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3-scale';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
// getChartColor removed

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
    labelMode = 'count',
}) => {
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

    // Y-axis ticks
    const yTicks = yScale.ticks(5);

    return (
        <svg
            width={width}
            height={height}
            style={{
                overflow: 'visible',
                fontFamily: 'var(--font-mono)',
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

                    return (
                        <g
                            key={d.label}
                            onClick={(e) => handleBarClick(d, e)}
                            onContextMenu={(e) => handleContextMenu(d, e)}
                            style={{ cursor: interactive ? 'pointer' : 'default' }}
                        >
                            <rect
                                x={xScale(d.label)}
                                y={yScale(d.value)}
                                width={xScale.bandwidth()}
                                height={barHeight}
                                // Use palette colors if available, otherwise fall back to primary
                                fill={colors ? colors[0] : 'var(--viz-fill-secondary)'}
                                fillOpacity={0.8}
                                stroke={isSelected ? 'var(--text-accent)' : 'none'}
                                strokeWidth={isSelected ? 2 : 0}
                                rx={1}
                                className="hover:opacity-90 chart-bar-rect"
                                style={{ transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
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
