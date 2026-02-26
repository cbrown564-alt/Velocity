/**
 * ReadStat WASM TypeScript Types
 */

export interface SavVariable {
    /** Variable name (e.g., "Q1", "Age") */
    name: string;
    /** Variable index (0-based) */
    index: number;
    /** Variable type: 'numeric' or 'string' */
    type: 'numeric' | 'string';
    /** Variable label (human-readable description) */
    label?: string;
    /** Name of the value label set, if any */
    valueLabelSetName?: string;
    /** User-defined missing values/range from source metadata (if available) */
    missingValues?: {
        discrete?: number[];
        range?: { low: number; high: number };
    };
}

export interface SavValueLabel {
    /** Numeric value */
    value: number;
    /** Human-readable label */
    label: string;
}

export interface SavMultipleResponseSet {
    /** MR set name (e.g., "$brands") */
    name: string;
    /** Human-readable label */
    label: string;
    /** Type: 'C' for category/grid, 'D' for dichotomy/multi-response */
    type: 'C' | 'D';
    /** For dichotomy sets, the value that indicates "selected" */
    countedValue: number;
    /** Variable names included in this set */
    subvariables: string[];
}

export interface SavMetadata {
    /** Number of variables (columns) */
    variableCount: number;
    /** Number of rows (-1 if unknown) */
    rowCount: number;
    /** Variable definitions */
    variables: SavVariable[];
    /** Value labels grouped by set name */
    valueLabelSets: Record<string, SavValueLabel[]>;
    /** Multiple Response Sets (grids and multi-response questions) */
    multipleResponseSets: SavMultipleResponseSet[];
}

/** Sampling strategy for partial file parsing */
export type SampleStrategy = 'sequential' | 'spread';

export interface SavParseResult {
    /** File metadata and variable definitions */
    metadata: SavMetadata;
    /** Parsed data rows */
    rows: (number | string | null)[][];
    /** Time taken to parse in milliseconds */
    durationMs: number;
    /** Sampling strategy used (only present for sample parsing) */
    sampleStrategy?: SampleStrategy;
}

export interface SavMetadataResult {
    /** File metadata and variable definitions */
    metadata: SavMetadata;
    /** Time taken to parse in milliseconds */
    durationMs: number;
}

export interface SavParseProgress {
    /** Progress from 0 to 1 */
    progress: number;
}

/**
 * Callback type for progress updates during parsing
 */
export type ProgressCallback = (progress: SavParseProgress) => void;
