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

interface ChartSelectorProps {
    currentType: ChartType;
    availableTypes?: ChartType[];
    onSelect?: (type: ChartType) => void;
    className?: string;
}

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
    'horizontal-bar': <AlignLeft size={16} />,
    'vertical-bar': <BarChart3 size={16} />,
    'grouped-bar': <BarChart3 size={16} />, // Similar icon for now
    'stacked-bar': <BarChartHorizontal size={16} />,
    'stacked-bar-100': <BarChartHorizontal size={16} />, // Differentiate later
    'diverging-bar': <AlignLeft size={16} />,
    'donut': <PieChart size={16} />,
    'histogram': <BarChart3 size={16} />,
    'box-plot': <BoxSelect size={16} />,
    'scatter': <ScatterChart size={16} />,
    'lollipop': <LineChart size={16} />,
    'grouped-box-plot': <BoxSelect size={16} />,
    'violin': <BarChart3 size={16} />, // Polyfill icon
    'ridgeline': <BarChart3 size={16} />, // Polyfill icon
    'hexbin': <ScatterChart size={16} />, // Polyfill icon
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
        'stacked-bar',
        'vertical-bar',
        'histogram'
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
        <div className={`flex items-center space-x-1 bg-white border border-stone-200 rounded-md p-1 shadow-sm ${className}`}>
            {typesToShow.map((type) => (
                <button
                    key={type}
                    onClick={() => handleSelect(type)}
                    className={`
                        p-1.5 rounded-md transition-colors duration-150 flex items-center justify-center
                        ${currentType === type
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                        }
                    `}
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
