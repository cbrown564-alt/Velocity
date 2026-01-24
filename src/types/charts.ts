import { ProcessedAnalysisData } from '../hooks/useProcessedAnalysisData';

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
export interface BaseChartRendererProps {
    /** Width of the chart container in pixels */
    width: number;
    /** Height of the chart container in pixels */
    height: number;
    /** Pre-processed data with labels, sorting, series */
    processedData: ProcessedAnalysisData;
    /** Callback when a chart element (bar, point) is clicked */
    onElementClick?: (elementData: any, event: React.MouseEvent) => void;
    /** Color palette to use */
    colors?: string[];
    /** Whether the chart is interactive (hover, click) */
    interactive?: boolean;
    /** Currently selected data keys (labels/ids) */
    selectedKeys?: Set<string>;
    /** Callback when selection changes */
    onSelectionChange?: (keys: Set<string>) => void;
    /** Callback for right-click context menu */
    onContextMenu?: (event: { selected: any[]; position: { x: number; y: number } }) => void;
    /** Optional variable stats (e.g. for histogram bins) */
    variableStats?: any; // typed as VariableStatsResult in implementation
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
    /** Currently selected data keys */
    selectedKeys?: Set<string>;
    /** Callback when selection changes */
    onSelectionChange?: (keys: Set<string>) => void;
    /** Callback for right-click context menu */
    onContextMenu?: (event: { selected: any[]; position: { x: number; y: number } }) => void;
}
