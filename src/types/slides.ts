import { ChartType } from './charts';
import { Variable, Filter } from './index';

export type LayoutMode = 'focus' | 'grid' | 'comparison' | 'freeform';

/**
 * Captured analysis state for a slide.
 * This is the "saved view" that gets snapshotted when creating or switching slides.
 */
export interface SlideAnalysisState {
    /** Row variable IDs */
    rowVars: string[];
    /** Column variable ID (nullable) */
    colVar: string | null;
    /** Active filters */
    filters: Filter[];
    /** Weight variable if enabled */
    weightVar: string | null;
}

export interface SlideCell {
    id: string;
    /** Position and Size would be used for Grid/Freeform modes */
    layout?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /** Content configuration */
    content: {
        type: 'chart' | 'table' | 'text' | 'empty';
        /** For chart cells */
        chartType?: ChartType;
        /** For table cells, we might need specific override configs */
        tableConfig?: any; // Placeholder for Phase 4
    };
}

export interface Slide {
    id: string;

    // User-facing metadata
    /** Editable headline, defaults from analysis context */
    title: string;
    /** Editable subtitle, defaults from filter/weight info */
    subtitle: string;

    // Analysis state (the "saved view")
    analysisState: SlideAnalysisState;

    // Visualization
    /** Whether to show table or chart */
    visualizationType: 'table' | 'chart';
    /** Chart type when visualizationType is 'chart' */
    chartType?: ChartType;

    // Layout (for grid mode)
    layoutMode: LayoutMode;
    cells: SlideCell[];

    // Organization
    /** Optional section this slide belongs to */
    sectionId?: string;

    // Timestamps
    createdAt: number;
    updatedAt: number;
}

/**
 * Section divider for grouping slides into narrative chunks.
 */
export interface SlideSection {
    id: string;
    title: string;
    /** Optional color accent for visual distinction */
    color?: string;
}

/**
 * Configuration for a specific cell's data view.
 * Replaces the global TableConfig in many ways.
 */
export interface CellConfig {
    rowVars: Variable[];
    colVar: Variable | null;
    // Filters could be here too if per-cell
}
