import React from 'react';
import * as d3scale from 'd3-scale';
import { area, curveBasis } from 'd3-shape';
import { BaseChartRendererProps } from '../../../types/charts';
// getChartColor removed use palette
const DEFAULT_PALETTE = [
  'var(--viz-palette-1)',
  'var(--viz-palette-2)',
  'var(--viz-palette-3)',
  'var(--viz-palette-4)',
  'var(--viz-palette-5)',
  'var(--viz-palette-6)',
];

/**
 * Ridgeline Renderer
 * Overlapping density plots for comparing distributions.
 */
export const RidgelineRenderer: React.FC<BaseChartRendererProps> = ({ width, height, colors, processedData }) => {
  const groups = processedData.series.filter((s) => s.data && s.data.length > 0);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
        Ridgeline data not available.
      </div>
    );
  }

  const margin = { top: 60, right: 30, bottom: 30, left: 100 }; // Wider left margin for labels
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Y Scale (Groups) - Mapping groups to vertical position
  // We want them to overlap, so the range step is smaller than the height of each plot
  const yScale = d3scale
    .scalePoint()
    .domain(groups.map((g) => g.label))
    .range([innerHeight, 0])
    .padding(1);

  // X Scale (Value Range)
  const allBins = groups.flatMap((s) => s.data);
  const minVal = Math.min(...allBins.map((d) => d.x0 ?? 0));
  const maxVal = Math.max(...allBins.map((d) => d.x1 ?? 100));

  const xScale = d3scale.scaleLinear().domain([minVal, maxVal]).range([0, innerWidth]);

  // Height Scale (Density) - Height of individual ridge
  const maxCount = Math.max(...allBins.map((d) => d.value || d.count || 0));
  const overlapFactor = 1.5; // How much overlap
  // The available height per band if they didn't overlap:
  const bandHeight = innerHeight / groups.length;

  const heightScale = d3scale
    .scaleLinear()
    .domain([0, maxCount])
    .range([0, bandHeight * overlapFactor]); // Scale density to pixels

  // Area Generator
  const areaGenerator = area<any>()
    .x((datum) => xScale((datum.x0 + datum.x1) / 2))
    .y0((d) => 0) // Baseline is relative to the group's y position
    .y1((d) => -heightScale(d.value || d.count || 0))
    .curve(curveBasis);

  return (
    <svg width={width} height={height} className="overflow-visible font-mono">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* X Axis at bottom */}
        <g transform={`translate(0,${innerHeight})`}>
          <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="var(--viz-stroke-main)" />
          {xScale.ticks(5).map((tick) => (
            <g key={tick} transform={`translate(${xScale(tick)},0)`}>
              <line y2={4} stroke="var(--viz-stroke-main)" />
              <text y={16} textAnchor="middle" className="text-[10px] fill-[var(--viz-text-axis)]">
                {tick}
              </text>
            </g>
          ))}
        </g>

        {/* Ridges */}
        {groups.map((g, i) => {
          const y = yScale(g.label) || 0;
          const color = colors ? colors[i % colors.length] : DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

          return (
            <g key={g.label} transform={`translate(0,${y})`}>
              <text
                x={-10}
                y={0}
                dy=".35em"
                textAnchor="end"
                className="text-xs font-medium fill-[var(--viz-text-axis)] font-mono"
              >
                {g.label}
              </text>

              <path
                d={areaGenerator(g.data) || ''}
                fill={color}
                fillOpacity={0.6}
                stroke={color}
                strokeWidth={1}
                className="transition-all hover:fill-opacity-90 hover:stroke-[var(--border-color-muted)]"
              />
              {/* Baseline line for this ridge */}
              <line x1={0} y1={0} x2={innerWidth} y2={0} stroke={color} strokeOpacity={0.3} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};
