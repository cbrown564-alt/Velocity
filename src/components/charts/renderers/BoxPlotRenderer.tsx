import React, { useMemo, useRef, useCallback } from 'react';
import * as d3scale from 'd3-scale';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

/**
 * Box Plot Renderer
 * Displays distribution of scale variables: min, q1, median, q3, max.
 * Data expected: Array of { label: string, min, q1, median, q3, max, ... }
 * derived from 'variableStats' or specialized aggregation.
 */
export const BoxPlotRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
    interactive = true,
    selectedKeys,
    onSelectionChange,
    variableStats,
}) => {
    // NOTE: True box plot calculation usually happens on backend or worker.
    // Here we assume keys in variableStats or processedData contain the quartiles.
    // If stats are not pre-calculated, we might need to compute them from raw data 
    // but the renderer ideally receives prepared stats.

    // For Velocity's current architecture, 'variableStats' often holds distribution info.
    // If we are strictly visualizing AggregatedRow[], it implies we have binned data or summary stats.
    // Let's assume for now we might be using a specific structure or we need to look at variableStats.

    // Fallback: if we just have a Histogram-like distribution in processedData, we can't easily make a boxplot 
    // without the raw values or pre-calculated quartiles.
    // Let's assume the user has passed pre-calculated stats for now.

    // For checking purposes, let's create a placeholder that warns if no stats available,
    // or renders provided stats.

    const stats = variableStats?.stats;

    // Check if we have valid box plot stats
    if (!stats || typeof stats.median === 'undefined') {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Box plot data not available (requires raw data or pre-calculated quartiles).
            </div>
        );
    }

    const margin = { top: 40, right: 40, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // We draw a single vertical box plot for the univariate case
    // Or multiple if we have a grouping variable (which would be GroupedBoxPlot).

    // Single Box Plot Logic
    const min = stats.min ?? 0;
    const max = stats.max ?? 100;
    const q1 = stats.q1 ?? min;
    const median = stats.median ?? (min + max) / 2;
    const q3 = stats.q3 ?? max;

    const yScale = d3scale.scaleLinear()
        .domain([min, max])
        .range([innerHeight, 0])
        .nice();

    const boxWidth = Math.min(innerWidth / 2, 100);
    const center = innerWidth / 2;

    const color = colors ? colors[0] : getChartColor(0);

    return (
        <svg width={width} height={height} className="overflow-visible font-body">
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Y Axis */}
                <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--gray-300)" />
                {yScale.ticks(5).map(tick => (
                    <g key={tick} transform={`translate(0,${yScale(tick)})`}>
                        <line x2={-6} stroke="var(--gray-300)" />
                        <text x={-10} dy=".32em" textAnchor="end" className="text-xs fill-gray-500">
                            {tick}
                        </text>
                    </g>
                ))}

                {/* Box Plot Elements */}
                <g className="box-plot-item">
                    {/* Range Line (Min to Max) */}
                    <line
                        x1={center} y1={yScale(min)}
                        x2={center} y2={yScale(max)}
                        stroke="var(--gray-400)"
                        strokeDasharray="4,4"
                    />
                    {/* Min Cap */}
                    <line
                        x1={center - boxWidth / 4} y1={yScale(min)}
                        x2={center + boxWidth / 4} y2={yScale(min)}
                        stroke="var(--gray-400)"
                    />
                    {/* Max Cap */}
                    <line
                        x1={center - boxWidth / 4} y1={yScale(max)}
                        x2={center + boxWidth / 4} y2={yScale(max)}
                        stroke="var(--gray-400)"
                    />

                    {/* Box (Q1 to Q3) */}
                    <rect
                        x={center - boxWidth / 2}
                        y={yScale(q3)}
                        width={boxWidth}
                        height={Math.abs(yScale(q1) - yScale(q3))}
                        fill={color}
                        fillOpacity={0.6}
                        stroke={color}
                        rx={2}
                    />

                    {/* Median Line */}
                    <line
                        x1={center - boxWidth / 2}
                        y1={yScale(median)}
                        x2={center + boxWidth / 2}
                        y2={yScale(median)}
                        stroke="white"
                        strokeWidth={2}
                    />
                </g>
            </g>
        </svg>
    );
};
