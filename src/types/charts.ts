import { ProcessedAnalysisData, ChartDataPoint } from '../hooks/useProcessedAnalysisData';

export type ChartType =
    | 'horizontal-bar'
    | 'vertical-bar'
    | 'grouped-bar'
    | 'grouped-column'
    | 'stacked-bar'
    | 'diverging-bar'
    | 'donut'
    | 'histogram'
    | 'box-plot'
    | 'scatter'
    | 'lollipop'
    | 'grouped-box-plot'
    | 'violin'
    | 'ridgeline'
    | 'hexbin';

export interface ChartRecommendation {
    default: ChartType;
    alternatives: ChartType[];
    reason: string;
}

/**
 * Data for a merge operation (Visual ETL drag-to-merge)
 */
export interface MergeEvent {
    /** The items being merged (dragged onto target) */
    sourceItems: ChartDataPoint[];
    /** The target item being merged into */
    targetItem: ChartDataPoint;
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
    /** Callback for drag-to-merge (Visual ETL) */
    onMerge?: (event: MergeEvent) => void;
    /** Optional variable stats (e.g. for histogram bins) */
    variableStats?: any; // typed as VariableStatsResult in implementation
    /** Mode for data labels */
    labelMode?: 'count' | 'percent' | 'none';
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

export interface BarDatum {
    label: string;
    value: number;
    code?: number | string;
    percent?: number;
}

export interface BinData {
    x0: number;
    x1: number;
    count: number;
    selected?: boolean;
    // Optional metadata that might be passed through
    [key: string]: any;
}

export interface SelectionEvent {
    selected: BarDatum[];
    position: { x: number; y: number };
}

/**
 * Event data for chart context menu (right-click)
 */
export interface ChartContextMenuEvent {
    /** Selected data points */
    selected: any[];
    /** Screen position for menu */
    position: { x: number; y: number };
}

export interface BinSelectionEvent {
    bins: BinData[];
    position: { x: number; y: number };
}
