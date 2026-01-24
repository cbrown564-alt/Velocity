import React, { useMemo } from 'react';
import * as d3 from 'd3-scale';
import * as d3Shape from 'd3-shape';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { AggregatedRow } from '../../../types';
import { getChartColor } from '../shared/chartColors';

interface StackedBarRendererProps extends BaseChartRendererProps<AggregatedRow> {
    type: 'stacked-bar' | 'stacked-bar-100';
}

export const StackedBarRenderer: React.FC<StackedBarRendererProps> = ({
    data,
    width,
    height,
    colors,
    type,
}) => {
    const margin = { top: 40, right: 100, bottom: 20, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 1. Extract Segments (Column Keys)
    const segments = useMemo(() => {
        const cols = new Set<string>();
        data.forEach(row => {
            if (row.colKey) cols.add(row.colKey);
        });
        // If no colKey, default to 'Count'
        if (cols.size === 0) return ['Count'];
        return Array.from(cols);
    }, [data]);

    // 2. Pivot Data
    // Transform flat AggregatedRow[] -> { label: "RowA", "Col1": 10, "Col2": 20 }[]
    const seriesData = useMemo(() => {
        const rowMap = new Map<string, any>();

        data.forEach(row => {
            const label = row.rowKeys.join(' / ');
            if (!rowMap.has(label)) {
                rowMap.set(label, { label });
            }
            const item = rowMap.get(label);
            const key = row.colKey || 'Count';
            item[key] = row.count;
        });

        return Array.from(rowMap.values());
    }, [data]);

    const stackGenerator = d3Shape.stack().keys(segments);
    if (type === 'stacked-bar-100') {
        stackGenerator.offset(d3Shape.stackOffsetExpand);
    }

    const stackedSeries = stackGenerator(seriesData);

    const yScale = useMemo(() => {
        return d3.scaleBand()
            .domain(seriesData.map(d => d.label))
            .range([0, innerHeight])
            .padding(0.2);
    }, [seriesData, innerHeight]);

    const xScale = useMemo(() => {
        const maxVal = type === 'stacked-bar-100' ? 1 : (max(stackedSeries, s => max(s, d => d[1])) || 0);
        return d3.scaleLinear()
            .domain([0, maxVal])
            .range([0, innerWidth]);
    }, [stackedSeries, innerWidth, type]);

    return (
        <svg width={width} height={height} className="overflow-visible">
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Legend (Top Right) - Simplified */}
                {segments.map((seg, i) => (
                    <g key={seg} transform={`translate(${i * 80}, -${margin.top - 10})`}>
                        <rect width={10} height={10} fill={colors ? colors[i % colors.length] : getChartColor(i)} />
                        <text x={15} y={9} className="text-xs fill-gray-600">{seg}</text>
                    </g>
                ))}

                {/* Y Axis Labels */}
                {seriesData.map((d: any) => (
                    <text
                        key={d.label}
                        x={-10}
                        y={(yScale(d.label) || 0) + yScale.bandwidth() / 2}
                        dy=".35em"
                        textAnchor="end"
                        className="text-xs font-medium fill-gray-600"
                    >
                        {d.label.length > 20 ? d.label.substring(0, 18) + '...' : d.label}
                    </text>
                ))}

                {/* Stacked Bars */}
                {stackedSeries.map((series, seriesIndex) => (
                    <g key={segments[seriesIndex]} fill={colors ? colors[seriesIndex % colors.length] : getChartColor(seriesIndex)}>
                        {series.map((d: any) => (
                            <rect
                                key={d.data.label}
                                y={yScale(d.data.label)}
                                x={xScale(d[0])}
                                width={xScale(d[1]) - xScale(d[0])}
                                height={yScale.bandwidth()}
                                className="transition-all duration-300 hover:opacity-90"
                            />
                        ))}
                    </g>
                ))}
            </g>
        </svg>
    );
};
