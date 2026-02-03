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

// Type for the Emscripten module
interface ReadStatModule {
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    _parse_sav: (bufferPtr: number, len: number) => number;
    _parse_sav_metadata?: (bufferPtr: number, len: number) => number;
    _parse_sav_sample?: (bufferPtr: number, len: number, rowLimit: number, strategy: number) => number;
    _get_variable_count: () => number;
    _get_row_count: () => number;
    _get_parsed_row_count?: () => number;
    _get_sample_strategy?: () => number;
    _get_value_label_count: () => number;
    _get_variable_name: (index: number) => number;
    _get_variable_type: (index: number) => number;
    _get_variable_label: (index: number) => number;
    _get_variable_value_labels_name: (index: number) => number;
    _get_value_label_set_name: (index: number) => number;
    _get_value_label_value: (index: number) => number;
    _get_value_label_label: (index: number) => number;
    _is_cell_missing: (row: number, col: number) => number;
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

    // Runtime methods
    HEAPU8: Uint8Array;
    UTF8ToString: (ptr: number) => string;
    writeArrayToMemory: (array: ArrayLike<number>, buffer: number) => void;
}

// Module instance (lazy-loaded)
let moduleInstance: ReadStatModule | null = null;
let modulePromise: Promise<ReadStatModule> | null = null;

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
        // Dynamic import of the Emscripten glue code
        const moduleFactory = (await import('../dist/readstat.js')).default as () => Promise<ReadStatModule>;
        const instance = await moduleFactory();
        moduleInstance = instance;
        console.log('📦 [ReadStat] WASM module initialized');
        return instance;
    })();

    await modulePromise;
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
    await initReadStat();
    const mod = moduleInstance!;

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
                if (mod._is_cell_missing(r, c)) {
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
    await initReadStat();
    const mod = moduleInstance!;

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

    await initReadStat();
    const mod = moduleInstance!;

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
                if (mod._is_cell_missing(r, c)) {
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
