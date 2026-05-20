import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as d3 from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { max, extent } from 'd3-array';
import { BaseChartRendererProps, BinData } from '../../../types/charts';
// getChartColor removed replaced by CSS vars

// Optional CSS module - we'll reuse the one from D3Histogram for now or just inline styles if simple
// For now, let's assume we can use standard D3 styling or a simple shared CSS
import styles from './HistogramRenderer.module.css';

/**
 * Histogram Renderer
 * Renders a histogram for numeric distribution analysis.
 * Supports bin selection and context menus for recoding.
 */
export const HistogramRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
    interactive,
    variableStats,
    onContextMenu,
    labelMode = 'count',
    hoveredKey,
    onHoverChange,
}) => {
    const { rows } = processedData;
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    // Convert ProcessedRows to BinData
    const bins = useMemo((): BinData[] => {
        // 1. Prefer pre-calculated bins from variableStats (from Worker)
        if (variableStats?.numeric?.histogramBins) {
            return variableStats.numeric.histogramBins.map((b: any, i: number) => ({
                x0: b.x0,
                x1: b.x1,
                count: b.count,
                selected: selectedIndices.has(i),
                originalBin: b // Keep reference for context menu
            }));
        }

        // 2. Fallback: Try to construct bins from ProcessedRows
        return rows.map((row, i) => {
            const count = row.total;
            let x0 = 0;
            let x1 = 1;

            // Try to parse range from label (e.g. "10 - 20")
            const rangeMatch = (row.label || '').match(/([\d\.]+)\s*-\s*([\d\.]+)/);
            if (rangeMatch) {
                x0 = parseFloat(rangeMatch[1]);
                x1 = parseFloat(rangeMatch[2]);
            } else {
                const val = parseFloat(row.rawValue);
                if (!isNaN(val)) {
                    x0 = val;
                    // Improved fallback logic
                    const nextRow = rows[i + 1];
                    const nextVal = nextRow ? parseFloat(nextRow.rawValue) : NaN;
                    if (!isNaN(nextVal)) {
                        x1 = nextVal;
                    } else {
                        const prevRow = rows[i - 1];
                        const prevVal = prevRow ? parseFloat(prevRow.rawValue) : NaN;
                        x1 = !isNaN(prevVal) ? x0 + (x0 - prevVal) : x0 + 1;
                    }
                }
            }

            return {
                x0,
                x1,
                count,
                selected: selectedIndices.has(i),
                originalBin: row // Keep reference
            };
        });
    }, [rows, variableStats, selectedIndices]);

    // Margins
    const margin = { top: 10, right: 20, bottom: 20, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const dataExtent = useMemo(() => {
        if (bins.length > 0) {
            return {
                min: bins[0].x0,
                max: bins[bins.length - 1].x1
            };
        }
        return { min: 0, max: 1 };
    }, [bins]);

    // Color resolution
    // Use semantic tokens for data visualization
    const barColor = 'var(--viz-fill-primary)';
    const selectedBarColor = 'var(--viz-fill-secondary)';

    // Handle interactions
    const handleBinClick = useCallback((index: number, event: MouseEvent) => {
        if (!interactive) return;

        const newSelection = new Set(selectedIndices);
        if (event.metaKey || event.ctrlKey) {
            if (newSelection.has(index)) newSelection.delete(index);
            else newSelection.add(index);
        } else if (event.shiftKey && selectedIndices.size > 0) {
            const lastSelected = Math.max(...Array.from(selectedIndices));
            const [start, end] = index < lastSelected ? [index, lastSelected] : [lastSelected, index];
            for (let i = start; i <= end; i++) newSelection.add(i);
        } else {
            newSelection.clear();
            newSelection.add(index);
        }
        setSelectedIndices(newSelection);
    }, [interactive, selectedIndices]);

    const handleContextMenuInteraction = useCallback((event: MouseEvent) => {
        if (!interactive || !onContextMenu || selectedIndices.size === 0) return;
        event.preventDefault();

        const selectedBins = bins.filter((_, i) => selectedIndices.has(i));

        // Transform to expected generic format for AnalysisChart context menu
        // The consumer (VariableInspector) expects { selected: any[], position: ... }
        onContextMenu({
            selected: selectedBins,
            position: { x: event.clientX, y: event.clientY }
        });
    }, [interactive, onContextMenu, selectedIndices, bins]);


    // D3 Render Effect
    useEffect(() => {
        if (!svgRef.current || bins.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const xScale = scaleLinear()
            .domain([dataExtent.min, dataExtent.max])
            .range([0, innerWidth]);

        const yScale = scaleLinear()
            .domain([0, max(bins, d => d.count) || 0])
            .nice()
            .range([innerHeight, 0]);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // X Axis
        g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(axisBottom(xScale).ticks(5))
            .call(g => g.select('.domain').attr('stroke', 'var(--viz-stroke-main)'))
            .call(g => g.selectAll('text').style('font-family', 'var(--font-mono)').style('fill', 'var(--viz-text-axis)'));

        // Y Axis
        g.append('g')
            .call(axisLeft(yScale).ticks(5).tickSize(-innerWidth))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').attr('stroke', 'var(--viz-grid-line)'))
            .call(g => g.selectAll('text').style('font-family', 'var(--font-mono)').style('fill', 'var(--viz-text-axis)'));

        // Bars
        const bars = g.selectAll('.bar')
            .data(bins)
            .join('rect')
            .attr('class', styles.bar)
            .attr('x', d => xScale(d.x0))
            .attr('y', d => yScale(d.count))
            .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0)))
            .attr('height', d => innerHeight - yScale(d.count))
            .attr('fill', (d) => {
                if (d.selected) return selectedBarColor;
                const label = `${d.x0} - ${d.x1}`;
                const isMissing = d.originalBin?.isMissing;
                if (hoveredKey === label) return isMissing ? 'var(--bg-active)' : barColor;
                if (hoveredKey) return 'var(--viz-fill-muted)';
                return isMissing ? 'var(--bg-active)' : barColor;
            })
            .attr('fill-opacity', (d) => {
                const label = `${d.x0} - ${d.x1}`;
                const isMissing = d.originalBin?.isMissing;
                if (d.selected) return 1;
                if (hoveredKey === label) return 1;
                if (hoveredKey) return 0.4;
                return isMissing ? 0.3 : 0.8;
            })
            .attr('stroke', (d) => {
                const label = `${d.x0} - ${d.x1}`;
                const isMissing = d.originalBin?.isMissing;
                return hoveredKey === label ? barColor : (isMissing ? 'var(--text-tertiary)' : 'var(--viz-stroke-bar)');
            })
            .attr('stroke-dasharray', (d) => d.originalBin?.isMissing ? '4,2' : 'none')
            .attr('stroke-width', (d) => {
                const label = `${d.x0} - ${d.x1}`;
                const isMissing = d.originalBin?.isMissing;
                return hoveredKey === label || isMissing ? 2 : 1;
            })
            .attr('rx', 1)
            .style('cursor', interactive ? 'pointer' : 'default')
            .on('mouseenter', (event, d) => {
                if (onHoverChange) onHoverChange(`${d.x0} - ${d.x1}`);
            })
            .on('mouseleave', (event, d) => {
                if (onHoverChange) onHoverChange(null);
            });

        if (interactive) {
            bars.on('click', function (event, d) {
                event.stopPropagation();
                const index = bins.indexOf(d);
                handleBinClick(index, event);
            });

            svg.on('contextmenu', (event) => handleContextMenuInteraction(event));

            // Click background to deselect
            svg.on('click', (event) => {
                if (event.target === svgRef.current) {
                    setSelectedIndices(new Set());
                }
            });
        }

        // Count labels
        if (labelMode !== 'none') {
            const totalCount = bins.reduce((sum, d) => sum + d.count, 0);

            g.selectAll('.count-label')
                .data(bins)
                .join('text')
                .attr('x', d => xScale(d.x0) + (xScale(d.x1) - xScale(d.x0)) / 2)
                .attr('y', d => yScale(d.count) - 4)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', 'var(--viz-text-value)')
                .style('font-family', 'var(--font-mono)')
                .text(d => {
                    if (d.count === 0) return '';
                    if (labelMode === 'percent') {
                        return `${((d.count / totalCount) * 100).toFixed(1)}%`;
                    }
                    return d.count.toLocaleString();
                });
        }


    }, [bins, width, height, innerWidth, innerHeight, margin, dataExtent, barColor, selectedBarColor, interactive, labelMode, handleBinClick, handleContextMenuInteraction, hoveredKey, onHoverChange]);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            className="overflow-visible"
            style={{ fontFamily: 'var(--font-body)' }}
        />
    );
};
