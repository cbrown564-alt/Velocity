export type ChartType =
    | 'horizontal-bar'
    | 'vertical-bar'
    | 'grouped-bar'
    | 'stacked-bar'
    | 'stacked-bar-100'
    | 'diverging-bar'
    | 'donut'
    | 'histogram'
    | 'box-plot'
    | 'scatter'
    | 'lollipop';

export interface ChartRecommendation {
    default: ChartType;
    alternatives: ChartType[];
    reason: string;
}

/**
 * Common props passed to all chart renderers.
 * This ensures uniform handling of dimensions, data, and interactions.
 */
export interface BaseChartRendererProps<T = any> {
    /** The aggregated data rows to visualize */
    data: T[];
    /** Width of the chart container in pixels */
    width: number;
    /** Height of the chart container in pixels */
    height: number;
    /** Callback when a chart element (bar, point) is clicked */
    onElementClick?: (elementData: any) => void;
    /** Color palette to use */
    colors?: string[];
    /** Whether the chart is interactive (hover, click) */
    interactive?: boolean;
}

/**
 * Configuration for the AnalysisChart wrapper
 */
export interface AnalysisChartConfig {
    type: ChartType;
    showLegend?: boolean;
    showTooltip?: boolean;
    /** If true, enables Visual ETL features (drag-to-merge, context menu) */
    enableVisualETL?: boolean;
}
