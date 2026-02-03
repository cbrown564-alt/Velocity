# ADR 002: Ingestion Strategy for Large SPSS Files

**Status:** Accepted
**Date:** 2026-01-19
**Context:** Local-First Web App, large datasets (100MB+)

## Context
Velocity aims to be a "High-Performance Research" tool running entirely in the browser. A critical requirement is ingesting SPSS (`.sav`) files, which are the industry standard for survey data.
- **File Sizes:** Users frequently work with datasets >100MB (e.g., WVS Wave 7 is 177MB).
- **Constraints:**
  - **Memory:** Browser tabs have strict memory limits (effectively 2GB-4GB, but instability starts earlier).
  - **Privacy:** No server-side processing allowed (Local-First).
  - **Speed:** Users expect "native-like" performance (<5s load times).

## Options Considered

### 1. Pure JavaScript (`jsavvy`)
- **Pros:** Zero build complexity, pure npm package.
- **Cons:** Extremely slow (10x-20x slower than C). High memory usage due to V8 object overhead. Incomplete struct parsing.
- **Verdict:** Rejected. Fails on files >50MB.

### 2. WebR (R in WASM) + `haven`
- **Pros:** Uses `readstat` internally (very robust). access to full R ecosystem.
- **Cons:**
  - **Double Copy Problem:** Data must be loaded into R memory, then serialized (copied) to JS/Arrow to be useful in Velocity.
  - **Memory Overhead:** A 177MB SAV file becomes ~800MB in R memory + ~400MB serialized copy. High risk of OOM crashes.
  - **Startup Time:** Requires downloading ~15MB of WASM binaries.
- **Verdict:** Rejected for *ingestion* (but kept for Phase 3 analytics).

### 3. Server-Side Processing
- **Pros:** Easy Python/Pandas implementation.
- **Cons:** Violates "Local-First" privacy promise. Adds infrastructure cost.
- **Verdict:** Rejected.

### 4. Custom WASM (`libreadstat` + Emscripten)
- **Pros:**
  - **Streaming:** Can use `readstat`'s row-based callback API to stream data into DuckDB without holding the full dataset in RAM.
  - **Speed:** Near-native C performance.
  - **Correctness:** `libreadstat` is the gold standard library (used by R default).
- **Cons:** High engineering complexity. Requires maintaining a custom C build pipeline (`emcc`).

## Decision
We will implement **Option 4: Custom ReadStat WASM**.

We will compile `libreadstat` to WebAssembly using Emscripten. We will wrap it with a thin C layer that accepts a file buffer and emits row/variable data directly to Javascript (eventually Arrow IPC).

## Implications
1.  **Build Toolchain:** We must add `emscripten` to our CI/CD pipeline or use a Dockerized builder.
2.  **Maintenance:** We are effectively maintaining a `readstat-wasm` fork.
3.  **Performance:** We expect to handle 500MB+ files smoothly by streaming 1000-row chunks directly into DuckDB.
