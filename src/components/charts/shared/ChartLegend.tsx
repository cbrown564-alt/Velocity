import React from 'react';

interface LegendItem {
  label: string;
  color: string;
}

interface ChartLegendProps {
  items: LegendItem[];
  position?: 'top' | 'bottom';
  className?: string;
}

export const ChartLegend: React.FC<ChartLegendProps> = ({ items, className = '' }) => {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)] ${className}`}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
