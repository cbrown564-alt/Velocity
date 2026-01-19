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
- [ ] **Implement Global Filter Bar UI & Logic** (Currently hardcoded in App.tsx)

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

---

## Phase 2: The Strategic Workbench (Commercial)
*Goal: Feature Parity with Displayr*

### Milestone 2.1: Data Management
- [ ] Refactor Row Shelf to `@dnd-kit/sortable` (Enable Reordering)
- [ ] "Variable Sets" Logic (Grouping columns)
- [ ] Recoding UI (Binning)
- [ ] **Connect DataDrawer to Worker** (Implement drill-down SQL & Pagination)

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

---

## Phase 4: Future Concepts (Parking Lot)
*Goal: Ideas that require a backend/server, conflicting with current Local-First architecture.*

### Milestone 4.1: Real-time Collaboration
- [ ] Backend: WebSocket / Firebase Sync Service
- [ ] Refactor `CollaboratorCursor.tsx` (Currently mock-only)
- [ ] Refactor `AvatarGroup.tsx` (Currently mock-only)
