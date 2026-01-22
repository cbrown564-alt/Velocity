/**
 * InteractiveBarChart Component
 *
 * A bar chart built on Observable Plot with click interaction support.
 * Designed for the Visual ETL feature: click a bar to filter/exclude/group.
 *
 * Features:
 * - Click detection on individual bars
 * - Hover highlighting
 * - Data attributes for mapping clicks → values
 * - Support for both vertical and horizontal orientations
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import * as Plot from '@observablehq/plot';
import styles from './InteractiveBarChart.module.css';

export interface BarDatum {
    /** The category/label for this bar */
    label: string;
    /** The value (count, percentage, etc.) */
    value: number;
    /** Optional: the raw value code (for filtering) */
    code?: number | string;
}

export interface BarClickEvent {
    /** The data for the clicked bar */
    datum: BarDatum;
    /** The DOM event */
    event: MouseEvent;
    /** Position for context menu */
    position: { x: number; y: number };
}

export interface InteractiveBarChartProps {
    /** The data to display */
    data: BarDatum[];
    /** Chart width */
    width?: number;
    /** Chart height */
    height?: number;
    /** Orientation */
    orientation?: 'vertical' | 'horizontal';
    /** Color for bars */
    color?: string;
    /** Color for hovered/selected bars */
    highlightColor?: string;
    /** Currently selected value (for highlighting) */
    selectedValue?: string | number | null;
    /** Callback when a bar is left-clicked (for drag initiation) */
    onBarClick?: (event: BarClickEvent) => void;
    /** Callback when a bar is right-clicked (for context menu) */
    onBarContextMenu?: (event: BarClickEvent) => void;
    /** Callback when hovering a bar */
    onBarHover?: (datum: BarDatum | null) => void;
    /** Optional title */
    title?: string;
    /** Show value labels on bars */
    showValues?: boolean;
    /** Optional className */
    className?: string;
}

export const InteractiveBarChart: React.FC<InteractiveBarChartProps> = ({
    data,
    width = 400,
    height = 300,
    orientation = 'vertical',
    color = 'var(--color-terracotta)',
    highlightColor = 'var(--color-ink)',
    selectedValue = null,
    onBarClick,
    onBarContextMenu,
    onBarHover,
    title,
    showValues = false,
    className,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

    // Build the Plot options
    const plotOptions = useMemo((): Plot.PlotOptions => {
        const isVertical = orientation === 'vertical';

        // Create marks based on orientation
        const marks: Plot.Markish[] = [];

        if (isVertical) {
            marks.push(
                Plot.barY(data, {
                    x: 'label',
                    y: 'value',
                    fill: (d: BarDatum) => {
                        if (selectedValue !== null && d.label === selectedValue) return highlightColor;
                        if (hoveredLabel === d.label) return highlightColor;
                        return color;
                    },
                    // Add data attributes for click detection
                    title: (d: BarDatum) => `${d.label}: ${d.value}`,
                }),
                Plot.ruleY([0])
            );

            if (showValues) {
                marks.push(
                    Plot.text(data, {
                        x: 'label',
                        y: 'value',
                        text: (d: BarDatum) => String(d.value),
                        dy: -8,
                        fill: 'var(--gray-600)',
                        fontSize: 11,
                    })
                );
            }
        } else {
            marks.push(
                Plot.barX(data, {
                    y: 'label',
                    x: 'value',
                    fill: (d: BarDatum) => {
                        if (selectedValue !== null && d.label === selectedValue) return highlightColor;
                        if (hoveredLabel === d.label) return highlightColor;
                        return color;
                    },
                    title: (d: BarDatum) => `${d.label}: ${d.value}`,
                }),
                Plot.ruleX([0])
            );

            if (showValues) {
                marks.push(
                    Plot.text(data, {
                        y: 'label',
                        x: 'value',
                        text: (d: BarDatum) => String(d.value),
                        dx: 8,
                        fill: 'var(--gray-600)',
                        fontSize: 11,
                        textAnchor: 'start',
                    })
                );
            }
        }

        return {
            width,
            height,
            marginTop: title ? 40 : 20,
            marginRight: 20,
            marginBottom: isVertical ? 60 : 20,
            marginLeft: isVertical ? 40 : 120,
            style: {
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                background: 'transparent',
            },
            x: isVertical
                ? { label: null, tickRotate: -45 }
                : { label: null, grid: true },
            y: isVertical
                ? { label: null, grid: true }
                : { label: null },
            marks,
        };
    }, [data, width, height, orientation, color, highlightColor, selectedValue, hoveredLabel, title, showValues]);

    // Render the plot and attach event listeners
    useEffect(() => {
        if (!containerRef.current) return;

        // Render the plot
        const plot = Plot.plot(plotOptions);
        containerRef.current.replaceChildren(plot);

        // Find all rect elements (the bars) and attach data + listeners
        const rects = plot.querySelectorAll('rect');
        rects.forEach((rect, index) => {
            if (index >= data.length) return; // Skip axis/grid rects

            const datum = data[index];
            if (!datum) return;

            // Store data on the element
            rect.setAttribute('data-label', datum.label);
            rect.setAttribute('data-value', String(datum.value));
            if (datum.code !== undefined) {
                rect.setAttribute('data-code', String(datum.code));
            }

            // Add CSS class for hover styling
            rect.classList.add(styles.bar);

            // Mouse events
            rect.addEventListener('mouseenter', () => {
                setHoveredLabel(datum.label);
                onBarHover?.(datum);
            });

            rect.addEventListener('mouseleave', () => {
                setHoveredLabel(null);
                onBarHover?.(null);
            });

            // Left-click handler (for drag initiation or selection)
            rect.addEventListener('click', (e: MouseEvent) => {
                e.stopPropagation();
                onBarClick?.({
                    datum,
                    event: e,
                    position: { x: e.clientX, y: e.clientY },
                });
            });

            // Right-click handler (for context menu)
            rect.addEventListener('contextmenu', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                onBarContextMenu?.({
                    datum,
                    event: e,
                    position: { x: e.clientX, y: e.clientY },
                });
            });
        });

        return () => {
            plot.remove();
        };
    }, [plotOptions, data, onBarClick, onBarContextMenu, onBarHover]);

    return (
        <div className={`${styles.container} ${className || ''}`}>
            {title && <h3 className={styles.title}>{title}</h3>}
            <div ref={containerRef} className={styles.chart} />
        </div>
    );
};
