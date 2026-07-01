import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3-scale';
import * as d3Shape from 'd3-shape';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { CHART_BAR_FILL_OPACITY } from '../shared/chartColors';
import { useChartSelection } from '../hooks/useChartSelection';
import { ChartPlotArea } from '../shared/ChartPlotArea';
import { SvgChartSeriesLegend } from '../shared/SvgChartSeriesLegend';
import { formatAxisTick, formatBarTooltip, formatBarValueLabel } from '../../../core/visualization/chartLabelFormatters';

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
      const keys = rows.map((r) => r.label);

      const item: Record<string, any> = {
        label: variableLabel,
        _total: grandTotal,
      };

      // Populate the single item with counts from each category row
      rows.forEach((r) => {
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
      const keys = rows.map((r) => r.rawValue);
      const data = columns.map((col) => {
        const item: Record<string, any> = { label: col.label };
        rows.forEach((row) => {
          item[row.rawValue] = row.cells[col.key]?.count || 0;
        });
        item._total = col.total;
        return item;
      });

      return {
        chartData: data,
        stackKeys: keys,
        stackLabels: rows.map((r) => r.label),
        rowLabels: columns.map((c) => c.label),
      };
    }
  }, [rows, columns, rowVariables, grandTotal, isSingleVariable]);

  // Dynamic margin based on label lengths
  const maxRowLabelLength = Math.max(...rowLabels.map((l) => (l || '').length), 10);
  const leftMargin = Math.min(Math.max(maxRowLabelLength * 6, 100), 200);

  // Legend layout handled by SvgChartSeriesLegend
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

  const { handleToggle } = useChartSelection({
    interactive,
    selectedKeys,
    onSelectionChange,
  });

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (rowLabel: string, segmentKey: string, value: number, event: React.MouseEvent) => {
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
    },
    [interactive, onContextMenu, isSingleVariable],
  );

  // Scales
  const yScale = useMemo(() => {
    return d3
      .scaleBand()
      .domain(chartData.map((d) => d.label))
      .range([0, actualHeight])
      .padding(0.2);
  }, [chartData, actualHeight]);

  const xScale = useMemo(() => {
    const maxVal = isPercentMode ? 1 : max(stackedSeries, (s) => max(s, (d) => d[1])) || 1;
    return d3.scaleLinear().domain([0, maxVal]).range([0, innerWidth]);
  }, [stackedSeries, innerWidth, isPercentMode]);

  // X-axis ticks
  const xTicks = isPercentMode ? [0, 0.25, 0.5, 0.75, 1] : xScale.ticks(5);

  return (
    <div style={{ width, height, overflowY: 'auto', overflowX: 'auto' }}>
      <svg
        width={width}
        height={Math.max(height, actualHeight + margin.top + margin.bottom)}
        className="overflow-visible font-body"
        style={{ display: 'block' }}
      >
        <ChartPlotArea margin={margin}>
          <SvgChartSeriesLegend
            labels={stackLabels}
            keys={stackKeys}
            colors={
              colors ??
              stackKeys.map((_, i) => `var(--viz-palette-${(i % 6) + 1})`)
            }
            innerWidth={innerWidth}
            fillOpacity={CHART_BAR_FILL_OPACITY}
          />

          {/* Grid lines */}
          {xTicks.map((tick) => (
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
            {xTicks.map((tick) => (
              <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                <line y2={4} stroke="var(--viz-stroke-main)" />
                <text y={18} textAnchor="middle" className="text-[10px] fill-[var(--viz-text-axis)] font-mono">
                  {formatAxisTick(labelMode ?? 'count', tick)}
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
          {stackedSeries.map((seriesItem, seriesIndex) => {
            const segmentColor = colors
              ? colors[seriesIndex % colors.length]
              : `var(--viz-palette-${(seriesIndex % 6) + 1})`;

            return (
              <g key={stackKeys[seriesIndex]}>
                {seriesItem.map((d) => {
                  const barWidth = xScale(d[1]) - xScale(d[0]);
                  const y = yScale(d.data.label) || 0;

                  // Determine if selected
                  // In single var: selected if stackKey (segment) is in selection
                  // In cross tab: selected if rowLabel is in selection
                  const rowLabel = d.data.label;
                  const segmentKey = stackKeys[seriesIndex];

                  const isSelected = isSingleVariable ? selectedKeys?.has(segmentKey) : selectedKeys?.has(rowLabel);

                  const showLabel = barWidth > 30;
                  const value = d[1] - d[0];
                  const segmentPercent = isPercentMode ? value * 100 : (value / (d.data._total || 1)) * 100;
                  const displayValue = formatBarValueLabel(labelMode ?? 'count', value, segmentPercent);
                  const segmentLabel = stackLabels[seriesIndex] ?? segmentKey;

                  return (
                    <g
                      key={`${d.data.label}-${segmentKey}`}
                      onClick={(e) => handleToggle(isSingleVariable ? segmentKey : d.data.label, e)}
                      onContextMenu={(e) => handleContextMenu(d.data.label, segmentKey, value, e)}
                      style={{ cursor: interactive ? 'pointer' : 'default' }}
                    >
                      <rect
                        y={y}
                        x={xScale(d[0])}
                        width={Math.max(barWidth, 0)}
                        height={yScale.bandwidth()}
                        fill={segmentColor}
                        fillOpacity={CHART_BAR_FILL_OPACITY}
                        className="transition-all duration-300 hover:opacity-80 chart-bar-rect"
                        stroke={isSelected ? 'var(--text-accent)' : 'var(--viz-stroke-bar)'}
                        strokeWidth={isSelected ? 2 : 1}
                      >
                        <title>{formatBarTooltip(segmentLabel, Math.round(value), segmentPercent)}</title>
                      </rect>
                      {labelMode !== 'none' && showLabel && displayValue && (
                        <text
                          x={xScale(d[0]) + barWidth / 2}
                          y={y + yScale.bandwidth() / 2}
                          dy=".35em"
                          textAnchor="middle"
                          className="text-[10px] font-medium fill-[var(--text-inverse)] pointer-events-none font-mono"
                          style={{ textShadow: 'none' }}
                        >
                          {displayValue}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Row totals (right side) */}
          {labelMode !== 'none' &&
            chartData.map((d) => {
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
          <line x1={0} y1={0} x2={0} y2={actualHeight} stroke="var(--viz-stroke-main)" />
        </ChartPlotArea>
      </svg>
    </div>
  );
};
