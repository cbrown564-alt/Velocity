import React, { useMemo } from 'react';
import * as d3scale from 'd3-scale';
import { hexbin as d3Hexbin } from 'd3-hexbin';
import { BaseChartRendererProps } from '../../../types/charts';
// getChartColor removed

export const HexbinRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
}) => {
    // Hexbin requires raw x,y data.
    // processedData might contain a series with `data` array of {x, y} objects.
    const points = useMemo(() => {
        if (!processedData?.series?.[0]?.data) return [];
        return processedData.series[0].data
            .filter(p => p.x !== undefined && p.x !== null && p.y !== undefined && p.y !== null)
            .map(p => [p.x!, p.y!] as [number, number]);
    }, [processedData]);

    const margin = { top: 24, right: 24, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate domains
    const xExtent = useMemo(() => {
        if (points.length === 0) return [0, 100];
        const values = points.map(p => p[0]);
        return [Math.min(...values), Math.max(...values)];
    }, [points]);

    const yExtent = useMemo(() => {
        if (points.length === 0) return [0, 100];
        const values = points.map(p => p[1]);
        return [Math.min(...values), Math.max(...values)];
    }, [points]);

    if (points.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
                No data available for Hexbin plot.
            </div>
        );
    }

    const xScale = d3scale.scaleLinear()
        .domain(xExtent)
        .range([0, innerWidth])
        .nice();

    const yScale = d3scale.scaleLinear()
        .domain(yExtent)
        .range([innerHeight, 0])
        .nice();

    // Configure Hexbin
    const hexbinGenerator = d3Hexbin()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .radius(10) // Fixed radius for now, could be dynamic
        .x(d => xScale(d[0]))
        .y(d => yScale(d[1]));

    const bins = useMemo(() => {
        return hexbinGenerator(points);
    }, [hexbinGenerator, points]);

    // Color Scale for Density
    const maxCount = Math.max(...bins.map(b => b.length));
    const baseColor = 'var(--viz-fill-secondary)'; // Solid accent color for density mapping

    // Create a sequential scale based on opacity or just use the base color with opacity
    const opacityScale = d3scale.scaleLinear()
        .domain([0, maxCount])
        .range([0.1, 0.8]); // Holographic range

    return (
        <svg width={width} height={height} className="overflow-visible font-mono">
            <g transform={`translate(${margin.left},${margin.top})`}>

                {/* Axes */}
                <g transform={`translate(0,${innerHeight})`}>
                    <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="var(--viz-stroke-main)" />
                    {xScale.ticks(5).map(tick => (
                        <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                            <line y2={4} stroke="var(--viz-stroke-main)" />
                            <text
                                y={16}
                                textAnchor="middle"
                                className="text-[10px] fill-[var(--viz-text-axis)] font-mono"
                            >
                                {tick}
                            </text>
                        </g>
                    ))}
                </g>

                <g>
                    <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--viz-stroke-main)" />
                    {yScale.ticks(5).map(tick => (
                        <g key={tick} transform={`translate(0,${yScale(tick)})`}>
                            <line x2={-6} stroke="var(--viz-stroke-main)" />
                            <text x={-10} dy=".32em" textAnchor="end" className="text-[10px] fill-[var(--viz-text-axis)] font-mono">
                                {tick}
                            </text>
                        </g>
                    ))}
                </g>

                {/* Hexagons */}
                <g clipPath="url(#clip)">
                    <clipPath id="clip">
                        <rect width={innerWidth} height={innerHeight} />
                    </clipPath>
                    {bins.map((bin, i) => (
                        <path
                            key={i}
                            d={hexbinGenerator.hexagon()}
                            transform={`translate(${bin.x},${bin.y})`}
                            fill={baseColor}
                            fillOpacity={opacityScale(bin.length)}
                            stroke="var(--viz-stroke-bar)"
                            strokeWidth={0.5}
                            className="transition-all duration-200 hover:stroke-[var(--viz-stroke-main)] hover:stroke-1"
                        >
                            <title>
                                {`Count: ${bin.length}\nRange: [${Math.min(...bin.map(d => d[0])).toFixed(1)} - ${Math.max(...bin.map(d => d[0])).toFixed(1)}]`}
                            </title>
                        </path>
                    ))}
                </g>
            </g>
        </svg>
    );
};
