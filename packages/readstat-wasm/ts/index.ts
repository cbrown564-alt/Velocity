/**
 * ReadStat WASM - High-performance SPSS SAV file parser
 * 
 * This module wraps libreadstat compiled to WebAssembly for parsing
 * SPSS .sav files directly in the browser with near-native performance.
 */

import type {
    SavVariable,
    SavValueLabel,
    SavMultipleResponseSet,
    SavMetadata,
    SavParseResult,
    SavMetadataResult,
    ProgressCallback,
    SampleStrategy,
} from './types';

// Re-export types
export type {
    SavVariable,
    SavValueLabel,
    SavMultipleResponseSet,
    SavMetadata,
    SavParseResult,
    SavMetadataResult,
    ProgressCallback,
    SampleStrategy,
};

// Streaming types are defined and exported inline below

// Type for the Emscripten module
interface ReadStatModule {
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    _parse_sav: (bufferPtr: number, len: number) => number;
    _parse_sav_metadata?: (bufferPtr: number, len: number) => number;
    _parse_sav_sample?: (bufferPtr: number, len: number, rowLimit: number, strategy: number) => number;
    _parse_sav_window?: (bufferPtr: number, len: number, rowOffset: number, rowLimit: number) => number;
    _get_variable_count: () => number;
    _get_row_count: () => number;
    _get_parsed_row_count?: () => number;
    _get_sample_strategy?: () => number;
    _get_window_row_count?: () => number;
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

    // Multiple Response Set accessors
    _get_mr_set_count: () => number;
    _get_mr_set_name: (index: number) => number;
    _get_mr_set_label: (index: number) => number;
    _get_mr_set_type: (index: number) => number;
    _get_mr_set_counted_value: (index: number) => number;
    _get_mr_set_subvar_count: (index: number) => number;
    _get_mr_set_subvar: (setIndex: number, subvarIndex: number) => number;

    // Streaming row extraction API
    _get_total_row_count?: () => number;
    _get_available_row_count?: () => number;
    _get_released_row_count?: () => number;
    _release_rows_up_to?: (endRow: number) => void;
    _get_row_batch_numeric?: (startRow: number, endRow: number, outBuffer: number, bufferSize: number) => number;
    _get_row_batch_missing?: (startRow: number, endRow: number, outBuffer: number, bufferSize: number) => number;

    // Runtime methods
    HEAPU8: Uint8Array;
    HEAPF64: Float64Array;
    HEAP32: Int32Array;
    UTF8ToString: (ptr: number) => string;
    writeArrayToMemory: (array: ArrayLike<number>, buffer: number) => void;
}

function extractVariableMissingValues(mod: ReadStatModule, variableIndex: number): SavVariable['missingValues'] | undefined {
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

function isCellSystemMissing(mod: ReadStatModule, row: number, col: number): boolean {
    if (mod._is_cell_system_missing) {
        return !!mod._is_cell_system_missing(row, col);
    }
    return !!mod._is_cell_missing(row, col);
}

// Module instance (lazy-loaded)
let moduleInstance: ReadStatModule | null = null;
let modulePromise: Promise<ReadStatModule> | null = null;

const READSTAT_MODULE_URL = '/readstat/readstat.js';

let jsavvyModule: any = null;
let jsavvyModulePromise: Promise<any> | null = null;

async function getJsavvyModule(): Promise<any> {
    if (jsavvyModule) return jsavvyModule;
    if (jsavvyModulePromise) return jsavvyModulePromise;

    jsavvyModulePromise = (async () => {
        // jsavvy is published as a UMD bundle that expects `global`.
        // Safari/WebKit workers do not expose it by default.
        const root = globalThis as unknown as { global?: unknown };
        if (typeof root.global === 'undefined') {
            root.global = root;
        }

        const imported = await import('jsavvy');
        jsavvyModule = (imported as any).default || imported;
        return jsavvyModule;
    })();

    return jsavvyModulePromise;
}

interface JsavvyParsedData {
    metadata: SavMetadata;
    rows: (number | string | null)[][];
}

async function parseWithJsavvy(buffer: ArrayBuffer, includeRows: boolean): Promise<JsavvyParsedData> {
    const jsavvy = await getJsavvyModule();
    const parser = new jsavvy.SavParser();
    const feeder = new jsavvy.Feeder(buffer);

    if (!includeRows) {
        const schema = await parser.schema(feeder);
        const valueLabelSets: Record<string, SavValueLabel[]> = {};

        schema.internal.levels.forEach((level: any, idx: number) => {
            const setName = `set_${idx}`;
            valueLabelSets[setName] = Array.from(level.map.entries()).map(([value, label]) => ({
                value: Number(value),
                label: String(label),
            }));
        });

        const variables: SavVariable[] = schema.headers.map((header: any, i: number) => {
            const levelIdx = schema.internal.levels.findIndex((level: any) => level.indices.has(i + 1));
            return {
                name: header.name,
                index: i,
                type: header.code === 0 ? 'numeric' : 'string',
                label: header.label || undefined,
                valueLabelSetName: levelIdx !== -1 ? `set_${levelIdx}` : undefined,
            };
        });

        return {
            metadata: {
                variableCount: variables.length,
                rowCount: schema.meta.cases,
                variables,
                valueLabelSets,
                multipleResponseSets: [],
            },
            rows: [],
        };
    }

    const all = await parser.all(feeder);
    const dataset = new jsavvy.Savvy(all);
    const valueLabelSets: Record<string, SavValueLabel[]> = {};

    all.internal.levels.forEach((level: any, idx: number) => {
        const setName = `set_${idx}`;
        valueLabelSets[setName] = Array.from(level.map.entries()).map(([value, label]) => ({
            value: Number(value),
            label: String(label),
        }));
    });

    const variables: SavVariable[] = all.headers.map((header: any, i: number) => {
        const levelIdx = all.internal.levels.findIndex((level: any) => level.indices.has(i + 1));
        return {
            name: header.name,
            index: i,
            type: header.code === 0 ? 'numeric' : 'string',
            label: header.label || undefined,
            valueLabelSetName: levelIdx !== -1 ? `set_${levelIdx}` : undefined,
        };
    });

    const rows: (number | string | null)[][] = [];
    for (let r = 0; r < all.meta.cases; r++) {
        const row = dataset.row(r);
        rows.push(all.headers.map((header: any) => {
            const value = row.get(header.name);
            return value === undefined ? null : value;
        }));
    }

    return {
        metadata: {
            variableCount: variables.length,
            rowCount: all.meta.cases,
            variables,
            valueLabelSets,
            multipleResponseSets: [],
        },
        rows,
    };
}

/**
 * Initialize the WASM module. Called automatically on first parse.
 */
export async function initReadStat(): Promise<void> {
    if (moduleInstance) return;
    if (modulePromise) {
        await modulePromise;
        return;
    }

    modulePromise = (async () => {
        // Dynamic import of the Emscripten glue code.
        //
        // NOTE: Using a Vite-ignored absolute URL avoids build-time resolution
        // errors in environments (e.g. Vercel) where packages/readstat-wasm/dist
        // is not present in source checkout.
        try {
            const moduleFactory = (await import(/* @vite-ignore */ READSTAT_MODULE_URL)).default as () => Promise<ReadStatModule>;
            const instance = await moduleFactory();
            moduleInstance = instance;
            console.log('📦 [ReadStat] WASM module initialized');
            return instance;
        } catch (error) {
            console.warn('⚠️ [ReadStat] WASM artifacts unavailable; falling back to jsavvy parser.', error);
            throw error;
        }
    })();

    await modulePromise;
}

function throwOnReadStatError(mod: ReadStatModule, errorCode: number): void {
    if (errorCode === 0) return;
    const errorMsgPtr = mod._get_error_message(errorCode);
    const errorMsg = mod.UTF8ToString(errorMsgPtr);
    throw new Error(`ReadStat error (${errorCode}): ${errorMsg}`);
}

function extractMetadataFromModule(mod: ReadStatModule): SavMetadata {
    const variableCount = mod._get_variable_count();
    const rowCount = mod._get_row_count();
    const valueLabelCount = mod._get_value_label_count();

    const variables: SavVariable[] = [];
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

    const valueLabelSets: Record<string, SavValueLabel[]> = {};
    for (let i = 0; i < valueLabelCount; i++) {
        const setNamePtr = mod._get_value_label_set_name(i);
        const labelPtr = mod._get_value_label_label(i);
        const setName = mod.UTF8ToString(setNamePtr);
        const value = mod._get_value_label_value(i);
        const label = mod.UTF8ToString(labelPtr);

        if (setName) {
            if (!valueLabelSets[setName]) {
                valueLabelSets[setName] = [];
            }
            valueLabelSets[setName].push({ value, label });
        }
    }

    const mrSetCount = mod._get_mr_set_count();
    const multipleResponseSets: SavMultipleResponseSet[] = [];
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
        variableCount,
        rowCount,
        variables,
        valueLabelSets,
        multipleResponseSets,
    };
}

function extractRowsFromModule(mod: ReadStatModule, variables: SavVariable[], rowCount: number): (number | string | null)[][] {
    const variableCount = variables.length;
    const rows: (number | string | null)[][] = [];

    for (let r = 0; r < rowCount; r++) {
        const row: (number | string | null)[] = [];
        for (let c = 0; c < variableCount; c++) {
            if (isCellSystemMissing(mod, r, c)) {
                row.push(null);
            } else if (variables[c].type === 'string') {
                const strPtr = mod._get_string_value(r, c);
                row.push(mod.UTF8ToString(strPtr));
            } else {
                row.push(mod._get_numeric_value(r, c));
            }
        }
        rows.push(row);
    }

    return rows;
}

/**
 * Parse a SAV file from an ArrayBuffer.
 * 
 * @param buffer - The SAV file contents as an ArrayBuffer
 * @param onProgress - Optional callback for progress updates (not yet implemented)
 * @returns Parsed metadata and data rows
 */
export async function parseSavFile(
    buffer: ArrayBuffer,
    onProgress?: ProgressCallback
): Promise<SavParseResult> {
    const startTime = performance.now();

    // Ensure module is initialized
    try {
        await initReadStat();
    } catch {
        const fallback = await parseWithJsavvy(buffer, true);
        if (onProgress) onProgress({ progress: 1 });
        return {
            metadata: fallback.metadata,
            rows: fallback.rows,
            durationMs: performance.now() - startTime,
        };
    }

    if (!moduleInstance) {
        const fallback = await parseWithJsavvy(buffer, true);
        if (onProgress) onProgress({ progress: 1 });
        return {
            metadata: fallback.metadata,
            rows: fallback.rows,
            durationMs: performance.now() - startTime,
        };
    }

    const mod = moduleInstance;

    console.log(`📦 [ReadStat] Parsing SAV file: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Allocate buffer in WASM memory
    const data = new Uint8Array(buffer);
    const bufferPtr = mod._malloc(data.length);

    if (bufferPtr === 0) {
        throw new Error('Failed to allocate WASM memory for SAV file');
    }

    console.log(`📦 [ReadStat] Allocated ${data.length} bytes at ptr ${bufferPtr}`);

    // Use writeArrayToMemory - handles memory growth properly
    mod.writeArrayToMemory(data, bufferPtr);

    console.log(`📦 [ReadStat] Copied data to WASM memory, calling parse_sav...`);

    try {
        // Parse the file
        const errorCode = mod._parse_sav(bufferPtr, data.length);

        // Check for errors
        if (errorCode !== 0) {
            const errorMsgPtr = mod._get_error_message(errorCode);
            const errorMsg = mod.UTF8ToString(errorMsgPtr);
            throw new Error(`ReadStat error (${errorCode}): ${errorMsg}`);
        }

        // Get counts
        const variableCount = mod._get_variable_count();
        const rowCount = mod._get_row_count();
        const valueLabelCount = mod._get_value_label_count();

        // Extract variables
        const variables: SavVariable[] = [];
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

        // Extract value labels
        const valueLabelSets: Record<string, SavValueLabel[]> = {};
        for (let i = 0; i < valueLabelCount; i++) {
            const setNamePtr = mod._get_value_label_set_name(i);
            const labelPtr = mod._get_value_label_label(i);
            const setName = mod.UTF8ToString(setNamePtr);
            const value = mod._get_value_label_value(i);
            const label = mod.UTF8ToString(labelPtr);

            if (setName) {
                if (!valueLabelSets[setName]) {
                    valueLabelSets[setName] = [];
                }
                valueLabelSets[setName].push({ value, label });
            }
        }

        // Extract Multiple Response Sets
        const mrSetCount = mod._get_mr_set_count();
        const multipleResponseSets: SavMultipleResponseSet[] = [];
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

        if (mrSetCount > 0) {
            console.log(`📦 [ReadStat] Found ${mrSetCount} Multiple Response Sets`);
        }

        // Extract rows
        const rows: (number | string | null)[][] = [];
        for (let r = 0; r < rowCount; r++) {
            const row: (number | string | null)[] = [];
            for (let c = 0; c < variableCount; c++) {
            if (isCellSystemMissing(mod, r, c)) {
                row.push(null);
            } else if (variables[c].type === 'string') {
                const strPtr = mod._get_string_value(r, c);
                    row.push(mod.UTF8ToString(strPtr));
                } else {
                    row.push(mod._get_numeric_value(r, c));
                }
            }
            rows.push(row);

            // Report progress every 1000 rows
            if (onProgress && r % 1000 === 0) {
                onProgress({ progress: r / rowCount });
            }
        }

        const durationMs = performance.now() - startTime;

        // Clean up WASM-side memory
        mod._free_parse_results();

        return {
            metadata: {
                variableCount,
                rowCount,
                variables,
                valueLabelSets,
                multipleResponseSets,
            },
            rows,
            durationMs,
        };
    } finally {
        // Free the input buffer
        mod._free(bufferPtr);
    }
}

/**
 * Parse SAV metadata only (no row data).
 *
 * @param buffer - The SAV file contents as an ArrayBuffer
 * @returns Parsed metadata without row values
 */
export async function parseSavMetadata(
    buffer: ArrayBuffer
): Promise<SavMetadataResult> {
    const startTime = performance.now();

    // Ensure module is initialized
    try {
        await initReadStat();
    } catch {
        const fallback = await parseWithJsavvy(buffer, false);
        return {
            metadata: fallback.metadata,
            durationMs: performance.now() - startTime,
        };
    }

    if (!moduleInstance) {
        const fallback = await parseWithJsavvy(buffer, false);
        return {
            metadata: fallback.metadata,
            durationMs: performance.now() - startTime,
        };
    }

    const mod = moduleInstance;

    if (!mod._parse_sav_metadata) {
        throw new Error('ReadStat WASM build does not support metadata-only parsing. Rebuild the WASM module.');
    }

    console.log(`📦 [ReadStat] Parsing SAV metadata: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Allocate buffer in WASM memory
    const data = new Uint8Array(buffer);
    const bufferPtr = mod._malloc(data.length);

    if (bufferPtr === 0) {
        throw new Error('Failed to allocate WASM memory for SAV file');
    }

    console.log(`📦 [ReadStat] Allocated ${data.length} bytes at ptr ${bufferPtr}`);

    // Use writeArrayToMemory - handles memory growth properly
    mod.writeArrayToMemory(data, bufferPtr);

    console.log(`📦 [ReadStat] Copied data to WASM memory, calling parse_sav_metadata...`);

    try {
        const errorCode = mod._parse_sav_metadata(bufferPtr, data.length);

        if (errorCode !== 0) {
            const errorMsgPtr = mod._get_error_message(errorCode);
            const errorMsg = mod.UTF8ToString(errorMsgPtr);
            throw new Error(`ReadStat error (${errorCode}): ${errorMsg}`);
        }

        // Get counts
        const variableCount = mod._get_variable_count();
        const rowCount = mod._get_row_count();
        const valueLabelCount = mod._get_value_label_count();

        // Extract variables
        const variables: SavVariable[] = [];
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

        // Extract value labels
        const valueLabelSets: Record<string, SavValueLabel[]> = {};
        for (let i = 0; i < valueLabelCount; i++) {
            const setNamePtr = mod._get_value_label_set_name(i);
            const labelPtr = mod._get_value_label_label(i);
            const setName = mod.UTF8ToString(setNamePtr);
            const value = mod._get_value_label_value(i);
            const label = mod.UTF8ToString(labelPtr);

            if (setName) {
                if (!valueLabelSets[setName]) {
                    valueLabelSets[setName] = [];
                }
                valueLabelSets[setName].push({ value, label });
            }
        }

        // Extract Multiple Response Sets
        const mrSetCount = mod._get_mr_set_count();
        const multipleResponseSets: SavMultipleResponseSet[] = [];
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

        const durationMs = performance.now() - startTime;

        // Clean up WASM-side memory
        mod._free_parse_results();

        return {
            metadata: {
                variableCount,
                rowCount,
                variables,
                valueLabelSets,
                multipleResponseSets,
            },
            durationMs,
        };
    } finally {
        // Free the input buffer
        mod._free(bufferPtr);
    }
}

/**
 * Parse a SAV file and return only the first N rows for sampling.
 * Metadata includes the full row count.
 *
 * @param buffer - The SAV file contents as an ArrayBuffer
 * @param rowLimit - Maximum number of rows to sample
 * @param strategy - Sampling strategy: 'sequential' (default) for first N rows, 'spread' for evenly distributed rows
 */
export async function parseSavSample(
    buffer: ArrayBuffer,
    rowLimit: number,
    strategy: SampleStrategy = 'sequential'
): Promise<SavParseResult> {
    const startTime = performance.now();

    try {
        await initReadStat();
    } catch {
        const fallback = await parseWithJsavvy(buffer, true);
        const fullRows = fallback.rows;
        const safeLimit = Math.max(0, Math.floor(rowLimit));
        const rows = strategy === 'spread' && safeLimit < fullRows.length
            ? Array.from({ length: safeLimit }, (_, i) => fullRows[Math.floor(i * fullRows.length / safeLimit)] ?? fullRows[fullRows.length - 1]).filter(Boolean) as (number | string | null)[][]
            : fullRows.slice(0, safeLimit);

        return {
            metadata: fallback.metadata,
            rows,
            durationMs: performance.now() - startTime,
            sampleStrategy: strategy,
        };
    }

    if (!moduleInstance) {
        const fallback = await parseWithJsavvy(buffer, true);
        const fullRows = fallback.rows;
        const safeLimit = Math.max(0, Math.floor(rowLimit));
        const rows = strategy === 'spread' && safeLimit < fullRows.length
            ? Array.from({ length: safeLimit }, (_, i) => fullRows[Math.floor(i * fullRows.length / safeLimit)] ?? fullRows[fullRows.length - 1]).filter(Boolean) as (number | string | null)[][]
            : fullRows.slice(0, safeLimit);

        return {
            metadata: fallback.metadata,
            rows,
            durationMs: performance.now() - startTime,
            sampleStrategy: strategy,
        };
    }

    const mod = moduleInstance;

    if (!mod._parse_sav_sample || !mod._get_parsed_row_count) {
        throw new Error('ReadStat WASM build does not support sample parsing. Rebuild the WASM module.');
    }

    const safeLimit = Math.max(0, Math.floor(rowLimit));
    const strategyCode = strategy === 'spread' ? 1 : 0;

    console.log(`📦 [ReadStat] Parsing SAV sample (${safeLimit} rows, ${strategy}): ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    const data = new Uint8Array(buffer);
    const bufferPtr = mod._malloc(data.length);

    if (bufferPtr === 0) {
        throw new Error('Failed to allocate WASM memory for SAV file');
    }

    console.log(`📦 [ReadStat] Allocated ${data.length} bytes at ptr ${bufferPtr}`);

    mod.writeArrayToMemory(data, bufferPtr);

    console.log(`📦 [ReadStat] Copied data to WASM memory, calling parse_sav_sample...`);

    try {
        const errorCode = mod._parse_sav_sample(bufferPtr, data.length, safeLimit, strategyCode);

        // ReadStat returns USER_ABORT when we stop early for sampling.
        if (errorCode !== 0 && errorCode !== 4) {
            const errorMsgPtr = mod._get_error_message(errorCode);
            const errorMsg = mod.UTF8ToString(errorMsgPtr);
            throw new Error(`ReadStat error (${errorCode}): ${errorMsg}`);
        }

        const variableCount = mod._get_variable_count();
        const rowCount = mod._get_row_count();
        const parsedRowCount = mod._get_parsed_row_count();
        const valueLabelCount = mod._get_value_label_count();
        const usedStrategy: SampleStrategy = mod._get_sample_strategy?.() === 1 ? 'spread' : 'sequential';

        const variables: SavVariable[] = [];
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

        const valueLabelSets: Record<string, SavValueLabel[]> = {};
        for (let i = 0; i < valueLabelCount; i++) {
            const setNamePtr = mod._get_value_label_set_name(i);
            const labelPtr = mod._get_value_label_label(i);
            const setName = mod.UTF8ToString(setNamePtr);
            const value = mod._get_value_label_value(i);
            const label = mod.UTF8ToString(labelPtr);

            if (setName) {
                if (!valueLabelSets[setName]) {
                    valueLabelSets[setName] = [];
                }
                valueLabelSets[setName].push({ value, label });
            }
        }

        const mrSetCount = mod._get_mr_set_count();
        const multipleResponseSets: SavMultipleResponseSet[] = [];
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

        const rows: (number | string | null)[][] = [];
        for (let r = 0; r < parsedRowCount; r++) {
            const row: (number | string | null)[] = [];
            for (let c = 0; c < variableCount; c++) {
                if (isCellSystemMissing(mod, r, c)) {
                    row.push(null);
                } else if (variables[c].type === 'string') {
                    const strPtr = mod._get_string_value(r, c);
                    row.push(mod.UTF8ToString(strPtr));
                } else {
                    row.push(mod._get_numeric_value(r, c));
                }
            }
            rows.push(row);
        }

        const durationMs = performance.now() - startTime;

        mod._free_parse_results();

        return {
            metadata: {
                variableCount,
                rowCount,
                variables,
                valueLabelSets,
                multipleResponseSets,
            },
            rows,
            durationMs,
            sampleStrategy: usedStrategy,
        };
    } finally {
        mod._free(bufferPtr);
    }
}

/**
 * Check if a file is a valid SAV file by checking magic bytes.
 */
export function isSavFile(buffer: ArrayBuffer): boolean {
    const view = new Uint8Array(buffer, 0, 4);
    // SAV files start with "$FL2" or "$FL3"
    return (
        view[0] === 0x24 && // $
        view[1] === 0x46 && // F
        view[2] === 0x4C && // L
        (view[3] === 0x32 || view[3] === 0x33) // 2 or 3
    );
}

/**
 * Streaming row batch result
 */
export interface RowBatch {
    rows: (number | string | null)[][];
    startRow: number;
    endRow: number;
    totalRows: number;
    progress: number;
    /** Variable metadata, provided on the first batch for streaming v2 */
    variables?: SavVariable[];
}

/**
 * Streaming progress callback
 */
export type StreamingProgressCallback = (
    batch: RowBatch
) => Promise<void | number> | void | number;

/**
 * Streaming parse result with metadata available upfront
 */
export interface StreamingParseResult extends SavMetadataResult {
    /** Variables with type information, available before rows are streamed */
    variables: SavVariable[];
}

/**
 * Single-pass streaming bridge options.
 * Credits bound how many row batches can be queued ahead of consumption.
 */
export interface SinglePassBridgeOptions {
    batchSize?: number;
    initialCredits?: number;
    maxCredits?: number;
}

export interface SinglePassBridgeMetrics {
    initialCredits: number;
    maxCredits: number;
    maxQueueDepth: number;
    producedBatches: number;
    consumedBatches: number;
}

export interface SinglePassBridgeResult extends StreamingParseResult {
    bridge: SinglePassBridgeMetrics;
}

/**
 * Windowed parse result for row-offset + row-limit extraction.
 */
export interface WindowParseResult extends SavParseResult {
    /** Number of rows actually parsed for this window */
    windowRowCount: number;
    /** Requested row offset used for this parse */
    rowOffset: number;
}

/**
 * Parse a SAV file window using ReadStat row offset/row limit.
 *
 * @param buffer - SAV file contents
 * @param rowOffset - 0-based starting row offset
 * @param rowLimit - maximum rows to parse in this window
 */
export async function parseSavWindow(
    buffer: ArrayBuffer,
    rowOffset: number,
    rowLimit: number
): Promise<WindowParseResult> {
    const startTime = performance.now();

    await initReadStat();
    const mod = moduleInstance!;

    if (!mod._parse_sav_window) {
        throw new Error('ReadStat WASM build does not support window parsing. Rebuild the WASM module.');
    }

    const safeOffset = Math.max(0, Math.floor(rowOffset));
    const safeLimit = Math.max(1, Math.floor(rowLimit));
    const data = new Uint8Array(buffer);
    const bufferPtr = mod._malloc(data.length);

    if (bufferPtr === 0) {
        throw new Error('Failed to allocate WASM memory for SAV window parse');
    }

    mod.writeArrayToMemory(data, bufferPtr);

    try {
        const errorCode = mod._parse_sav_window(bufferPtr, data.length, safeOffset, safeLimit);
        throwOnReadStatError(mod, errorCode);

        const metadata = extractMetadataFromModule(mod);
        const windowRowCount = mod._get_window_row_count?.()
            ?? mod._get_parsed_row_count?.()
            ?? metadata.rowCount;
        const totalRows = mod._get_total_row_count?.() ?? metadata.rowCount;

        const rows = extractRowsFromModule(mod, metadata.variables, windowRowCount);
        const durationMs = performance.now() - startTime;

        mod._free_parse_results();

        return {
            metadata: {
                ...metadata,
                rowCount: totalRows,
            },
            rows,
            durationMs,
            windowRowCount,
            rowOffset: safeOffset,
        };
    } finally {
        mod._free(bufferPtr);
    }
}

/**
 * Streaming parser v2: metadata-first + windowed row parsing.
 *
 * Compared to parseSavStreaming(), this avoids full-matrix accumulation by
 * reparsing bounded row windows and emitting each window immediately.
 */
export async function parseSavStreamingV2(
    buffer: ArrayBuffer,
    batchSize: number = 5000,
    onBatch: StreamingProgressCallback
): Promise<StreamingParseResult> {
    const startTime = performance.now();

    await initReadStat();
    const mod = moduleInstance!;

    if (!mod._parse_sav_metadata || !mod._parse_sav_window) {
        throw new Error('ReadStat WASM build does not support streaming v2 window parsing. Rebuild the WASM module.');
    }

    const safeBatchSize = Math.max(1, Math.floor(batchSize));
    const data = new Uint8Array(buffer);
    const bufferPtr = mod._malloc(data.length);

    if (bufferPtr === 0) {
        throw new Error('Failed to allocate WASM memory for SAV streaming parse');
    }

    mod.writeArrayToMemory(data, bufferPtr);

    try {
        const metadataError = mod._parse_sav_metadata(bufferPtr, data.length);
        throwOnReadStatError(mod, metadataError);

        const metadata = extractMetadataFromModule(mod);
        const totalRows = metadata.rowCount;

        mod._free_parse_results();

        if (totalRows < 0) {
            throw new Error('ReadStat metadata returned unknown row count; streaming v2 requires deterministic row counts.');
        }

        let processedRows = 0;
        let activeBatchSize = safeBatchSize;
        let firstBatch = true;

        while (processedRows < totalRows) {
            const remainingRows = totalRows - processedRows;
            const requestedRows = Math.min(activeBatchSize, remainingRows);

            let shouldFreeResults = false;
            try {
                const errorCode = mod._parse_sav_window(bufferPtr, data.length, processedRows, requestedRows);
                throwOnReadStatError(mod, errorCode);
                shouldFreeResults = true;

                const windowRows = mod._get_window_row_count?.()
                    ?? mod._get_parsed_row_count?.()
                    ?? mod._get_row_count();

                if (windowRows <= 0) {
                    throw new Error(`Window parse returned zero rows at offset ${processedRows}`);
                }

                const rows = extractRowsFromModule(mod, metadata.variables, windowRows);
                const endRow = Math.min(totalRows, processedRows + windowRows);

                const suggestedBatchSize = await onBatch({
                    rows,
                    startRow: processedRows,
                    endRow,
                    totalRows,
                    progress: endRow / totalRows,
                    variables: firstBatch ? metadata.variables : undefined,
                });

                if (
                    typeof suggestedBatchSize === 'number' &&
                    Number.isFinite(suggestedBatchSize) &&
                    suggestedBatchSize >= 1
                ) {
                    activeBatchSize = Math.max(1, Math.floor(suggestedBatchSize));
                }

                firstBatch = false;
                processedRows = endRow;
            } finally {
                if (shouldFreeResults) {
                    mod._free_parse_results();
                }
            }
        }

        const durationMs = performance.now() - startTime;
        return {
            metadata,
            variables: metadata.variables,
            durationMs,
        };
    } finally {
        mod._free(bufferPtr);
    }
}

/**
 * Parse a SAV file in streaming mode, processing rows in batches.
 * This reduces peak JS memory by allowing the caller to process and discard
 * each batch before the next one is loaded.
 *
 * The function returns metadata immediately (via the returned promise),
 * and delivers rows via the onBatch callback. This allows the caller
 * to know column names and types before receiving data.
 *
 * @param buffer - The SAV file contents as an ArrayBuffer
 * @param batchSize - Number of rows per batch (default 5000)
 * @param onBatch - Callback called for each batch of rows
 * @returns Parsed metadata (rows are delivered via callback)
 */
export async function parseSavStreaming(
    buffer: ArrayBuffer,
    batchSize: number = 5000,
    onBatch: StreamingProgressCallback
): Promise<StreamingParseResult> {
    const startTime = performance.now();

    try {
        await initReadStat();
    } catch {
        const fallback = await parseWithJsavvy(buffer, true);
        const totalRows = fallback.metadata.rowCount;
        for (let startRow = 0; startRow < totalRows; startRow += batchSize) {
            const endRow = Math.min(startRow + batchSize, totalRows);
            await onBatch({
                rows: fallback.rows.slice(startRow, endRow),
                startRow,
                endRow,
                totalRows,
                progress: endRow / totalRows,
            });
        }

        return {
            metadata: fallback.metadata,
            variables: fallback.metadata.variables,
            durationMs: performance.now() - startTime,
        };
    }

    if (!moduleInstance) {
        const fallback = await parseWithJsavvy(buffer, true);
        const totalRows = fallback.metadata.rowCount;
        for (let startRow = 0; startRow < totalRows; startRow += batchSize) {
            const endRow = Math.min(startRow + batchSize, totalRows);
            await onBatch({
                rows: fallback.rows.slice(startRow, endRow),
                startRow,
                endRow,
                totalRows,
                progress: endRow / totalRows,
            });
        }

        return {
            metadata: fallback.metadata,
            variables: fallback.metadata.variables,
            durationMs: performance.now() - startTime,
        };
    }

    const mod = moduleInstance;

    const fileSizeMb = (buffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`📦 [ReadStat] Streaming parse SAV: ${fileSizeMb} MB, batch size ${batchSize}`);

    // Allocate buffer in WASM memory
    const data = new Uint8Array(buffer);
    const bufferPtr = mod._malloc(data.length);

    if (bufferPtr === 0) {
        throw new Error('Failed to allocate WASM memory for SAV file');
    }

    mod.writeArrayToMemory(data, bufferPtr);

    try {
        // Parse the entire file into WASM memory
        // Note: This still loads all rows into WASM, but we extract them in batches
        // to reduce peak JS memory usage
        const errorCode = mod._parse_sav(bufferPtr, data.length);

        if (errorCode !== 0) {
            const errorMsgPtr = mod._get_error_message(errorCode);
            const errorMsg = mod.UTF8ToString(errorMsgPtr);
            throw new Error(`ReadStat error (${errorCode}): ${errorMsg}`);
        }

        // Extract metadata first (before streaming rows)
        const variableCount = mod._get_variable_count();
        const rowCount = mod._get_row_count();
        const valueLabelCount = mod._get_value_label_count();

        // Extract variables with full metadata
        const variables: SavVariable[] = [];
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

        // Extract value labels
        const valueLabelSets: Record<string, SavValueLabel[]> = {};
        for (let i = 0; i < valueLabelCount; i++) {
            const setNamePtr = mod._get_value_label_set_name(i);
            const labelPtr = mod._get_value_label_label(i);
            const setName = mod.UTF8ToString(setNamePtr);
            const value = mod._get_value_label_value(i);
            const label = mod.UTF8ToString(labelPtr);

            if (setName) {
                if (!valueLabelSets[setName]) {
                    valueLabelSets[setName] = [];
                }
                valueLabelSets[setName].push({ value, label });
            }
        }

        // Extract Multiple Response Sets
        const mrSetCount = mod._get_mr_set_count();
        const multipleResponseSets: SavMultipleResponseSet[] = [];
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

        console.log(`📦 [ReadStat] Metadata extracted: ${variableCount} variables, ${rowCount} rows. Streaming...`);

        // Stream rows in batches
        let activeBatchSize = Math.max(1, Math.floor(batchSize));
        let processedRows = 0;
        let batchCount = 0;
        while (processedRows < rowCount) {
            const batchEnd = Math.min(processedRows + activeBatchSize, rowCount);
            const rows: (number | string | null)[][] = [];

            // Extract this batch of rows
            for (let r = processedRows; r < batchEnd; r++) {
                const row: (number | string | null)[] = [];
                for (let c = 0; c < variableCount; c++) {
                    if (isCellSystemMissing(mod, r, c)) {
                        row.push(null);
                    } else if (variables[c].type === 'string') {
                        const strPtr = mod._get_string_value(r, c);
                        row.push(mod.UTF8ToString(strPtr));
                    } else {
                        row.push(mod._get_numeric_value(r, c));
                    }
                }
                rows.push(row);
            }

            batchCount++;

            // Call the batch callback (await allows for async processing)
            const suggestedBatchSize = await onBatch({
                rows,
                startRow: processedRows,
                endRow: batchEnd,
                totalRows: rowCount,
                progress: batchEnd / rowCount,
                variables: batchCount === 1 ? variables : undefined,
            });

            if (
                typeof suggestedBatchSize === 'number' &&
                Number.isFinite(suggestedBatchSize) &&
                suggestedBatchSize >= 1
            ) {
                activeBatchSize = Math.max(1, Math.floor(suggestedBatchSize));
            }

            // Release WASM memory for processed rows (reduces WASM heap usage)
            if (mod._release_rows_up_to) {
                mod._release_rows_up_to(batchEnd);
            }

            processedRows = batchEnd;
        }

        const durationMs = performance.now() - startTime;
        console.log(`📦 [ReadStat] Streaming complete: ${rowCount} rows in ${batchCount} batches, ${durationMs.toFixed(0)}ms`);

        // Clean up WASM-side memory
        mod._free_parse_results();

        return {
            metadata: {
                variableCount,
                rowCount,
                variables,
                valueLabelSets,
                multipleResponseSets,
            },
            variables,
            durationMs,
        };
    } finally {
        // Free the input buffer
        mod._free(bufferPtr);
    }
}

/**
 * Stage-2 single-pass bridge (R&D):
 * producer = parseSavStreaming row extraction, consumer = onBatch ingestion.
 *
 * Bounded credits create explicit backpressure and cap queued JS row batches.
 * This path remains opt-in and should be feature-flagged by callers.
 */
export async function parseSavStreamingSinglePassBridge(
    buffer: ArrayBuffer,
    options: SinglePassBridgeOptions = {},
    onBatch: StreamingProgressCallback
): Promise<SinglePassBridgeResult> {
    const initialCredits = Math.max(1, Math.floor(options.initialCredits ?? 2));
    const maxCredits = Math.max(initialCredits, Math.floor(options.maxCredits ?? 4));
    const initialBatchSize = Math.max(1, Math.floor(options.batchSize ?? 5000));

    let credits = initialCredits;
    let currentBatchSize = initialBatchSize;
    const queue: RowBatch[] = [];
    const creditWaiters: Array<() => void> = [];
    const queueWaiters: Array<() => void> = [];
    let parserDone = false;
    let parserError: Error | null = null;
    let consumerError: Error | null = null;

    let producedBatches = 0;
    let consumedBatches = 0;
    let maxQueueDepth = 0;

    const signalWaiters = (waiters: Array<() => void>): void => {
        const toNotify = waiters.splice(0, waiters.length);
        for (const notify of toNotify) notify();
    };

    const waitForCredit = async (): Promise<void> => {
        if (credits > 0 || consumerError) return;
        await new Promise<void>((resolve) => creditWaiters.push(resolve));
    };

    const waitForQueueItem = async (): Promise<void> => {
        if (queue.length > 0 || parserDone) return;
        await new Promise<void>((resolve) => queueWaiters.push(resolve));
    };

    const consumePromise = (async () => {
        while (!parserDone || queue.length > 0) {
            if (consumerError) {
                break;
            }
            if (queue.length === 0) {
                await waitForQueueItem();
                continue;
            }

            const batch = queue.shift()!;
            try {
                const suggestedBatchSize = await onBatch(batch);
                consumedBatches += 1;

                if (
                    typeof suggestedBatchSize === 'number' &&
                    Number.isFinite(suggestedBatchSize) &&
                    suggestedBatchSize >= 1
                ) {
                    currentBatchSize = Math.max(1, Math.floor(suggestedBatchSize));
                }
            } catch (error: any) {
                consumerError = error instanceof Error ? error : new Error(String(error));
                break;
            } finally {
                credits = Math.min(maxCredits, credits + 1);
                signalWaiters(creditWaiters);
            }
        }
    })();

    let parseResult: StreamingParseResult | null = null;
    try {
        parseResult = await parseSavStreaming(
            buffer,
            initialBatchSize,
            async (batch) => {
                while (credits <= 0) {
                    if (consumerError) {
                        throw consumerError;
                    }
                    await waitForCredit();
                }

                if (consumerError) {
                    throw consumerError;
                }

                credits -= 1;
                queue.push(batch);
                producedBatches += 1;
                if (queue.length > maxQueueDepth) {
                    maxQueueDepth = queue.length;
                }
                signalWaiters(queueWaiters);

                return currentBatchSize;
            }
        );
    } catch (error: any) {
        parserError = error instanceof Error ? error : new Error(String(error));
    } finally {
        parserDone = true;
        signalWaiters(queueWaiters);
        signalWaiters(creditWaiters);
    }

    await consumePromise;

    if (consumerError) {
        throw consumerError;
    }

    if (parserError) {
        throw parserError;
    }

    if (!parseResult) {
        throw new Error('Single-pass bridge parse did not return a result');
    }

    return {
        ...parseResult,
        bridge: {
            initialCredits,
            maxCredits,
            maxQueueDepth,
            producedBatches,
            consumedBatches,
        },
    };
}
