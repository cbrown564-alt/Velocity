import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3-scale';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { CHART_BAR_FILL_OPACITY, CHART_PALETTE } from '../shared/chartColors';
import { SvgChartSeriesLegend } from '../shared/SvgChartSeriesLegend';
import { formatAxisTick, formatBarTooltip, formatBarValueLabel } from '../../../core/visualization/chartLabelFormatters';

const DEFAULT_PALETTE = CHART_PALETTE;

/**
 * Grouped Bar Chart Renderer
 * Displays multiple series side-by-side for each category.
 * Useful for comparing exact values across categories.
 */
export const GroupedBarRenderer: React.FC<BaseChartRendererProps> = ({
  width,
  height,
  colors,
  processedData,
  interactive = true,
  onContextMenu,
  labelMode = 'count',
}) => {
  const { rows, columns } = processedData;

  // Get column keys and labels for the legend/sub-groups
  const columnKeys = columns.map((c) => c.key);
  const columnLabels = columns.map((c) => c.label);

  // Dynamic margin based on label lengths
  const maxRowLabelLength = Math.max(...rows.map((r) => (r.label || '').length), 10);
  const leftMargin = Math.min(Math.max(maxRowLabelLength * 6, 100), 200);

  // Calculate legend width — dynamic layout handled by SvgChartSeriesLegend
  const margin = { top: 48, right: 40, bottom: 32, left: leftMargin };
  const innerWidth = Math.max(width - margin.left - margin.right, 200);

  // Calculate height based on number of rows and groups
  // Each group needs enough space for N bars
  const groupPadding = 0.2;
  const barPadding = 0.1; // Padding between bars in a group

  // Minimum height per bar within a group
  const minBarHeight = 16;
  const groupHeight = Math.max((minBarHeight * columns.length) / (1 - barPadding), 40);

  // Total chart height
  const actualHeight = groupHeight * rows.length;

  // Scales
  // Y0: The main row categories
  const y0Scale = useMemo(() => {
    return d3
      .scaleBand()
      .domain(rows.map((r) => r.label))
      .range([0, actualHeight])
      .padding(groupPadding);
  }, [rows, actualHeight]);

  // Y1: The sub-categories (columns) within each row
  const y1Scale = useMemo(() => {
    return d3.scaleBand().domain(columnKeys).range([0, y0Scale.bandwidth()]).padding(barPadding);
  }, [columnKeys, y0Scale]);

  const isPercentMode = labelMode === 'percent';

  // X: Validation scale
  const xScale = useMemo(() => {
    const maxVal =
      (isPercentMode
        ? max(rows, (row) => {
            return max(columnKeys, (key) => {
              const cell = row.cells[key];
              if (!cell) return 0;
              return cell.percent / 100;
            });
          })
        : max(rows, (row) => {
            return max(columnKeys, (key) => row.cells[key]?.count || 0);
          })) || 1;

    return d3
      .scaleLinear()
      .domain([0, maxVal * 1.1]) // Add 10% padding
      .range([0, innerWidth]);
  }, [rows, columnKeys, innerWidth, isPercentMode]);

  const xTicks = xScale.ticks(5);

  // Handle right-click on a row group
  const handleRowContextMenu = useCallback(
    (row: any, event: React.MouseEvent) => {
      if (!interactive || !onContextMenu) return;
      event.preventDefault();
      event.stopPropagation();

      // Build data point from row
      const firstColKey = columns[0]?.key || 'Total';
      const cell = row.cells[firstColKey];
      onContextMenu({
        selected: [
          {
            label: row.label,
            rawValue: row.rawValue,
            value: cell?.count || 0,
            percent: cell?.percent || 0,
          },
        ],
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [interactive, onContextMenu, columns],
  );

  return (
    <div style={{ width, height, overflowY: 'auto', overflowX: 'auto' }}>
      <svg
        width={width}
        height={Math.max(height, actualHeight + margin.top + margin.bottom)}
        style={{ display: 'block', overflow: 'visible', fontFamily: 'var(--font-mono)' }}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          <SvgChartSeriesLegend
            labels={columnLabels}
            keys={columnKeys}
            colors={colors ?? DEFAULT_PALETTE}
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
            <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="var(--viz-stroke-main)" />
            {xTicks.map((tick) => (
              <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                <line y2={4} stroke="var(--viz-stroke-main)" />
                <text y={18} textAnchor="middle" style={{ fontSize: '10px', fill: 'var(--viz-text-axis)' }}>
                  {formatAxisTick(labelMode, tick)}
                </text>
              </g>
            ))}
          </g>

          {/* Y Axis Labels */}
          {rows.map((r) => (
            <text
              key={r.label}
              x={-12}
              y={(y0Scale(r.label) || 0) + y0Scale.bandwidth() / 2}
              dy=".35em"
              textAnchor="end"
              style={{ fontSize: 'var(--text-xs)', fill: 'var(--viz-text-axis)', fontFamily: 'var(--font-body)' }}
            >
              {r.label}
            </text>
          ))}

          {/* Grouped Bars */}
          {rows.map((row) => {
            const groupY = y0Scale(row.label) || 0;

            return (
              <g
                key={row.label}
                transform={`translate(0, ${groupY})`}
                onContextMenu={(e) => handleRowContextMenu(row, e)}
              >
                {columnKeys.map((colKey, i) => {
                  const count = row.cells[colKey]?.count || 0;
                  const percent = row.cells[colKey]?.percent || 0;
                  const value = isPercentMode ? percent / 100 : count;
                  const barWidth = xScale(value);
                  const barY = y1Scale(colKey) || 0;
                  const barHeight = y1Scale.bandwidth();

                  const color = colors ? colors[i % colors.length] : DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
                  return (
                    <g key={colKey}>
                      <rect
                        y={barY}
                        x={0}
                        width={barWidth}
                        height={barHeight}
                        fill={color}
                        fillOpacity={CHART_BAR_FILL_OPACITY}
                        style={{
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          cursor: interactive ? 'pointer' : 'default',
                        }}
                      >
                        <title>{formatBarTooltip(columnLabels[i] ?? colKey, count, percent)}</title>
                      </rect>
                      {/* Value label if wide enough and not hidden */}
                      {labelMode !== 'none' && barWidth > 20 && (
                        <text
                          x={barWidth - 4}
                          y={barY + barHeight / 2}
                          dy=".35em"
                          textAnchor="end"
                          style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            fill: 'var(--text-inverse)',
                            pointerEvents: 'none',
                            textShadow: 'none',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {formatBarValueLabel(labelMode, count, percent)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Baseline */}
          <line x1={0} y1={0} x2={0} y2={actualHeight} stroke="var(--viz-stroke-main)" />
        </g>
      </svg>
    </div>
  );
};
