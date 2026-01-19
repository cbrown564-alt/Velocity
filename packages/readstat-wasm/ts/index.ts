/**
 * ReadStat WASM - High-performance SPSS SAV file parser
 * 
 * This module wraps libreadstat compiled to WebAssembly for parsing
 * SPSS .sav files directly in the browser with near-native performance.
 */

import type {
    SavVariable,
    SavValueLabel,
    SavMetadata,
    SavParseResult,
    ProgressCallback,
} from './types';

// Re-export types
export type {
    SavVariable,
    SavValueLabel,
    SavMetadata,
    SavParseResult,
    ProgressCallback,
};

// Type for the Emscripten module
interface ReadStatModule {
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    _parse_sav: (bufferPtr: number, len: number) => number;
    _get_variable_count: () => number;
    _get_row_count: () => number;
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
