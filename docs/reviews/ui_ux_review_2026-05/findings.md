# UI/UX Review Findings Register

**Program:** `docs/plan_01_comprehensive_ui_ux_review.md`  
**Started:** May 19, 2026

Log one entry per `UXR-###`. Update **Status** when fixed: `open` | `confirmed` | `fixed` | `wontfix`.

---

## UXR-000 — `D` key binds both Variable Manager and duplicate slide

- **Status:** fixed (May 19, 2026)
- **Severity:** P0
- **Mode:** Canvas (TimelineDock + AppShell)
- **Session:** 0
- **Steps to reproduce:**
  1. Load example dataset; open Canvas with ≥1 slide.
  2. Press `D` once — Variable Manager opens (`AppShell`).
  3. Press `D` again — slide duplicates (`TimelineDock` `duplicateSlide`) while Manager may still be open.
- **Expected:** Single, documented action per key; no accidental deck mutation.
- **Actual:** Both handlers listen on `document.keydown`; duplicate slides created (`Analysis 1 (Copy)`, `(Copy) (Copy)`).
- **Heuristic:** #3 User control and freedom; #4 Consistency and standards
- **Related code:** `src/components/layout/AppShell.tsx`, `src/features/dashboard/components/TimelineDock.tsx`
- **Screenshot:** Session 0 browser recon (deck shows 3 slides after `D` presses)
- **Resolution:** `D` toggles Variable Manager only; duplicate slide is `⌘D` / `Ctrl+D`. Header control label renamed to “Variables”.

---

## UXR-001 — “Data D” label vs Variable Manager shortcut

- **Status:** fixed (May 19, 2026; label → “Variables” with `D`)
- **Severity:** P1
- **Mode:** Canvas
- **Session:** 0
- **Steps to reproduce:** Observe header control labeled “Data D” while tooltip/docs associate `D` with Variable Manager toggle.
- **Expected:** Unique mnemonic per action or shared command palette (`STAB-UI-C`).
- **Actual:** Same key letter used for different mental models (data drawer vs manager vs duplicate).
- **Heuristic:** #6 Recognition rather than recall
- **Related:** `STAB-UI-C` command palette; `DashboardShell` header actions

---

## UXR-002 — Workspace → Canvas transition is an instant cut

- **Status:** open
- **Severity:** P2
- **Mode:** Workspace → Canvas
- **Session:** 0
- **Expected:** Optional cohesive transition (per `audit_02` motion ideas) without hurting performance.
- **Actual:** Immediate mode swap after Load Example.
- **Heuristic:** #1 Visibility of system status (weak spatial continuity)

---

## UXR-003 — Duplicate slide titles propagate to export

- **Status:** fixed (May 19, 2026)
- **Severity:** P2
- **Mode:** Canvas / Export
- **Session:** 0
- **Steps to reproduce:** Duplicate slides via `D`; open Export modal.
- **Expected:** Meaningful default titles or deduplication hints.
- **Actual:** Report title “Analysis 1 (Copy) (Copy)” and slide list show repeated copy names.
- **Heuristic:** #4 Consistency; #8 Aesthetic and minimalist design

---

## UXR-004 — Variable Manager close button lacks accessible name

- **Status:** open
- **Severity:** P2
- **Mode:** Variable Manager
- **Session:** 0
- **Steps to reproduce:** Open Manager; inspect close control in accessibility tree.
- **Expected:** `aria-label="Close Variable Manager"` or visible text.
- **Actual:** Icon-only button with no name in snapshot (ref unlabeled).
- **Heuristic:** #4 Consistency (Export modal has “Close modal”)
- **Related:** `src/features/variableManager/VariableManager.tsx`

---

## UXR-005 — Session backup toast competes with first-run focus

- **Status:** fixed (May 19, 2026; deferred until first row/column shelf use)
- **Severity:** P3
- **Mode:** Canvas
- **Session:** 0
- **Expected:** Toast after first analysis or dismissible with “don’t show again”.
- **Actual:** Export Session toast visible during empty-state exploration on first entry.
- **Heuristic:** #8 Minimalist design

---

## UXR-006 — Dataset card shows `0 B` file size

- **Status:** open
- **Severity:** P2
- **Mode:** Workspace
- **Session:** 1
- **Steps to reproduce:** Upload or Load Example; open Workspace Recent/All Datasets.
- **Expected:** File size reflects OPFS/stored bytes (consistent with Local Storage meter).
- **Actual:** Card shows `250 rows · 7 cols · 0 B` while header reports ~819 KB used.
- **Heuristic:** #1 Visibility of system status

---

## UXR-007 — Starred search with no matches lacks empty feedback

- **Status:** open
- **Severity:** P3
- **Mode:** Workspace
- **Session:** 1
- **Steps to reproduce:** Starred tab + search filter that excludes all cards.
- **Expected:** “No datasets match your search” (or clear empty state).
- **Actual:** Section heading remains; content area empty without explanation.
- **Heuristic:** #1 Visibility of system status

---

## UXR-008 — Projects tab is a blank panel

- **Status:** open
- **Severity:** P1
- **Mode:** Workspace
- **Session:** 1
- **Steps to reproduce:** Workspace → Projects tab (grid or list).
- **Expected:** Empty state with copy + CTA (create/link project) per longitudinal UX spec.
- **Actual:** Empty dark content area; no heading or action in UI or a11y tree.
- **Heuristic:** #6 Recognition rather than recall; #8 Minimalist (too empty)

---

## UXR-009 — List view hides dataset cards from workspace content

- **Status:** open
- **Severity:** P2
- **Mode:** Workspace
- **Session:** 1
- **Steps to reproduce:** Recent tab → switch to list view (header toggle).
- **Expected:** Same datasets as grid, row layout.
- **Actual:** “Recent Datasets” heading + batch checkbox; `mock_data.csv` card not present in accessibility tree (grid toggle restores it).
- **Heuristic:** #4 Consistency and standards

---

## UXR-010 — Filtered subtitle shows unfiltered N

- **Status:** open
- **Severity:** P1
- **Mode:** Canvas
- **Session:** 2
- **Steps to reproduce:**
  1. Build crosstab on F1; note `N = 250 Respondents`.
  2. Add Filter → `nps segment` → select `Promoter` → Apply.
  3. Observe subtitle: `Filtered: nps segment = Promoter · N = 250 Respondents`.
  4. Table row totals drop (e.g. Total row counts ~10–17 per column) — filter is applied to data.
- **Expected:** Subtitle `N` reflects filtered sample size (survey-native base).
- **Actual:** `N` still shows full dataset row count.
- **Heuristic:** #1 Visibility of system status; trust impact for researchers
- **Related:** `src/features/dashboard/components/SlideHeader.tsx` (`dataset?.rowCount`), `resolveSlideDefaults.ts`

---

## UXR-011 — Chart legend truncates region labels

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas (chart view)
- **Session:** 2
- **Steps to reproduce:** gender × region crosstab → switch to chart view.
- **Expected:** Full region names in legend (`International`, `South`).
- **Actual:** Labels clip (`Internatio...`, `Sout`).
- **Heuristic:** #4 Consistency; #8 Aesthetic and minimalist design
- **Related:** `src/components/charts/AnalysisChart.tsx`

---

## UXR-012 — Table/chart view toggles lack accessible names

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 2
- **Steps to reproduce:** Inspect header grid/chart toggle buttons in accessibility tree.
- **Expected:** `aria-label` such as “Table view” / “Chart view” (pressed state).
- **Actual:** Two unnamed icon buttons.
- **Heuristic:** #4 Consistency (Export modal radios are named)
- **Related:** `src/features/dashboard/DashboardShell.tsx`

---

## UXR-013 — Filter modal: age group has no selectable values

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 2
- **Steps to reproduce:** Add Filter → select `age group`.
- **Expected:** Age bracket values (as used in crosstabs).
- **Actual:** “No values found”; Apply disabled.
- **Heuristic:** #9 Help users recover from errors
- **Related:** `src/components/overlays/FilterModal.tsx`

---

## UXR-014 — Filter modal flashes stale values while loading

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 2
- **Steps to reproduce:** Add Filter → pick `nps segment` immediately after another variable.
- **Expected:** Loading state until correct values arrive.
- **Actual:** Brief display of prior variable’s values (e.g. age brackets) before NPS Detractor/Passive/Promoter.
- **Heuristic:** #1 Visibility of system status
- **Related:** `FilterModal.tsx` value fetch / `loadingValues`

---

## UXR-015 — Statistical settings popover clipped in slide scrollport

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 2
- **Steps to reproduce:** Build crosstab; scroll slide content; open Statistical settings.
- **Expected:** Full panel visible or portaled above slide.
- **Actual:** Popover bottom clipped; inner page scroll required to reach control.
- **Heuristic:** #7 Flexibility and efficiency of use
- **Related:** `AnalysisSettingsPanel.tsx`, `SlideContainer.tsx`

---

## UXR-016 — Column shelf variable chip lacks accessible name

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 2
- **Steps to reproduce:** Add `region` to columns; inspect shelf chip in a11y tree.
- **Expected:** Named control (e.g. “region, column”).
- **Actual:** Unnamed button (row `gender` chip is named).
- **Heuristic:** #4 Consistency
- **Related:** Dashboard shelf / column chip component

---

## UXR-017 — `⌘/Ctrl+D` opens Variable Manager while duplicating slide

- **Status:** fixed (May 19, 2026)
- **Severity:** P1
- **Mode:** Canvas
- **Session:** 3
- **Steps to reproduce:**
  1. Canvas with active slide.
  2. Press `⌘D` / `Ctrl+D` to duplicate.
- **Expected:** Only slide duplication (`TimelineDock`); no mode change.
- **Actual:** Slide duplicated **and** `AppShell` toggled Variable Manager (`D` handler ignored modifiers).
- **Heuristic:** #4 Consistency and standards
- **Related code:** `src/components/layout/AppShell.tsx`
- **Resolution:** Ignore `D` when `metaKey` or `ctrlKey` is set.

---

## UXR-018 — Variable Manager search filters Canvas sidebar

- **Status:** open
- **Severity:** P2
- **Mode:** Variable Manager → Canvas (mode boundary)
- **Session:** 4
- **Steps to reproduce:**
  1. Open Canvas with F1 loaded; note all 7 variables in sidebar.
  2. Open Variable Manager (`D`); type `gender` in Manager search.
  3. Observe Canvas sidebar: only `gender` remains visible (`Survey Questions ( 1 )`).
  4. Clear Manager search — sidebar restores all variables.
- **Expected:** Manager search scopes to Manager columns only; Canvas sidebar unchanged while overlay is open.
- **Actual:** Both surfaces bind to the same `searchQuery` in global store.
- **Heuristic:** #4 Consistency and standards (mode separation per `design_02_ux_modes.md`)
- **Related:** `uiSlice.ts` `searchQuery`, `VariableManager.tsx`, Canvas sidebar search

---

## UXR-019 — Facet dropdown options missing from accessibility tree

- **Status:** open
- **Severity:** P2
- **Mode:** Variable Manager
- **Session:** 4
- **Steps to reproduce:** Open Manager → click **Type** facet → inspect dropdown options in accessibility tree.
- **Expected:** Checkbox options (Category, Scale, Numeric, …) exposed as named controls.
- **Actual:** Options render as clickable `div`s; tree shows only the **Type** trigger button. Keyboard/a11y users cannot reach facet values.
- **Heuristic:** #4 Consistency; #7 Flexibility and efficiency of use
- **Related:** `FacetedSearchBar.tsx` `FacetDropdown`

---

## UXR-020 — Value-mapping row actions share identical accessible names

- **Status:** open
- **Severity:** P2
- **Mode:** Variable Manager (Inspector)
- **Session:** 4
- **Steps to reproduce:** Select `region` (5 categories) or `gender` (2); inspect value-mapping action buttons in a11y tree.
- **Expected:** Distinct names per row, e.g. “Set Male as missing”.
- **Actual:** Every row action is named “Set as Missing” (from `title` only); screen readers cannot distinguish targets.
- **Heuristic:** #4 Consistency
- **Related:** `InspectorStats.tsx` `tableActionButton`

---

## UXR-021 — Import Session modal crashes the app (hooks violation)

- **Status:** fixed (May 19, 2026)
- **Severity:** P0
- **Mode:** Canvas / Workspace (Import Session)
- **Session:** 5
- **Steps to reproduce:**
  1. Open Canvas with any dataset loaded.
  2. Click **Import Session** in the header.
- **Expected:** Two-step import modal (`.velocity` then matching `.sav`).
- **Actual:** React error — “Rendered more hooks than during the previous render”; page shows only splash/empty document.
- **Heuristic:** #9 Help users recover from errors (total failure)
- **Related:** `src/components/overlays/SessionImportModal.tsx` — `useReducedMotion()` was called after `if (!isOpen) return null`
- **Resolution:** Call `useReducedMotion()` before the early return.

---

## UXR-022 — Export format picker not exposed to accessibility tree

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas (Export modal)
- **Session:** 5
- **Steps to reproduce:** Open Export modal; inspect format section in accessibility tree.
- **Expected:** Named controls for PowerPoint vs Excel (radio group or tabs).
- **Actual:** Scope radios and checkboxes are named; PPTX/XLSX tiles are clickable `motion.div` elements with no role/name.
- **Heuristic:** #4 Consistency (scope section is accessible; format section is not)
- **Related:** `src/components/overlays/ExportModal.tsx` format grid

---

## UXR-023 — “Export dialog opened” toast on every open

- **Status:** open
- **Severity:** P3
- **Mode:** Canvas
- **Session:** 5
- **Steps to reproduce:** Click **Export** in header twice.
- **Expected:** Silent open or single dismissible hint for first use.
- **Actual:** Info toast “Export dialog opened” each time (`DashboardShell` `addToast`).
- **Heuristic:** #8 Minimalist design
- **Related:** `src/features/dashboard/DashboardShell.tsx` `handleExport`

---

## UXR-024 — Recode modal unreachable from Canvas sidebar

- **Status:** open
- **Severity:** P1
- **Mode:** Canvas
- **Session:** 6
- **Steps to reproduce:**
  1. Open Canvas with F1 loaded.
  2. Attempt to open **Recode Variable** from sidebar variable cards (context menu, hover actions, etc.).
- **Expected:** Documented recode flow via `RecodeModal` or clear Manager-only path.
- **Actual:** `DashboardShell` passes `onRecode={handleRecodeClick}` → `openRecodeModal`, but `VariableCard` / `DraggableVariable` never call `onRecode`; modal never opens from Canvas.
- **Heuristic:** #4 Consistency; #6 Recognition rather than recall
- **Related:** `RecodeModal.tsx`, `DraggableVariable.tsx`, `DashboardShell.tsx`
- **Note:** Recode **does** work from Variable Manager distribution chart (group/bin flow).

---

## UXR-025 — Table cell drill-down / Data drawer not wired

- **Status:** open
- **Severity:** P1
- **Mode:** Canvas
- **Session:** 6
- **Steps to reproduce:**
  1. Build a crosstab in table view.
  2. Click a data cell to inspect underlying respondents.
- **Expected:** `DataDrawer` opens with filtered respondent rows (`openDrillDown`).
- **Actual:** `DataTable` supports `onCellClick`, but `SlideContainer` does not pass it; clicks have no effect.
- **Heuristic:** #1 Visibility of system status; #7 Flexibility and efficiency of use
- **Related:** `SlideContainer.tsx`, `DataTable.tsx`, `drillDownSlice.ts`, `DataDrawer.tsx`

---

## UXR-026 — Variable Manager stays open over Workspace

- **Status:** open
- **Severity:** P2
- **Mode:** Variable Manager → Workspace (mode boundary)
- **Session:** 6
- **Steps to reproduce:**
  1. Open Variable Manager (`D`) on Canvas.
  2. Click **Return to Workspace** without closing Manager.
- **Expected:** Manager closes (or Workspace is fully interactive); user can use Projects tab and dataset actions.
- **Actual:** Manager overlay remains; Workspace controls (e.g. Projects tab) are click-intercepted.
- **Heuristic:** #3 User control and freedom; mode separation per `design_02_ux_modes.md`
- **Related:** `AppShell.tsx`, `App.tsx` mode routing

---

## UXR-027 — Theme toggle tooltip omits Liquid Glass

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 7
- **Steps to reproduce:**
  1. Open Canvas; note theme control tooltip: “Switch to Mission Control” or “Switch to Soft Machine” only.
  2. Click repeatedly — Liquid Glass appears between Soft Machine and Mission Control.
- **Expected:** Tooltip names **next** theme (all three) or shows current theme name.
- **Actual:** Tooltip binary string; Liquid Glass is undiscoverable from copy.
- **Heuristic:** #4 Consistency and standards; #6 Recognition rather than recall
- **Related:** `DashboardShell.tsx` theme button `title`

---

## UXR-028 — No theme control on Workspace

- **Status:** open
- **Severity:** P2
- **Mode:** Workspace
- **Session:** 7
- **Steps to reproduce:**
  1. Land on Workspace (cold or Return to Workspace).
  2. Search header for theme toggle.
- **Expected:** Same theme switcher as Canvas (or settings entry) per `design_01` three-theme system.
- **Actual:** Theme changes only inside Canvas; Workspace inherits last Canvas theme with no local control.
- **Heuristic:** #4 Consistency and standards
- **Related:** `WorkspaceView.tsx` (no `useTheme`); `DashboardShell.tsx` only consumer of `toggleTheme`

---

## UXR-029 — Theme toggle icon implies light/dark only

- **Status:** open
- **Severity:** P3
- **Mode:** Canvas
- **Session:** 7
- **Steps to reproduce:** Observe theme button icon (Sun on non–Soft Machine, Moon on Soft Machine) while cycling three distinct aesthetics.
- **Expected:** Icon or label reflects current theme or “cycle theme”.
- **Actual:** Sun/Moon metaphor matches two themes, not Liquid Glass.
- **Heuristic:** #6 Recognition rather than recall
- **Related:** `DashboardShell.tsx` lines 515–516

---

## UXR-030 — Liquid Glass blur under-realized on Canvas chrome

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 7
- **Steps to reproduce:**
  1. Cycle to Liquid Glass on F1 crosstab.
  2. Compare sidebar, shelves, and slide chrome to `design_01` “translucent, biomorphic” spec.
- **Expected:** Visible material depth (blur/translucency) on panels over `bg-glass-app`.
- **Actual:** Sidebar and shelves read as flat warm panels; slide card blur subtle; spec differentiation from Soft Machine is weak.
- **Heuristic:** #8 Aesthetic and minimalist design
- **Related:** `SlideContainer.tsx` (panel uses tokens); sidebar/shelves lack `mat-*` surfaces

---

## UXR-031 — Liquid Glass chart palette low contrast

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas (chart view)
- **Session:** 7
- **Steps to reproduce:**
  1. Liquid Glass + gender × region grouped bar chart.
  2. Compare bar/legend contrast to Mission Control on same data.
- **Expected:** Chart series distinguishable at a glance (WCAG-oriented contrast for UI graphics).
- **Actual:** Muted pastels on light slide; legend truncation (`Internatio...`) worse combined with low contrast.
- **Heuristic:** #8 Aesthetic and minimalist design
- **Related:** `themes.ts` `liquidGlass` viz palette; `AnalysisChart.tsx` / renderers

---

<!-- Add new findings below as sessions progress -->
