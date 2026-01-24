import { ChartType } from './charts';
import { Variable } from './index';

export type LayoutMode = 'focus' | 'grid' | 'comparison' | 'freeform';

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
    title: string;
    layoutMode: LayoutMode;
    cells: SlideCell[];
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
