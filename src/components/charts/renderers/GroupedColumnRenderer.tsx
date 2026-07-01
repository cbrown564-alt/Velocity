import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3-scale';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { SvgChartSeriesLegend } from '../shared/SvgChartSeriesLegend';
import { formatAxisTick, formatBarTooltip, formatBarValueLabel } from '../../../core/visualization/chartLabelFormatters';

const DEFAULT_PALETTE = [
  'var(--viz-palette-1)',
  'var(--viz-palette-2)',
  'var(--viz-palette-3)',
  'var(--viz-palette-4)',
  'var(--viz-palette-5)',
  'var(--viz-palette-6)',
];

/**
 * Grouped Column Chart Renderer
 * Displays multiple series side-by-side for each category (vertical bars).
 * Useful for comparing exact values across categories.
 */
export const GroupedColumnRenderer: React.FC<BaseChartRendererProps> = ({
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

  // Calculate dynamic dimensions
  const margin = { top: 48, right: 20, bottom: 40, left: 60 };

  // Determine if we need to expand width based on number of groups
  const groupPadding = 0.2;
  const barPadding = 0.1;
  const minBarWidth = 16; // Minimum width per bar

  // Required width per group (category)
  const minGroupWidth = Math.max(
    (minBarWidth * columns.length) / (1 - barPadding),
    80, // Minimum group width to fit labels reasonably
  );

  // Total required chart width
  const requiredWidth = minGroupWidth * rows.length + margin.left + margin.right;

  // Use the larger of provided width or required width
  // This allows horizontal scrolling if needed (assuming parent container allows it)
  const actualWidth = Math.max(width, requiredWidth);

  const innerWidth = actualWidth - margin.left - margin.right;
  const innerHeight = Math.max(height - margin.top - margin.bottom, 150);

  // Scales
  // X0: The main row categories (Groups)
  const x0Scale = useMemo(() => {
    return d3
      .scaleBand()
      .domain(rows.map((r) => r.label))
      .range([0, innerWidth])
      .padding(groupPadding);
  }, [rows, innerWidth]);

  // X1: The sub-categories (columns) within each group
  const x1Scale = useMemo(() => {
    return d3.scaleBand().domain(columnKeys).range([0, x0Scale.bandwidth()]).padding(barPadding);
  }, [columnKeys, x0Scale]);

  const isPercentMode = labelMode === 'percent';

  // Y: Values scale
  const yScale = useMemo(() => {
    const maxVal =
      (isPercentMode
        ? max(rows, (row) => {
            return max(columnKeys, (key) => {
              const cell = row.cells[key];
              if (!cell) return 0;
              // Use pre-calculated percent from buildTree (it's 0-100)
              return cell.percent / 100;
            });
          })
        : max(rows, (row) => {
            return max(columnKeys, (key) => row.cells[key]?.count || 0);
          })) || 1;

    return d3
      .scaleLinear()
      .domain([0, maxVal * 1.1]) // Add 10% padding
      .range([innerHeight, 0]); // Inverted for SVG Y coords
  }, [rows, columnKeys, innerHeight, isPercentMode]);

  const yTicks = yScale.ticks(5);

  // Handle right-click on a group (row)
  const handleGroupContextMenu = useCallback(
    (row: any, event: React.MouseEvent) => {
      if (!interactive || !onContextMenu) return;
      event.preventDefault();
      event.stopPropagation();

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
    <div style={{ width, height, overflowX: 'auto', overflowY: 'hidden' }}>
      <svg
        width={actualWidth}
        height={height}
        style={{ display: 'block', overflow: 'visible', fontFamily: 'var(--font-mono)' }}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          <SvgChartSeriesLegend
            labels={columnLabels}
            keys={columnKeys}
            colors={colors ?? DEFAULT_PALETTE}
            innerWidth={innerWidth}
          />

          {/* Grid lines (Horizontal for Column chart) */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={0}
              y1={yScale(tick)}
              x2={innerWidth}
              y2={yScale(tick)}
              stroke="var(--viz-grid-line)"
              strokeDasharray="2,2"
            />
          ))}

          {/* Y-axis Labels and Ticks */}
          <g>
            <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--viz-stroke-main)" />
            {yTicks.map((tick) => (
              <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
                <line x2={-4} stroke="var(--viz-stroke-main)" />
                <text x={-8} y={4} textAnchor="end" style={{ fontSize: '10px', fill: 'var(--viz-text-axis)' }}>
                  {formatAxisTick(labelMode, tick)}
                </text>
              </g>
            ))}
          </g>

          {/* X Axis Labels */}
          {rows.map((r) => (
            <g
              key={r.label}
              transform={`translate(${(x0Scale(r.label) || 0) + x0Scale.bandwidth() / 2}, ${innerHeight + 16})`}
            >
              <text
                textAnchor="middle"
                style={{
                  fontSize: 'var(--text-xs)',
                  fill: 'var(--viz-text-axis)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {r.label && r.label.length > 15 ? r.label.substring(0, 12) + '...' : r.label}
              </text>
            </g>
          ))}

          {/* Baseline (Bottom) */}
          <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="var(--viz-stroke-main)" />

          {/* Grouped Columns */}
          {rows.map((row) => {
            const groupX = x0Scale(row.label) || 0;

            return (
              <g
                key={row.label}
                transform={`translate(${groupX}, 0)`}
                onContextMenu={(e) => handleGroupContextMenu(row, e)}
              >
                {columnKeys.map((colKey, i) => {
                  const count = row.cells[colKey]?.count || 0;
                  const percent = row.cells[colKey]?.percent || 0;
                  const value = isPercentMode ? percent / 100 : count;
                  const barHeight = Math.abs(yScale(value) - yScale(0));
                  const barY = yScale(value);
                  const barX = x1Scale(colKey) || 0;
                  const barWidth = x1Scale.bandwidth();

                  const color = colors ? colors[i % colors.length] : DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

                  return (
                    <g key={colKey}>
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        fill={color}
                        fillOpacity={0.8}
                        style={{
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          cursor: interactive ? 'pointer' : 'default',
                        }}
                      >
                        <title>{formatBarTooltip(columnLabels[i] ?? colKey, count, percent)}</title>
                      </rect>
                      {/* Value label if tall enough/wide enough and not hidden */}
                      {labelMode !== 'none' && barHeight > 14 && barWidth > 20 && (
                        <text
                          x={barX + barWidth / 2}
                          y={barY + 12}
                          textAnchor="middle"
                          style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            fill: 'white',
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
        </g>
      </svg>
    </div>
  );
};
