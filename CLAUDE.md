# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velocity is a **local-first, browser-based statistical analysis tool** designed to replace legacy desktop software (SPSS, WinCross). All computation happens client-side using WebAssembly. No data is ever uploaded to a server.

**Vision:** Transform from `.SAV` viewer (Phase 1) → Strategic Workbench (Phase 2) → Academic Environment (Phase 3) → AI-Native Tool (Phase 4).

**Current Phase:** Phase 2 substantially complete; Phase 3 features partially landed (WebR, advanced statistics, longitudinal support). Active work spans late Phase 2 (export polish, persistence hardening) and early Phase 3.

## Key Dependencies

- `@duckdb/duckdb-wasm@1.33.1-dev18.0` — In-browser SQL engine (OPFS persistence supported at this version)
- `pptxgenjs@4.0.1` — PowerPoint export
- `webr@0.4.0` — R statistical runtime in the browser (Phase 3)
- `@dnd-kit` — Drag-and-drop framework
- `react-window` — Virtualized lists
- `d3` — Chart rendering

## Development Commands

### Local Development
```bash
npm run dev              # Start dev server on port 3000 (with COOP/COEP headers for DuckDB-Wasm)
npm run build            # Build for production
npm run preview          # Preview production build
```

### Testing
```bash
npm run test             # Run tests in watch mode
npm run test:run         # Run tests once (CI mode)
npm run test:coverage    # Generate coverage report
npm run test:ui          # Launch Vitest UI
```

**Testing Standards:**
- Coverage thresholds: 80% for branches, functions, lines, statements
- Test files: `src/**/*.test.{ts,tsx}`
- Environment: happy-dom (lightweight DOM simulation)
- Setup: `src/test/setup.ts` (React Testing Library configuration)

## Architecture

### Core Principles

1. **Local-First:** All data processing happens in the browser. DuckDB runs in a Web Worker.
2. **Worker-First:** The main thread NEVER queries DuckDB directly. All database operations go through `src/services/analysisWorker.ts`.
3. **Layered Persistence:** Data persistence uses a layered strategy (see `docs/arch_06_local_first_persistence.md`):
   - **Source files** persisted in OPFS (SAV/CSV originals)
   - **Analysis state** persisted in localStorage via Zustand
   - **DuckDB OPFS DB** as fast-path cache (per-dataset paths: `opfs://velocity_data_v1_dataset_{uuid}.db`)
   - **Rebuild fallback:** If DuckDB DB is corrupt/locked, rebuild from OPFS source file + transform log
4. **Headless Core:** Business logic lives in `src/core/` (analysis, export, ingestion) independent of UI, enabling testability and future CLI usage.
5. **Three-Mode UX:**
   - **Workspace:** Dataset library/browser — manage files, projects, longitudinal studies
   - **Analysis Canvas (Hub):** Low-density, drag-and-drop, reading mode with Analysis Deck (slides)
   - **Variable Manager (Spoke):** High-density, card sorting, writing/cleaning mode
   - Manager overlays Canvas (Z-index layer) rather than replacing routes

### Data Flow Architecture

```
User → React UI → Zustand Store → Headless Core (src/core/) → Analysis Worker → DuckDB-Wasm
                      ↓                                              ↓
                  localStorage                                 OPFS (source files
              (state persistence)                             + DuckDB DB cache)
```

**Critical Constraint:** The UI never queries DuckDB directly. All queries go through the worker message-passing API defined in `src/services/analysisWorker.ts`.

### State Management (Zustand)

The store is split into modular slices (ref: `src/store/slices/`):

- **dataSlice:** Dataset metadata, variables, variable sets
- **analysisSlice:** Table configuration, filters, aggregated results
- **uiSlice:** App mode (workspace/dashboard/variable-manager), modal states, view modes
- **drillDownSlice:** Data drawer state for viewing raw records
- **slidesSlice:** Analysis Deck — saved analysis views (slides) with state capture, titles, sections
- **workspaceSlice:** Multi-file dataset management, projects, longitudinal study linking
- **webrSlice:** WebR statistical runtime integration (R in the browser)

**Persistence:** Uses `zustand/middleware/persist` with `localStorage`. Configuration in `src/store/persistConfig.ts`.

### Worker Communication

Worker messages are typed (see `WorkerRequest` and `WorkerResponse` in `src/types/worker.ts` and `analysisWorker.ts`):

```typescript
// Example message types
{ type: 'loadSAV'; buffer: ArrayBuffer }
{ type: 'query'; sql: string }
{ type: 'recodeVariable'; sourceCol: string; newColName: string; config: RecodeConfig }
```

**Known Issue:** The worker protocol currently lacks request IDs. Multiple operations (SQL queries, crosstab analysis) emit identical `type: 'queryResult'` responses, making concurrent requests collision-prone. See `docs/code-review-report-2026-02-05.md` finding #2.

### Data Model (Critical for All Work)

See `docs/arch_02_data_model.md`, `src/types/index.ts`, `src/types/slides.ts`, and `src/types/worker.ts` for canonical schemas:

- **Variable:** The atomic unit with `id`, `name`, `label`, `type` (nominal/ordinal/scale), `valueLabels`, `missingValues`
- **VariableSet:** Groups related variables (e.g., grids, multi-select questions)
- **Dataset:** Represents a loaded file with metadata
- **Filter:** Restricts dataset scope via SQL WHERE clauses
- **Crosstab:** Analysis output with cells, totals, weighted counts, significance markers
- **Slide:** Saved analysis view capturing rowVars, colVar, filters, weightVar, visualization type, editable title/subtitle
- **StoredDataset / Project:** Multi-file workspace entities for dataset management and longitudinal studies

**Dual-State Principle:** Variables exist as both raw integer codes (in DuckDB) and human-readable labels (in UI). UI always displays labels; engine always computes on raw values.

## Styling & Design System

### CSS Architecture

**Strict Vanilla CSS.** No Tailwind, no CSS-in-JS libraries.

- **Global tokens:** `src/index.css` (based on `docs/design_01_system.md`)
- **Component styles:** Use `*.module.css` for scoped styles
- **Design philosophy:** Dynamic theme system with three themes:
  - **Soft Machine** (default): Warm, organic, Dieter Rams-inspired
  - **Mission Control**: Dark, high-contrast, NASA/Bloomberg-inspired
  - **Liquid Glass**: Translucent, visionOS-inspired with frosted glass effects

### Semantic Tokens (Theme-Agnostic)

**CRITICAL:** Always use semantic tokens, never theme-specific colors or hardcoded values.

```css
/* Surfaces & Backgrounds */
--bg-app: var(--background);        /* Main application background */
--bg-panel: var(--card);            /* Cards, modals, panels */
--bg-surface: var(--popover);       /* Popovers, dropdowns */
--bg-active: var(--secondary);      /* Active/selected states */

/* Typography */
--text-primary: var(--foreground);          /* Primary text */
--text-secondary: var(--muted-foreground);  /* Secondary text */
--text-accent: var(--accent);               /* Accent text */
--text-inverse: var(--primary-foreground);  /* Text on colored backgrounds */

/* Font Variables (theme-specific, dynamically injected) */
--font-body:    /* UI text, labels, buttons */
--font-display: /* Headers, modal titles */
--font-mono:    /* Data, statistics */

/* Borders */
--border-color: var(--border);
--border-color-muted: var(--input);
--border-color-active: var(--ring);

/* Spacing (8px base) */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-4: 1rem;     /* 16px */
--space-8: 2rem;     /* 32px */

/* Accent */
--color-accent: var(--accent);
```

**Rule:** Always use semantic tokens. Never hardcode hex values. Components must work across all three themes without modification.

### Legacy Note

"The Research Desk" design language (Newsreader/Atkinson fonts, Ink & Paper palette) has been **fully deprecated** and replaced with the dynamic theme system above. `design_01_system.md` now documents the current token-based theme architecture, not the old Research Desk palette.

## File Organization

```
src/
├── core/                    # Headless business logic (UI-independent)
│   ├── analysis/            # Crosstab runner, statistical computations
│   ├── export/              # PPTX/XLSX export generation
│   ├── ingestion/           # SAV/CSV parsing and import
│   ├── DatabaseAdapter.ts   # Abstraction over DuckDB access
│   ├── gridDetection.ts     # Variable set/grid discovery heuristics
│   └── scaleNormalization.ts
├── components/
│   ├── common/              # Reusable UI (DropZone, FilterBar, FilterChip)
│   ├── layout/              # AppShell, navigation
│   └── overlays/            # Modals (RecodeModal, FilterModal, DataDrawer, InputModal)
├── features/
│   ├── dashboard/           # Analysis Canvas (DataTable, TimelineDock, SlideHeader)
│   ├── variableManager/     # Variable Manager screen (Card sorting, FolderPanel)
│   └── workspace/           # Multi-file dataset browser, projects, longitudinal linking
├── services/
│   ├── analysisWorker.ts    # DuckDB Web Worker (PRIMARY data access point)
│   ├── opfsPersistence.ts   # OPFS persistence strategy (layered recovery)
│   ├── queryBuilder.ts      # SQL generation logic (pure functions, tested)
│   └── duckDb.ts            # ⚠️ DEPRECATED - Do not use (legacy dual-instance bug)
├── store/
│   ├── slices/              # Modular state slices (data, analysis, ui, slides, workspace, webr, drillDown)
│   ├── index.ts             # Main store composition
│   └── persistConfig.ts     # localStorage persistence config
├── types/
│   ├── index.ts             # Canonical TypeScript interfaces (from arch_02_data_model.md)
│   ├── slides.ts            # Slide/Analysis Deck types
│   └── worker.ts            # Worker message protocol types
└── test/
    ├── setup.ts             # Vitest + React Testing Library setup
    └── fixtures/            # Test data fixtures
```

## Key Technical Patterns

### Drag-and-Drop

Uses `@dnd-kit` library:
- Variable list: Draggable variables with visual feedback
- Row shelf: `@dnd-kit/sortable` for reordering rows
- Drop zones: Rows, columns, filters, weight

### Virtualization

Large variable lists (500+) use `react-window` for performance:
- See `src/features/dashboard/components/VirtualizedVariableList.tsx`
- Maintains smooth scrolling at any dataset size

### SQL Generation & Headless Core

Crosstab queries are generated via `src/services/queryBuilder.ts` and executed through `src/core/analysis/`:
- Pure functions (no side effects)
- Comprehensive test coverage (`queryBuilder.test.ts`)
- Handles weighting, filtering, nested rows
- `src/core/analysis/crosstabRunner.ts` returns `{ rows, tableStats }` (object, not array)

### Export Pipeline

PPTX and XLSX export via `src/core/export/`:
- Uses `pptxgenjs` for PowerPoint, built-in for XLSX
- Export logic is in the headless core, UI triggers via buttons on analysis tables

### Performance Requirements

- **Main Thread Zero:** No heavy computation on main thread
- **Sub-2s Load:** 10MB `.SAV` file must load in < 2 seconds
- **Smooth Scrolling:** Variable list must handle 500+ items without lag

## Common Workflows

### Adding a New Variable Transformation

1. Define the operation in `src/types/index.ts` (e.g., `RecodeConfig`)
2. Add worker message types to `analysisWorker.ts`
3. Implement SQL logic in the worker
4. Add store action to appropriate slice
5. Create UI component in `src/components/overlays/`
6. Write tests for SQL generation and UI

### Adding a New Analysis Type

1. Extend `TableConfig` in `src/store/slices/analysisSlice.ts`
2. Update SQL generation in `queryBuilder.ts`
3. Modify `DataTable.tsx` to render new output format
4. Add tests for new query patterns

### Debugging Worker Issues

1. Check `analysisWorker.ts` console logs (prefixed with `🦆 [Worker]`)
2. Verify message types match `WorkerRequest`/`WorkerResponse` interfaces
3. Test SQL queries directly in worker using `{ type: 'query', sql: '...' }`
4. Check OPFS persistence: `navigator.storage.getDirectory()`

## Critical Bugs to Avoid

**Historical (fixed):**
1. **Dual DuckDB Instance Bug (FIXED in Milestone 1.7):** Never create DuckDB instances outside the worker. `src/services/duckDb.ts` is deprecated.
2. **ReadStat WASM Vercel Build Failure (RECURRING):** Dynamic `import('../dist/readstat.js')` inside `packages/readstat-wasm/ts/index.ts` must use `/* @vite-ignore */` or Rollup will fail to resolve it at build time. Every occurrence of `import('...readstat.js')` in that file needs the comment. This has broken Vercel at least twice — check this file if the build error is `Could not resolve "../dist/readstat.js"`.

**Ongoing architectural constraints:**
2. **Variable Type Detection:** Variables with value labels should be `nominal`, not `scale` (even if numeric codes).
3. **Main Thread Blocking:** Any operation >16ms must run in the worker.
4. **Missing COOP/COEP Headers:** DuckDB-Wasm requires these for SharedArrayBuffer support. Dev server is pre-configured.

**Known issues (from `docs/code-review-report-2026-02-05.md`):**
5. **Worker Message Collision (P0):** SQL queries and crosstab analysis both emit `type: 'queryResult'` with no request ID — concurrent requests can route wrong responses. Needs request ID protocol.
6. **Workspace Dataset Identity (P1):** Datasets get new IDs on insert but projects retain old IDs — can break project-dataset links on import.
7. **`runCrosstab` Contract (P1):** Return type changed to `{ rows, tableStats }` but some callers/tests still expect array — 51 failing tests in golden/parity suites.
8. **Merge Hook Crash (P1):** `useMergeOrchestration.ts` selects `state.variables` (not present in store), causing runtime crash.
9. **App.tsx Size (P2):** At ~1750 LOC — needs code-splitting and feature-shell decomposition.

## Documentation References

**Start here for new work:**
- `docs/tracker_00_implementation_status.md` - Daily task tracker with current milestone
- `docs/arch_01_system_architecture.md` - System design and data flow
- `docs/arch_02_data_model.md` - Canonical data structures
- `docs/design_01_system.md` - Dynamic theme system (tokens, themes)
- `docs/code-review-report-2026-02-05.md` - Known bugs and suggested fix order

**Architecture deep-dives:**
- `docs/arch_04_statistical_engine.md` - Significance testing, ESS, t-tests
- `docs/arch_05_visualisation_engine.md` - D3.js chart system
- `docs/arch_06_local_first_persistence.md` - OPFS strategy, DuckDB version constraints, layered recovery

**Feature design:**
- `docs/design_03_analysis_deck.md` - Slide/deck architecture (Analysis Deck)
- `docs/design_03_workspace_architecture.md` - Multi-file workspace, projects, longitudinal data
- `docs/design_02_ux_modes.md` - Three-mode UX (Workspace, Canvas, Manager)

**Roadmap & strategy:**
- `docs/blue_01_unified_roadmap.md` - Phased roadmap
- `docs/audit_01_vision_vs_implementation.md` - Vision vs. reality gap analysis

## Git Workflow

Per global user instructions: **After any significant batch of changes, commit to git.**

Velocity is a single-person project with direct pushes to `main` branch. No PR workflow required.
