
import { AggregatedRow, Variable, HistogramBin } from './index';

// ============================================================================
// Types
// ============================================================================

/** Confidence interval */
export interface ConfidenceInterval {
    lower: number;
    upper: number;
}

/** A processed cell with resolved data */
export interface ProcessedCell {
    count: number;
    percent: number;
    /** Significance marker */
    sig?: 'high_95' | 'high_80' | 'low_95' | 'low_80';
    /** Detailed stats for tooltips */
    stats?: {
        tScore: number;
        pValue: number;
        adjustedPValue?: number;
        correctionMethod?: 'none' | 'bonferroni' | 'fdr';
        effN: number;
    };
    /** 95% Confidence interval for mean or proportion */
    ci95?: ConfidenceInterval;
    /** 80% Confidence interval for mean or proportion */
    ci80?: ConfidenceInterval;
    /** Pairwise comparison letters (e.g., "BC" means significantly higher than columns B and C) */
    sigLetters?: string;
    /** Column letter for this cell's column (A, B, C, etc.) */
    columnLetter?: string;
    /** Scale variable stats */
    mean?: number;
    median?: number;
    stdDev?: number;
    min?: number;
    max?: number;
    q1?: number;
    q3?: number;
    validCount?: number;
    /** Histogram bins for data visualization */
    histogramBins?: HistogramBin[];
}

/** A processed row in tree structure (for tables) */
export interface ProcessedRow {
    /** Unique key for React */
    key: string;
    /** Display label (resolved from valueLabels) */
    label: string;
    /** Raw value from data */
    rawValue: string;
    /** Numeric value used for sorting */
    sortValue?: number;
    /** Depth in tree (0 = root) */
    depth: number;
    /** Cell data keyed by column key */
    cells: Record<string, ProcessedCell>;
    /** Row total count */
    total: number;
    /** Row mean (for metric tables) */
    mean?: number;
    /** Child rows */
    children: ProcessedRow[];
    /** Full path from root (for drill-down) */
    rowPath: { variable: string; value: string }[];
}

/** A column definition */
export interface ProcessedColumn {
    /** Column key (raw value) */
    key: string;
    /** Display label */
    label: string;
    /** Column total */
    total: number;
}

/** A data point for chart series */
export interface ChartDataPoint {
    /** Display label */
    label: string;
    /** Raw value */
    rawValue: string;
    /** Count value */
    value: number;
    /** Percentage of column total */
    percent: number;
    /** Significance marker */
    sig?: string;
    // For Box Plot / Distribution
    stats?: {
        min?: number;
        q1?: number;
        median?: number;
        q3?: number;
        max?: number;
        mean?: number;
        n?: number;
    };
    // For Histogram/Violin/Ridgeline Bins
    x0?: number;
    x1?: number;
    count?: number;
    // Nested bins for this point (if it represents a group)
    histogramBins?: HistogramBin[];
    // For Scatter/Hexbin
    x?: number;
    y?: number;
}

/** A chart series (one per column) */
export interface ChartSeries {
    /** Column key */
    key: string;
    /** Column label */
    label: string;
    /** Data points (one per row category) */
    data: ChartDataPoint[];
    // For Grouped Box Plot where series = group
    stats?: {
        min?: number;
        q1?: number;
        median?: number;
        q3?: number;
        max?: number;
        mean?: number;
        n?: number;
    };
}

/** The complete processed analysis data */
export interface ProcessedAnalysisData {
    /** Tree structure for tables */
    rows: ProcessedRow[];
    /** Flat series for charts */
    series: ChartSeries[];
    /** Column definitions */
    columns: ProcessedColumn[];
    /** Grand total count */
    grandTotal: number;
    /** Whether this is a metric (scale) analysis */
    isMetric: boolean;
    /** Whether this is a grid structure (Items × Scale) */
    isGrid: boolean;
    /** Source variables for reference */
    rowVariables: Variable[];
    colVariable: Variable | null;
    isMultipleResponse: boolean;
}
