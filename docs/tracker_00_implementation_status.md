# Velocity Implementation Tracker

**Current Phase:** Phase 2 (The Strategic Workbench)
**Key Goal:** Feature Parity with Displayr.

## Phase 1: The Core (Foundation)

### Milestone 1.1: The Ingestion Engine (Week 1)
*Goal: Parse .SAV files in browser -> DuckDB*
- [x] Initialize Repository (Vite/React/TS)
- [x] Configure `duckdb-wasm`
- [x] Create Web Worker for DuckDB (`services/analysisWorker.ts`)
- [x] Implement `readstat-wasm` (or `apache-arrow` ingestion)
- [x] **Verify:** User can drop a 10MB .SAV file and see it logged to console in < 2s.

### Milestone 1.2: The Pantry (Variable List) (Week 2)
*Goal: Display 500+ variables without lag*
- [x] Create `VariableStore` (Zustand) backed by DuckDB (`store/index.ts`)
- [x] Build Variable List Component (`DraggableVariable.tsx`)
- [x] Implement "Smart Icon" detection (Nominal/Ordinal/Scale)
- [x] Virtualized List Component (React-Window) for 500+ variables

### Milestone 1.3: The Canvas (Crosstabs) (Week 3)
*Goal: Drag-and-drop analysis*
- [x] Implement Drag-and-Drop system (@dnd-kit)
- [x] Create `CrosstabEngine` (DuckDB SQL Generation)
- [x] Render HTML Table with Significance Testing placeholders
- [x] **Implement Global Filter Bar UI & Logic** (Currently hardcoded in App.tsx)

### Milestone 1.4: Architecture & Design System
*Added based on arch docs*
- [x] Data model aligned with `arch_02_data_model.md` (`types/index.ts`)
- [x] Design tokens from `design_01_system.md` (`index.css`)
- [x] Newsreader + Atkinson Hyperlegible typography

### Milestone 1.5: Refactor Legacy UI (Prototype Debt)
*Goal: Bring early prototype components up to architectural standards*
> [!WARNING]
> These components were built before the core architecture and design system. They function but need refactoring to match the new standards.

- [x] Refactor `features/dashboard/components/DataTable.tsx`
- [x] Refactor `features/dashboard/components/DraggableVariable.tsx`
- [x] Refactor `components/common/DropZone.tsx`
- [x] Refactor `components/overlays/DataDrawer.tsx` (UI Only)
- [x] Refactor `components/overlays/RecodeModal.tsx`
- [x] **Support Nested Rows** (Refactor Data Model & Table)

### Milestone 1.6: Testing Infrastructure
*Goal: Comprehensive testing apparatus for current and future development*
- [x] Configure Vitest with React Testing Library
- [x] GitHub Actions CI/CD workflow (`.github/workflows/test.yml`)
- [x] Extract `queryBuilder.ts` for pure SQL generation testing
- [x] Unit tests: 25 tests for SQL generation logic
- [x] Component tests: 25 tests for DropZone & DraggableVariable
- [x] Test fixtures aligned with `arch_02_data_model.md`
- [x] Architecture doc: `docs/arch_03_testing.md`

### Milestone 1.7: Data Ingestion Bug Fixes
*Goal: Fix issues discovered during real-world SAV testing*
> [!CAUTION]
> Critical bugs found: Dual DuckDB instances cause data to be unavailable to some components.

- [x] **Fix Dual DuckDB Architecture** - `RecodeModal` uses main-thread `duckDb.ts` but data is in Worker
- [x] **Fix Variable Type Detection** - SAV variables with value labels should be `nominal`, not `scale`
- [x] **Unify Data Access** - All components must query via store/worker, deprecate `duckDb.ts`
- [x] **Test with `test_data/sleep.sav`** - Verify filter, recode, and table all show correct data

---

## Phase 2: The Strategic Workbench (Commercial)
*Goal: Reporting Parity with Displayr (Complementing SPSS for Data Prep)*

> [!NOTE]
> **Strategy Shift:** Phase 2 transforms Velocity from a single-screen prototype into a **Multi-Mode Application**. It introduces Visual Data Engineering (Card Sorting) and a robust Statistical Foundation (Summary Stats) before tackling advanced features.

### Milestone 2.1: The Hybrid Hub-and-Spoke Architecture
*Goal: Separate "Data Management" from "Analysis" workflows as per `research_08_UX_patterns_for_surveys.md`.*
- [x] **Design Task:** Define "Variable Manager" (Card Sorting) vs "Analysis Canvas" (Tables) modes.
- [x] Implement App Shell & Navigation (Sidebar/Tabs for Modes).
- [x] Refactor State Manager for Multi-Mode support.
- [x] **Refactor Store:** Slice `src/store/index.ts` (currently 700+ lines) into modular slices (e.g., `createDataSlice`, `createUISlice`).
- [ ] **Local-First State:** Persistent state across modes without reloading [ref](research_08_UX_patterns_for_surveys.md#L385).

### Milestone 2.2: Data Management (Visual ETL)
> [!TIP]
> **Paradigm Shift:** Moving from "Legacy List View" to "Visual Construct Builder" (Card Sorting).

- [x] Refactor Row Shelf to `@dnd-kit/sortable`
- [x] **Connect DataDrawer to Worker** (View-only drill-down)
- [x] Basic Recoding UI (Modal-based)
- [x] **Variable Card Sorting** (The "Variable Manager" Screen).
- [ ] **Miller Column Navigation:** Hierarchy: Data Sources > Folders > Sets > Variables > Inspector [ref](research_08_UX_patterns_for_surveys.md#L149).
- [ ] **Rich Variable Cards:** Sparklines (Mini-histograms) and Quality Indicators (Missingness %) [ref](research_08_UX_patterns_for_surveys.md#L177).
- [ ] **Context Awareness:** Bi-directional focus (Selecting variable in Analysis opens it in Manager) [ref](research_08_UX_patterns_for_surveys.md#L131).
- [ ] **Faceted Search:** Filter variable list by Type, Status, and Quality [ref](research_08_UX_patterns_for_surveys.md#L168).
- [ ] **Visual Recoding** (Interactive Histogram Bucketing).
- [ ] **Visual ETL (Charts):** Click-to-filter and Click-to-exclude context menus [ref](research_08_UX_patterns_for_surveys.md#L252).
- [ ] **Lasso Selection:** Spatial grouping/recoding on scatterplots [ref](research_08_UX_patterns_for_surveys.md#L353).
- [ ] **Semantic Variable Sets** (Grids represented as Card Clusters).
- [ ] **Verify Multi-Response Interaction:** Ensure `VariableSet` works for multiple response data.

### Milestone 2.3: Statistical Foundation
*Goal: "Contextually Relevant Statistics" (Beyond simple counts)*
- [ ] **Numeric Summaries:** Mean, Median, StdDev, Min/Max for Scale variables.
- [ ] **Smart Table Stats:** Auto-toggle between Counts (Nominal) and Averages (Scale).
- [ ] **Significance Testing:** T-Test/Z-Test implementation for table cells.

### Milestone 2.4: The Weighting Engine
*Scope: Application Only (No Weight Creation)*
- [x] Apply Weight Variable to DuckDB Queries
- [x] Display Weighted N vs Unweighted N
- [ ] **Implement Weighting UI Controls:** Global Weight Dropzone and Toggle.


### Milestone 2.5: The Output (The Parity Goal)
- [ ] **Implement Chart View:** Integrate charting library (Recharts/Visx) for in-app visualization.
- [ ] Implement `PptxGenJS` Export
- [ ] Verify Editable Charts in PowerPoint

### Reference
*   **Source:** `docs/research_08_UX_patterns_for_surveys.md` - Validates the Hub-and-Spoke model and Visual ETL patterns.

---

## Phase 3: Project Aletheia (Academic)
*Goal: Advanced Statistics & Deep Harmonization*

### Milestone 3.0: The Harmonization Workspace
- [ ] **Sankey Mapper:** Visualizing wave-over-wave changes.
- [ ] **Harmonization Logic:** Generating mapping scripts.
*Goal: Advanced Statistics*

### Milestone 3.1: The WebR Bridge
- [ ] Configure WebR Worker
- [ ] Implement Data marshalling (Arrow -> R)

### Milestone 3.2: Advanced Stats
- [ ] Implement `lme4` (Mixed Models)
- [ ] **Implement Weight Creation (Raking):**
    - [ ] Port C++ Raking library to Wasm (Replacing original WebR plan)
    - [ ] UI for Target Definition (Rim Weighting)

### Milestone 3.3: Advanced Data Preparation
*Goal: Reproducibility and Complex Logic*
- [ ] **Recipe Manager:** Non-destructive step history (Import -> Rename -> Recode) [ref](research_08_UX_patterns_for_surveys.md#L226).
- [ ] **Time Travel:** Edit/Revert any step in the recipe stack.
- [ ] **Block-based Formula Builder:** Visual logic construction [ref](research_08_UX_patterns_for_surveys.md#L244).
- [ ] **Programming by Example:** Smart text cleaning (Flash Fill style) [ref](research_08_UX_patterns_for_surveys.md#L199).


---

## Phase 4: The Cognitive Engine (AI-Native)
*Goal: Additive AI capabilities that leverage the local-first architecture for privacy-preserving intelligence.*

### Milestone 4.1: Semantic Reasoning ("Glass Box")
- [ ] Implement WebGPU-based Local LLM (e.g., Llama via Wasm/WebLLM)
- [ ] Build "Auto-Code" interface for Text Variables
- [ ] Implement "Semantic Cross-Tabs" (Correlating themes with quant data)

### Milestone 4.2: Natural Language Querying
- [ ] Implement Text-to-SQL / Text-to-State interpreter
- [ ] Build Chat Interface compatible with `queryBuilder`

### Milestone 4.3: The Action Hub
- [ ] Implement OAuth Connectors for Linear/Jira
- [ ] Create "Export to Issue Tracker" flow

## Phase 5: Cloud Extensions (Future)
*Goal: Features that strictly require a backend.*

### Milestone 5.1: Real-time Collaboration
- [ ] Backend: WebSocket / Firebase Sync Service
- [ ] Refactor `CollaboratorCursor.tsx` (Currently mock-only)
- [ ] Refactor `AvatarGroup.tsx` (Currently mock-only)

### Milestone 5.2: Direct Data Imports
- [ ] **Serverless Connection Manager:** Backend proxy for Qualtrics/Decipher API auth & CORS. (Option A from research)
