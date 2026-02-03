# Known Divergences between WASM and Node Adapters

This document tracks known differences in behavior or output between the `DuckDBWasmAdapter` (browser/WASMBundle) and `DuckDBNodeAdapter` (Native Node-API).

## Current Status: Parity Achieved

As of the current implementation, all golden test fixtures pass parity tests with a floating-point tolerance of `1e-10`.

## Potential Areas of Divergence

- **Floating Point Precision**: Small differences may occur due to the WASM environment vs. native compilation. Parity tests currently use `expectCloseDeep` with a tolerance to account for this.
- **Worker Communication**: WASM adapter uses async communication with a worker (polyfilled or real), which may introduce subtle timing differences if not properly teardown.
- **SQL Variations**: Ensure all SQL dialects/functions used are supported by both the WASM version and the native Node-API version of DuckDB.

## How to Run Parity Tests

```bash
npm run test:parity
```

If a new divergence is found that is acceptable (e.g., minor scientific notation differences), document it here.
