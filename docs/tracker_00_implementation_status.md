# Velocity Implementation Tracker

**Current Phase:** Phase 1 (Foundation)
**Key Goal:** Ship a local-first `.SAV` viewer that is faster than Displayr.

## Phase 1: The Core (Foundation)

### Milestone 1.1: The Ingestion Engine (Week 1)
*Goal: Parse .SAV files in browser -> DuckDB*
- [x] Initialize Repository (Vite/React/TS)
- [x] Configure `duckdb-wasm`
- [x] Create Web Worker for DuckDB (`services/analysisWorker.ts`)
- [x] Implement `readstat-wasm` (or `apache-arrow` ingestion)
- [ ] **Verify:** User can drop a 10MB .SAV file and see it logged to console in < 2s.

### Milestone 1.2: The Pantry (Variable List) (Week 2)
*Goal: Display 500+ variables without lag*
- [x] Create `VariableStore` (Zustand) backed by DuckDB (`store/index.ts`)
- [x] Build Variable List Component (`DraggableVariable.tsx`)
- [x] Implement "Smart Icon" detection (Nominal/Ordinal/Scale)
- [ ] Virtualized List Component (React-Window) for 500+ variables

### Milestone 1.3: The Canvas (Crosstabs) (Week 3)
*Goal: Drag-and-drop analysis*
- [x] Implement Drag-and-Drop system (framer-motion)
- [x] Create `CrosstabEngine` (DuckDB SQL Generation)
- [x] Render HTML Table with Significance Testing placeholders

### Milestone 1.4: Architecture & Design System
*Added based on arch docs*
- [x] Data model aligned with `arch_02_data_model.md` (`types/index.ts`)
- [x] Design tokens from `design_01_system.md` (`index.css`)
- [x] Newsreader + Atkinson Hyperlegible typography

---

## Phase 2: The Strategic Workbench (Commercial)
*Goal: Feature Parity with Displayr*

### Milestone 2.1: Data Management
- [ ] "Variable Sets" Logic (Grouping columns)
- [ ] Recoding UI (Binning)

### Milestone 2.2: The Weighting Engine
- [ ] Apply Weight Variable to DuckDB Queries
- [ ] Display Weighted N vs Unweighted N

### Milestone 2.3: The Output
- [ ] Implement `PptxGenJS` Export
- [ ] Verify Editable Charts in PowerPoint

---

## Phase 3: Project Aletheia (Academic)
*Goal: Advanced Statistics*

### Milestone 3.1: The WebR Bridge
- [ ] Configure WebR Worker
- [ ] Implement Data marshalling (Arrow -> R)

### Milestone 3.2: Advanced Stats
- [ ] Implement `lme4` (Mixed Models)
- [ ] Implement `survey` package (Raking)
