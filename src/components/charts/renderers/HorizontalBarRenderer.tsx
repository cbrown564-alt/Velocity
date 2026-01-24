import React, { useMemo } from 'react';
import * as d3 from 'd3-scale';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { AggregatedRow } from '../../../types';
import { getChartColor } from '../shared/chartColors';

export const HorizontalBarRenderer: React.FC<BaseChartRendererProps<AggregatedRow>> = ({
    data,
    width,
    height,
    colors,
}) => {
    const margin = { top: 20, right: 30, bottom: 20, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales
    const yScale = useMemo(() => {
        return d3.scaleBand()
            .domain(data.map(d => d.rowKeys.join(' / ')))
            .range([0, innerHeight])
            .padding(0.2);
    }, [data, innerHeight]);

    const xScale = useMemo(() => {
        const maxVal = max(data, d => d.count) || 0;
        return d3.scaleLinear()
            .domain([0, maxVal])
            .range([0, innerWidth]);
    }, [data, innerWidth]);

    return (
        <svg width={width} height={height} className="overflow-visible">
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Y Axis Labels */}
                {data.map((d) => {
                    const label = d.rowKeys.join(' / ');
                    return (
                        <text
                            key={label}
                            x={-10}
                            y={(yScale(label) || 0) + yScale.bandwidth() / 2}
                            dy=".35em"
                            textAnchor="end"
                            className="text-xs font-medium fill-gray-600"
                        >
                            {label.length > 20 ? label.substring(0, 18) + '...' : label}
                        </text>
                    )
                })}

                {/* Bars */}
                {data.map((d, i) => {
                    const label = d.rowKeys.join(' / ');
                    return (
                        <g key={label}>
                            <rect
                                y={yScale(label)}
                                height={yScale.bandwidth()}
                                width={xScale(d.count)}
                                fill={colors ? colors[i % colors.length] : getChartColor(i)}
                                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                            />
                            {/* Value Labels */}
                            <text
                                x={xScale(d.count) + 5}
                                y={(yScale(label) || 0) + yScale.bandwidth() / 2}
                                dy=".35em"
                                className="text-xs fill-gray-500"
                            >
                                {d.count}
                            </text>
                        </g>
                    )
                })}

                {/* Baseline */}
                <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="currentColor" className="text-gray-300" />
            </g>
        </svg>
    );
};
