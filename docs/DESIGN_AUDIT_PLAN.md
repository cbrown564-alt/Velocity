# Velocity Design Audit & Remediation Plan

**Date:** 2026-05-19
**Scope:** Design system integrity, component architecture, runtime safety, and vision-to-implementation gaps
**Policy Decision:** Tailwind CSS is an approved, first-class styling tool. AGENTS.md and all documentation will be updated to reflect this.

---

## 1. Audit Summary

### 1.1 Core Design Principles — Documented vs. Implemented

| Principle | Documented State | Actual State | Grade |
|-----------|-----------------|--------------|-------|
| **Local-First / Worker-First** | All DB ops via worker, OPFS persistence | Worker protocol has P0 race condition; OPFS **disabled** due to corruption loops | 🔴 C- |
| **Headless Core** | Business logic in `src/core/`, UI independent | 18 circular deps; store imports feature code; logic bleeds into App.tsx | 🟡 B- |
| **CSS Architecture** | "Strict Vanilla CSS. No Tailwind" *(legacy, now updated)* | Tailwind installed + heavily used; `tailwind.config.cjs` actively maintained | 🟢 A- *(with policy update)* |
| **Semantic Token Architecture** | All components use `--bg-panel`, `--text-primary`, etc. | Many undefined tokens (`--text-tertiary`, `--gray-*`, legacy `--color-paper`); hardcoded hex fallbacks | 🟡 C |
| **Three-Mode UX** | Workspace → Canvas (Hub) → Manager (Spoke) overlay | Correctly implemented as Z-index overlay; AppShell handles transitions well | 🟢 A- |
| **Type Safety** | Clean TypeScript, strict contracts | `tsconfig` is non-strict; `tsc --noEmit` fails; 51 tests broken | 🟡 C- |

### 1.2 Five Major Audit Areas

1. **Design System Integrity** — Missing tokens, legacy Research Desk remnants, hardcoded colors in TSX/CSS
2. **Component Architecture & Bundle Health** — Monolithic components (App.tsx 868 LOC, WorkspaceView.tsx 1,028 LOC), no code splitting, 18 circular dependency chains
3. **Worker Protocol & Runtime Safety** — P0 message collision, P0 persistence binding, P1 merge crash, 51 failing tests
4. **Vision vs. Implementation Gaps** — OPFS disabled, export UI missing, Analysis Deck underexposed
5. **Type Safety & Test Health** — Non-strict tsconfig, `tsc --noEmit` failures

---

## 2. Guiding Policy: Tailwind CSS

Tailwind CSS is **approved and canonical** for Velocity. The existing `tailwind.config.cjs` and `@tailwind` directives in `index.css` are correct. All future styling should follow this hybrid approach:

- **Layout & rapid UI**: Tailwind utilities (`flex`, `p-4`, `rounded-md`, `gap-2`)
- **Theme-aware values**: Always use `bg-[var(--bg-panel)]`, `text-[var(--text-primary)]`, etc. — never raw Tailwind color palettes (`bg-white`, `text-indigo-600`, `bg-red-500`)
- **Component-specific styles**: CSS Modules for complex component styles (hover states, animations, grid layouts)
- **Dynamic/data-driven values**: Inline styles for D3 SVG, react-window, positioned elements

**Rule:** Raw Tailwind color classes (`bg-white`, `text-amber-900`, `border-red-200`) bypass the theme system and are prohibited. The only allowed color references in Tailwind are CSS custom properties.

---

## 3. Phase 1: Design System Cleanup & Token Integrity

**Goal:** Make the design system internally consistent, fully documented, and free of undefined/legacy tokens.

**Estimated Effort:** 1–2 sprints
**Acceptance Criteria:**
- Zero undefined CSS variable references at build time
- Zero raw Tailwind color classes in source
- All three themes render correctly with no visual regressions
- `AGENTS.md` and `design_01_system.md` updated to reflect Tailwind policy

### 3.1 Task 1.1 — Update Documentation for Tailwind Policy

**Files:**
- `AGENTS.md` — Update "Strict Vanilla CSS. No Tailwind" to approved hybrid policy
- `docs/design_01_system.md` — Update Section 10 (Implementation Guide) with Tailwind examples
- `docs/design_01_system.md` — Remove "Migration Notes" from Research Desk (already deprecated, now irrelevant)

**Acceptance Criteria:**
- [ ] AGENTS.md accurately describes Tailwind as approved with CSS-variable-only colors
- [ ] design_01_system.md includes a "Tailwind Usage" subsection under Implementation Guide
- [ ] No contradictory statements about Tailwind anywhere in docs

### 3.2 Task 1.2 — Define Missing Semantic Tokens

**New tokens to add to `src/index.css`:**

```css
/* Missing Typography */
--text-tertiary: var(--muted-foreground);

/* Missing Interaction */
--bg-hover: var(--secondary);

/* Missing Status (maps to theme-defined colors) */
--status-success-text: var(--success);
--status-success-bg: color-mix(in srgb, var(--success) 10%, transparent);
--status-warning-text: var(--warning);
--status-warning-bg: color-mix(in srgb, var(--warning) 10%, transparent);
--status-error-text: var(--destructive);
--status-error-bg: color-mix(in srgb, var(--destructive) 10%, transparent);
```

**Note:** Do NOT add `--gray-50` through `--gray-800`. These are anti-semantic. Every usage should be remapped to a semantic token (`--bg-panel`, `--text-secondary`, `--border-color-muted`, etc.).

**Files to audit for `--gray-*` usage:**
- `DataDrawer.tsx`, `FilterChip.tsx`, `FilterBar.tsx`
- `MillerColumns.module.css`, `VariableInspector.module.css`
- `HistogramRenderer.module.css`

**Acceptance Criteria:**
- [ ] `--text-tertiary`, `--bg-hover`, `--status-*` tokens defined in `:root`
- [ ] All `--gray-*` references replaced with semantic equivalents
- [ ] All `--green-500`, `--amber-500` references replaced with `--status-*`

### 3.3 Task 1.3 — Remap Legacy Research Desk Tokens

**Legacy tokens to eliminate:**

| Legacy Token | Used In | Remap To |
|--------------|---------|----------|
| `--color-paper` | `DataDrawer.tsx`, `AvatarGroup.tsx`, `FilterBar.tsx` | `--bg-panel` or `--bg-app` |
| `--color-terracotta` | `DataDrawer.tsx`, `FilterBar.tsx` | `--color-accent` |
| `--color-ink` | `DataDrawer.tsx` | `--text-primary` |
| `--color-parchment` | `CollaboratorCursor.tsx`, `FilterBar.tsx` | `--bg-app` |

**Acceptance Criteria:**
- [ ] Zero references to `--color-paper`, `--color-ink`, `--color-terracotta`, `--color-parchment` in source
- [ ] Remove deprecated font imports from `src/index.css` (Newsreader, Atkinson) unless still needed for PPTX export
- [ ] If Atkinson is needed for PPTX export, document this exception in AGENTS.md

### 3.4 Task 1.4 — Replace Hardcoded Colors in CSS Modules

**True hardcoded hexes (not fallbacks):**

| File | Lines | Values | Fix |
|------|-------|--------|-----|
| `WorkspaceView.module.css` | 375–383 | `#E11D48`, `#FFF1F2`, `#FECDD3` | Use `--status-error-*` tokens |

**Fallback hexes to remove (use token-only, no fallback):**

| File | Fallbacks | Fix |
|------|-----------|-----|
| `WorkspaceView.module.css` | `#FFB800`, `#E74C3C` | Map to `--warning`, `--destructive` |
| `VariableInspector.module.css` | `#888`, `#10b981`, `#f59e0b` | Map to `--text-secondary`, `--status-success-text`, `--status-warning-text` |
| `WaveTimeline.module.css` | `#10b981`, `#f59e0b`, `#ef4444` | Map to `--status-*` |
| `MappingTable.module.css` | `#22c55e`, `#f59e0b`, `#ef4444` | Map to `--status-*` |
| `ExportModal.module.css` | `#dc2626`, `rgba(0,0,0,0.4)` | Map to `--status-error-text`, `--backdrop` |
| `SankeyDiagram.module.css` | `#ef4444` | Map to `--status-error-text` |
| `ValueRemapPanel.module.css` | `#ef4444`, `#f59e0b` | Map to `--status-*` |
| `HistogramRenderer.module.css` | `--gray-400` | Map to semantic token |

**Acceptance Criteria:**
- [ ] Zero true hardcoded hex colors in all `*.module.css` files
- [ ] Zero fallback hex values in `var(--token, #hex)` patterns in CSS modules
- [ ] All `rgba(0,0,0,…)` shadows/backdrops use theme tokens or `color-mix()`

### 3.5 Task 1.5 — Replace Raw Tailwind Color Classes in TSX

**Files with raw Tailwind color classes to fix:**

| File | Violations | Fix |
|------|-----------|-----|
| `App.tsx` | `bg-white`, `bg-black/30`, `text-amber-900`, `border-amber-200`, `shadow-indigo-500/20`, `bg-indigo-100`, `text-indigo-600`, `text-amber-700`, `bg-amber-50` | Use semantic tokens via `bg-[var(--…)]` or CSS Module classes |
| `ChartTooltip.tsx` | `bg-stone-900/90`, `text-white`, `border-white/10` | Use `--bg-panel`, `--text-primary`, `--border-color` |
| `InputModal.tsx` | `bg-white`, `bg-indigo-600` | Use `--bg-panel`, `--color-accent` |
| `ConfirmModal.tsx` | `bg-red-600` | Use `--status-error-bg` or `--color-accent` |
| `ConvertSystemMissingModal.tsx` | `bg-white`, `bg-indigo-600` | Use `--bg-panel`, `--color-accent` |
| `AnalysisSettingsPanel.tsx` | `text-white` | Use `--text-primary` or `--text-inverse` |
| `TimelineDock.tsx` | `text-white` | Use `--text-primary` |
| `PersistenceStatus.tsx` | `text-white` | Use `--text-primary` |
| `MethodologyPanel.tsx` | `bg-black/20` | Use `color-mix` with `--bg-app` |

**Acceptance Criteria:**
- [ ] Zero raw Tailwind color palette classes in all TSX files (search: `bg-(white|black|red|indigo|amber|stone|green)-`)
- [ ] All replaced with `bg-[var(--token)]`, `text-[var(--token)]`, or dedicated CSS Module classes
- [ ] Visual regression check across all three themes

### 3.6 Task 1.6 — Add Token Linting / Guardrails

Add a simple build-time or pre-commit check to prevent regressions:

```bash
# Forbidden patterns in TSX:
(bg|text|border|shadow)-(white|black|red|green|blue|indigo|amber|stone|cyan|orange|purple|pink|gray|slate|zinc|neutral)-

# Forbidden patterns in CSS:
var\(--.*,\s*#[0-9a-fA-F]{3,6}\)   # fallback hexes
```

**Acceptance Criteria:**
- [ ] Script or CI step added to catch raw Tailwind colors and CSS fallback hexes
- [ ] Documented in AGENTS.md under "Design System" section

---

## 4. Phase 2: Critical Runtime & Protocol Fixes

**Goal:** Fix P0/P1 bugs that cause data corruption, crashes, or test failures.

**Estimated Effort:** 1 sprint
**Acceptance Criteria:**
- Worker protocol is safe for concurrent requests
- All tests pass (or have documented exceptions)
- No runtime crashes in merge/harmonization flows
- Workspace dataset identity is stable across import/export

### 4.1 Task 2.1 — Add Request IDs to Worker Protocol

**Problem:** SQL queries and crosstab analysis both emit `type: 'queryResult'` with no request ID. Concurrent requests collide.

**Files:**
- `src/types/worker.ts` — Add `requestId: string` to `WorkerRequest` and `WorkerResponse`
- `src/services/analysisWorker.ts` — Generate request IDs, echo them back in responses
- All callers of `worker.postMessage` — Generate UUIDs per request
- All `onmessage` handlers — Route responses by `requestId` instead of `type` alone

**Acceptance Criteria:**
- [ ] `WorkerRequest` interface requires `requestId`
- [ ] `WorkerResponse` includes matching `requestId`
- [ ] Concurrent crosstab + SQL queries do not cross-pollinate
- [ ] Documented in `AGENTS.md` under "Worker Communication"

### 4.2 Task 2.2 — Fix Persistence Storage Binding

**Problem:** `globalThis.localStorage` lacks `setItem`, causing state-write failures.

**Files:**
- `src/store/index.ts:62`
- `src/store/persistence.test.ts:18`

**Acceptance Criteria:**
- [ ] Store correctly binds to `window.localStorage`
- [ ] Persistence tests pass
- [ ] No silent write failures

### 4.3 Task 2.3 — Fix `runCrosstab` Contract & 51 Failing Tests

**Problem:** `runCrosstab` returns `{ rows, tableStats }` but golden/parity tests still expect arrays.

**Files:**
- `src/core/analysis/crosstabRunner.ts` — Confirm return type
- `tests/golden/golden.test.ts:85`
- `tests/golden/spss_parity.test.ts:48`
- Any other test files expecting old array shape

**Acceptance Criteria:**
- [ ] All golden/parity tests updated to expect `{ rows, tableStats }`
- [ ] Test count: 0 failures in golden/parity suites
- [ ] Document the contract in `AGENTS.md` or a code comment

### 4.4 Task 2.4 — Fix Merge Hook Runtime Crash

**Problem:** `useMergeOrchestration.ts` selects `state.variables` (not present in store), then calls `.find()`.

**Files:**
- `src/hooks/useMergeOrchestration.ts:26, 50`

**Acceptance Criteria:**
- [ ] Correct store selector used (likely `state.datasets` or `state.currentDataset?.variables`)
- [ ] Merge flow tested manually or with unit test
- [ ] No runtime `undefined.find()` crashes

### 4.5 Task 2.5 — Fix Workspace Dataset Identity

**Problem:** Datasets get new IDs on insert, but projects retain old IDs, breaking project-dataset links on import.

**Files:**
- `src/store/slices/workspaceSlice.ts:79`
- `src/App.tsx:718, 724, 857, 876`

**Acceptance Criteria:**
- [ ] Dataset IDs are stable on workspace insert/update
- [ ] Project-dataset links survive import/export cycle
- [ ] Unit test added for workspace import round-trip

---

## 5. Phase 3: Architecture Hardening

**Goal:** Break circular dependencies, extract business logic from components, and prepare for scalable growth.

**Estimated Effort:** 2–3 sprints
**Acceptance Criteria:**
- Zero circular dependency chains via `madge`
- App.tsx < 400 LOC
- WorkspaceView.tsx < 400 LOC
- Store slices do not import from `features/`, `services/EngineProxy`, or `core/session/`
- `tsc --noEmit` passes

### 5.1 Task 3.1 — Break Circular Dependencies

**Key cycles to break:**
1. `store/slices/analysisSlice.ts` ↔ `store/slices/dataSlice.ts` ↔ `services/EngineProxy.ts` ↔ `engine/types.ts` ↔ `core/session/index.ts`
2. `store/slices/workspaceSlice.ts` → `features/workspace/`
3. `core/export/types.ts` → `types/charts.ts` → `hooks/useProcessedAnalysisData.ts` → `store/index.ts`

**Strategy:**
- Move shared types to `src/types/` (pure types, no implementation)
- Create `src/store/types.ts` for store-specific interfaces that features can import
- Use dependency injection / callback patterns instead of store importing feature hooks
- Extract engine proxy interactions into a middleware pattern or thunk layer

**Acceptance Criteria:**
- [ ] `madge --circular src/` returns zero cycles
- [ ] Store slices import only from `types/`, `store/`, and `core/` (not `features/`)
- [ ] Document dependency rules in `AGENTS.md`

### 5.2 Task 3.2 — Extract Business Logic from App.tsx

**Current problems:** App.tsx contains session serialization, dataset materialization, harmonization resolution.

**Extract to:**
- `src/core/session/useSessionOrchestration.ts` — Session import/export, download generation, transform replay
- `src/core/workspace/useDatasetMaterialization.ts` — Open/delete/star/batch operations
- `src/core/harmonization/useHarmonizationResolver.ts` — Dataset resolution, variable resolution, auto-close

**Acceptance Criteria:**
- [ ] App.tsx < 400 LOC
- [ ] All extracted hooks have unit tests
- [ ] App.tsx only orchestrates — no inline business logic

### 5.3 Task 3.3 — Decompose WorkspaceView.tsx Monolith

**Current:** 1,028 LOC with 8 inline sub-components.

**Extract inline sub-components to:**
- `src/features/workspace/components/` — One file per sub-component
- `src/features/workspace/hooks/` — Any local state logic

**Acceptance Criteria:**
- [ ] WorkspaceView.tsx < 400 LOC
- [ ] Each extracted component is independently testable
- [ ] No inline component definitions

### 5.4 Task 3.4 — Add Code Splitting

**Lazy-load candidates:**
- `VariableManager` — Only needed when `appMode === 'variables'`
- `WorkspaceView` — Only needed in `mode === 'splash'`
- `HarmonizationWorkspace` — Only needed during harmonization flows
- `AdvancedAnalysisPanel` / WebR runtime — Large optional dependencies

**Implementation:**
- Use `React.lazy(() => import('./features/...'))` + `Suspense` boundaries
- Add `/* @vite-ignore */` comments if needed for dynamic imports (see ReadStat WASM lesson)

**Acceptance Criteria:**
- [ ] Main chunk < 1.5MB after splitting
- [ ] No visual jank during lazy load (use skeleton placeholders)
- [ ] Vite build passes without warnings

### 5.5 Task 3.5 — Enable Strict TypeScript

**Files:**
- `tsconfig.json` — Add `"strict": true`
- Fix or suppress `allowJs`-related issues
- Address all `tsc --noEmit` failures

**Acceptance Criteria:**
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] No regressions in test suite
- [ ] Document strict mode in AGENTS.md

---

## 6. Phase 4: Vision-to-Implementation Gaps (Optional / Post-Hardening)

These are product/feature decisions that may require design input before engineering.

| Gap | Suggested Action | Effort |
|-----|-----------------|--------|
| **OPFS persistence disabled** | Architectural decision: fix corruption loops or deprecate OPFS | 1–2 sprints |
| **Export UI missing** | Add export buttons to `DashboardShell` / `DataTable` chrome | 2–4 hours |
| **Analysis Deck underexposed** | Design review: expose multi-slide UI vs. simplify | 1 sprint |
| **Variable Manager canvas vision** | Design review: Miller Columns is working; card-sorting is future | Future |
| **Recipe / Time Travel** | `S5-PREP-1` on roadmap; depends on persistence strategy | Future |

---

## 7. Appendix: Files to Touch by Phase

### Phase 1 Files
```
src/index.css
src/theme/themes.ts
src/context/ThemeContext.tsx
src/types/theme.ts
AGENTS.md
docs/design_01_system.md
src/features/workspace/components/WorkspaceView.module.css
src/features/variableManager/VariableInspector.module.css
src/features/workspace/components/WaveTimeline.module.css
src/features/harmonization/components/MappingTable.module.css
src/components/overlays/ExportModal.module.css
src/features/harmonization/components/HarmonizationWorkspace.module.css
src/features/workspace/components/ProjectLinkModal.module.css
src/features/workspace/components/DatasetSidebar.module.css
src/components/common/Logo.tsx
src/features/harmonization/components/SankeyDiagram.module.css
src/features/harmonization/components/ValueRemapPanel.module.css
src/features/variableManager/components/InspectorHeader.tsx
src/components/charts/HistogramRenderer.module.css
src/App.tsx
src/components/charts/ChartTooltip.tsx
src/components/overlays/InputModal.tsx
src/components/overlays/ConfirmModal.tsx
src/components/overlays/ConvertSystemMissingModal.tsx
src/components/common/AnalysisSettingsPanel.tsx
src/features/dashboard/components/TimelineDock.tsx
src/features/dashboard/components/PersistenceStatus.tsx
src/components/common/MethodologyPanel.tsx
src/components/common/DataDrawer.tsx
src/components/common/AvatarGroup.tsx
src/components/common/FilterBar.tsx
src/components/common/FilterChip.tsx
src/components/common/CollaboratorCursor.tsx
```

### Phase 2 Files
```
src/types/worker.ts
src/services/analysisWorker.ts
src/store/index.ts
src/store/persistence.test.ts
src/core/analysis/crosstabRunner.ts
tests/golden/golden.test.ts
tests/golden/spss_parity.test.ts
src/hooks/useMergeOrchestration.ts
src/store/slices/workspaceSlice.ts
src/App.tsx
src/hooks/useWorkspace.ts
```

### Phase 3 Files
```
src/store/slices/analysisSlice.ts
src/store/slices/dataSlice.ts
src/store/slices/workspaceSlice.ts
src/services/EngineProxy.ts
src/engine/types.ts
src/core/session/index.ts
src/core/session/sessionImportDiagnostics.ts
src/core/session/sessionImporter.ts
src/types/index.ts
src/types/charts.ts
src/hooks/useProcessedAnalysisData.ts
src/core/export/types.ts
src/App.tsx
src/features/workspace/components/WorkspaceView.tsx
tsconfig.json
vite.config.ts
```

---

## 8. Appendix: Quick-Win Priority Order

If you want to maximize impact with minimal effort, do these first:

1. **Task 1.1** (Update Tailwind docs) — 15 min, unblocks all styling work
2. **Task 2.4** (Fix merge crash) — 30 min, fixes runtime crash
3. **Task 2.3** (Fix 51 tests) — 2–4 hours, restores CI confidence
4. **Task 1.3** (Remap legacy tokens) — 2–3 hours, fixes visual bugs
5. **Task 1.5** (Replace raw Tailwind colors) — 4–6 hours, improves theme consistency
6. **Task 2.1** (Worker request IDs) — 1–2 days, fixes P0 race condition
