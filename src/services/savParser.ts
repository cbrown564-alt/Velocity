/**
 * SAV File Parser
 * 
 * Parses SPSS .SAV files using jsavvy and converts to a format
 * suitable for DuckDB ingestion, preserving SPSS metadata.
 */

import { SavParser, Feeder, type Header, type Parsed, type Display, type Scale } from 'jsavvy';

export interface SavColumn {
    name: string;
    type: 'VARCHAR' | 'DOUBLE';
    label: string;
    valueLabels: Map<number, string>;
    missingValues: number[];
    measurementLevel: 'nominal' | 'ordinal' | 'scale';
}

export interface ParsedSav {
    columns: SavColumn[];
    rows: (string | number | null)[][];
    rowCount: number;
}

/**
 * Parse an ArrayBuffer containing SAV file data
 */
export async function parseSavFile(buffer: ArrayBuffer): Promise<ParsedSav> {
    const startTime = performance.now();

    const feeder = new Feeder(buffer);
    const parser = new SavParser();

    // Parse entire file (schema + data)
    const parsed: Parsed = await parser.all(feeder);

    const headers = parsed.headers || [];
    const displays = parsed.internal?.display || [];
    const levels = parsed.internal?.levels || [];
    const rows = parsed.rows || [];

    // Build a name-to-index map for looking up display info
    const headerIndexMap = new Map<string, number>();
    headers.forEach((h, i) => headerIndexMap.set(h.name, i));

    // Build column definitions from headers + display info
    const columns: SavColumn[] = headers.map((h: Header, idx: number) => {
        const display: Display | undefined = displays[idx];

        // Determine SQL type based on SPSS code (0 = numeric, >0 = string width)
        const type: 'VARCHAR' | 'DOUBLE' = h.code === 0 ? 'DOUBLE' : 'VARCHAR';

        // Determine measurement level from display type
        let measurementLevel: 'nominal' | 'ordinal' | 'scale' = 'scale';
        if (display) {
            if (display.type === 1) {
                measurementLevel = 'nominal';
            } else if (display.type === 2) {
                measurementLevel = 'ordinal';
            } else if (display.type === 3) {
                measurementLevel = 'scale';
            }
        }

        // Extract value labels from levels
        const valueLabels = new Map<number, string>();
        for (const scale of levels) {
            if (scale.indices.has(idx)) {
                scale.map.forEach((label, code) => {
                    valueLabels.set(code, label);
                });
            }
        }

        // Extract missing values
        const missingValues: number[] = [];
        if (h.missing?.codes) {
            missingValues.push(...h.missing.codes);
        }

        return {
            name: h.name,
            type,
            label: h.label || h.name,
            valueLabels,
            measurementLevel,
            missingValues,
        };
    });

    // Convert rows (Map<string, value>) to array format
    const dataRows: (string | number | null)[][] = rows.map((row: Map<string, string | number | boolean>) => {
        return columns.map(col => {
            const value = row.get(col.name);
            if (value === undefined || value === null || value === '') {
                return null;
            }
            if (typeof value === 'boolean') {
                return value ? 1 : 0;
            }
            return value as string | number;
        });
    });

    const duration = performance.now() - startTime;
    console.log(`📊 [SAV Parser] Parsed ${dataRows.length} rows, ${columns.length} variables in ${duration.toFixed(2)}ms`);

    return {
        columns,
        rows: dataRows,
        rowCount: dataRows.length,
    };
}

/**
 * Convert parsed SAV metadata to Variable[] format for the store
 */
export function savColumnsToVariables(columns: SavColumn[]): any[] {
    return columns.map(col => ({
        id: col.name,
        name: col.name,
        label: col.label,
        type: col.measurementLevel,
        valueLabels: Array.from(col.valueLabels.entries()).map(([value, label]) => ({
            value,
            label,
        })),
        missingValues: col.missingValues.length > 0
            ? { discrete: col.missingValues }
            : {},
    }));
}
