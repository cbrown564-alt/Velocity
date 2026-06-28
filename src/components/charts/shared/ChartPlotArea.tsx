import React from 'react';

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartPlotAreaProps {
  margin: ChartMargin;
  children: React.ReactNode;
  innerRef?: React.Ref<SVGGElement>;
  className?: string;
}

/**
 * SVG plot-area group with standard margin translation.
 * Shared by bar, lollipop, stacked, and other cartesian chart renderers.
 */
export const ChartPlotArea: React.FC<ChartPlotAreaProps> = ({ margin, children, innerRef, className }) => (
  <g ref={innerRef} transform={`translate(${margin.left},${margin.top})`} className={className}>
    {children}
  </g>
);
