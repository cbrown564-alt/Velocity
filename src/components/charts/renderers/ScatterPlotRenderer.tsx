import React, { useMemo } from 'react';
import * as d3scale from 'd3-scale';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

export const ScatterPlotRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
}) => {
    // Expecting processedData.series[0].data to contain { x, y, value } points
    const points = useMemo(() => {
        if (!processedData?.series?.[0]?.data) return [];

        // Filter out invalid points
        return processedData.series[0].data.filter(p =>
            p.x !== undefined && p.x !== null &&
            p.y !== undefined && p.y !== null
        );
    }, [processedData]);

    const margin = { top: 24, right: 24, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate domains with slight padding
    const xExtent = useMemo(() => {
        if (points.length === 0) return [0, 100];
        const values = points.map(p => p.x!);
        let min = Math.min(...values);
        let max = Math.max(...values);
        const padding = (max - min) * 0.05 || 1; // Default padding if single point
        return [min - padding, max + padding];
    }, [points]);

    const yExtent = useMemo(() => {
        if (points.length === 0) return [0, 100];
        const values = points.map(p => p.y!);
        let min = Math.min(...values);
        let max = Math.max(...values);
        const padding = (max - min) * 0.05 || 1;
        return [min - padding, max + padding];
    }, [points]);

    if (points.length === 0) {
        // Capture some debug info
        const debugInfo = {
            rows: processedData?.rows?.length || 0,
            cols: processedData?.columns?.length || 0,
            firstRowRaw: processedData?.rows?.[0]?.rawValue,
            firstColKey: processedData?.columns?.[0]?.key,
            sampleCell: processedData?.rows?.[0]?.cells?.[processedData?.columns?.[0]?.key || '']
        };

        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-4 text-center">
                <div className="mb-2 font-medium">No scatter data available</div>
                <div className="text-xs text-left bg-gray-100 p-2 rounded max-w-full overflow-auto font-mono">
                    <div className="font-bold text-gray-700 mb-1">Debug Info:</div>
                    <div>Rows: {debugInfo.rows}</div>
                    <div>Cols: {debugInfo.cols}</div>
                    <div>Row[0].val: "{String(debugInfo.firstRowRaw)}"</div>
                    <div>Col[0].key: "{String(debugInfo.firstColKey)}"</div>
                    <div>Points found: {points.length}</div>
                </div>
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

    const color = colors ? colors[0] : getChartColor(0);

    return (
        <svg width={width} height={height} className="overflow-visible font-body">
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Axes */}
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

                <g>
                    <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--gray-300)" />
                    {yScale.ticks(5).map(tick => (
                        <g key={tick} transform={`translate(0,${yScale(tick)})`}>
                            <line x2={-6} stroke="var(--gray-300)" />
                            <text x={-10} dy=".32em" textAnchor="end" className="text-[10px] fill-gray-500">
                                {tick}
                            </text>
                        </g>
                    ))}
                </g>

                {/* Points */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={xScale(p.x!)}
                        cy={yScale(p.y!)}
                        r={4}
                        fill={color}
                        fillOpacity={0.6}
                    >
                        <title>{`(${p.x}, ${p.y})`}</title>
                    </circle>
                ))}
            </g>
        </svg>
    );
};
