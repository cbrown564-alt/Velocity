import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import createModule from '../dist/readstat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const savPath = '/Users/cobro/Code/Velocity/test_data/WVS_Cross-National_Wave_7_spss_v6_0.sav';

async function runTest() {
    console.log(`[Test] Starting WASM verification with ${savPath}`);

    // 1. Initialize Module
    const wasmPath = '/Users/cobro/Code/Velocity/packages/readstat-wasm/dist/readstat.wasm';
    const wasmBinary = fs.readFileSync(wasmPath);

    const mod = await createModule({
        wasmBinary: wasmBinary,
        print: (text) => console.log('[WASM stdout]', text),
        printErr: (text) => console.error('[WASM stderr]', text)
    });
    console.log('[Test] WASM Module initialized');

    // 2. Read File
    const buffer = fs.readFileSync(savPath);
    console.log(`[Test] Read file: ${buffer.length} bytes`);

    // 3. Allocate Memory
    const ptr = mod._malloc(buffer.length);
    if (!ptr) {
        console.error('[Test] Malloc failed');
        process.exit(1);
    }
    console.log(`[Test] Allocated memory at ${ptr}`);

    // 4. Write Data
    if (mod.writeArrayToMemory) {
        mod.writeArrayToMemory(buffer, ptr);
        console.log('[Test] Wrote data using writeArrayToMemory');
    } else {
        console.warn('[Test] writeArrayToMemory missing, using HEAPU8.set');
        mod.HEAPU8.set(buffer, ptr);
    }

    // 5. Parse
    console.log('[Test] Calling _parse_sav...');
    try {
        const errorCode = mod._parse_sav(ptr, buffer.length);
        console.log(`[Test] _parse_sav returned code: ${errorCode}`);

        if (errorCode !== 0) {
            const msgPtr = mod._get_error_message(errorCode);
            console.error(`[Test] Error message: ${mod.UTF8ToString(msgPtr)}`);
        } else {
            const rowCount = mod._get_row_count();
            const varCount = mod._get_variable_count();
            console.log(`[Test] Success! Parsed ${rowCount} rows and ${varCount} variables.`);
        }
    } catch (e) {
        console.error('[Test] CRASHED inside _parse_sav:', e);
    } finally {
        mod._free(ptr);
        if (mod._free_parse_results) mod._free_parse_results();
    }
}

runTest().catch(e => console.error('Script error:', e));
