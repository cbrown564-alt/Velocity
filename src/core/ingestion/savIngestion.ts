/**
 * SAV Ingestion (CLI/Node)
 *
 * Hybrid ingestion for SPSS files in Node.js:
 * 1. DuckDB's read_stat extension for fast columnar data load
 * 2. jsavvy for rich metadata extraction
 */

import * as fs from 'fs';
import jsavvyDefault from 'jsavvy';
const jsavvy: any = (jsavvyDefault as any).default || jsavvyDefault;
import { DuckDBNodeAdapter } from '../../adapters/DuckDBNodeAdapter';
import { processMetadata, ParsedSavMetadata } from './savLoader';
import { Variable, VariableSet } from '../../types';

export interface SavLoadResult {
    variables: Variable[];
    variableSets: VariableSet[];
    rowCount: number;
}

/**
 * Load a SAV file using a hybrid approach.
 */
export async function loadSav(
    adapter: DuckDBNodeAdapter,
    filePath: string,
    tableName: string = 'main'
): Promise<SavLoadResult> {
    let hasReadStat = false;

    // 1. Try to use DuckDB read_stat for fast data ingest
    try {
        await adapter.execute('INSTALL read_stat; LOAD read_stat;');
        await adapter.execute(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_sav('${filePath}')`);
        hasReadStat = true;
        console.log('🦆 [SAV] Loaded data via DuckDB read_stat');
    } catch (err) {
        console.warn('⚠️ [SAV] DuckDB read_stat failed, falling back to jsavvy for data:', (err as Error).message);
    }

    // 2. Use jsavvy for metadata (and data if fallback)
    const buffer = await fs.promises.readFile(filePath);
    const parser = new jsavvy.SavParser();

    let metadata: ParsedSavMetadata;
    let rows: any[][] = [];

    if (hasReadStat) {
        // Only parse schema/metadata if we already have data in DuckDB
        const schema = await parser.schema(new jsavvy.Feeder(buffer.buffer.slice(buffer.byteOffset)));

        // Map value labels
        const valueLabelSets: Record<string, { value: number; label: string }[]> = {};
        schema.internal.levels.forEach((level, idx) => {
            const setName = `set_${idx}`;
            valueLabelSets[setName] = Array.from(level.map.entries()).map(([value, label]) => ({
                value: Number(value),
                label
            }));
        });

        metadata = {
            variables: schema.headers.map((h, i) => {
                // Find which level applies to this variable index (1-based in jsavvy)
                const levelIdx = schema.internal.levels.findIndex(l => l.indices.has(i + 1));
                return {
                    name: h.name,
                    label: h.label || h.name,
                    type: h.code === 0 ? 'numeric' : 'string',
                    index: i,
                    valueLabelSetName: levelIdx !== -1 ? `set_${levelIdx}` : undefined
                };
            }),
            valueLabelSets,
            multipleResponseSets: [], // jsavvy doesn't seem to expose MR sets easily
            rowCount: schema.meta.cases
        };
    } else {
        // Fallback: parse everything via jsavvy
        const all = await parser.all(new jsavvy.Feeder(buffer.buffer.slice(buffer.byteOffset)));
        const dataset = new jsavvy.Savvy(all);

        // Map value labels
        const valueLabelSets: Record<string, { value: number; label: string }[]> = {};
        all.internal.levels.forEach((level, idx) => {
            const setName = `set_${idx}`;
            valueLabelSets[setName] = Array.from(level.map.entries()).map(([value, label]) => ({
                value: Number(value),
                label
            }));
        });

        metadata = {
            variables: all.headers.map((h, i) => {
                const levelIdx = all.internal.levels.findIndex(l => l.indices.has(i + 1));
                return {
                    name: h.name,
                    label: h.label || h.name,
                    type: h.code === 0 ? 'numeric' : 'string',
                    index: i,
                    valueLabelSetName: levelIdx !== -1 ? `set_${levelIdx}` : undefined
                };
            }),
            valueLabelSets,
            multipleResponseSets: [],
            rowCount: all.meta.cases
        };

        // Extract rows for metadata processing (some heuristics need data)
        // We only need a sample for heuristics
        const sampleSize = Math.min(all.meta.cases, 100);
        for (let i = 0; i < sampleSize; i++) {
            const row = dataset.row(i);
            rows.push(all.headers.map(h => row.get(h.name)));
        }

        // Load data into DuckDB manually via Appender
        await loadDataViaAppender(adapter, tableName, metadata, dataset);
    }

    // 3. Process metadata through savLoader pipeline
    const processed = processMetadata({
        metadata,
        rows: rows.length > 0 ? rows : [] // If we used read_stat, we might need some sample rows?
    });

    return {
        ...processed,
        rowCount: metadata.rowCount
    };
}

/**
 * Fallback: Load data into DuckDB using the Appender API.
 * This is slower than read_stat but works when the extension is missing.
 */
async function loadDataViaAppender(
    adapter: DuckDBNodeAdapter,
    tableName: string,
    metadata: ParsedSavMetadata,
    dataset: any
): Promise<void> {
    // Create table first
    const colDefs = metadata.variables.map(v => `"${v.name}" ${v.type === 'string' ? 'VARCHAR' : 'DOUBLE'}`).join(', ');
    await adapter.execute(`CREATE OR REPLACE TABLE "${tableName}" (${colDefs})`);

    // Get raw connection for Appender
    const conn = (adapter as any).connection;
    const appender = await conn.createAppender(tableName);

    try {
        for (let i = 0; i < metadata.rowCount; i++) {
            const row = dataset.row(i, false);
            metadata.variables.forEach(v => {
                const val = row.get(v.name);
                if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
                    appender.appendNull();
                } else if (v.type === 'string') {
                    appender.appendVarchar(String(val));
                } else {
                    appender.appendDouble(Number(val));
                }
            });
            appender.endRow();
        }
        appender.flushSync();
    } finally {
        appender.closeSync();
    }
}
