import React, { useMemo } from 'react';
import * as d3 from 'd3-scale';
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
}) => {
    // Use the first series (single column analysis) or "Total" column
    const series = processedData.series[0];
    const chartData = series?.data || [];

    // Dynamic margin based on label length
    const maxLabelLength = Math.max(...chartData.map(d => d.label.length), 10);
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

    // X-axis ticks
    const xTicks = xScale.ticks(5);

    return (
        <svg
            width={width}
            height={Math.max(height, actualHeight + margin.top + margin.bottom)}
            className="overflow-visible font-body"
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
                                className="text-[10px] fill-gray-500"
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
                        className="text-xs fill-gray-700"
                        style={{ fontFamily: 'var(--font-body)' }}
                    >
                        {d.label.length > 25 ? d.label.substring(0, 23) + '...' : d.label}
                    </text>
                ))}

                {/* Bars */}
                {chartData.map((d, i) => {
                    const barWidth = xScale(d.value);
                    const y = yScale(d.label) || 0;

                    return (
                        <g key={d.label}>
                            {/* Bar background (subtle) */}
                            <rect
                                y={y}
                                height={yScale.bandwidth()}
                                width={innerWidth}
                                fill="var(--gray-50)"
                                rx={3}
                            />
                            {/* Actual bar */}
                            <rect
                                y={y}
                                height={yScale.bandwidth()}
                                width={barWidth}
                                fill={colors ? colors[0] : getChartColor(0)}
                                rx={3}
                                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                            />
                            {/* Value label */}
                            <text
                                x={barWidth + 8}
                                y={y + yScale.bandwidth() / 2}
                                dy=".35em"
                                className="text-xs font-medium fill-gray-600"
                            >
                                {d.value.toLocaleString()}
                                <tspan className="fill-gray-400 font-normal">
                                    {' '}({d.percent.toFixed(1)}%)
                                </tspan>
                            </text>
                        </g>
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
