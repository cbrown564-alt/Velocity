import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3-scale';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';

/**
 * Diverging Bar Chart Renderer
 * Used for Likert scales and sentiment analysis.
 * Aligns bars around a central neutral axis.
 * 
 * Improvements:
 * - Continuous color scale (Blue -> Grey -> Red)
 * - Separation of "N/A" / "Don't know" categories
 * - Numeric sorting of scale (handled in parent, but robust logic here)
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
    labelMode = 'none', // Default to none
}) => {
    const { rows, columns } = processedData;

    // 1. Separate Scale Columns vs Special Columns (N/A, Don't know)
    const { scaleColumns, specialColumns } = useMemo(() => {
        const specialKeywords = ['don\'t know', 'n/a', 'na', 'refused', 'prefer not to say', 'none'];
        const scale: typeof columns = [];
        const special: typeof columns = [];

        columns.forEach(col => {
            const labelLower = (col.label || '').toLowerCase();
            // Check if label matches special keywords
            // Also check if key is explicitly negative or way out of range (99) if needed, 
            // but rely on string matching for now as per plan.
            const isSpecial = specialKeywords.some(kw => labelLower === kw || labelLower.includes(`(${kw})`));

            // Also heuristic: if the scale is mostly numeric (1-10), and this one is not?
            // But usually "not at all" is 1. "not at all" is NOT special.

            if (isSpecial) {
                special.push(col);
            } else {
                scale.push(col);
            }
        });

        return { scaleColumns: scale, specialColumns: special };
    }, [columns]);

    const colCount = scaleColumns.length;

    // 2. Determine split point for Scale Columns
    // If odd (5): split=2 (idx 0,1 left, 2 middle, 3,4 right)
    // If even (4): split=2 (idx 0,1 left, 2,3 right)
    const midPoint = Math.floor(colCount / 2);
    const hasNeutral = colCount % 2 !== 0;

    // Helper to determine segment position
    const getSegmentKeys = () => {
        const left = scaleColumns.slice(0, midPoint).map(c => c.key);
        const right = hasNeutral
            ? scaleColumns.slice(midPoint + 1).map(c => c.key)
            : scaleColumns.slice(midPoint).map(c => c.key);
        const neutral = hasNeutral ? scaleColumns[midPoint].key : null;

        const special = specialColumns.map(c => c.key);

        return { left, right, neutral, special };
    };

    const { left, right, neutral, special } = getSegmentKeys();

    // 3. Calculate extents
    // For diverging part: Max(LeftSum + HalfNeutral, RightSum + HalfNeutral)
    // For special part: Max(SpecialSum) -> We need to reserve space for this on the right.
    const { maxDiverging, maxSpecial } = useMemo(() => {
        let maxDiv = 0;
        let maxSpec = 0;

        rows.forEach(row => {
            let leftSum = 0;
            let rightSum = 0;
            let specSum = 0; // Usually typically one special col per row? Or sum if multiple? treating as stacked for space

            left.forEach(k => leftSum += (row.cells[k]?.count || 0));
            right.forEach(k => rightSum += (row.cells[k]?.count || 0));
            const neutralVal = neutral ? (row.cells[neutral]?.count || 0) : 0;

            maxDiv = Math.max(maxDiv, leftSum + neutralVal / 2, rightSum + neutralVal / 2);

            special.forEach(k => specSum += (row.cells[k]?.count || 0));
            maxSpec = Math.max(maxSpec, specSum);
        });

        return { maxDiverging: maxDiv || 1, maxSpecial: maxSpec };
    }, [rows, left, right, neutral, special]);

    // 4. Layout
    const maxRowLabelLength = Math.max(...rows.map(r => (r.label || '').length), 10);
    const leftMargin = Math.min(Math.max(maxRowLabelLength * 6, 100), 200);

    // Reserve space for "Avg" column
    const avgColumnWidth = 50;
    const rightMargin = 40 + avgColumnWidth;

    const gapForSpecial = 20; // Gap between diverging and special bars
    const margin = { top: 60, right: rightMargin, bottom: 30, left: leftMargin };

    // We split inner width. 
    // Special bars need width roughly proportional?
    // Let's assume the same scale unit (pixels per count) for both.
    // Total Width Unit Space = (maxDiverging * 2) + (maxSpecial > 0 ? maxSpecial + gap : 0)
    // Note: xScale domain is [-maxDiverging, maxDiverging]. 
    // If we want to fit special bars in the same SVG, we need to map them manually or extend the domain.

    // Let's use a single linear scale for "width calculation"
    // Domain size = maxDiverging * 2 + (specialValues?)
    // Actually, distinct scales might be safer if we want the diverging part to be centered in its own area.
    // But aligning the "visual size" of 10 respondents implies a shared scale.

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = Math.max(height - margin.top - margin.bottom, 150);

    const totalDomainWidth = (maxDiverging * 2) + (maxSpecial > 0 ? maxSpecial * 1.2 : 0); // 1.2 for some padding/gap logic in logical units? No, let's do pixel allocation.

    // Allocate width
    // Fraction of width for diverging
    const divergingFraction = (maxDiverging * 2) / totalDomainWidth;
    const divergingWidth = innerWidth * (maxSpecial > 0 ? divergingFraction : 1);

    // The gap in pixels
    const pixelGap = 30;
    // Recalculate if we have special
    // available = innerWidth - (special ? pixelGap : 0)
    // scale = available / totalDomainCounts
    const availablePixels = innerWidth - (maxSpecial > 0 ? pixelGap : 0);
    const pixelsPerUnit = availablePixels / totalDomainWidth;

    const divergingPixelWidth = (maxDiverging * 2) * pixelsPerUnit;
    // const specialPixelWidth = maxSpecial * pixelsPerUnit; // unused directly, implied

    const barHeight = Math.min(Math.max(innerHeight / rows.length - 8, 24), 48);
    const actualHeight = (barHeight + 8) * rows.length;

    // Scales
    // Diverging Scale: Domain [-max, max] -> Range [0, divergingPixelWidth]
    const xDivScale = d3.scaleLinear()
        .domain([-maxDiverging, maxDiverging])
        .range([0, divergingPixelWidth]);

    // Special Scale: Domain [0, maxSpecial] -> Range [0, maxSpecial * pixelsPerUnit]
    const xSpecScale = d3.scaleLinear()
        .domain([0, maxSpecial])
        .range([0, maxSpecial * pixelsPerUnit]);

    const yScale = d3.scaleBand()
        .domain(rows.map(r => r.label))
        .range([0, actualHeight])
        .padding(0.2);

    // Color Scales
    // Main Scale: Linear Blue(Low) -> Grey(Mid) -> Red(High)
    // Domain: [0, 0.5, 1] relative to the index in scaleColumns
    // Use CSS variables for theme awareness? D3 scales need loose color strings, 
    // but we can query the computed style or use hardcoded theme-aware fallbacks if needed.
    // Ideally we use var(--color-info) -> var(--bg-active) -> var(--color-error)
    // Use discrete CSS variables to avoid D3 interpolation issues with var() strings.
    const getColumnColor = (key: string) => {
        // Is it special?
        const specIdx = specialColumns.findIndex(c => c.key === key);
        if (specIdx >= 0) return 'var(--text-secondary)'; // Neutral Grey for N/A

        // Is it scale?
        const scaleIdx = scaleColumns.findIndex(c => c.key === key);
        if (scaleIdx >= 0) {
            // Map index (0..N-1) to 1..5 range
            const normalized = scaleIdx / (scaleColumns.length - 1); // 0 to 1
            const step = Math.round(normalized * 4) + 1; // 1 to 5
            return `var(--viz-diverging-${step})`;
        }
        return 'var(--bg-surface)';
    };

    // Color Accessor for sorting or legend
    const getLegendColors = () => {
        // Scale labels
        const labels = scaleColumns.map((c, i) => {
            const normalized = i / (scaleColumns.length - 1);
            const step = Math.round(normalized * 4) + 1;
            return {
                label: c.label,
                color: `var(--viz-diverging-${step})`
            };
        });
        // Special labels
        specialColumns.forEach(c => {
            labels.push({ label: c.label, color: 'var(--text-secondary)' });
        });
        return labels;
    };

    const legendItems = getLegendColors();

    const handleRowClick = useCallback((rowLabel: string, event: React.MouseEvent) => {
        if (!interactive || !onSelectionChange) return;

        const newSelection = new Set(selectedKeys);
        if (event.metaKey || event.ctrlKey) {
            newSelection.has(rowLabel) ? newSelection.delete(rowLabel) : newSelection.add(rowLabel);
        } else {
            newSelection.clear();
            newSelection.add(rowLabel);
        }
        onSelectionChange(newSelection);
    }, [interactive, onSelectionChange, selectedKeys]);


    const handleRowContextMenu = useCallback((rowLabel: string, event: React.MouseEvent) => {
        if (!interactive || !onContextMenu) return;
        event.preventDefault();
        event.stopPropagation();

        const row = rows.find(r => r.label === rowLabel);
        if (!row) return;

        onContextMenu({
            selected: [{
                label: rowLabel,
                value: row.total,
                percent: 100,
                rawValue: row.label,
            }],
            position: { x: event.clientX, y: event.clientY },
        });
    }, [interactive, onContextMenu, rows]);

    return (
        <svg
            width={width}
            height={Math.max(height, actualHeight + margin.top + margin.bottom)}
            className="overflow-visible font-mono"
        >
            {/* Legend (Top Centered, Wrapped) */}
            <foreignObject x={0} y={0} width={width} height={margin.top}>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 text-[10px] text-[var(--text-secondary)] h-full overflow-y-auto content-center">
                    {legendItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: item.color }} />
                            <span className="truncate max-w-[100px]" title={item.label}>{item.label}</span>
                        </div>
                    ))}
                </div>
            </foreignObject>

            <g transform={`translate(${margin.left},${margin.top})`}>

                {/* Center Line for Diverging Part */}
                <line
                    x1={xDivScale(0)}
                    y1={0}
                    x2={xDivScale(0)}
                    y2={actualHeight}
                    // Center Line for Diverging Part
                    stroke="var(--viz-grid-line)"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                />
                <text
                    x={xDivScale(0)}
                    y={-5}
                    textAnchor="middle"
                    className="text-[10px] fill-[var(--viz-text-axis)]"
                >
                    0
                </text>

                {/* Separator Line for Special Part (if exists) */}
                {maxSpecial > 0 && (
                    <line
                        x1={divergingPixelWidth + pixelGap / 2}
                        y1={0}
                        x2={divergingPixelWidth + pixelGap / 2}
                        y2={actualHeight}
                        stroke="var(--viz-grid-line)"
                        strokeWidth={1}
                    />
                )}

                {/* Separator Line for Average Column */}
                <line
                    x1={divergingPixelWidth + (maxSpecial > 0 ? pixelGap + xSpecScale.range()[1] : 0) + 12}
                    y1={0}
                    x2={divergingPixelWidth + (maxSpecial > 0 ? pixelGap + xSpecScale.range()[1] : 0) + 12}
                    y2={actualHeight}
                    stroke="var(--viz-grid-line)"
                    strokeWidth={1}
                />

                {/* Header for Average Column */}
                <text
                    x={divergingPixelWidth + (maxSpecial > 0 ? pixelGap + xSpecScale.range()[1] : 0) + 20}
                    y={-5}
                    textAnchor="start"
                    className="text-[10px] font-medium fill-[var(--text-secondary)]"
                >
                    Avg
                </text>

                {rows.map(row => {
                    const y = yScale(row.label) || 0;
                    const h = yScale.bandwidth();
                    const neutralVal = neutral ? (row.cells[neutral]?.count || 0) : 0;
                    const isSelected = selectedKeys?.has(row.label);

                    let currentLeft = -(neutralVal / 2);
                    let currentRight = (neutralVal / 2);

                    // Special Stack Start
                    let currentSpecial = 0;

                    const avgValue = (row as any).average;

                    return (
                        <g
                            key={row.label}
                            onClick={(e) => handleRowClick(row.label, e)}
                            onContextMenu={(e) => handleRowContextMenu(row.label, e)}
                            style={{ cursor: interactive ? 'pointer' : 'default' }}
                        >
                            {/* Selection highlight */}
                            {isSelected && (
                                <rect
                                    x={0}
                                    y={y - 2}
                                    width={innerWidth + avgColumnWidth}
                                    height={h + 4}
                                    fill="var(--bg-active)"
                                    rx={3}
                                />
                            )}

                            {/* Y Axis Label */}
                            <text
                                x={-10}
                                y={y + h / 2}
                                dy=".35em"
                                textAnchor="end"
                                className="text-xs font-sans" // Keep rows sans for readability? HorizontalBar used Sans for Y axis labels.
                                style={{
                                    fill: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    fontWeight: isSelected ? 600 : 400,
                                }}
                            >
                                {(row.label || '').length > 25 ? (row.label || '').substring(0, 23) + '...' : (row.label || '')}
                            </text>

                            {/* DIVERGING: Neutral Bar */}
                            {hasNeutral && neutralVal > 0 && (
                                <g>
                                    <rect
                                        x={xDivScale(-neutralVal / 2)}
                                        y={y}
                                        width={xDivScale(neutralVal / 2) - xDivScale(-neutralVal / 2)}
                                        height={h}
                                        fill={getColumnColor(neutral)}
                                    />
                                    {labelMode !== 'none' && (xDivScale(neutralVal / 2) - xDivScale(-neutralVal / 2)) > 24 && (
                                        <text
                                            x={xDivScale(0)}
                                            y={y + h / 2}
                                            dy=".35em"
                                            textAnchor="middle"
                                            className="text-[10px] font-medium fill-[var(--text-primary)] pointer-events-none font-mono"
                                        >
                                            {labelMode === 'percent'
                                                ? `${Math.round(row.cells[neutral]?.percent || 0)}%`
                                                : neutralVal.toLocaleString()}
                                        </text>
                                    )}
                                </g>
                            )}

                            {/* DIVERGING: Left Bars (Negative) */}
                            {left.slice().reverse().map((key) => {
                                const val = row.cells[key]?.count || 0;
                                if (val === 0) return null;

                                const start = currentLeft;
                                const end = currentLeft - val;
                                currentLeft -= val;

                                const xStart = xDivScale(start);
                                const xEnd = xDivScale(end);
                                const bandwidth = xStart - xEnd;

                                return (
                                    <g key={key}>
                                        <rect
                                            x={xEnd}
                                            y={y}
                                            width={Math.max(bandwidth, 0)}
                                            height={h}
                                            fill={getColumnColor(key)}
                                            className="transition-opacity hover:opacity-80"
                                        >
                                            <title>{`${scaleColumns.find(c => c.key === key)?.label || ''}: ${val}`}</title>
                                        </rect>
                                        {labelMode !== 'none' && bandwidth > 24 && (
                                            <text
                                                x={xEnd + bandwidth / 2}
                                                y={y + h / 2}
                                                dy=".35em"
                                                textAnchor="middle"
                                                className="text-[10px] font-medium fill-[var(--text-inverse)] pointer-events-none font-mono"
                                                style={{ textShadow: 'none' }}
                                            >
                                                {labelMode === 'percent'
                                                    ? `${Math.round(row.cells[key]?.percent || 0)}%`
                                                    : val.toLocaleString()}
                                            </text>
                                        )
                                        }
                                    </g>
                                );
                            })}

                            {/* DIVERGING: Right Bars (Positive) */}
                            {right.map((key) => {
                                const val = row.cells[key]?.count || 0;
                                if (val === 0) return null;

                                const start = currentRight;
                                const end = currentRight + val;
                                currentRight += val;

                                const xStart = xDivScale(start);
                                const xEnd = xDivScale(end);
                                const bandwidth = xEnd - xStart;

                                return (
                                    <g key={key}>
                                        <rect
                                            x={xStart}
                                            y={y}
                                            width={Math.max(bandwidth, 0)}
                                            height={h}
                                            fill={getColumnColor(key)}
                                            className="transition-opacity hover:opacity-80"
                                        />
                                        {labelMode !== 'none' && bandwidth > 24 && (
                                            <text
                                                x={xStart + bandwidth / 2}
                                                y={y + h / 2}
                                                dy=".35em"
                                                textAnchor="middle"
                                                className="text-[10px] font-medium fill-[var(--text-inverse)] pointer-events-none font-mono"
                                                style={{ textShadow: 'none' }}
                                            >
                                                {labelMode === 'percent'
                                                    ? `${Math.round(row.cells[key]?.percent || 0)}%`
                                                    : val.toLocaleString()}
                                            </text>
                                        )
                                        }
                                    </g>
                                );
                            })}

                            {/* SPECIAL: Far Right Bars */}
                            {special.map((key) => {
                                const val = row.cells[key]?.count || 0;
                                if (val === 0) return null;

                                const start = currentSpecial;
                                const end = currentSpecial + val;
                                currentSpecial += val;

                                const xBase = divergingPixelWidth + pixelGap;
                                const xStart = xBase + xSpecScale(start);
                                const bandwidth = xSpecScale(val);

                                return (
                                    <g key={key}>
                                        <rect
                                            x={xStart}
                                            y={y}
                                            width={Math.max(bandwidth, 0)}
                                            height={h}
                                            fill={getColumnColor(key)}
                                            className="transition-opacity hover:opacity-80"
                                        />
                                        {labelMode !== 'none' && bandwidth > 24 && (
                                            <text
                                                x={xStart + bandwidth / 2}
                                                y={y + h / 2}
                                                dy=".35em"
                                                textAnchor="middle"
                                                className="text-[10px] font-medium fill-[var(--text-inverse)] pointer-events-none font-mono"
                                            >
                                                {labelMode === 'percent'
                                                    ? `${Math.round(row.cells[key]?.percent || 0)}%`
                                                    : val.toLocaleString()}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Average Column Value */}
                            <text
                                x={divergingPixelWidth + (maxSpecial > 0 ? pixelGap + xSpecScale.range()[1] : 0) + 20}
                                y={y + h / 2}
                                dy=".35em"
                                textAnchor="start"
                                className="text-[10px] font-medium fill-[var(--text-primary)]"
                            >
                                {typeof avgValue === 'number' ? avgValue.toFixed(1) : '-'}
                            </text>
                        </g>
                    );
                })}
            </g >
        </svg >
    );
};
