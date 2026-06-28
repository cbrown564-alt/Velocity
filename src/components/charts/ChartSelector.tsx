import React from 'react';
import {
  ChartColumn,
  ChartBar,
  ChartBarStacked,
  Donut,
  ScatterChart,
  Lollipop,
  Box,
  Boxes,
  Activity,
  Waves,
  Hexagon,
  MoveHorizontal,
} from 'lucide-react';
import { ChartType } from '../../types/charts';
import styles from './ChartSelector.module.css';

interface ChartSelectorProps {
  currentType: ChartType;
  availableTypes?: ChartType[];
  onSelect?: (type: ChartType) => void;
  className?: string;
}

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  'horizontal-bar': <ChartBar size={16} />,
  'vertical-bar': <ChartColumn size={16} />,
  'grouped-bar': <ChartBar size={16} />,
  'grouped-column': <ChartColumn size={16} />,
  'stacked-bar': <ChartBarStacked size={16} />,
  'diverging-bar': <MoveHorizontal size={16} />,
  donut: <Donut size={16} />,
  histogram: <ChartColumn size={16} />,
  'box-plot': <Box size={16} />,
  scatter: <ScatterChart size={16} />,
  lollipop: <Lollipop size={16} />,
  'grouped-box-plot': <Boxes size={16} />,
  violin: <Activity size={16} />,
  ridgeline: <Waves size={16} />,
  hexbin: <Hexagon size={16} />,
};

const CHART_LABELS: Record<ChartType, string> = {
  'horizontal-bar': 'Horizontal Bar',
  'vertical-bar': 'Vertical Bar',
  'grouped-bar': 'Grouped Bar',
  'grouped-column': 'Grouped Column',
  'stacked-bar': 'Stacked Bar',
  'diverging-bar': 'Diverging Bar',
  donut: 'Donut Chart',
  histogram: 'Histogram',
  'box-plot': 'Box Plot',
  scatter: 'Scatterplot',
  lollipop: 'Lollipop Chart',
  'grouped-box-plot': 'Grouped Box Plot',
  violin: 'Violin Chart',
  ridgeline: 'Ridgeline Chart',
  hexbin: 'Hexbin Chart',
};

export const ChartSelector: React.FC<ChartSelectorProps> = ({
  currentType,
  availableTypes,
  onSelect,
  className = '',
}) => {
  // Default to a common set if not provided
  const typesToShow: ChartType[] = availableTypes || [
    'horizontal-bar',
    'vertical-bar',
    'stacked-bar',
    'histogram',
    'box-plot',
  ];

  const handleSelect = (type: ChartType) => {
    onSelect?.(type);
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {typesToShow.map((type) => (
        <button
          key={type}
          onClick={() => handleSelect(type)}
          className={`${styles.button} ${currentType === type ? styles.buttonActive : ''}`}
          title={CHART_LABELS[type]}
          aria-label={`Select ${CHART_LABELS[type]}`}
          aria-pressed={currentType === type}
        >
          {CHART_ICONS[type]}
        </button>
      ))}
    </div>
  );
};
