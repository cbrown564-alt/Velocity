## Purpose
Optimize performance in a way that preserves architectural boundaries, statistical correctness, and UI responsiveness.

This playbook applies to:
- slow queries or aggregations
- UI freezes or frame drops
- large dataset ingestion or transformation
- repeated recomputation of derived results
- performance regressions after refactors or new features

## Non-negotiable invariants
- Heavy data processing MUST run in the Web Worker (DuckDB, Arrow ops).
- UI (main thread) is for rendering and interaction only.
- Statistical outputs must remain methodologically identical unless explicitly changed.
- `src/core/` remains portable (no DOM / React / browser APIs).

## Inputs you MUST read
- `arch_01_system_architecture.md` (main thread vs worker responsibilities)
- `arch_03_headless_core.md` (adapter seam and dependency direction)
- If stats are involved: `arch_04_statistical_engine.md`

## Required PR artifacts
- A short “Perf Hypothesis” in the PR description:
  - where the bottleneck is suspected
  - how it was measured
  - expected impact (e.g., p95 latency ↓, memory ↓)
- Before/After evidence:
  - timing logs
  - query duration
  - frame rate / UI responsiveness
  - memory usage (if relevant)

## Workflow

### Step 0 — Measure first
Do NOT optimize based on intuition.

Gather at least one:
- timing around worker calls
- DuckDB query duration
- render duration (e.g., chart mount/update)
- ingestion time for a representative dataset

Record a baseline in the PR.

### Step 1 — Classify the bottleneck
Identify which layer is slow:

| Layer | Likely Cause |
|-------|--------------|
Worker / DB | query complexity, missing indexes, repeated scans |
Core logic | inefficient transforms, repeated computation |
UI thread | large state updates, excessive re-renders |
Bridge | large message passing / serialization |

### Step 2 — Choose the lowest-risk optimization
Prefer:
- query simplification (avoid nested aggregations)
- pushing aggregation into DuckDB
- memoizing derived results in core/worker
- batching UI updates
- debouncing user-driven recalculations
- reducing message payload sizes across worker boundary

Avoid:
- moving compute into UI “for convenience”
- changing statistical methods to gain speed
- introducing async complexity without clear gain

### Step 3 — Implement minimally
Make one targeted change at a time:
- adjust SQL
- introduce memoization cache
- move logic to worker
- debounce/throttle UI-triggered recalcs

Avoid mixing structural refactors in the same PR.

### Step 4 — Re-measure
Re-run the same measurement used in Step 0.
Include:
- before vs after timing
- any change in memory footprint
- UI responsiveness improvement (if applicable)

### Step 5 — Verify correctness
For any stats-related optimization:
- run golden tests
- verify denominators / ESS unchanged
- confirm deterministic outputs

### Step 6 — Reviewer checklist
Reviewers should verify:
- baseline measurement existed
- optimization targets the right layer
- worker/main-thread boundary respected
- statistical outputs unchanged (unless declared)

## Common failure modes (avoid these)
- optimizing UI instead of moving compute to worker
- caching results without invalidation on filter change
- reducing precision or rounding silently
- over-optimizing small datasets (hurts large ones)
- introducing race conditions via async batching

## Definition of Done
- baseline + after measurements included
- worker/main-thread responsibilities preserved
- tests pass and outputs unchanged
- targeted change only (no stealth refactor)