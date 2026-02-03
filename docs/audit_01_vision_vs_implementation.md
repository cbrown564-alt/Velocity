# Vision vs. Implementation Audit

**Project:** Velocity
**Date:** February 3, 2026
**Scope:** Full review of `/docs` (including `/docs/archive`) and comparison to current codebase state
**Goal:** Build a rich understanding of the original vision, compare to current implementation, and identify gaps, over-deliveries, and new directions unlocked.

---

## Executive Summary
Velocity’s original vision centers on a local‑first, survey‑native analysis workbench that is fast, trustworthy, and accessible to non‑technical researchers. The current implementation has delivered the core architectural bet (WASM ingestion + DuckDB‑WASM + worker‑based analysis), and in several areas has **exceeded** the original scope: a functioning headless core with a CLI, a broad chart system with advanced renderers, and a real export pipeline (PPTX/XLSX).

However, there are still **material gaps** relative to the original roadmap, especially around persistence (OPFS reliability), large‑file ingestion beyond guardrails, multi‑slide/true canvas layouts, and advanced statistical features like raking and pairwise significance letters. The variable manager exists and is robust, but its interaction model differs from the “card sorting canvas” vision. The product is closer to the Phase‑2 “Strategic Workbench” and has laid credible foundations for Phase‑3 and Phase‑4 capabilities.

This audit presents:
- The **intended vision** (from docs)
- The **current status snapshot** (from code)
- A **gap analysis**
- **Over‑deliveries** (areas where the app surpassed the original vision)
- **New directions** enabled by these extensions

---

## 1. Original Vision (Condensed)

### 1.1 Core Philosophy
- **Local‑first**: no server processing; data never leaves the browser.
- **Speed > Power**: instant feedback, “video‑game responsiveness.”
- **Survey‑native**: dual‑state variables (raw codes + labels), missing‑value semantics, weighting, and significance testing.

### 1.2 System Architecture
- ReadStat‑WASM ingestion to Arrow
- DuckDB‑WASM for analytics in a worker
- Zustand store as the UI source of truth
- Advanced stats as optional runtime plugins (WebR/Pyodide)

### 1.3 UX Architecture
- **Hub‑and‑spoke**: Analysis Canvas (Harvesting) + Variable Manager (Gardening)
- **Soft‑modal** switching (instant transitions)
- **Visual ETL**: drag‑merge, click‑filter, context menus
- Variable Sets as primary unit of interaction

### 1.4 Output & Reporting
- Editable PowerPoint export (PptxGenJS)
- Copy/Export workflow optimized for “Friday 4PM” use case

### 1.5 Roadmap Layers
- **Phase 1–2:** Core ingestion, crosstabs, significance, weighting (apply), visual ETL, reporting
- **Phase 3:** WebR, advanced stats, recipes/time travel
- **Phase 4:** AI‑native “Cognitive Engine”

---

## 2. Current Implementation Snapshot

### 2.1 Architecture & Core
- ReadStat‑WASM ingestion and Arrow → DuckDB‑WASM is fully implemented.
- Worker orchestration exists (`analysisWorker.ts`) and delegates to a **headless core** (`src/core/*`).
- **DatabaseAdapter** abstractions exist for WASM and Node runtimes.
- A CLI exists and uses the same core runners (`cli/velocity.ts`).

### 2.2 UI & UX
- **Hub‑and‑spoke UX is implemented**: Variable Manager overlay (`AppShell.tsx`, `VariableManager.tsx`).
- Miller Columns navigation, faceted search, bulk actions, and smart inspection exist.
- Analysis Canvas remains a **single focus view**, but slide scaffolding is present (focus mode only).

### 2.3 Charts & Visual ETL
- Full chart system with a recommender and many renderers: bar, stacked, diverging, violin, ridgeline, scatter, hexbin, box plot, lollipop.
- **Visual ETL**: chart context menus (filter/exclude) and drag‑merge exist.

### 2.4 Statistics
- Survey‑native significance testing logic (ESS + Welch t) implemented.
- Weighted stats implemented in `queryBuilder.ts` (mean/stddev).

### 2.5 Export
- **PPTX and XLSX export pipelines exist in core** and are wired into the CLI.

### 2.6 Theming
- Multiple themes exist (Mission Control, Soft Machine, Liquid Glass) with material tokens.

---

## 3. Gap Analysis (Vision vs. Implementation)

### 3.1 Persistence & Recovery
**Vision:** OPFS persistence for session recovery and “no reload loss.”

**Current:** OPFS logic exists but is disabled due to corruption loops. Persisted metadata is stored, but the data engine runs in memory.

**Gap:** Persistent storage is unreliable and not enabled.

---

### 3.2 Large‑File Ingestion
**Vision:** Chunked/streamed ingestion to avoid OOM for large SAVs.

**Current:** Guardrails, metadata‑only and sample modes exist; full ingestion still builds full in‑memory Arrow tables.

**Gap:** Chunked/streamed ingestion path is not implemented; full loads can still crash.

---

### 3.3 Variable Manager UX
**Vision:** Card‑sorting canvas (Miro‑like) for spatial organization.

**Current:** Miller Columns + faceted filtering and folders; robust but different mental model.

**Gap:** Card‑sorting canvas not implemented.

---

### 3.4 Analysis Canvas Layout
**Vision:** Slide‑deck metaphor, multi‑visualization layouts, grid/dashboard mode.

**Current:** Focus mode only; slides slice exists but only first cell used.

**Gap:** Multi‑slide and grid layout not implemented.

---

### 3.5 Weight Creation
**Vision:** Weight creation (raking) via WASM or WebR in later phases.

**Current:** Only applying existing weights is supported.

**Gap:** Weight creation not implemented.

---

### 3.6 Advanced Stats
**Vision:** Pairwise letters (A/B/C), FDR/Bonferroni, dependent samples.

**Current:** Not implemented; survey‑native base exists.

**Gap:** Advanced stats remain roadmap items.

---

### 3.7 Export UX
**Vision:** User‑facing PPTX export in UI.

**Current:** Export pipeline exists in core + CLI; no visible UI workflow.

**Gap:** UI export flow missing.

---

### 3.8 AI / Cognitive Engine
**Vision:** Glass‑box AI, text‑to‑SQL, semantic insights.

**Current:** Not implemented.

**Gap:** Full Phase‑4 scope remains future work.

---

## 4. Over‑Deliveries (Beyond Original Ideas)

### 4.1 Headless Core + CLI
The headless architecture is fully implemented (not just planned), enabling CLI analysis and adapter parity testing.

### 4.2 Export Pipeline Implemented
PPTX/XLSX exporters exist with formatting logic and are callable from CLI.

### 4.3 Chart System Depth
A full chart system with many advanced renderers is present, exceeding initial Phase‑2 chart scope.

### 4.4 Multi‑Theme System
Theme system includes multiple design directions and material‑based tokens.

### 4.5 Worker‑Side Data Processing
Heavy transforms moved into the worker via `processData`, reducing UI jank.

---

## 5. New Directions Opened Up by These Extensions

1. **Headless Core + CLI** enables:
   - CI parity testing vs. SPSS
   - Batch reports
   - Potential serverless exports

2. **Export Pipeline** enables:
   - Automated reporting
   - Scheduled exports
   - Presentation templates

3. **Expanded Chart System** enables:
   - Multi‑viz dashboards
   - Interactive storytelling
   - More advanced visual ETL

4. **Theme System** enables:
   - Persona‑based modes (Strategist vs Analyst)
   - White‑labeling

5. **Worker‑side transforms** enables:
   - Bigger datasets
   - Future AI‑assisted chart generation without main‑thread costs

---

## 6. Risk & Priority Highlights

### High Priority
- OPFS persistence reliability
- Large‑file ingestion beyond sample/metadata mode
- UI‑level export workflow

### Medium Priority
- Slide / multi‑viz layout
- Weight creation engine
- Advanced stats (pairwise letters, FDR)

### Strategic Future
- AI/semantic layer
- Direct imports (Qualtrics/Decipher)

---

## 7. Suggested Next Steps (If Prioritizing Gaps)

1. **Decide persistence strategy**: fix OPFS or commit to in‑memory + explicit save/restore.
2. **Implement chunked ingestion**: reduce OOM risk and unblock large SAV support.
3. **Add UI export flow**: surface PPTX/XLSX pipeline in the app.
4. **Choose canvas evolution**: grid‑layout vs multi‑slide vs continue focus‑mode.

---

## Appendix: Evidence Pointers

**Architecture / Headless Core**
- `src/core/*`
- `src/adapters/*`
- `cli/velocity.ts`

**Worker / Ingestion**
- `src/services/analysisWorker.ts`
- `src/core/ingestion/*`

**Variable Manager**
- `src/components/layout/AppShell.tsx`
- `src/features/variableManager/*`

**Charts**
- `src/components/charts/*`
- `src/services/chartRecommender.ts`

**Export**
- `src/core/export/*`

**Persistence**
- `src/services/analysisWorker.ts`
- `src/store/persistConfig.ts`

