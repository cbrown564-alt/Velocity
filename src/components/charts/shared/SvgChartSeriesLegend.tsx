import React, { useMemo } from 'react';
import { layoutLegendItems } from '../../../core/visualization/chartLabelFormatters';

interface SvgChartSeriesLegendProps {
  labels: string[];
  keys: string[];
  colors: string[];
  /** Available width for centering; legend may extend beyond with overflow visible. */
  innerWidth: number;
  /** Y offset from plot area origin (typically negative, above chart). */
  y?: number;
  fillOpacity?: number;
}

/**
 * Horizontally laid-out SVG legend with dynamic item widths so labels are not clipped.
 * Parent container should allow overflow-x: auto when legend exceeds chart width.
 */
export const SvgChartSeriesLegend: React.FC<SvgChartSeriesLegendProps> = ({
  labels,
  keys,
  colors,
  innerWidth,
  y = -40,
  fillOpacity = 0.8,
}) => {
  const layout = useMemo(() => layoutLegendItems(labels), [labels]);
  const totalWidth = layout.length > 0 ? layout[layout.length - 1]!.x + layout[layout.length - 1]!.width : 0;
  const startX = Math.max(0, (innerWidth - totalWidth) / 2);

  if (labels.length === 0) return null;

  return (
    <g transform={`translate(${startX}, ${y})`}>
      {labels.map((label, i) => (
        <g key={keys[i] ?? i} transform={`translate(${layout[i]!.x}, 0)`}>
          <rect
            width={12}
            height={12}
            rx={1}
            fill={colors[i % colors.length]}
            fillOpacity={fillOpacity}
          />
          <text
            x={18}
            y={10}
            style={{ fontSize: '11px', fill: 'var(--viz-text-axis)', fontFamily: 'var(--font-body)' }}
          >
            {label ? <title>{label}</title> : null}
            {label || ''}
          </text>
        </g>
      ))}
    </g>
  );
};
