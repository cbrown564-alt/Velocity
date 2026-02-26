/**
 * SAV Ingestion (CLI/Node)
 *
 * Hybrid ingestion for SPSS files in Node.js:
 * 1. DuckDB's read_stat extension for fast columnar data load
 * 2. ReadStat-WASM for robust metadata extraction and fallback parsing
 */

import * as fs from 'fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DuckDBNodeAdapter } from '../../adapters/DuckDBNodeAdapter';
import { processMetadata, ParsedSavMetadata } from './savLoader';
import { Variable, VariableSet } from '../../types';
import { escapeString } from '../../services/queryBuilder';

export interface SavLoadResult {
    variables: Variable[];
    variableSets: VariableSet[];
    rowCount: number;
}

interface ReadStatModule {
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    _parse_sav: (bufferPtr: number, len: number) => number;
    _parse_sav_metadata?: (bufferPtr: number, len: number) => number;
    _get_variable_count: () => number;
    _get_row_count: () => number;
    _get_value_label_count: () => number;
    _get_variable_name: (index: number) => number;
    _get_variable_type: (index: number) => number;
    _get_variable_label: (index: number) => number;
    _get_variable_value_labels_name: (index: number) => number;
    _get_variable_missing_count?: (index: number) => number;
    _get_variable_missing_lo?: (variableIndex: number, missingIndex: number) => number;
    _get_variable_missing_hi?: (variableIndex: number, missingIndex: number) => number;
    _get_value_label_set_name: (index: number) => number;
    _get_value_label_value: (index: number) => number;
    _get_value_label_label: (index: number) => number;
    _is_cell_missing: (row: number, col: number) => number;
    _is_cell_system_missing?: (row: number, col: number) => number;
    _get_numeric_value: (row: number, col: number) => number;
    _get_string_value: (row: number, col: number) => number;
    _free_parse_results: () => void;
    _get_error_message: (errorCode: number) => number;
    _get_mr_set_count: () => number;
    _get_mr_set_name: (index: number) => number;
    _get_mr_set_label: (index: number) => number;
    _get_mr_set_type: (index: number) => number;
    _get_mr_set_counted_value: (index: number) => number;
    _get_mr_set_subvar_count: (index: number) => number;
    _get_mr_set_subvar: (setIndex: number, subvarIndex: number) => number;
    UTF8ToString: (ptr: number) => string;
    writeArrayToMemory: (array: ArrayLike<number>, buffer: number) => void;
}

type ReadStatFactory = (moduleArg?: { wasmBinary?: Uint8Array }) => Promise<ReadStatModule>;

const FALLBACK_SAMPLE_ROWS = 100;
const MAX_SAFE_FALLBACK_CELLS = 25_000_000;
const READSTAT_DIST_DIR = path.resolve(process.cwd(), 'packages/readstat-wasm/dist');
const READSTAT_JS_URL = pathToFileURL(path.join(READSTAT_DIST_DIR, 'readstat.js')).href;
const READSTAT_WASM_PATH = path.join(READSTAT_DIST_DIR, 'readstat.wasm');

let readStatModulePromise: Promise<ReadStatModule> | null = null;

function escapeIdentifier(identifier: string): string {
    return identifier.replace(/"/g, '""');
}

function toUint8Array(buffer: Buffer): Uint8Array {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function freeParseResultsSafe(mod: ReadStatModule): void {
    try {
        mod._free_parse_results();
    } catch {
        // Ignore cleanup failures to keep ingestion flow deterministic.
    }
}

function extractVariableMissingValues(mod: ReadStatModule, variableIndex: number): { discrete?: number[]; range?: { low: number; high: number } } | undefined {
    if (!mod._get_variable_missing_count || !mod._get_variable_missing_lo || !mod._get_variable_missing_hi) {
        return undefined;
    }
    const count = mod._get_variable_missing_count(variableIndex);
    if (!Number.isFinite(count) || count <= 0) return undefined;

    const discrete: number[] = [];
    let range: { low: number; high: number } | undefined;
    for (let i = 0; i < count; i++) {
        const lo = mod._get_variable_missing_lo(variableIndex, i);
        const hi = mod._get_variable_missing_hi(variableIndex, i);
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
        if (lo === hi) {
            discrete.push(lo);
        } else if (!range) {
            range = lo <= hi ? { low: lo, high: hi } : { low: hi, high: lo };
        }
    }
    if (discrete.length === 0 && !range) return undefined;
    return { discrete: discrete.length > 0 ? discrete : undefined, range };
}

function isCellSystemMissing(mod: ReadStatModule, rowIndex: number, colIndex: number): boolean {
    if (mod._is_cell_system_missing) {
        return !!mod._is_cell_system_missing(rowIndex, colIndex);
    }
    return !!mod._is_cell_missing(rowIndex, colIndex);
}

function assertReadStatSuccess(mod: ReadStatModule, errorCode: number, operation: string): void {
    if (errorCode === 0) return;
    const errorMsgPtr = mod._get_error_message(errorCode);
    const errorMsg = mod.UTF8ToString(errorMsgPtr);
    throw new Error(`ReadStat ${operation} failed (${errorCode}): ${errorMsg}`);
}

async function getReadStatModule(): Promise<ReadStatModule> {
    if (!readStatModulePromise) {
        readStatModulePromise = (async () => {
            const moduleFactory = (await import(READSTAT_JS_URL)).default as ReadStatFactory;
            const wasmBinary = await fs.promises.readFile(READSTAT_WASM_PATH);
            return moduleFactory({ wasmBinary: new Uint8Array(wasmBinary.buffer, wasmBinary.byteOffset, wasmBinary.byteLength) });
        })();
    }
    return readStatModulePromise;
}

function extractMetadata(mod: ReadStatModule): ParsedSavMetadata {
    const variableCount = mod._get_variable_count();
    const rowCount = mod._get_row_count();
    const valueLabelCount = mod._get_value_label_count();

    const variables: ParsedSavMetadata['variables'] = [];
    for (let i = 0; i < variableCount; i++) {
        const namePtr = mod._get_variable_name(i);
        const labelPtr = mod._get_variable_label(i);
        const vlNamePtr = mod._get_variable_value_labels_name(i);

        variables.push({
            name: mod.UTF8ToString(namePtr),
            index: i,
            type: mod._get_variable_type(i) === 0 ? 'numeric' : 'string',
            label: mod.UTF8ToString(labelPtr) || undefined,
            valueLabelSetName: mod.UTF8ToString(vlNamePtr) || undefined,
            missingValues: extractVariableMissingValues(mod, i),
        });
    }

    const valueLabelSets: ParsedSavMetadata['valueLabelSets'] = {};
    for (let i = 0; i < valueLabelCount; i++) {
        const setNamePtr = mod._get_value_label_set_name(i);
        const labelPtr = mod._get_value_label_label(i);
        const setName = mod.UTF8ToString(setNamePtr);
        const label = mod.UTF8ToString(labelPtr);
        const value = mod._get_value_label_value(i);

        if (!setName) continue;
        if (!valueLabelSets[setName]) {
            valueLabelSets[setName] = [];
        }
        valueLabelSets[setName].push({ value, label });
    }

    const mrSetCount = mod._get_mr_set_count();
    const multipleResponseSets: NonNullable<ParsedSavMetadata['multipleResponseSets']> = [];
    for (let i = 0; i < mrSetCount; i++) {
        const subvarCount = mod._get_mr_set_subvar_count(i);
        const subvariables: string[] = [];

        for (let j = 0; j < subvarCount; j++) {
            const subvarPtr = mod._get_mr_set_subvar(i, j);
            subvariables.push(mod.UTF8ToString(subvarPtr));
        }

        const namePtr = mod._get_mr_set_name(i);
        const labelPtr = mod._get_mr_set_label(i);
        const typeCode = mod._get_mr_set_type(i);

        multipleResponseSets.push({
            name: mod.UTF8ToString(namePtr),
            label: mod.UTF8ToString(labelPtr),
            type: String.fromCharCode(typeCode) as 'C' | 'D',
            countedValue: mod._get_mr_set_counted_value(i),
            subvariables,
        });
    }

    return {
        variables,
        valueLabelSets,
        multipleResponseSets,
        rowCount,
    };
}

async function parseSavMetadataWithReadStat(buffer: Buffer): Promise<ParsedSavMetadata> {
    const mod = await getReadStatModule();
    const input = toUint8Array(buffer);
    const bufferPtr = mod._malloc(input.length);

    if (bufferPtr === 0) {
        throw new Error('Failed to allocate memory for SAV metadata parse');
    }

    mod.writeArrayToMemory(input, bufferPtr);

    try {
        const parseMetadata = mod._parse_sav_metadata || mod._parse_sav;
        const errorCode = parseMetadata(bufferPtr, input.length);
        assertReadStatSuccess(mod, errorCode, 'metadata parse');
        return extractMetadata(mod);
    } finally {
        freeParseResultsSafe(mod);
        mod._free(bufferPtr);
    }
}

async function buildMetadataFromDuckDbSchema(
    adapter: DuckDBNodeAdapter,
    tableName: string
): Promise<ParsedSavMetadata> {
    const escapedTableName = tableName.replace(/'/g, "''");
    const schema = await adapter.query(`PRAGMA table_info('${escapedTableName}')`);
    const count = await adapter.query(`SELECT COUNT(*) AS cnt FROM "${escapeIdentifier(tableName)}"`);

    const variables: ParsedSavMetadata['variables'] = schema.rows.map((row: any, index: number) => {
        const rawType = String(row.type || '').toUpperCase();
        const isStringType = /CHAR|TEXT|STRING|VARCHAR/.test(rawType);
        return {
            name: String(row.name),
            index,
            label: String(row.name),
            type: isStringType ? 'string' : 'numeric',
        };
    });

    return {
        variables,
        valueLabelSets: {},
        multipleResponseSets: [],
        rowCount: Number(count.rows[0]?.cnt ?? 0),
    };
}

async function loadDataViaAppenderFromReadStat(
    adapter: DuckDBNodeAdapter,
    tableName: string,
    metadata: ParsedSavMetadata,
    fileBuffer: Buffer
): Promise<{ sampleRows: any[][]; parsedRowCount: number; parsedMetadata: ParsedSavMetadata }> {
    const mod = await getReadStatModule();
    const input = toUint8Array(fileBuffer);
    const bufferPtr = mod._malloc(input.length);

    if (bufferPtr === 0) {
        throw new Error('Failed to allocate memory for SAV full parse');
    }

    mod.writeArrayToMemory(input, bufferPtr);

    try {
        const errorCode = mod._parse_sav(bufferPtr, input.length);
        assertReadStatSuccess(mod, errorCode, 'full parse');

        const parsedRowCount = mod._get_row_count();
        const parsedMetadata = extractMetadata(mod);
        const expectedColumns = metadata.variables.length;
        const sampleRows: any[][] = [];

        const colDefs = metadata.variables
            .map(v => `"${escapeIdentifier(v.name)}" ${v.type === 'string' ? 'VARCHAR' : 'DOUBLE'}`)
            .join(', ');
        await adapter.execute(`CREATE OR REPLACE TABLE "${escapeIdentifier(tableName)}" (${colDefs})`);

        const conn = (adapter as any).connection;
        const appender = await conn.createAppender(tableName);

        try {
            for (let rowIndex = 0; rowIndex < parsedRowCount; rowIndex++) {
                const sampleRow = rowIndex < FALLBACK_SAMPLE_ROWS ? new Array(expectedColumns) : null;

                for (let colIndex = 0; colIndex < expectedColumns; colIndex++) {
                    if (isCellSystemMissing(mod, rowIndex, colIndex)) {
                        appender.appendNull();
                        if (sampleRow) sampleRow[colIndex] = null;
                        continue;
                    }

                    const variable = metadata.variables[colIndex];
                    if (variable.type === 'string') {
                        const strPtr = mod._get_string_value(rowIndex, colIndex);
                        const value = mod.UTF8ToString(strPtr);
                        appender.appendVarchar(value);
                        if (sampleRow) sampleRow[colIndex] = value;
                    } else {
                        const value = mod._get_numeric_value(rowIndex, colIndex);
                        appender.appendDouble(value);
                        if (sampleRow) sampleRow[colIndex] = value;
                    }
                }

                if (sampleRow) sampleRows.push(sampleRow);
                appender.endRow();
            }

            appender.flushSync();
        } finally {
            appender.closeSync();
        }

        return { sampleRows, parsedRowCount, parsedMetadata };
    } finally {
        freeParseResultsSafe(mod);
        mod._free(bufferPtr);
    }
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
        const safePath = escapeString(filePath);
        await adapter.execute(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_sav('${safePath}')`);
        hasReadStat = true;
        console.log('🦆 [SAV] Loaded data via DuckDB read_stat');
    } catch (err) {
        console.warn('⚠️ [SAV] DuckDB read_stat failed, falling back to ReadStat-WASM for data:', (err as Error).message);
    }

    // 2. Parse metadata via ReadStat-WASM (same parser family as browser path)
    const buffer = await fs.promises.readFile(filePath);
    let metadata: ParsedSavMetadata;
    let rows: any[][] = [];

    try {
        metadata = await parseSavMetadataWithReadStat(buffer);
    } catch (err) {
        if (!hasReadStat) {
            throw err;
        }
        console.warn('⚠️ [SAV] Metadata parse failed; using DuckDB schema fallback:', (err as Error).message);
        metadata = await buildMetadataFromDuckDbSchema(adapter, tableName);
    }

    if (!hasReadStat) {
        const estimatedCells = metadata.rowCount * metadata.variables.length;
        if (estimatedCells > MAX_SAFE_FALLBACK_CELLS) {
            throw new Error(
                `[SAV] read_stat unavailable and fallback parse would materialize ${estimatedCells.toLocaleString()} cells ` +
                `(${metadata.rowCount.toLocaleString()} rows × ${metadata.variables.length.toLocaleString()} variables). ` +
                `This is likely to exceed memory limits. Use an environment with DuckDB read_stat support for this file.`
            );
        }

        const fallbackLoad = await loadDataViaAppenderFromReadStat(adapter, tableName, metadata, buffer);
        rows = fallbackLoad.sampleRows;
        metadata = fallbackLoad.parsedMetadata;

        if (fallbackLoad.parsedRowCount !== metadata.rowCount) {
            console.warn(
                `⚠️ [SAV] Parsed row count mismatch (metadata=${metadata.rowCount}, parsed=${fallbackLoad.parsedRowCount})`
            );
        }
    }

    // 3. Process metadata through savLoader pipeline
    const processed = processMetadata({
        metadata,
        rows
    });

    return {
        ...processed,
        rowCount: metadata.rowCount
    };
}
