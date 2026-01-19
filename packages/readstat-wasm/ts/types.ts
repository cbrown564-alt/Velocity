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
}

export interface SavValueLabel {
    /** Numeric value */
    value: number;
    /** Human-readable label */
    label: string;
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
}

export interface SavParseResult {
    /** File metadata and variable definitions */
    metadata: SavMetadata;
    /** Parsed data rows */
    rows: (number | string | null)[][];
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
