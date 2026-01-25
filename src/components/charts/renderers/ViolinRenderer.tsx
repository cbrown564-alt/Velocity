import React, { useMemo } from 'react';
import * as d3scale from 'd3-scale';
import { area, curveCatmullRom } from 'd3-shape';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

/**
 * Violin Renderer
 * Shows density distribution.
 * Requires pre-calculated density bins (bins: {x0, x1, count/density}) for each series.
 */
export const ViolinRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
    variableStats,
}) => {
    // Similar to box plot, we need distribution data.
    // Assumption: variableStats.density or processedData.series[].density is available.
    // If not, we show a simplified placeholder or just use what we have.

    // For this implementation, let's assume 'processedData.series' contains 'histogram' or 'density' data.
    // Just like HistogramRenderer uses series[0].data (bins).

    // For grouped violin (Scale x Nominal), each series is a group.

    const groups = processedData.series.filter(s => s.data && s.data.length > 0);

    if (groups.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Violin plot data not available.
            </div>
        );
    }

    const margin = { top: 40, right: 40, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // X Scale (Groups)
    const xScale = d3scale.scaleBand()
        .domain(groups.map(s => s.label))
        .range([0, innerWidth])
        .padding(0.05);

    // Y Scale (Value Range)
    // We need min/max of the bins
    const allBins = groups.flatMap(s => s.data);
    const minVal = Math.min(...allBins.map(d => d.x0 ?? 0)); // Assuming bins have x0/x1 (range)
    const maxVal = Math.max(...allBins.map(d => d.x1 ?? 100)); // and x1

    const yScale = d3scale.scaleLinear()
        .domain([minVal, maxVal])
        .range([innerHeight, 0])
        .nice();

    // Width Scale (Density) - for component width inside the band
    // Find max frequency in any single bin across all groups to normalize
    const maxCount = Math.max(...allBins.map(d => d.value || d.count || 0));

    const wScale = d3scale.scaleLinear()
        .domain([0, maxCount])
        .range([0, xScale.bandwidth() / 2]);

    // Area Generator
    const areaGenerator = area<any>()
        .x0(d => -wScale(d.value || d.count || 0))
        .x1(d => wScale(d.value || d.count || 0))
        .y(d => yScale((d.x0 + d.x1) / 2))
        .curve(curveCatmullRom);

    return (
        <svg width={width} height={height} className="overflow-visible font-body">
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Y Axis */}
                <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--gray-300)" />
                {yScale.ticks(5).map(tick => (
                    <g key={tick} transform={`translate(0,${yScale(tick)})`}>
                        <line x2={-6} stroke="var(--gray-300)" />
                        <text x={-10} dy=".32em" textAnchor="end" className="text-[10px] fill-gray-500">
                            {tick}
                        </text>
                    </g>
                ))}

                {/* X Axis */}
                <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="var(--gray-300)" />
                {groups.map(g => (
                    <g key={g.label} transform={`translate(${xScale(g.label)! + xScale.bandwidth() / 2}, ${innerHeight + 15})`}>
                        <text textAnchor="middle" className="text-[11px] fill-gray-600 font-medium">
                            {g.label}
                        </text>
                    </g>
                ))}

                {/* Violins */}
                {groups.map((g, i) => {
                    const x = xScale(g.label)! + xScale.bandwidth() / 2;
                    const color = colors ? colors[i % colors.length] : getChartColor(i);

                    return (
                        <g key={g.label} transform={`translate(${x},0)`}>
                            <path
                                d={areaGenerator(g.data) || ''}
                                fill={color}
                                fillOpacity={0.8}
                                stroke={color}
                                strokeWidth={1}
                            />
                        </g>
                    );
                })}

            </g>
        </svg>
    );
};
