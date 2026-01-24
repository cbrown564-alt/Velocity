import React, { useMemo } from 'react';
import * as d3scale from 'd3-scale';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

/**
 * Grouped Box Plot Renderer
 * Used for Scale x Nominal analysis (comparing distributions across groups).
 */
export const GroupedBoxPlotRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
    variableStats,
}) => {
    // Assumption: processedData.series contains the groups (columns).
    // And within each series, we hopefully have the stats (min, q1, median, q3, max)
    // OR we have raw values to compute them.
    // Given the architecture, let's assume 'variableStats' might contain a 'byColumn' map 
    // or processedData.series items have metadata.

    // If we don't have stats, we render a placeholder.
    if (!variableStats?.byColumn && !processedData.series.some(s => s.stats)) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Grouped Box Plot data not available.
            </div>
        );
    }

    const margin = { top: 40, right: 40, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Resolve data
    // We want to map: Column Group -> Stats
    const groups = processedData.series.map((s, i) => {
        // Look for stats in the series object or lookup in variableStats
        // This relies on how the data is shaped upstream.
        // For now, let's look for 'stats' property on the series or fallback to variableStats using label.
        const stats = s.stats || s.data[0]?.stats || (variableStats?.byColumn ? variableStats.byColumn[s.label] : null);
        return {
            label: s.label,
            stats,
            color: colors ? colors[i % colors.length] : getChartColor(i)
        };
    }).filter(g => g.stats); // Only keep valid groups

    if (groups.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No valid distribution data found for groups.
            </div>
        );
    }

    // Determine global min/max for Y scale
    const allMin = Math.min(...groups.map(g => g.stats.min ?? 0));
    const allMax = Math.max(...groups.map(g => g.stats.max ?? 100));

    const xScale = d3scale.scaleBand()
        .domain(groups.map(g => g.label))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3scale.scaleLinear()
        .domain([allMin, allMax]) // TODO: Add padding
        .range([innerHeight, 0])
        .nice();

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

                {/* X Axis */}
                <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="var(--gray-300)" />
                {groups.map(g => (
                    <g key={g.label} transform={`translate(${xScale(g.label)! + xScale.bandwidth() / 2}, ${innerHeight + 15})`}>
                        <text textAnchor="middle" className="text-xs fill-gray-600 font-medium">
                            {g.label}
                        </text>
                    </g>
                ))}

                {/* Boxes */}
                {groups.map(g => {
                    const { min, q1, median, q3, max } = g.stats;
                    const x = xScale(g.label)!;
                    const w = xScale.bandwidth();
                    const center = x + w / 2;

                    return (
                        <g key={g.label}>
                            {/* Range Line */}
                            <line
                                x1={center} y1={yScale(min)}
                                x2={center} y2={yScale(max)}
                                stroke="var(--gray-400)"
                                strokeDasharray="4,4"
                            />
                            {/* Caps */}
                            <line
                                x1={center - w / 4} y1={yScale(min)}
                                x2={center + w / 4} y2={yScale(min)}
                                stroke="var(--gray-400)"
                            />
                            <line
                                x1={center - w / 4} y1={yScale(max)}
                                x2={center + w / 4} y2={yScale(max)}
                                stroke="var(--gray-400)"
                            />

                            {/* Box */}
                            <rect
                                x={x}
                                y={yScale(q3)}
                                width={w}
                                height={Math.abs(yScale(q1) - yScale(q3))}
                                fill={g.color}
                                fillOpacity={0.8}
                                stroke={g.color}
                                rx={2}
                            />

                            {/* Median */}
                            <line
                                x1={x}
                                y1={yScale(median)}
                                x2={x + w}
                                y2={yScale(median)}
                                stroke="white"
                                strokeWidth={2}
                            />
                        </g>
                    );
                })}
            </g>
        </svg>
    );
};
