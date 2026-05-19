# Vision vs. Implementation Audit

**Project:** Velocity
**Date:** February 3, 2026 (Updated: February 5, 2026)
**Scope:** Full review of `/docs` (including `/docs/archive`) and comparison to current codebase state
**Goal:** Build a rich understanding of the original vision, compare to current implementation, and identify gaps, over-deliveries, and new directions unlocked.

---

## 🆕 Update Log (February 5, 2026)

**Major Progress Since Initial Audit:**

✅ **CLOSED GAPS:**
- **Weight Creation** - WebR integration with survey package enables raking (commit d392363)
- **Advanced Statistics** - Full Phase 3 implementation: chi-square, CIs, pairwise comparisons, FDR/Bonferroni (commit 94b9eb4)

🚀 **MAJOR OVER-DELIVERIES:**
- **Multi-File Workspace** - Complete 4-phase implementation: dataset browser, projects, longitudinal support, batch operations (commits ef40689, f78bc0f, 0f3b45c)
- **WebR Statistical Runtime** - Academic-grade R integration with lme4 for mixed models (commit d392363)
- **Analysis State Capture** - Session persistence with editable headers and unsaved indicators (commit f6b2eb7)

⚠️ **REMAINING HIGH-PRIORITY GAPS:**
1. Export UI Integration (EASIEST WIN - core complete, needs UI buttons)
2. OPFS Persistence Reliability (architectural decision needed)
3. Chunked Ingestion (performance/enterprise enabler)

**Recommended Next Action:** Export UI Integration (2-4 hour task, highest ROI)

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

**Current:** ✅ **IMPROVED** - Analysis state capture with editable headers and unsaved indicators (commit f6b2eb7). Focus mode enhanced with session persistence. Multi-slide infrastructure exists but not exposed in UI.

**Gap:** PARTIAL - Multi-slide and grid layout UI not exposed; single-focus mode remains primary.

---

### 3.5 Weight Creation
**Vision:** Weight creation (raking) via WASM or WebR in later phases.

**Current:** ✅ **COMPLETED** - WebR integration with survey package (commit d392363). SurveyWeightingRunner implements raking with design effects.

**Gap:** CLOSED - Weight creation fully implemented via WebR.

---

### 3.6 Advanced Stats
**Vision:** Pairwise letters (A/B/C), FDR/Bonferroni, dependent samples.

**Current:** ✅ **COMPLETED** - Full Phase 3 stats implementation (commit 94b9eb4):
- Chi-square with Cramér's V
- Confidence intervals (mean & proportion)
- Pairwise column comparisons with letters
- Bonferroni and Benjamini-Hochberg FDR corrections
- AnalysisSettingsPanel UI
- MixedEffectsRunner for dependent samples via lme4

**Gap:** CLOSED - Advanced stats fully implemented.

---

### 3.7 Export UX
**Vision:** User‑facing PPTX export in UI.

**Current:** ⚠️ **PARTIAL** - Export pipeline fully implemented in core + CLI (commit b81a30e). Workspace export/import modal added (commit 0f3b45c). Missing: In-analysis PPTX/XLSX export UI buttons.

**Gap:** PARTIAL - Core export complete; needs UI integration in analysis canvas.

---

### 3.8 AI / Cognitive Engine
**Vision:** Glass‑box AI, text‑to‑SQL, semantic insights.

**Current:** 🔜 **FOUNDATION READY** - WebR integration (commit d392363) provides R runtime with Monaco editor and RCodeEditor component. Infrastructure exists for advanced AI features.

**Gap:** Glass-box AI and semantic layer remain Phase 4 future work.

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

### 4.6 🆕 Multi-File Workspace System
**Exceeds original vision** - Full 4-phase workspace implementation (commits ef40689, f78bc0f, 0f3b45c):
- Phase 1: Dataset browser with rich metadata, storage quota tracking, session persistence
- Phase 2: Project linking and organization
- Phase 3: Longitudinal support with WaveTimeline and CrossWavePanel for panel attrition analysis
- Phase 4: Batch operations, workspace export/import for backup and sharing

### 4.7 🆕 WebR Statistical Runtime
**Exceeds original vision** - Full WebR integration (commit d392363):
- Lazy-loaded R runtime with survey and lme4 packages
- SurveyWeightingRunner for raking/design effects
- MixedEffectsRunner for hierarchical models
- Monaco-based R code editor with templates
- Arrow IPC bridge for DuckDB ↔ WebR data transfer

### 4.8 🆕 Advanced Statistical Features
**Exceeds Phase 2 scope** - Phase 3 statistics fully implemented (commit 94b9eb4):
- Chi-square independence tests with Cramér's V
- Confidence intervals (95% & 80%) for means and proportions
- Pairwise column comparisons with significance letters (A/B/C)
- Multiple testing corrections (Bonferroni, FDR)
- AnalysisSettingsPanel for methodology controls

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

6. 🆕 **Multi-File Workspace** enables:
   - Research portfolio management
   - Cross-study insights
   - Panel study workflows
   - Team collaboration prep (sync architecture ready)

7. 🆕 **WebR Integration** enables:
   - Academic-grade statistical methods
   - Custom R analysis scripts
   - Integration with existing R workflows
   - Advanced mixed models and survey methods

8. 🆕 **Advanced Stats + Workspace** enables:
   - Comparative analysis across projects
   - Longitudinal statistical tracking
   - Wave-over-wave significance testing
   - Research quality benchmarking

---

## 6. Risk & Priority Highlights

### High Priority (UPDATED)
- 🔴 **OPFS persistence reliability** - Still disabled due to corruption loops (commit 755a363 investigated)
- 🔴 **Large‑file ingestion beyond sample/metadata mode** - Chunked ingestion not implemented
- 🟡 **UI‑level export workflow** - PARTIAL: Core complete, needs in-analysis UI buttons

### Medium Priority (UPDATED)
- 🟡 **Slide / multi‑viz layout** - Infrastructure exists, not exposed in UI
- ✅ **Weight creation engine** - COMPLETED via WebR
- ✅ **Advanced stats (pairwise letters, FDR)** - COMPLETED

### Strategic Future (UPDATED)
- 🟢 **AI/semantic layer** - Foundation ready with WebR + Monaco editor
- 🔴 **Direct imports (Qualtrics/Decipher)** - Remains future work

---

## 7. Suggested Next Steps (Updated Based on Recent Progress)

### 🔴 Critical Path (Addressing Remaining Gaps)

1. **Finish Export UI Integration** (EASIEST WIN)
   - Add export buttons to analysis canvas (DataTable/SlideContainer)
   - Wire PPTX/XLSX exporters from core into UI
   - Estimated: 2-4 hours
   - **Priority: HIGH** - Core is done, just needs UI surface

2. **Decide OPFS Persistence Strategy** (ARCHITECTURAL)
   - Option A: Fix corruption loops (investigate commit 755a363 findings)
   - Option B: Commit to in-memory + explicit save/restore via workspace export
   - Option C: Hybrid: OPFS for raw data, localStorage for session state only
   - **Priority: HIGH** - Blocks production reliability

3. **Implement Chunked Ingestion** (PERFORMANCE)
   - Reduce OOM risk for large SAV files
   - Unblock enterprise use cases (50MB+ files)
   - **Priority: MEDIUM-HIGH** - Guardrails exist but not complete

### 🟢 Enhancement Path (Leveraging New Capabilities)

4. **Expose Multi-Slide Layout** (UX)
   - Infrastructure exists, needs UI controls
   - Enable grid/dashboard mode for presentations
   - **Priority: MEDIUM** - Nice-to-have, not blocking

5. **Cross-Wave Analysis Tools** (RESEARCH VALUE)
   - Leverage WaveTimeline + CrossWavePanel foundations
   - Add comparative crosstabs across waves
   - Panel attrition significance testing
   - **Priority: MEDIUM** - Unlocks longitudinal value proposition

6. **WebR Analysis Templates** (ACADEMIC USERS)
   - Pre-built R scripts for common tasks
   - Integration with workspace projects
   - **Priority: LOW-MEDIUM** - Infrastructure complete, needs content

### 🎯 Recommended Next Action

**Export UI Integration** - Highest ROI, smallest effort. Complete the PPTX/XLSX feature that's 90% done.

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

