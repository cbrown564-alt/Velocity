import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3-shape';
import { BaseChartRendererProps } from '../../../types/charts';
import { useChartSelection } from '../hooks/useChartSelection';
const DEFAULT_PALETTE = [
  'var(--viz-palette-1)',
  'var(--viz-palette-2)',
  'var(--viz-palette-3)',
  'var(--viz-palette-4)',
  'var(--viz-palette-5)',
  'var(--viz-palette-6)',
];

interface DonutDatum {
  label: string;
  value: number;
  percent: number;
  rawValue?: number | string;
}

/**
 * Donut Chart Renderer
 * Displays composition of a single variable (or first column of a cross-tab).
 */
export const DonutRenderer: React.FC<BaseChartRendererProps> = ({
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
  // Use the first series (single column analysis)
  const series = processedData.series[0];
  const data = series?.data || [];

  // Filter out zero values to avoid ugly empty slices
  const chartData = useMemo(() => {
    return data
      .filter((d) => d.value > 0)
      .map((d) => ({
        label: d.label,
        value: d.value,
        percent: d.percent,
        rawValue: (d as any).rawValue ?? d.label,
      }));
  }, [data]);

  const { handleToggle } = useChartSelection<DonutDatum>({
    interactive,
    selectedKeys,
    onSelectionChange,
  });

  // Handle right-click context menu
  const handleSliceContextMenu = useCallback(
    (datum: DonutDatum, event: React.MouseEvent) => {
      if (!interactive || !onContextMenu) return;
      event.preventDefault();
      event.stopPropagation();

      onContextMenu({
        selected: [
          {
            label: datum.label,
            value: datum.value,
            percent: datum.percent,
            rawValue: datum.rawValue,
          },
        ],
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [interactive, onContextMenu],
  );

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const radius = Math.min(innerWidth, innerHeight) / 2;

  const pie = d3
    .pie<DonutDatum>()
    .value((d) => d.value)
    .sort(null); // Keep order from processed data (usually sorted by frequency)

  const arc = d3
    .arc<d3.PieArcDatum<DonutDatum>>()
    .innerRadius(radius * 0.6)
    .outerRadius(radius);

  // Arc for labels (slightly larger)
  const labelArc = d3
    .arc<d3.PieArcDatum<DonutDatum>>()
    .innerRadius(radius * 1.05)
    .outerRadius(radius * 1.05);

  const arcs = pie(chartData);

  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <svg width={width} height={height} className="overflow-visible font-mono">
      <g transform={`translate(${centerX},${centerY})`}>
        {arcs.map((d, i) => {
          const sliceColor = colors ? colors[i % colors.length] : DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
          const isSelected = selectedKeys?.has(d.data.label);

          return (
            <g
              key={d.data.label}
              onClick={(e) => handleToggle(d.data.label, e)}
              onContextMenu={(e) => handleSliceContextMenu(d.data, e)}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
            >
              <path
                d={arc(d) || ''}
                fill={sliceColor}
                stroke={isSelected ? 'var(--text-accent)' : 'var(--viz-stroke-bar)'} // Separator
                strokeWidth={isSelected ? 3 : 1}
                fillOpacity={0.6} // Semi-transparent for holographic feel
                className="transition-all duration-300 hover:opacity-90"
                style={{
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  transformOrigin: '0 0',
                }}
              />

              {/* Direct Labels (Polylines + Text) */}
              {(() => {
                if (labelMode === 'none') return null;

                const pos = labelArc.centroid(d);
                const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                const isRightSide = midAngle < Math.PI;

                // Polyline points
                const startPoint = arc.centroid(d);
                const breakPoint = labelArc.centroid(d);
                const endPoint = [...breakPoint];
                endPoint[0] = radius * 1.15 * (isRightSide ? 1 : -1);

                return (
                  <g className="pointer-events-none">
                    <polyline
                      points={`${startPoint},${breakPoint},${endPoint}`}
                      fill="none"
                      stroke="var(--viz-stroke-main)"
                      strokeWidth={1}
                    />
                    <text
                      x={endPoint[0] + (isRightSide ? 8 : -8)}
                      y={endPoint[1]}
                      dy=".35em"
                      textAnchor={isRightSide ? 'start' : 'end'}
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        fill: 'var(--viz-text-axis)',
                        fontWeight: isSelected ? 700 : 400,
                      }}
                    >
                      {labelMode === 'percent'
                        ? `${d.data.label} (${Math.round(d.data.percent)}%)`
                        : `${d.data.label} (${d.data.value.toLocaleString()})`}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Center Text (Total) */}
        <text
          textAnchor="middle"
          dy="-0.6em"
          style={{
            fontSize: 'var(--text-xxs)',
            fill: 'var(--viz-text-axis)',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Total
        </text>
        <text
          textAnchor="middle"
          dy="0.8em"
          style={{
            fontSize: 'var(--text-2xl)',
            fill: 'var(--viz-text-value)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {series.data.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
        </text>
      </g>
    </svg>
  );
};
