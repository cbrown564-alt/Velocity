/**
 * D3Histogram Component
 *
 * A histogram for numeric data with draggable bin boundaries.
 * Enables visual binning/bucketing for recoding numeric variables.
 *
 * Features:
 * - Auto-binned histogram based on data range
 * - Draggable boundary handles to adjust bins
 * - Click/brush to select bins
 * - Right-click on selection for context menu
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as d3 from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { bin as d3Bin, max, min, extent } from 'd3-array';
import { drag } from 'd3-drag';
import styles from './D3Histogram.module.css';

export interface HistogramDatum {
    value: number;
}

export interface BinData {
    x0: number;
    x1: number;
    count: number;
    selected?: boolean;
}

export interface BinSelectionEvent {
    /** Selected bins */
    bins: BinData[];
    /** Position for context menu */
    position: { x: number; y: number };
}

export interface D3HistogramProps {
    /** Raw numeric values */
    values: number[];
    /** Number of initial bins (default: auto) */
    binCount?: number;
    /** Custom bin thresholds (overrides binCount) */
    thresholds?: number[];
    /** Chart width */
    width?: number;
    /** Chart height */
    height?: number;
    /** Color for bars */
    color?: string;
    /** Color for selected bars */
    selectedColor?: string;
    /** Callback when bins change (from dragging boundaries) */
    onBinsChange?: (thresholds: number[]) => void;
    /** Callback when selection changes */
    onSelectionChange?: (bins: BinData[]) => void;
    /** Callback when right-clicking on selection */
    onContextMenu?: (event: BinSelectionEvent) => void;
    /** Optional className */
    className?: string;
}

export const D3Histogram: React.FC<D3HistogramProps> = ({
    values,
    binCount = 10,
    thresholds: customThresholds,
    width = 280,
    height = 200,
    color = 'var(--color-terracotta)',
    selectedColor = 'var(--color-ink)',
    onBinsChange,
    onSelectionChange,
    onContextMenu,
    className,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [thresholds, setThresholds] = useState<number[]>([]);

    // Margins
    const margin = { top: 10, right: 20, bottom: 30, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Compute data extent
    const dataExtent = useMemo(() => {
        const [minVal, maxVal] = extent(values) as [number, number];
        return { min: minVal, max: maxVal };
    }, [values]);

    // Initialize thresholds
    useEffect(() => {
        if (customThresholds && customThresholds.length > 0) {
            setThresholds(customThresholds);
        } else if (values.length > 0) {
            // Create evenly spaced thresholds
            const step = (dataExtent.max - dataExtent.min) / binCount;
            const newThresholds: number[] = [];
            for (let i = 1; i < binCount; i++) {
                newThresholds.push(dataExtent.min + step * i);
            }
            setThresholds(newThresholds);
        }
    }, [values, binCount, customThresholds, dataExtent]);

    // Compute bins from thresholds
    const bins = useMemo((): BinData[] => {
        if (values.length === 0) return [];

        const allThresholds = [dataExtent.min, ...thresholds, dataExtent.max];
        const binner = d3Bin<number, number>()
            .domain([dataExtent.min, dataExtent.max])
            .thresholds(thresholds);

        const binned = binner(values);

        return binned.map((b, i) => ({
            x0: b.x0 ?? allThresholds[i],
            x1: b.x1 ?? allThresholds[i + 1],
            count: b.length,
            selected: selectedIndices.has(i),
        }));
    }, [values, thresholds, dataExtent, selectedIndices]);

    // Handle selection change
    const updateSelection = useCallback((indices: Set<number>) => {
        setSelectedIndices(indices);
        const selected = bins.filter((_, i) => indices.has(i));
        onSelectionChange?.(selected);
    }, [bins, onSelectionChange]);

    // Handle bin click
    const handleBinClick = useCallback((index: number, event: MouseEvent) => {
        const newSelection = new Set(selectedIndices);

        if (event.metaKey || event.ctrlKey) {
            if (newSelection.has(index)) {
                newSelection.delete(index);
            } else {
                newSelection.add(index);
            }
        } else if (event.shiftKey && selectedIndices.size > 0) {
            const lastSelected = Math.max(...selectedIndices);
            const [start, end] = index < lastSelected ? [index, lastSelected] : [lastSelected, index];
            for (let i = start; i <= end; i++) {
                newSelection.add(i);
            }
        } else {
            newSelection.clear();
            newSelection.add(index);
        }

        updateSelection(newSelection);
    }, [selectedIndices, updateSelection]);

    // Handle right-click
    const handleContextMenu = useCallback((event: MouseEvent) => {
        if (selectedIndices.size === 0) return;

        event.preventDefault();
        const selected = bins.filter((_, i) => selectedIndices.has(i));
        onContextMenu?.({
            bins: selected,
            position: { x: event.clientX, y: event.clientY },
        });
    }, [bins, selectedIndices, onContextMenu]);

    // Handle threshold drag
    const handleThresholdDrag = useCallback((index: number, newValue: number) => {
        const newThresholds = [...thresholds];

        // Clamp to valid range (between adjacent thresholds)
        const minBound = index === 0 ? dataExtent.min + 0.01 : thresholds[index - 1] + 0.01;
        const maxBound = index === thresholds.length - 1 ? dataExtent.max - 0.01 : thresholds[index + 1] - 0.01;

        newThresholds[index] = Math.max(minBound, Math.min(maxBound, newValue));
        setThresholds(newThresholds);
        onBinsChange?.(newThresholds);
    }, [thresholds, dataExtent, onBinsChange]);

    // Render chart
    useEffect(() => {
        if (!svgRef.current || bins.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Create scales
        const xScale = scaleLinear()
            .domain([dataExtent.min, dataExtent.max])
            .range([0, innerWidth]);

        const yScale = scaleLinear()
            .domain([0, max(bins, d => d.count) || 0])
            .nice()
            .range([innerHeight, 0]);

        // Create main group
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Add X axis
        g.append('g')
            .attr('class', styles.axis)
            .attr('transform', `translate(0,${innerHeight})`)
            .call(axisBottom(xScale).ticks(5))
            .call(g => g.select('.domain').attr('stroke', 'var(--gray-300)'));

        // Add Y axis
        g.append('g')
            .attr('class', styles.axis)
            .call(axisLeft(yScale).ticks(5).tickSize(-innerWidth))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').attr('stroke', 'var(--gray-200)'));

        // Add bars
        const bars = g.selectAll<SVGRectElement, BinData>('.bar')
            .data(bins)
            .join('rect')
            .attr('class', styles.bar)
            .attr('x', d => xScale(d.x0) + 1)
            .attr('y', d => yScale(d.count))
            .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
            .attr('height', d => innerHeight - yScale(d.count))
            .attr('fill', (d, i) => selectedIndices.has(i) ? selectedColor : color)
            .attr('rx', 2)
            .style('cursor', 'pointer');

        // Bar click handler
        bars.on('click', function(event: MouseEvent, d: BinData) {
            event.stopPropagation();
            const index = bins.indexOf(d);
            handleBinClick(index, event);
        });

        // Add count labels on bars
        g.selectAll<SVGTextElement, BinData>('.count-label')
            .data(bins)
            .join('text')
            .attr('class', styles.countLabel)
            .attr('x', d => xScale(d.x0) + (xScale(d.x1) - xScale(d.x0)) / 2)
            .attr('y', d => yScale(d.count) - 4)
            .attr('text-anchor', 'middle')
            .text(d => d.count > 0 ? d.count : '');

        // Add draggable threshold handles
        const handleWidth = 12;
        const handleHeight = innerHeight;

        const handles = g.selectAll<SVGGElement, number>('.threshold-handle')
            .data(thresholds)
            .join('g')
            .attr('class', styles.thresholdHandle)
            .attr('transform', d => `translate(${xScale(d)},0)`);

        // Handle line
        handles.append('line')
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .attr('stroke', 'var(--gray-400)')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,2');

        // Handle drag area (invisible wider area for easier grabbing)
        handles.append('rect')
            .attr('x', -handleWidth / 2)
            .attr('y', 0)
            .attr('width', handleWidth)
            .attr('height', handleHeight)
            .attr('fill', 'transparent')
            .attr('cursor', 'ew-resize');

        // Handle grip indicator
        handles.append('rect')
            .attr('class', styles.handleGrip)
            .attr('x', -3)
            .attr('y', innerHeight / 2 - 10)
            .attr('width', 6)
            .attr('height', 20)
            .attr('rx', 2)
            .attr('fill', 'var(--gray-300)');

        // Drag behavior
        const dragBehavior = drag<SVGGElement, number>()
            .on('drag', function(event, d) {
                const index = thresholds.indexOf(d);
                const newValue = xScale.invert(event.x);
                handleThresholdDrag(index, newValue);
            });

        handles.call(dragBehavior);

        // Context menu handler
        svg.on('contextmenu', function(event: MouseEvent) {
            handleContextMenu(event);
        });

        // Click outside to clear selection
        svg.on('click', function(event: MouseEvent) {
            if (event.target === svgRef.current) {
                updateSelection(new Set());
            }
        });

    }, [bins, thresholds, width, height, innerWidth, innerHeight, margin, dataExtent,
        color, selectedColor, selectedIndices, handleBinClick, handleContextMenu,
        handleThresholdDrag, updateSelection]);

    // Update bar colors when selection changes
    useEffect(() => {
        if (!svgRef.current) return;
        d3.select(svgRef.current)
            .selectAll<SVGRectElement, BinData>('.bar')
            .attr('fill', (_, i) => selectedIndices.has(i) ? selectedColor : color);
    }, [selectedIndices, color, selectedColor]);

    // Format bin range for display
    const formatRange = (bin: BinData) => {
        const format = (n: number) => n.toFixed(1);
        return `${format(bin.x0)} - ${format(bin.x1)}`;
    };

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className={styles.svg}
            />
            {selectedIndices.size > 0 && (
                <div className={styles.selectionInfo}>
                    {selectedIndices.size === 1
                        ? `Selected: ${formatRange(bins[Array.from(selectedIndices)[0]])}`
                        : `${selectedIndices.size} bins selected (right-click to create recode)`
                    }
                </div>
            )}
            <div className={styles.hint}>
                Drag boundaries to adjust bins
            </div>
        </div>
    );
};
