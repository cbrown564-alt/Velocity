import React, { useMemo } from 'react';
import * as d3 from 'd3-shape';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

interface DonutDatum {
    label: string;
    value: number;
    percent: number;
}

/**
 * Donut Chart Renderer
 * Displays composition of a single variable (or first column of a cross-tab).
 */
export const DonutRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
}) => {
    // Use the first series (single column analysis)
    const series = processedData.series[0];
    const data = series?.data || [];

    // Filter out zero values to avoid ugly empty slices
    const chartData = useMemo(() => {
        return data
            .filter(d => d.value > 0)
            .map(d => ({
                label: d.label,
                value: d.value,
                percent: d.percent
            }));
    }, [data]);

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const pie = d3.pie<DonutDatum>()
        .value(d => d.value)
        .sort(null); // Keep order from processed data (usually sorted by frequency)

    const arc = d3.arc<d3.PieArcDatum<DonutDatum>>()
        .innerRadius(radius * 0.6)
        .outerRadius(radius);

    // Arc for labels (slightly larger)
    const labelArc = d3.arc<d3.PieArcDatum<DonutDatum>>()
        .innerRadius(radius * 1.05)
        .outerRadius(radius * 1.05);

    const arcs = pie(chartData);

    const centerX = width / 2;
    const centerY = height / 2;

    return (
        <svg width={width} height={height} className="overflow-visible font-body">
            <g transform={`translate(${centerX},${centerY})`}>
                {arcs.map((d, i) => {
                    const sliceColor = colors ? colors[i % colors.length] : getChartColor(i);
                    const isLargeSlice = (d.endAngle - d.startAngle) > 0.2;

                    // Callout line computations
                    const pos = labelArc.centroid(d);
                    const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                    pos[0] = radius * 1.1 * (midAngle < Math.PI ? 1 : -1);

                    // Anchor for text
                    const textAnchor = midAngle < Math.PI ? 'start' : 'end';

                    return (
                        <g key={d.data.label}>
                            <path
                                d={arc(d) || ''}
                                fill={sliceColor}
                                stroke="white"
                                strokeWidth={2}
                                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                            />

                            {/* Inner Percentage (if slice is large enough) */}
                            {isLargeSlice && (
                                <text
                                    transform={`translate(${arc.centroid(d)})`}
                                    dy=".35em"
                                    textAnchor="middle"
                                    className="text-xs font-semibold fill-white pointer-events-none"
                                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                                >
                                    {Math.round(d.data.percent)}%
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Center Text (Total) */}
                <text
                    textAnchor="middle"
                    dy="-0.5em"
                    className="text-sm text-gray-500 font-medium"
                >
                    Total
                </text>
                <text
                    textAnchor="middle"
                    dy="1em"
                    className="text-xl text-gray-800 font-bold"
                >
                    {series.data.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
                </text>
            </g>


            {/* External Labels with lines? 
                For simplicity in this iteration, I'm relying on inner labels and a legend if provided.
                But since I noticed AnalysisChart legend issue, I should probably add simple labels if possible.
                Let's add simple legend on the right if width allows/requires.
            */}
        </svg>
    );
};
