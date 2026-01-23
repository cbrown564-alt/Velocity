/**
 * D3BarChart Component
 *
 * A bar chart built with pure D3 for maximum control and performance.
 * Supports brush selection, click selection, and context menus.
 *
 * Features:
 * - Brush drag to select multiple bars
 * - Click to toggle selection
 * - Cmd/Shift+click for multi-select
 * - Right-click on selection for context menu
 * - Instant rendering (~5ms for 10 bars)
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { brushX, brushY } from 'd3-brush';
import { max } from 'd3-array';
import styles from './D3BarChart.module.css';

export interface BarDatum {
    label: string;
    value: number;
    code?: number | string;
}

export interface SelectionEvent {
    /** Selected bar data */
    selected: BarDatum[];
    /** Position for context menu */
    position: { x: number; y: number };
}

export interface D3BarChartProps {
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
    /** Color for selected bars */
    selectedColor?: string;
    /** Callback when selection changes */
    onSelectionChange?: (selected: BarDatum[]) => void;
    /** Callback when right-clicking on selection */
    onContextMenu?: (event: SelectionEvent) => void;
    /** Optional className */
    className?: string;
}

export const D3BarChart: React.FC<D3BarChartProps> = ({
    data,
    width = 280,
    height = 200,
    orientation = 'horizontal',
    color = 'var(--color-charcoal)',
    selectedColor = 'var(--color-terracotta)',
    onSelectionChange,
    onContextMenu,
    className,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());

    // Margins
    const margin = orientation === 'horizontal'
        ? { top: 10, right: 40, bottom: 20, left: 100 }
        : { top: 10, right: 20, bottom: 60, left: 40 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Handle selection change
    const updateSelection = useCallback((labels: Set<string>) => {
        setSelectedLabels(labels);
        const selected = data.filter(d => labels.has(d.label));
        onSelectionChange?.(selected);
    }, [data, onSelectionChange]);

    // Handle bar click
    const handleBarClick = useCallback((datum: BarDatum, event: MouseEvent) => {
        const newSelection = new Set(selectedLabels);

        if (event.metaKey || event.ctrlKey) {
            // Toggle selection
            if (newSelection.has(datum.label)) {
                newSelection.delete(datum.label);
            } else {
                newSelection.add(datum.label);
            }
        } else if (event.shiftKey && selectedLabels.size > 0) {
            // Range selection
            const labels = data.map(d => d.label);
            const lastSelected = Array.from(selectedLabels).pop()!;
            const lastIdx = labels.indexOf(lastSelected);
            const currentIdx = labels.indexOf(datum.label);
            const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
            for (let i = start; i <= end; i++) {
                newSelection.add(labels[i]);
            }
        } else {
            // Single selection
            newSelection.clear();
            newSelection.add(datum.label);
        }

        updateSelection(newSelection);
    }, [data, selectedLabels, updateSelection]);

    // Handle right-click
    const handleContextMenu = useCallback((event: MouseEvent) => {
        if (selectedLabels.size === 0) return;

        event.preventDefault();
        const selected = data.filter(d => selectedLabels.has(d.label));
        onContextMenu?.({
            selected,
            position: { x: event.clientX, y: event.clientY },
        });
    }, [data, selectedLabels, onContextMenu]);

    // Render chart
    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Create scales
        const isHorizontal = orientation === 'horizontal';

        const categoryScale = scaleBand<string>()
            .domain(data.map(d => d.label))
            .range(isHorizontal ? [0, innerHeight] : [0, innerWidth])
            .padding(0.2);

        const valueScale = scaleLinear()
            .domain([0, max(data, d => d.value) || 0])
            .nice()
            .range(isHorizontal ? [0, innerWidth] : [innerHeight, 0]);

        // Create main group
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Add axes
        if (isHorizontal) {
            // Y-axis (categories)
            g.append('g')
                .attr('class', styles.axis)
                .call(axisLeft(categoryScale).tickSize(0).tickPadding(8))
                .call(g => g.select('.domain').remove());

            // X-axis (values)
            g.append('g')
                .attr('class', styles.axis)
                .attr('transform', `translate(0,${innerHeight})`)
                .call(axisBottom(valueScale).ticks(5).tickSize(-innerHeight))
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line').attr('stroke', 'var(--gray-200)'));
        } else {
            // X-axis (categories)
            g.append('g')
                .attr('class', styles.axis)
                .attr('transform', `translate(0,${innerHeight})`)
                .call(axisBottom(categoryScale).tickSize(0).tickPadding(8))
                .call(g => g.select('.domain').remove())
                .selectAll('text')
                .attr('transform', 'rotate(-45)')
                .style('text-anchor', 'end');

            // Y-axis (values)
            g.append('g')
                .attr('class', styles.axis)
                .call(axisLeft(valueScale).ticks(5).tickSize(-innerWidth))
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line').attr('stroke', 'var(--gray-200)'));
        }

        // Add bars
        const bars = g.selectAll<SVGRectElement, BarDatum>('.bar')
            .data(data)
            .join('rect')
            .attr('class', styles.bar)
            .attr('x', d => isHorizontal ? 0 : categoryScale(d.label)!)
            .attr('y', d => isHorizontal ? categoryScale(d.label)! : valueScale(d.value))
            .attr('width', d => isHorizontal ? valueScale(d.value) : categoryScale.bandwidth())
            .attr('height', d => isHorizontal ? categoryScale.bandwidth() : innerHeight - valueScale(d.value))
            .attr('fill', d => selectedLabels.has(d.label) ? selectedColor : color)
            .attr('rx', 2)
            .style('cursor', 'pointer');

        // Add value labels
        g.selectAll<SVGTextElement, BarDatum>('.value-label')
            .data(data)
            .join('text')
            .attr('class', styles.valueLabel)
            .attr('x', d => isHorizontal ? valueScale(d.value) + 4 : categoryScale(d.label)! + categoryScale.bandwidth() / 2)
            .attr('y', d => isHorizontal ? categoryScale(d.label)! + categoryScale.bandwidth() / 2 : valueScale(d.value) - 4)
            .attr('dy', isHorizontal ? '0.35em' : 0)
            .attr('text-anchor', isHorizontal ? 'start' : 'middle')
            .text(d => d.value);

        // Click handler
        bars.on('click', function (event: MouseEvent, d: BarDatum) {
            event.stopPropagation();
            handleBarClick(d, event);
        });

        // Context menu handler
        svg.on('contextmenu', function (event: MouseEvent) {
            handleContextMenu(event);
        });

        // Brush for drag selection
        const brush = isHorizontal
            ? brushY<unknown>()
                .extent([[0, 0], [innerWidth, innerHeight]])
                .on('end', (event) => {
                    if (!event.selection) return;
                    const [y0, y1] = event.selection as [number, number];
                    const selected = data.filter(d => {
                        const barY = categoryScale(d.label)!;
                        const barH = categoryScale.bandwidth();
                        return barY + barH > y0 && barY < y1;
                    });
                    updateSelection(new Set(selected.map(d => d.label)));
                    // Clear brush after selection
                    g.select<SVGGElement>('.brush').call(brush.move, null);
                })
            : brushX<unknown>()
                .extent([[0, 0], [innerWidth, innerHeight]])
                .on('end', (event) => {
                    if (!event.selection) return;
                    const [x0, x1] = event.selection as [number, number];
                    const selected = data.filter(d => {
                        const barX = categoryScale(d.label)!;
                        const barW = categoryScale.bandwidth();
                        return barX + barW > x0 && barX < x1;
                    });
                    updateSelection(new Set(selected.map(d => d.label)));
                    // Clear brush after selection
                    g.select<SVGGElement>('.brush').call(brush.move, null);
                });

        // Add brush layer
        const brushG = g.append('g')
            .attr('class', 'brush')
            .call(brush as any);

        // Style brush
        brushG.select('.selection')
            .attr('fill', 'var(--color-terracotta)')
            .attr('fill-opacity', 0.2)
            .attr('stroke', 'var(--color-terracotta)');

        // Click outside to clear selection
        svg.on('click', function (event: MouseEvent) {
            if (event.target === svgRef.current) {
                updateSelection(new Set());
            }
        });

    }, [data, width, height, orientation, color, selectedColor, innerWidth, innerHeight, margin, selectedLabels, handleBarClick, handleContextMenu, updateSelection]);

    // Update bar colors when selection changes
    useEffect(() => {
        if (!svgRef.current) return;
        d3.select(svgRef.current)
            .selectAll<SVGRectElement, BarDatum>('.bar')
            .attr('fill', d => selectedLabels.has(d.label) ? selectedColor : color);
    }, [selectedLabels, color, selectedColor]);

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className={styles.svg}
            />
            {selectedLabels.size > 0 && (
                <div className={styles.selectionInfo}>
                    {selectedLabels.size} selected (right-click to group)
                </div>
            )}
        </div>
    );
};
