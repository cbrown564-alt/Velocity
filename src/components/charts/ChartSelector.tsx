import React from 'react';
import {
    BarChart3,
    BarChartHorizontal,
    PieChart,
    ScatterChart,
    LineChart,
    BoxSelect,
    AlignLeft
} from 'lucide-react';
import { ChartType } from '../../types/charts';
import { useVelocityStore } from '../../store';
import styles from './ChartSelector.module.css';

interface ChartSelectorProps {
    currentType: ChartType;
    availableTypes?: ChartType[];
    onSelect?: (type: ChartType) => void;
    className?: string;
}

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
    'horizontal-bar': <AlignLeft size={16} />,
    'vertical-bar': <BarChart3 size={16} />,
    'grouped-bar': <BarChart3 size={16} />,
    'stacked-bar': <BarChartHorizontal size={16} />,
    'stacked-bar-100': <BarChartHorizontal size={16} />,
    'diverging-bar': <AlignLeft size={16} />,
    'donut': <PieChart size={16} />,
    'histogram': <BarChart3 size={16} />,
    'box-plot': <BoxSelect size={16} />, // Kept BoxSelect but will ensure it renders well or swap if imports allow
    'scatter': <ScatterChart size={16} />,
    'lollipop': <LineChart size={16} />,
    'grouped-box-plot': <BoxSelect size={16} />,
    'violin': <BarChart3 size={16} />,
    'ridgeline': <BarChart3 size={16} />,
    'hexbin': <ScatterChart size={16} />,
};

const CHART_LABELS: Record<ChartType, string> = {
    'horizontal-bar': 'Horizontal Bar',
    'vertical-bar': 'Vertical Bar',
    'grouped-bar': 'Grouped Bar',
    'stacked-bar': 'Stacked Bar',
    'stacked-bar-100': '100% Stacked',
    'diverging-bar': 'Diverging Bar',
    'donut': 'Donut Chart',
    'histogram': 'Histogram',
    'box-plot': 'Box Plot',
    'scatter': 'Scatterplot',
    'lollipop': 'Lollipop Chart',
    'grouped-box-plot': 'Grouped Box Plot',
    'violin': 'Violin Chart',
    'ridgeline': 'Ridgeline Chart',
    'hexbin': 'Hexbin Chart',
};

export const ChartSelector: React.FC<ChartSelectorProps> = ({
    currentType,
    availableTypes,
    onSelect,
    className = '',
}) => {
    const setSelectedChartType = useVelocityStore((state) => state.setSelectedChartType);

    // Default to a common set if not provided
    const typesToShow: ChartType[] = availableTypes || [
        'horizontal-bar',
        'vertical-bar',
        'stacked-bar',
        'histogram',
        'box-plot'
    ];

    const handleSelect = (type: ChartType) => {
        if (onSelect) {
            onSelect(type);
        } else {
            // Default behavior: update global store
            setSelectedChartType(type);
        }
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
