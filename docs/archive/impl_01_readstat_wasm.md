# ReadStat WASM Implementation

> **Status**: Work in Progress - Debugging memory access issues

## Overview

This documents the implementation of a high-performance SPSS `.sav` file parser by compiling the [libreadstat](https://github.com/WizardMac/ReadStat) C library to WebAssembly using Emscripten.

## What Was Built

### Package Structure

```
packages/readstat-wasm/
├── lib/ReadStat/          # Git submodule of WizardMac/ReadStat
├── src/
│   └── readstat_wasm.c    # C shim layer bridging ReadStat to JS
├── ts/
│   ├── index.ts           # TypeScript wrapper with async API
│   └── types.ts           # Type definitions
├── dist/
│   ├── readstat.js        # Emscripten glue code (~16KB)
│   └── readstat.wasm      # Compiled WASM binary (~195KB)
├── Makefile               # Emscripten build orchestration
└── package.json
```

---

## Design Decisions

### 1. Getter-Based API (vs Callbacks)

**Decision**: Use global state with getter functions instead of JS callback registration.

**Rationale**: Emscripten's `addFunction`/`removeFunction` for dynamic callback registration requires `-sALLOW_TABLE_GROWTH` and careful signature matching. Initial attempts with callbacks caused memory access errors. The getter approach is simpler:

```c
// C side stores parsed data in globals
static variable_info_t *g_variables;
static double *g_numeric_data;

// JS retrieves via getter calls
EMSCRIPTEN_KEEPALIVE
const char* get_variable_name(int index) { ... }
```

### 2. Memory Buffer I/O

**Decision**: Implement custom I/O handlers to read SAV data from a memory buffer rather than filesystem.

**Rationale**: Emscripten's filesystem adds ~100KB+ overhead. Since we receive ArrayBuffer from JS, we implement minimal memory-based I/O.

### 3. Large Initial Memory

**Decision**: Set `-sINITIAL_MEMORY=536870912` (512MB).

**Rationale**: When memory grows during `malloc`, Emscripten's typed array views (`HEAPU8`) become detached. Pre-allocating avoids growth for typical file sizes.

### 4. Selective Source Compilation

**Decision**: Only compile SPSS-related source files, not the full ReadStat library.

**Rationale**: Reduces WASM size from potential megabytes to ~195KB.

---

## Challenges Faced
 
### 1. Memory Access Out of Bounds / Stack Overflow ✅ **RESOLVED**
 
**Status**: Fixed by increasing WASM stack size.
 
**Problem**: 
Parsing certain SAV files (including small ones like `sleep.sav`) caused a `RuntimeError: Out of bounds memory access` or `stack overflow`. 
Investigation revealed this was due to `libreadstat`'s `sav_read_compressed_data` function using more stack space (likely for decompression buffers) than the default Emscripten stack size (64KB).
 
**Fix**: 
Added `-s STACK_SIZE=5242880` (5MB) to the Emscripten build flags.
 
**Verification**:
- `test_small.sav` (Generated): PASS
- `sleep.sav` (Real w/ compression): PASS
- `WVS_Cross-National_Wave_7_spss_v6_0.sav` (176MB Real): PASS
 
---

## Current Integration

The `analysisWorker.ts` has been updated to use `@velocity/readstat-wasm`:

```typescript
const { parseSavFile } = await import('@velocity/readstat-wasm');
const parsed = await parseSavFile(buffer, (progress) => {
  console.log(`Parse progress: ${progress.progress * 100}%`);
});
```

---

## Outstanding Questions

1. **Why does `parse_sav` crash with the 176MB WVS file?**
   - Need smaller test file to isolate the issue

2. **Does ReadStat support compressed ZSAV format fully?**
   - We added zlib support, but need verification

3. **Memory limits in Workers**
   - 512MB initial + growth to 2GB - browser compatibility?

---

## Next Steps

1. Find/create a small test SAV file (~1MB)
2. Add debug logging in C code to trace crash location  
3. Test with `-O0` build for better stack traces
4. Consider iconv dependency for character encoding

---

## Build Commands

```bash
cd packages/readstat-wasm
make all          # Build WASM module
make clean        # Clean build artifacts
make syntax-check # Syntax check only
```

## References

- [ReadStat GitHub](https://github.com/WizardMac/ReadStat)
- [Emscripten Memory Guide](https://emscripten.org/docs/porting/emscripten-runtime-environment.html)
- [SPSS SAV Format](https://www.gnu.org/software/pspp/pspp-dev/html_node/System-File-Format.html)
