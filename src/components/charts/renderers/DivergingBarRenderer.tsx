import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3-scale';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { getChartColor } from '../shared/chartColors';

/**
 * Diverging Bar Chart Renderer
 * Used for Likert scales and sentiment analysis (Negative <-> Positive).
 * Aligns bars around a central neutral axis.
 */
export const DivergingBarRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
    interactive = true,
    selectedKeys,
    onSelectionChange,
    onContextMenu,
}) => {
    const { rows, columns } = processedData;
    const colCount = columns.length;

    // Determine split point
    // If odd (5): split=2 (idx 0,1 left, 2 middle, 3,4 right)
    // If even (4): split=2 (idx 0,1 left, 2,3 right)
    const midPoint = Math.floor(colCount / 2);
    const hasNeutral = colCount % 2 !== 0;

    // Helper to determine segment position
    const getSegmentKeys = () => {
        const left = columns.slice(0, midPoint).map(c => c.key);
        const right = hasNeutral
            ? columns.slice(midPoint + 1).map(c => c.key)
            : columns.slice(midPoint).map(c => c.key);
        const neutral = hasNeutral ? columns[midPoint].key : null;
        return { left, right, neutral };
    };

    const { left, right, neutral } = getSegmentKeys();

    // Calculate extents to determine scale domain
    const maxExtent = useMemo(() => {
        return max(rows, row => {
            let leftSum = 0;
            let rightSum = 0;

            left.forEach(k => leftSum += (row.cells[k]?.count || 0));
            right.forEach(k => rightSum += (row.cells[k]?.count || 0));

            const neutralVal = neutral ? (row.cells[neutral]?.count || 0) : 0;

            // The extent on either side is Sum + Half Neutral
            return Math.max(leftSum + neutralVal / 2, rightSum + neutralVal / 2);
        }) || 1;
    }, [rows, left, right, neutral]);

    // Layout
    const maxRowLabelLength = Math.max(...rows.map(r => (r.label || '').length), 10);
    const leftMargin = Math.min(Math.max(maxRowLabelLength * 6, 100), 200);
    const margin = { top: 50, right: 40, bottom: 30, left: leftMargin };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = Math.max(height - margin.top - margin.bottom, 150);

    const barHeight = Math.min(Math.max(innerHeight / rows.length - 8, 24), 48);
    const actualHeight = (barHeight + 8) * rows.length;

    // Scales
    const xScale = d3.scaleLinear()
        .domain([-maxExtent, maxExtent])
        .range([0, innerWidth]);

    const yScale = d3.scaleBand()
        .domain(rows.map(r => r.label))
        .range([0, actualHeight])
        .padding(0.2);

    // Handle row click for selection
    const handleRowClick = useCallback((rowLabel: string, event: React.MouseEvent) => {
        if (!interactive || !onSelectionChange) return;

        const newSelection = new Set(selectedKeys);
        if (event.metaKey || event.ctrlKey) {
            if (newSelection.has(rowLabel)) {
                newSelection.delete(rowLabel);
            } else {
                newSelection.add(rowLabel);
            }
        } else {
            newSelection.clear();
            newSelection.add(rowLabel);
        }
        onSelectionChange(newSelection);
    }, [interactive, onSelectionChange, selectedKeys]);

    // Handle right-click context menu
    const handleRowContextMenu = useCallback((rowLabel: string, event: React.MouseEvent) => {
        if (!interactive || !onContextMenu) return;
        event.preventDefault();
        event.stopPropagation();

        // Find the row data
        const row = rows.find(r => r.label === rowLabel);
        if (!row) return;

        const dataPoint = {
            label: rowLabel,
            value: row.total,
            percent: 100,
            rawValue: row.label,
        };

        onContextMenu({
            selected: [dataPoint],
            position: { x: event.clientX, y: event.clientY },
        });
    }, [interactive, onContextMenu, rows]);

    // Color Logic: Generate a diverging palette if none provided
    // Negative (Red/Orange) -> Neutral (Gray) -> Positive (Green/Blue)
    const getColor = (index: number) => {
        if (colors && colors.length >= colCount) return colors[index];

        // Auto-generated diverging palette
        if (hasNeutral && index === midPoint) return 'var(--gray-300)'; // Neutral

        // If left side (negative)
        if (index < midPoint) {
            // Darker red for more negative (0 is most negative)
            // Linear interpolation from Dark Red to Light Red?
            // Simple mapping for common sizes
            if (index === 0) return '#d32f2f'; // Strong neg
            if (index === 1) return '#e57373'; // Weak neg
            return getChartColor(index);
        }

        // If right side (positive)
        // Light Green to Dark Green
        // Index goes from midPoint+1 to end
        if (index === colCount - 1) return '#388e3c'; // Strong pos
        if (index === colCount - 2) return '#81c784'; // Weak pos

        return getChartColor(index);
    };

    return (
        <svg
            width={width}
            height={Math.max(height, actualHeight + margin.top + margin.bottom)}
            className="overflow-visible font-body"
        >
            <g transform={`translate(${margin.left},${margin.top})`}>

                {/* Legend */}
                <g transform={`translate(${(innerWidth - (colCount * 100)) / 2}, -${margin.top - 10})`}>
                    {columns.map((col, i) => (
                        <g key={col.key} transform={`translate(${i * 100}, 0)`}>
                            <rect width={12} height={12} rx={2} fill={getColor(i)} />
                            <text x={18} y={10} className="text-[10px] fill-gray-600">
                                {(col.label || '').length > 12 ? (col.label || '').substring(0, 10) + '...' : (col.label || '')}
                            </text>
                        </g>
                    ))}
                </g>

                {/* Center Line */}
                <line
                    x1={xScale(0)}
                    y1={0}
                    x2={xScale(0)}
                    y2={actualHeight}
                    stroke="var(--gray-400)"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                />

                {/* Rows */}
                {rows.map(row => {
                    const y = yScale(row.label) || 0;
                    const h = yScale.bandwidth();
                    const neutralVal = neutral ? (row.cells[neutral]?.count || 0) : 0;
                    const isSelected = selectedKeys?.has(row.label);

                    // Track position for stacking
                    let currentLeft = -(neutralVal / 2);
                    let currentRight = (neutralVal / 2);

                    return (
                        <g
                            key={row.label}
                            onClick={(e) => handleRowClick(row.label, e)}
                            onContextMenu={(e) => handleRowContextMenu(row.label, e)}
                            style={{ cursor: interactive ? 'pointer' : 'default' }}
                        >
                            {/* Selection highlight background */}
                            {isSelected && (
                                <rect
                                    x={0}
                                    y={y - 2}
                                    width={innerWidth}
                                    height={h + 4}
                                    fill="var(--gray-100)"
                                    rx={3}
                                />
                            )}
                            {/* Y Axis Label */}
                            <text
                                x={-10}
                                y={y + h / 2}
                                dy=".35em"
                                textAnchor="end"
                                className="text-xs"
                                style={{
                                    fill: isSelected ? 'var(--gray-900)' : 'var(--gray-700)',
                                    fontWeight: isSelected ? 600 : 400,
                                }}
                            >
                                {(row.label || '').length > 25 ? (row.label || '').substring(0, 23) + '...' : (row.label || '')}
                            </text>

                            {/* Neutral Bar (Centered) */}
                            {hasNeutral && neutralVal > 0 && (
                                <rect
                                    x={xScale(-neutralVal / 2)}
                                    y={y}
                                    width={xScale(neutralVal / 2) - xScale(-neutralVal / 2)}
                                    height={h}
                                    fill={getColor(midPoint)}
                                />
                            )}

                            {/* Left Bars (Negative) - Iterate backwards from midPoint-1 to 0 */}
                            {left.slice().reverse().map((key, i) => {
                                // Original index mapping
                                const colIndex = midPoint - 1 - i;
                                const val = row.cells[key]?.count || 0;
                                if (val === 0) return null;

                                const start = currentLeft;
                                const end = currentLeft - val;
                                currentLeft -= val;

                                return (
                                    <rect
                                        key={key}
                                        x={xScale(end)}
                                        y={y}
                                        width={xScale(start) - xScale(end)}
                                        height={h}
                                        fill={getColor(colIndex)}
                                        className="transition-opacity hover:opacity-80"
                                    >
                                        <title>{`${columns[colIndex].label}: ${val}`}</title>
                                    </rect>
                                );
                            })}

                            {/* Right Bars (Positive) - Iterate forwards */}
                            {right.map((key, i) => {
                                const colIndex = hasNeutral ? midPoint + 1 + i : midPoint + i;
                                const val = row.cells[key]?.count || 0;
                                if (val === 0) return null;

                                const start = currentRight;
                                const end = currentRight + val;
                                currentRight += val;

                                return (
                                    <rect
                                        key={key}
                                        x={xScale(start)}
                                        y={y}
                                        width={xScale(end) - xScale(start)}
                                        height={h}
                                        fill={getColor(colIndex)}
                                        className="transition-opacity hover:opacity-80"
                                    >
                                        <title>{`${columns[colIndex].label}: ${val}`}</title>
                                    </rect>
                                );
                            })}
                        </g>
                    );
                })}
            </g>
        </svg>
    );
};
