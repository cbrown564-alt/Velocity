import React from 'react';
import * as d3scale from 'd3-scale';
import { BaseChartRendererProps } from '../../../types/charts';
// getChartColor removed

/**
 * Box Plot Renderer
 * Displays distribution of scale variables: min, q1, median, q3, max.
 * Data expected: Array of { label: string, min, q1, median, q3, max, ... }
 * derived from 'variableStats' or specialized aggregation.
 */
export const BoxPlotRenderer: React.FC<BaseChartRendererProps> = ({
  width,
  height,
  processedData,
  variableStats,
}) => {
  // NOTE: True box plot calculation usually happens on backend or worker.
  // Here we assume keys in variableStats or processedData contain the quartiles.
  // If stats are not pre-calculated, we might need to compute them from raw data
  // but the renderer ideally receives prepared stats.

  // For Velocity's current architecture, 'variableStats' often holds distribution info.
  // If we are strictly visualizing AggregatedRow[], it implies we have binned data or summary stats.
  // Let's assume for now we might be using a specific structure or we need to look at variableStats.

  // Fallback: if we just have a Histogram-like distribution in processedData, we can't easily make a boxplot
  // without the raw values or pre-calculated quartiles.
  // Let's assume the user has passed pre-calculated stats for now.

  // For checking purposes, let's create a placeholder that warns if no stats available,
  // or renders provided stats.

  const stats = variableStats?.numeric || variableStats?.stats;

  // Check if we have valid box plot stats
  if (!stats || typeof stats.median === 'undefined') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-body)',
        }}
      >
        Box plot data not available (requires raw data or pre-calculated quartiles).
      </div>
    );
  }

  const margin = { top: 40, right: 40, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // We draw a single vertical box plot for the univariate case
  // Or multiple if we have a grouping variable (which would be GroupedBoxPlot).

  // Single Box Plot Logic
  const min = stats.min ?? 0;
  const max = stats.max ?? 100;
  const q1 = stats.q1 ?? min;
  const median = stats.median ?? (min + max) / 2;
  const q3 = stats.q3 ?? max;

  const yScale = d3scale.scaleLinear().domain([min, max]).range([innerHeight, 0]).nice();

  const boxWidth = Math.min(innerWidth / 2, 100);
  const center = innerWidth / 2;

  // Holographic styling
  const boxFill = 'var(--viz-fill-primary)';
  const boxStroke = 'var(--viz-stroke-bar)';

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', fontFamily: 'var(--font-mono)' }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Y Axis */}
        <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--viz-stroke-main)" />
        {yScale.ticks(5).map((tick) => (
          <g key={tick} transform={`translate(0,${yScale(tick)})`}>
            <line x2={-6} stroke="var(--viz-stroke-main)" />
            <text x={-10} dy=".32em" textAnchor="end" style={{ fontSize: '10px', fill: 'var(--viz-text-axis)' }}>
              {tick}
            </text>
          </g>
        ))}

        {/* X Axis Label */}
        <g transform={`translate(${innerWidth / 2}, ${innerHeight + 25})`}>
          <text
            textAnchor="middle"
            style={{
              fontSize: '11px',
              fill: 'var(--viz-text-axis)',
              fontWeight: 500,
            }}
          >
            {processedData?.columns?.[0]?.label || 'All Respondents'}
          </text>
        </g>

        {/* Box Plot Elements */}
        <g className="box-plot-item">
          {/* Range Line (Whiskers: Min/Max or Fences) */}
          {/* If we have whiskerMin/Max (calculated fences), use them. Else fall back to Min/Max */}
          <line
            x1={center}
            y1={yScale(stats.whiskerMin ?? min)}
            x2={center}
            y2={yScale(stats.whiskerMax ?? max)}
            stroke="var(--viz-stroke-bar)"
            strokeDasharray="4,4"
          />
          {/* Min Cap */}
          <line
            x1={center - boxWidth / 4}
            y1={yScale(stats.whiskerMin ?? min)}
            x2={center + boxWidth / 4}
            y2={yScale(stats.whiskerMin ?? min)}
            stroke="var(--viz-stroke-bar)"
          />
          {/* Max Cap */}
          <line
            x1={center - boxWidth / 4}
            y1={yScale(stats.whiskerMax ?? max)}
            x2={center + boxWidth / 4}
            y2={yScale(stats.whiskerMax ?? max)}
            stroke="var(--viz-stroke-bar)"
          />

          {/* Box (Q1 to Q3) */}
          <rect
            x={center - boxWidth / 2}
            y={yScale(q3)}
            width={boxWidth}
            height={Math.abs(yScale(q1) - yScale(q3))}
            fill={boxFill}
            stroke={boxStroke}
            rx={1}
          />

          {/* Median Line */}
          <line
            x1={center - boxWidth / 2}
            y1={yScale(median)}
            x2={center + boxWidth / 2}
            y2={yScale(median)}
            stroke="var(--text-primary)"
            strokeWidth={2}
          />

          {/* Outliers */}
          {stats.outliers &&
            stats.outliers.map((val: number, i: number) => (
              <circle
                key={`outlier-${i}`}
                cx={center}
                cy={yScale(val)}
                r={3}
                fill="transparent"
                stroke={boxStroke}
                strokeWidth={1.5}
              >
                <title>Outlier: {val}</title>
              </circle>
            ))}
        </g>
      </g>
    </svg>
  );
};
