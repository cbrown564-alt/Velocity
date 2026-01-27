import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3-scale';
import * as d3Shape from 'd3-shape';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
// getChartColor removed

interface StackedBarRendererProps extends BaseChartRendererProps {
    type: 'stacked-bar';
}

/**
 * Stacked Bar Chart Renderer
 * Used for cross-tabs (row variable x column variable) and grids.
 * Shows composition of each row across column categories.
 */

export const StackedBarRenderer: React.FC<StackedBarRendererProps> = ({
    width,
    height,
    colors,
    type,
    processedData,
    interactive = true,
    selectedKeys,
    onSelectionChange,
    onContextMenu,
    labelMode,
}) => {
    const { rows, columns, colVariable, rowVariables, grandTotal } = processedData;

    // Detect if this is a single variable analysis (no column variable)
    const isSingleVariable = !colVariable && rows.length > 0;

    // Prepare data for the chart based on mode
    const { chartData, stackKeys, stackLabels, rowLabels } = useMemo(() => {
        if (isSingleVariable) {
            // Single Variable: Transpose so categories become stack segments
            // We create ONE row "Total" (or variable name), and the stack keys are the categories.
            const variableLabel = rowVariables[0]?.label || 'Total';

            // Use category labels as the stack keys
            const keys = rows.map(r => r.label);

            const item: Record<string, any> = {
                label: variableLabel,
                _total: grandTotal,
            };

            // Populate the single item with counts from each category row
            rows.forEach(r => {
                item[r.label] = r.total;
            });

            return {
                chartData: [item],
                stackKeys: keys,
                stackLabels: keys, // Legend shows categories
                rowLabels: [variableLabel],
            };
        } else {
            // Cross-tab: Columns (Series) are bars, Rows (Categories) are stack segments
            // This aligns with survey 'Column %' where we compare distributions across banners.
            const keys = rows.map(r => r.rawValue);
            const data = columns.map(col => {
                const item: Record<string, any> = { label: col.label };
                rows.forEach(row => {
                    item[row.rawValue] = row.cells[col.key]?.count || 0;
                });
                item._total = col.total;
                return item;
            });

            return {
                chartData: data,
                stackKeys: keys,
                stackLabels: rows.map(r => r.label),
                rowLabels: columns.map(c => c.label),
            };
        }
    }, [rows, columns, rowVariables, colVariable, grandTotal, isSingleVariable]);

    // Dynamic margin based on label lengths
    const maxRowLabelLength = Math.max(...rowLabels.map(l => (l || '').length), 10);
    const leftMargin = Math.min(Math.max(maxRowLabelLength * 6, 100), 200);

    // Calculate legend width
    const legendItemWidth = 100;
    const legendWidth = Math.min(stackKeys.length * legendItemWidth, width - leftMargin - 40);

    const margin = { top: 48, right: 40, bottom: 32, left: leftMargin };
    const innerWidth = Math.max(width - margin.left - margin.right, 200);
    const innerHeight = Math.max(height - margin.top - margin.bottom, 150);

    // Calculate bar height
    const effectiveRowCount = chartData.length;
    const barHeight = Math.min(Math.max(innerHeight / effectiveRowCount - 8, 24), 48);
    const actualHeight = (barHeight + 8) * effectiveRowCount;

    // Create stack generator
    const stackGenerator = d3Shape.stack<Record<string, any>>().keys(stackKeys);

    // Check if we should be in 100% stacked mode
    // Only governed by labelMode now
    const isPercentMode = labelMode === 'percent';

    if (isPercentMode) {
        stackGenerator.offset(d3Shape.stackOffsetExpand);
    }

    const stackedSeries = stackGenerator(chartData);

    // Handle click for selection
    const handleClick = useCallback((rowLabel: string, segmentKey: string, event: React.MouseEvent) => {
        if (!interactive || !onSelectionChange) return;

        // In single variable mode, we select the segment (category).
        // In cross-tab mode, we select the row.
        const keyToToggle = isSingleVariable ? segmentKey : rowLabel;

        const newSelection = new Set(selectedKeys);
        if (event.metaKey || event.ctrlKey) {
            if (newSelection.has(keyToToggle)) {
                newSelection.delete(keyToToggle);
            } else {
                newSelection.add(keyToToggle);
            }
        } else {
            newSelection.clear();
            newSelection.add(keyToToggle);
        }
        onSelectionChange(newSelection);
    }, [interactive, onSelectionChange, selectedKeys, isSingleVariable]);

    // Handle right-click context menu
    const handleContextMenu = useCallback((rowLabel: string, segmentKey: string, value: number, event: React.MouseEvent) => {
        if (!interactive || !onContextMenu) return;
        event.preventDefault();
        event.stopPropagation();

        // In single var mode, we want context menu for the category (segment)
        // In cross-tab, typically the row.
        // But for context menu, it's nice to have specific data point info.

        const dataPoint = {
            label: isSingleVariable ? segmentKey : rowLabel,
            value: value,
            percent: 0, // Calculated below if needed or approximate
            rawValue: isSingleVariable ? segmentKey : rowLabel, // Approximate mapping
        };

        onContextMenu({
            selected: [dataPoint],
            position: { x: event.clientX, y: event.clientY },
        });
    }, [interactive, onContextMenu, isSingleVariable]);

    // Scales
    const yScale = useMemo(() => {
        return d3.scaleBand()
            .domain(chartData.map(d => d.label))
            .range([0, actualHeight])
            .padding(0.2);
    }, [chartData, actualHeight]);

    const xScale = useMemo(() => {
        const maxVal = isPercentMode
            ? 1
            : (max(stackedSeries, s => max(s, d => d[1])) || 1);
        return d3.scaleLinear()
            .domain([0, maxVal])
            .range([0, innerWidth]);
    }, [stackedSeries, innerWidth, isPercentMode]);

    // X-axis ticks
    const xTicks = isPercentMode
        ? [0, 0.25, 0.5, 0.75, 1]
        : xScale.ticks(5);

    return (
        <div style={{ width, height, overflowY: 'auto', overflowX: 'hidden' }}>
            <svg
                width={width}
                height={Math.max(height, actualHeight + margin.top + margin.bottom)}
                className="overflow-visible font-body"
                style={{ display: 'block' }}
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {/* Legend (Top) */}
                    <g transform={`translate(${(innerWidth - legendWidth) / 2}, -${margin.top - 8})`}>
                        {stackLabels.map((label, i) => {
                            const xOffset = i * legendItemWidth;
                            return (
                                <g key={stackKeys[i]} transform={`translate(${xOffset}, 0)`}>
                                    <rect
                                        width={12}
                                        height={12}
                                        rx={1}
                                        fill={colors ? colors[i % colors.length] : `var(--viz-palette-${(i % 6) + 1})`}
                                        style={{
                                            fillOpacity: 0.8
                                        }}
                                    />
                                    <text
                                        x={18}
                                        y={10}
                                        className="text-[11px] fill-[var(--viz-text-axis)]"
                                        style={{ fontFamily: 'var(--font-body)' }}
                                    >
                                        {(label || '').length > 12 ? (label || '').substring(0, 10) + '...' : (label || '')}
                                    </text>
                                </g>
                            );
                        })}
                    </g>

                    {/* Grid lines */}
                    {xTicks.map(tick => (
                        <line
                            key={tick}
                            x1={xScale(tick)}
                            y1={0}
                            x2={xScale(tick)}
                            y2={actualHeight}
                            stroke="var(--viz-grid-line)"
                            strokeDasharray="2,2"
                        />
                    ))}

                    {/* X-axis */}
                    <g transform={`translate(0,${actualHeight})`}>
                        <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="var(--border-color)" />
                        {xTicks.map(tick => (
                            <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                                <line y2={4} stroke="var(--viz-stroke-main)" />
                                <text
                                    y={18}
                                    textAnchor="middle"
                                    className="text-[10px] fill-[var(--viz-text-axis)] font-mono"
                                >
                                    {isPercentMode
                                        ? `${Math.round(tick * 100)}%`
                                        : tick.toLocaleString()}
                                </text>
                            </g>
                        ))}
                    </g>

                    {/* Y Axis Labels */}
                    {chartData.map((d) => (
                        <text
                            key={d.label}
                            x={-12}
                            y={(yScale(d.label) || 0) + yScale.bandwidth() / 2}
                            dy=".35em"
                            textAnchor="end"
                            className="text-xs fill-[var(--viz-text-axis)]"
                            style={{ fontFamily: 'var(--font-body)' }}
                        >
                            {(d.label || '').length > 25 ? (d.label || '').substring(0, 23) + '...' : d.label}
                        </text>
                    ))}

                    {/* Stacked Bars */}
                    {stackedSeries.map((seriesItem, seriesIndex) => (
                        <g
                            key={stackKeys[seriesIndex]}
                            fill={colors ? colors[seriesIndex % colors.length] : `var(--viz-palette-${(seriesIndex % 6) + 1})`}
                            fillOpacity={colors ? 1 : 0.8}
                        >
                            {seriesItem.map((d, i) => {
                                const barWidth = xScale(d[1]) - xScale(d[0]);
                                const y = yScale(d.data.label) || 0;

                                // Determine if selected
                                // In single var: selected if stackKey (segment) is in selection
                                // In cross tab: selected if rowLabel is in selection
                                const rowLabel = d.data.label;
                                const segmentKey = stackKeys[seriesIndex];

                                const isSelected = isSingleVariable
                                    ? selectedKeys?.has(segmentKey)
                                    : selectedKeys?.has(rowLabel);

                                // Only show label if segment is wide enough
                                const showLabel = barWidth > 30;
                                const value = d[1] - d[0];
                                const displayValue = isPercentMode
                                    ? `${Math.round(value * 100)}%`
                                    : value.toLocaleString();

                                return (
                                    <g
                                        key={`${d.data.label}-${segmentKey}`}
                                        onClick={(e) => handleClick(d.data.label, segmentKey, e)}
                                        onContextMenu={(e) => handleContextMenu(d.data.label, segmentKey, value, e)}
                                        style={{ cursor: interactive ? 'pointer' : 'default' }}
                                    >
                                        <rect
                                            y={y}
                                            x={xScale(d[0])}
                                            width={Math.max(barWidth, 0)}
                                            height={yScale.bandwidth()}
                                            className="transition-all duration-300 hover:opacity-80 chart-bar-rect"
                                            stroke={isSelected ? 'var(--text-accent)' : 'var(--viz-stroke-bar)'}
                                            strokeWidth={isSelected ? 2 : 1}
                                        />
                                        {labelMode !== 'none' && showLabel && (
                                            <text
                                                x={xScale(d[0]) + barWidth / 2}
                                                y={y + yScale.bandwidth() / 2}
                                                dy=".35em"
                                                textAnchor="middle"
                                                className="text-[10px] font-medium fill-[var(--viz-text-value)] pointer-events-none font-mono"
                                                style={{ textShadow: 'none' }}
                                            >
                                                {displayValue}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    ))}

                    {/* Row totals (right side) */}
                    {labelMode !== 'none' && chartData.map((d) => {
                        const total = d._total;
                        const y = yScale(d.label) || 0;
                        return (
                            <text
                                key={`total-${d.label}`}
                                x={innerWidth + 8}
                                y={y + yScale.bandwidth() / 2}
                                dy=".35em"
                                className="text-[10px] fill-[var(--viz-text-axis)]"
                            >
                                n={total.toLocaleString()}
                            </text>
                        );
                    })}

                    {/* Baseline */}
                    <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={actualHeight}
                        stroke="var(--viz-stroke-main)"
                    />
                </g>
            </svg>
        </div>
    );
};

