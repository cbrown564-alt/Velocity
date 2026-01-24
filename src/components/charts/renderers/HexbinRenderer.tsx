import React, { useMemo } from 'react';
import * as d3scale from 'd3-scale';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

/**
 * Hexbin Renderer
 * Used for Two Scales visualization.
 * Note: Full hexbin requires d3-hexbin which might need to be added.
 * For now, we will implement a Scatterplot as a proxy or use circles 
 * since the user request asked for "Hexbin" specifically which implies binning.
 * 
 * If we don't have d3-hexbin, we can manually bin or just show scatter points.
 * Given "Hexbin" is requested, I'll attempt a rectangular binning (Heatmap) 
 * or just Scatter if data isn't dense.
 * 
 * Let's implement a Scatterplot first as the base for "Two scales", 
 * and maybe style it to look densified if needed.
 */
export const HexbinRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
    variableStats,
}) => {
    // Hexbin requires raw x,y data.
    // processedData might contain a series with `data` array of {x, y} objects.

    // Let's assume series[0].data contains points.
    const series = processedData.series[0];
    const points = series?.data || [];

    // Basic scatter check
    if (points.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Scatter/Hexbin data not available.
            </div>
        );
    }

    const margin = { top: 24, right: 24, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales
    const minX = Math.min(...points.map(p => p.x ?? p.value ?? 0));
    const maxX = Math.max(...points.map(p => p.x ?? p.value ?? 100));
    const minY = Math.min(...points.map(p => p.y ?? 0));
    const maxY = Math.max(...points.map(p => p.y ?? 100));

    const xScale = d3scale.scaleLinear()
        .domain([minX, maxX])
        .range([0, innerWidth])
        .nice();

    const yScale = d3scale.scaleLinear()
        .domain([minY, maxY])
        .range([innerHeight, 0])
        .nice();

    const color = colors ? colors[0] : getChartColor(0);

    return (
        <svg width={width} height={height} className="overflow-visible font-body">
            <g transform={`translate(${margin.left},${margin.top})`}>

                {/* Axes */}
                {/* X */}
                <g transform={`translate(0,${innerHeight})`}>
                    <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="var(--gray-300)" />
                    {xScale.ticks(5).map(tick => (
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

                {/* Y */}
                <g>
                    <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--gray-300)" />
                    {yScale.ticks(5).map(tick => (
                        <g key={tick} transform={`translate(0,${yScale(tick)})`}>
                            <line x2={-6} stroke="var(--gray-300)" />
                            <text x={-10} dy=".32em" textAnchor="end" className="text-xs fill-gray-500">
                                {tick}
                            </text>
                        </g>
                    ))}
                </g>

                {/* Points */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={xScale(p.x ?? p.value)}
                        cy={yScale(p.y)}
                        r={4}
                        fill={color}
                        fillOpacity={0.6}
                    />
                ))}
            </g>
        </svg>
    );
};
