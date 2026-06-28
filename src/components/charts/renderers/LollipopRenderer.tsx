import React, { useMemo } from 'react';
import * as d3 from 'd3-scale';
import { max } from 'd3-array';
import { BaseChartRendererProps } from '../../../types/charts';
import { ChartDataPoint } from '../../../types/processedData';
import { useChartSelection } from '../hooks/useChartSelection';
import { ChartPlotArea } from '../shared/ChartPlotArea';

/**
 * Lollipop Chart Renderer
 * Used for single-variable frequency distributions, alternative to Horizontal Bar.
 * Effective for ranking multiple response items or long lists.
 */
export const LollipopRenderer: React.FC<BaseChartRendererProps> = ({
  width,
  height,
  colors,
  processedData,
  interactive = true,
  selectedKeys,
  onSelectionChange,
  onContextMenu,
  labelMode = 'count',
}) => {
  const chartData = useMemo(() => {
    const series = processedData.series[0];
    return series?.data || [];
  }, [processedData.series]);

  // Dynamic margin similar to Horizontal Bar
  const maxLabelLength = Math.max(...chartData.map((d) => (d.label || '').length), 10);
  const leftMargin = Math.min(Math.max(maxLabelLength * 6, 80), 180);

  const margin = { top: 24, right: 60, bottom: 24, left: leftMargin };
  const innerWidth = Math.max(width - margin.left - margin.right, 100);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 100);

  const barHeight = Math.min(Math.max(innerHeight / chartData.length - 8, 20), 40);
  const actualHeight = (barHeight + 8) * chartData.length;

  const yScale = useMemo(() => {
    return d3
      .scalePoint()
      .domain(chartData.map((d) => d.label))
      .range([0, actualHeight])
      .padding(0.5);
  }, [chartData, actualHeight]);

  const xScale = useMemo(() => {
    const maxVal = max(chartData, (d) => d.value) || 1;
    return d3
      .scaleLinear()
      .domain([0, maxVal * 1.1])
      .range([0, innerWidth]);
  }, [chartData, innerWidth]);

  const { handleToggle } = useChartSelection<ChartDataPoint>({
    interactive,
    selectedKeys,
    onSelectionChange,
    onContextMenu,
  });

  // X-axis ticks
  const xTicks = xScale.ticks(5);

  return (
    <svg
      width={width}
      height={Math.max(height, actualHeight + margin.top + margin.bottom)}
      className="overflow-visible font-mono"
      onContextMenu={(e) => {
        if (interactive && onContextMenu && selectedKeys && selectedKeys.size > 0) {
          e.preventDefault();
          const selectedItems = chartData.filter((d) => selectedKeys.has(d.label));
          onContextMenu({
            selected: selectedItems,
            position: { x: e.clientX, y: e.clientY },
          });
        }
      }}
    >
      <ChartPlotArea margin={margin}>
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
              <text y={16} textAnchor="middle" className="text-[10px] fill-[var(--viz-text-axis)]">
                {tick}
              </text>
            </g>
          ))}
        </g>

        {/* Y Axis Labels */}
        {chartData.map((d) => (
          <text
            key={d.label}
            x={-12}
            y={yScale(d.label)}
            dy=".35em"
            textAnchor="end"
            className={`text-xs ${selectedKeys?.has(d.label) ? 'font-bold fill-[var(--text-primary)]' : 'fill-[var(--viz-text-axis)]'}`}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {(d.label || '').length > 25 ? (d.label || '').substring(0, 23) + '...' : d.label}
          </text>
        ))}

        {/* Lines and Circles */}
        {chartData.map((d) => {
          const xVal = xScale(d.value);
          const yVal = yScale(d.label) || 0;
          const isSelected = selectedKeys?.has(d.label);
          const color = isSelected
            ? colors
              ? colors[1]
              : 'var(--text-accent)'
            : colors
              ? colors[0]
              : 'var(--viz-fill-primary)';

          return (
            <g
              key={d.label}
              className={`transition-all duration-300 ${interactive ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(d.label, e);
              }}
            >
              {/* Stick */}
              <line
                x1={0}
                y1={yVal}
                x2={xVal}
                y2={yVal}
                stroke={isSelected ? 'var(--text-accent)' : 'var(--viz-stroke-main)'}
                strokeWidth={2}
              />

              {/* Head */}
              <circle
                cx={xVal}
                cy={yVal}
                r={isSelected ? 8 : 6}
                fill={color}
                stroke={isSelected ? 'var(--text-accent)' : 'var(--viz-stroke-bar)'}
                strokeWidth={2}
              />

              {/* Value label */}
              {labelMode !== 'none' && (
                <text
                  x={xVal + 12}
                  y={yVal}
                  dy=".35em"
                  className={`text-xs ${isSelected ? 'font-bold fill-[var(--text-primary)]' : 'font-medium fill-[var(--viz-text-value)]'}`}
                >
                  {labelMode === 'percent' ? `${d.percent.toFixed(1)}%` : d.value.toLocaleString()}
                </text>
              )}
            </g>
          );
        })}
      </ChartPlotArea>
    </svg>
  );
};
