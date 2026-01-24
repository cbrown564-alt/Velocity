import React from 'react';
import * as d3scale from 'd3-scale';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

/**
 * Grouped Box Plot Renderer
 * Used for Nominal (row) x Scale (col) analysis - comparing distributions across groups.
 *
 * Data flow: Each row in processedData.rows represents a nominal group (e.g., Male, Female).
 * The cells contain the distribution stats (min, q1, median, q3, max) for the scale variable
 * within that group.
 */
export const GroupedBoxPlotRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
    variableStats,
}) => {
    // For grouped box plot: rows are the nominal groups, cells contain the stats
    // We need to extract stats from each row's cells (typically the "Total" column)

    // Build groups from rows, extracting stats from the first available cell
    const groups = processedData.rows.map((row, i) => {
        // Get stats from the first column's cell (usually "Total" for metric analysis)
        const firstColKey = processedData.columns[0]?.key || 'Total';
        const cell = row.cells[firstColKey];

        // Check if we have the required stats
        const hasStats = cell &&
            cell.min !== undefined &&
            cell.q1 !== undefined &&
            cell.median !== undefined &&
            cell.q3 !== undefined &&
            cell.max !== undefined;

        if (!hasStats) return null;

        return {
            label: row.label,
            rawValue: row.rawValue,
            stats: {
                min: cell.min!,
                q1: cell.q1!,
                median: cell.median!,
                q3: cell.q3!,
                max: cell.max!,
                mean: cell.mean,
                n: cell.validCount,
            },
            color: colors ? colors[i % colors.length] : getChartColor(i)
        };
    }).filter((g): g is NonNullable<typeof g> => g !== null);

    // Fallback: if no stats in rows, try series data points (older data path)
    if (groups.length === 0 && processedData.series.length > 0) {
        const seriesGroups = processedData.series[0]?.data
            .map((dp, i) => {
                if (!dp.stats || dp.stats.min === undefined || dp.stats.q1 === undefined) {
                    return null;
                }
                return {
                    label: dp.label,
                    rawValue: dp.rawValue,
                    stats: {
                        min: dp.stats.min!,
                        q1: dp.stats.q1!,
                        median: dp.stats.median!,
                        q3: dp.stats.q3!,
                        max: dp.stats.max!,
                        mean: dp.stats.mean,
                        n: dp.stats.n,
                    },
                    color: colors ? colors[i % colors.length] : getChartColor(i)
                };
            })
            .filter((g): g is NonNullable<typeof g> => g !== null) || [];

        if (seriesGroups.length > 0) {
            groups.push(...seriesGroups);
        }
    }

    if (groups.length === 0) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--gray-400)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-body)',
            }}>
                No distribution data available. Try placing a scale variable in the column.
            </div>
        );
    }

    const margin = { top: 40, right: 40, bottom: 60, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Determine global min/max for Y scale with 5% padding
    const allMin = Math.min(...groups.map(g => g.stats.min));
    const allMax = Math.max(...groups.map(g => g.stats.max));
    const range = allMax - allMin;
    const padding = range * 0.05;

    const xScale = d3scale.scaleBand()
        .domain(groups.map(g => g.label))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3scale.scaleLinear()
        .domain([allMin - padding, allMax + padding])
        .range([innerHeight, 0])
        .nice();

    return (
        <svg
            width={width}
            height={height}
            style={{ overflow: 'visible', fontFamily: 'var(--font-body)' }}
        >
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Y Axis */}
                <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--gray-300)" />
                {yScale.ticks(5).map(tick => (
                    <g key={tick} transform={`translate(0,${yScale(tick)})`}>
                        <line x2={-6} stroke="var(--gray-300)" />
                        <text
                            x={-10}
                            dy=".32em"
                            textAnchor="end"
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                fill: 'var(--gray-500)'
                            }}
                        >
                            {tick}
                        </text>
                    </g>
                ))}

                {/* X Axis */}
                <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="var(--gray-300)" />
                {groups.map(g => (
                    <g key={g.label} transform={`translate(${xScale(g.label)! + xScale.bandwidth() / 2}, ${innerHeight + 15})`}>
                        <text
                            textAnchor="middle"
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                fill: 'var(--gray-600)',
                                fontWeight: 500,
                            }}
                        >
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
                            {/* Range Line (whiskers) */}
                            <line
                                x1={center} y1={yScale(min)}
                                x2={center} y2={yScale(max)}
                                stroke="var(--gray-400)"
                                strokeDasharray="4,4"
                            />
                            {/* Min Cap */}
                            <line
                                x1={center - w / 4} y1={yScale(min)}
                                x2={center + w / 4} y2={yScale(min)}
                                stroke="var(--gray-400)"
                            />
                            {/* Max Cap */}
                            <line
                                x1={center - w / 4} y1={yScale(max)}
                                x2={center + w / 4} y2={yScale(max)}
                                stroke="var(--gray-400)"
                            />

                            {/* IQR Box */}
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

                            {/* Median Line */}
                            <line
                                x1={x}
                                y1={yScale(median)}
                                x2={x + w}
                                y2={yScale(median)}
                                stroke="white"
                                strokeWidth={2}
                            />

                            {/* Tooltip trigger area */}
                            <title>
                                {g.label}: Min={min.toFixed(1)}, Q1={q1.toFixed(1)}, Median={median.toFixed(1)}, Q3={q3.toFixed(1)}, Max={max.toFixed(1)}
                                {g.stats.n !== undefined ? ` (n=${g.stats.n})` : ''}
                            </title>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
};
