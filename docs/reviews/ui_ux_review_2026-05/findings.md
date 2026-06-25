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

- **Status:** fixed (June 25, 2026; `AppModeRouter` now uses a motion fade for dashboard entry and preserves reduced-motion behavior)
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

- **Status:** fixed (May 19, 2026; `aria-label="Close Variable Manager"`)
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

- **Status:** fixed (June 25, 2026; dataset persistence bytes computed from OPFS source + dataset DB files)
- **Severity:** P2
- **Mode:** Workspace
- **Session:** 1
- **Steps to reproduce:** Upload or Load Example; open Workspace Recent/All Datasets.
- **Expected:** File size reflects OPFS/stored bytes (consistent with Local Storage meter).
- **Actual:** Card shows `250 rows · 7 cols · 0 B` while header reports ~819 KB used.
- **Heuristic:** #1 Visibility of system status

---

## UXR-007 — Starred search with no matches lacks empty feedback

- **Status:** fixed (June 25, 2026; WorkspaceView now renders filtered-empty feedback copy)
- **Severity:** P3
- **Mode:** Workspace
- **Session:** 1
- **Steps to reproduce:** Starred tab + search filter that excludes all cards.
- **Expected:** “No datasets match your search” (or clear empty state).
- **Actual:** Section heading remains; content area empty without explanation.
- **Heuristic:** #1 Visibility of system status

---

## UXR-008 — Projects tab is a blank panel

- **Status:** fixed (June 25, 2026; `WorkspaceView` projects empty state + New Project CTA)
- **Severity:** P1
- **Mode:** Workspace
- **Session:** 1
- **Steps to reproduce:** Workspace → Projects tab (grid or list).
- **Expected:** Empty state with copy + CTA (create/link project) per longitudinal UX spec.
- **Actual:** Empty dark content area; no heading or action in UI or a11y tree.
- **Heuristic:** #6 Recognition rather than recall; #8 Minimalist (too empty)

---

## UXR-009 — List view hides dataset cards from workspace content

- **Status:** fixed (June 25, 2026; list rows exposed as keyboard-accessible dataset items with explicit view toggle labels)
- **Severity:** P2
- **Mode:** Workspace
- **Session:** 1
- **Steps to reproduce:** Recent tab → switch to list view (header toggle).
- **Expected:** Same datasets as grid, row layout.
- **Actual:** “Recent Datasets” heading + batch checkbox; `mock_data.csv` card not present in accessibility tree (grid toggle restores it).
- **Heuristic:** #4 Consistency and standards

---

## UXR-010 — Filtered subtitle shows unfiltered N

- **Status:** fixed (June 25, 2026; `computeAnalysisSampleSize` + `SlideHeader` filtered N)
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

- **Status:** fixed (May 19, 2026; `aria-label` + `aria-pressed` on header toggles)
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

- **Status:** fixed (June 25, 2026; `FilterModal` falls back to `variableStats.frequencies` when distinct-value lookup returns empty)
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

- **Status:** fixed (June 25, 2026; `FilterModal` clears value list on variable switch and ignores stale async responses)
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

- **Status:** fixed (June 25, 2026; isolated `managerSearchQuery` confirmed via `uiSlice` tests)
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

- **Status:** fixed (June 25, 2026; facet dropdowns now expose `menuitemcheckbox` options with accessible names)
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

- **Status:** fixed (June 25, 2026; Inspector row actions include value label + code in accessible names)
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

- **Status:** fixed (June 25, 2026; Export format rendered as labeled radios inside a fieldset/radiogroup)
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

- **Status:** fixed (June 25, 2026; removed repetitive open-toast in `DashboardShell` export handler)
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

- **Status:** fixed (June 25, 2026; Canvas sidebar context menu → `RecodeModal`)
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

- **Status:** fixed (June 25, 2026; drill-down click path validated end-to-end, including multiple-response axis mapping)
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
- **Resolution:** Verified `SlideContainer` → `DataTable` wiring and fixed downstream drill-down filter resolution for multiple-response row/column labels (`resolveDrillDownContext`) so cell clicks open `DataDrawer` with matching respondent rows.

---

## UXR-026 — Variable Manager stays open over Workspace

- **Status:** fixed (June 25, 2026; Return to Workspace now forces app mode back to analysis)
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

- **Status:** fixed (June 25, 2026; `ThemeSwitcher` trigger copy now announces current + next theme across all three themes)
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

- **Status:** fixed (June 25, 2026; `WorkspaceView` header includes shared `ThemeSwitcher`)
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

- **Status:** fixed (June 25, 2026; shared `ThemeSwitcher` uses neutral palette icon + theme-name copy)
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

- **Status:** fixed (June 25, 2026; Canvas chrome panels use stronger Liquid Glass material tokens and shared `surface-panel` treatment)
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

- **Status:** fixed (June 25, 2026; `liquidGlass` viz palette + axis text tokens retuned for stronger chart/legend contrast)
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

## UXR-032 — Canvas deck shortcuts fire while Variable Manager is open

- **Status:** fixed (May 19, 2026)
- **Severity:** P1
- **Mode:** Canvas → Variable Manager (mode boundary)
- **Session:** 8
- **Steps to reproduce:**
  1. Open Canvas; press `D` to open Variable Manager.
  2. Press `N` (new slide) without closing Manager.
- **Expected:** Deck mutations disabled until Manager closes (mode spoke owns keyboard).
- **Actual:** New slide added behind overlay; active slide changed to empty “New Slide”.
- **Heuristic:** #3 User control and freedom; mode separation per `design_02_ux_modes.md`
- **Related:** `TimelineDock.tsx` document listener; `uiSlice` `appMode`
- **Resolution:** `TimelineDock` ignores deck keys when `appMode === 'variables'`.

---

## UXR-033 — Keyboard shortcuts reference misdocuments bindings

- **Status:** fixed (May 19, 2026)
- **Severity:** P2
- **Mode:** Global (`?` modal)
- **Session:** 8
- **Steps to reproduce:** Press `?`; read Canvas group.
- **Expected:** Matches plan §14 (`N`, `⌘D`, Manager-only `⌘A`).
- **Actual:** Canvas listed `⌘A` for variables; omitted `N` and duplicate slide.
- **Heuristic:** #4 Consistency and standards; #6 Recognition rather than recall
- **Related:** `KeyboardShortcuts.tsx`

---

## UXR-034 — Keyboard shortcuts list not exposed to assistive tech

- **Status:** fixed (May 19, 2026)
- **Severity:** P2
- **Mode:** Global
- **Session:** 8
- **Steps to reproduce:** Open `?` modal; inspect accessibility tree.
- **Expected:** Each shortcut row readable (description + keys).
- **Actual:** Only section headings (`Global`, `Canvas`, `Manager`) appeared in tree.
- **Heuristic:** #4 Consistency
- **Related:** `KeyboardShortcuts.tsx` — now uses `role="dialog"` and `<ul>` rows

---

## UXR-035 — Keyboard shortcuts modal close control unnamed

- **Status:** fixed (May 19, 2026)
- **Severity:** P2
- **Mode:** Global
- **Session:** 8
- **Steps to reproduce:** Open `?` modal; inspect close button.
- **Expected:** `aria-label="Close keyboard shortcuts"`.
- **Actual:** Icon-only button with no accessible name.
- **Heuristic:** #4 Consistency (Export modal names close control)
- **Related:** `KeyboardShortcuts.tsx`

---

## UXR-036 — Upload progress bar is decorative, not data-driven

- **Status:** fixed (June 25, 2026; SAV worker progress is bridged to `engine.loadProgress` and consumed by `UploadProgressBar`/`UploadOverlay`)
- **Severity:** P1
- **Mode:** Workspace → Canvas (uploading overlay)
- **Session:** 9
- **Steps to reproduce:**
  1. Upload a large `.sav` or open a workspace dataset that triggers `mode === 'uploading'`.
  2. Observe top accent bar and “Loading dataset...” overlay.
- **Expected:** Progress reflects worker `engine.loadProgress` (parse/insert phases, row counts).
- **Actual (fixed):** Chunked and non-chunked SAV ingestion now emits `engine.loadProgress` from worker handlers; UI progress bar width, phase headline, and row-count copy render directly from store `loadProgress` updates.
- **Heuristic:** #1 Visibility of system status
- **Related:** `engineHandlers.ts`, `workerIngestion.ts`, `savChunkedLoader.ts`, `UploadProgressBar.tsx`, `UploadOverlay.tsx`

---

## UXR-037 — Crosstab query failures are silent in the slide UI

- **Status:** fixed (June 25, 2026; `queryError` in `analysisSlice` + inline alert/retry in `SlideContainer`)
- **Severity:** P1
- **Mode:** Canvas
- **Session:** 9
- **Steps to reproduce:**
  1. Open Canvas with row/column variables configured.
  2. Trigger `runAnalysis` when worker has no `main` table (e.g. OPFS conflict / failed dataset materialization).
  3. Check slide body vs browser console.
- **Expected:** Inline error (“Couldn’t run analysis”) with retry; shelves remain editable.
- **Actual:** `analysisSlice` logs `[AnalysisSlice] Query error` and clears `isQuerying`; slide title/shelves render but table/chart area stays empty with no explanation.
- **Heuristic:** #1 Visibility of system status; #9 Help users recover from errors
- **Related:** `analysisSlice.ts`, `SlideContainer.tsx`, `DataTable.tsx`

---

## UXR-038 — Analysis loading state not exposed to assistive tech

- **Status:** open
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 9
- **Steps to reproduce:**
  1. Add row/column variables on a slow query (large dataset or throttled worker).
  2. Inspect slide region during recompute with screen reader or accessibility tree.
- **Expected:** `aria-busy="true"` and/or `role="status"` announcement while `isQuerying`.
- **Actual:** Visual spinner overlay only (`DashboardShell`); no busy semantics on analysis container. On F1 the overlay is often sub-perceptual.
- **Heuristic:** #1 Visibility of system status
- **Related:** `DashboardShell.tsx` `isQuerying` block

---

## UXR-039 — Engine initialization has no progress feedback

- **Status:** fixed (June 25, 2026; splash now surfaces init phase/detail text and load-progress percent when available)
- **Severity:** P2
- **Mode:** Global (splash)
- **Session:** 9
- **Steps to reproduce:**
  1. Cold load app (hard refresh).
  2. Time from “Initializing Analysis Engine...” to workspace ready.
- **Expected:** Phase label and/or % while DuckDB WASM and persistence bridge start (similar to WebR panel pattern).
- **Actual:** Indeterminate spinner and static copy; DuckDB init ~0.5–4s with no user-facing phases.
- **Heuristic:** #1 Visibility of system status
- **Related:** `App.tsx` engine init overlay; `enginePersistenceBridge.ts`

---

## UXR-040 — Multiple tabs cause OPFS errors and opaque “Storage Issue”

- **Status:** fixed (June 25, 2026; `getPersistenceDisplayMessage`, pilot single-tab warning, `PersistenceStatus` copy)
- **Severity:** P1
- **Mode:** Global / Canvas
- **Session:** 9
- **Steps to reproduce:**
  1. Open Velocity in two browser tabs on the same origin.
  2. Open dataset in tab B; add row/column variables.
  3. Observe sidebar footer and console.
- **Expected:** Warning that only one tab should use local storage, or coordinated lock; analysis either works or shows clear blocker.
- **Actual:** Console: `createSyncAccessHandle` / OPFS repair DB churn; sidebar shows **Storage Issue**; crosstab queries fail with “Table main does not exist” and no slide-level error (see UXR-037).
- **Heuristic:** #1 Visibility of system status; #5 Error prevention
- **Related:** `analysisWorker.ts` OPFS open paths; `PersistenceStatus.tsx`

---

## UXR-041 — Filter and Import Session modals ignore Escape

- **Status:** fixed (June 25, 2026; `useModalEscape` via `ModalShell.escapeToClose`)
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 10
- **Steps to reproduce:**
  1. Open **Add Filter** or **Import Session**.
  2. Press `Escape`.
- **Expected:** Modal closes (same as Export close / ConfirmModal).
- **Actual:** Modal stays open; only backdrop click, Cancel, or X dismisses.
- **Heuristic:** #3 User control and freedom; #4 Consistency (ConfirmModal and Export support Esc when focused)
- **Related:** `FilterModal.tsx`, `SessionImportModal.tsx`

---

## UXR-042 — Export modal Escape fails without focus inside panel

- **Status:** fixed (June 25, 2026; document-level `useModalEscape` on `ExportModal`)
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 10
- **Steps to reproduce:**
  1. Open **Export** from header (focus often remains on trigger behind modal).
  2. Press `Escape`.
- **Expected:** Modal closes immediately.
- **Actual:** Modal remains open until user tabs into modal or clicks Cancel/Close.
- **Heuristic:** #3 User control and freedom
- **Related:** `ExportModal.tsx` — `onKeyDown` on inner `.modal` only; no focus trap or `autoFocus`

---

## UXR-043 — Purge Corruption has no confirmation

- **Status:** fixed (June 25, 2026; destructive purge now routes through `ConfirmModal` before execution)
- **Severity:** P2
- **Mode:** Canvas (Storage Health)
- **Session:** 10
- **Steps to reproduce:**
  1. Open sidebar **Storage Issue** → Storage Health modal.
  2. Click **Purge Corruption**.
- **Expected:** Confirm destructive action (quarantined OPFS DB files).
- **Actual:** Purge runs immediately (`purgeQuarantinedDbs` in `usePersistenceManager.ts`).
- **Heuristic:** #5 Error prevention
- **Related:** `PersistenceStatus.tsx`, `usePersistenceManager.ts`

---

## UXR-044 — Canvas header toolbar does not adapt at narrow widths

- **Status:** fixed (June 25, 2026; `DashboardToolbar` icon-only labels below `xl` breakpoint)
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 11
- **Steps to reproduce:**
  1. Open F1 dataset on Canvas.
  2. Resize browser to 1280px or 900px width.
  3. Observe header row: Table/Chart toggle, Import Session, Export Session, Export, theme, Focus, Variables, Reset.
- **Expected:** Secondary actions collapse to icons or overflow menu below ~1200px.
- **Actual:** All controls remain full-width labels in one row (`DashboardShell` header `flex gap-6` with no `@media` rules); layout feels crowded below 1280px.
- **Heuristic:** #8 Aesthetic and minimalist design
- **Related:** `src/features/dashboard/DashboardShell.tsx` header block
- **Screenshot:** `screenshots/S11-canvas-1920.png` (comfortable at 1920; contrast by resize)

---

## UXR-045 — Canvas sidebar fixed at 288px with no narrow collapse

- **Status:** fixed (June 25, 2026; collapsible sidebar + auto-collapse below 1280px)
- **Severity:** P2
- **Mode:** Canvas
- **Session:** 11
- **Steps to reproduce:**
  1. Open Canvas at 1280×900 or 900×700.
  2. Compare to Workspace `DatasetSidebar`, which supports collapsed width.
- **Expected:** Optional sidebar collapse (or icon rail) when viewport &lt; 1280px to preserve analysis area.
- **Actual:** Sidebar always `w-72` (288px) unless Focus mode; main slide area ~500–700px on target laptop widths.
- **Heuristic:** #8 Aesthetic and minimalist design; #7 Flexibility
- **Related:** `DashboardShell.tsx` aside classes; `DatasetSidebar.module.css` (collapse pattern exists elsewhere)

---

## UXR-046 — Timeline slide labels truncate with larger decks

- **Status:** open
- **Severity:** P3
- **Mode:** Canvas
- **Session:** 11
- **Steps to reproduce:**
  1. Create or open a deck with 6+ slides (Session 0 recon deck).
  2. Observe timeline dock at 1280–1440px width.
- **Expected:** Enough label context to distinguish slides without hovering every thumb.
- **Actual:** Capsules show truncated titles (e.g. “gender by r…”); horizontal scroll works but off-screen slides are hard to identify.
- **Heuristic:** #6 Recognition rather than recall
- **Related:** `TimelineDock.tsx`, `SlideThumb` width
- **Screenshot:** `screenshots/S11-canvas-1920.png`

---

## UXR-047 — Workspace OPFS banner shows raw browser exception

- **Status:** fixed (June 25, 2026; `getPersistenceDisplayMessage` + collapsible technical details in `SplashScreen`)
- **Severity:** P2
- **Mode:** Workspace
- **Session:** 11
- **Steps to reproduce:**
  1. Open Workspace with OPFS lock active (e.g. multiple Velocity tabs).
  2. Observe bottom warning card.
- **Expected:** Plain-language message only (hint text is good); dismiss or link to Storage Health.
- **Actual:** Full `createSyncAccessHandle…` exception string rendered above friendlier `opfsErrorHint`; card consumes large fraction of viewport at 1280×900.
- **Heuristic:** #9 Help users recover from errors
- **Related:** `App.tsx` OPFS overlay; UXR-040
- **Screenshot:** `screenshots/S11-workspace-1920.png`

---

## UXR-048 — No minimum viewport guard or desktop guidance

- **Status:** fixed (June 25, 2026; global desktop-recommended banner appears below 1280px viewport width)
- **Severity:** P3
- **Mode:** Global
- **Session:** 11
- **Steps to reproduce:**
  1. Resize browser to 768px or below.
  2. Use Canvas and Workspace normally.
- **Expected:** Documented minimum width (e.g. 1280px) or lightweight “desktop recommended” banner.
- **Actual:** App renders without guard; Canvas has no responsive rules in `DashboardShell`; only minor Workspace `@media` for project cards.
- **Heuristic:** #10 Help and documentation
- **Related:** `design_02_ux_modes.md` (desktop-first assumption); Session 12 synthesis

---

## UXR-049 — MC chart multi-hue palette reads as “rainbow” on dark chrome

- **Status:** fixed (May 20, 2026; UXP-033 — MC viz palette → sequential cyan ramp)
- **Severity:** P2
- **Mode:** Canvas (chart)
- **Session:** VP-D §12 frame-it (2026-05-20)
- **Steps to reproduce:**
  1. Mission Control theme; gender × region grouped horizontal bar.
  2. Open chart view; view unedited screenshot artifact.
- **Expected:** Region series feel like one instrument panel — restrained hue count, coherent with MC cyan/orange accent system.
- **Actual:** High-saturation multi-hue bars on dark background; reviewer would not paste into a deck without rework.
- **Heuristic:** #4 Consistency and standards; #8 Aesthetic and minimalist design
- **Related:** UXP-033; UXR-031 (LG chart contrast); `vp-d-06/05-chart-theme-mc.png`
- **Screenshot:** `screenshots/vp-d-06/05-chart-theme-mc.png`

---

## UXR-050 — Footer χ² badge uses success green and dominates attention

- **Status:** fixed (May 20, 2026; UXP-034 — green pill only when p &lt; 0.05)
- **Severity:** P2
- **Mode:** Canvas (crosstab footer)
- **Session:** VP-D §12 frame-it (2026-05-20)
- **Steps to reproduce:**
  1. Mission Control; gender × region crosstab with statistics footer visible.
  2. Observe χ² result at bottom-right of analysis frame.
- **Expected:** Footer supports the table; significance styling only when result is significant.
- **Actual:** Green χ² pill pulls focus even when association is not significant (p ≥ 0.05); competes with cell data.
- **Heuristic:** #8 Aesthetic and minimalist design
- **Related:** UXP-005, UXP-034; `StatisticsStatusBar.module.css` `.chiSquareSignificant`; `vp-d-05/01-crosstab-compact-mc-frame-it.png`
- **Screenshot:** `screenshots/vp-d-05/01-crosstab-compact-mc-frame-it.png`

---

## UXR-051 — Small-base cell `n=` warning color too prominent (especially MC)

- **Status:** fixed (May 20, 2026; UXP-035 — `.crosstab-small-base` whisper; removed MC amber glow)
- **Severity:** P2
- **Mode:** Canvas (crosstab)
- **Session:** VP-D §12 frame-it (2026-05-20)
- **Steps to reproduce:**
  1. Mission Control; crosstab with cells where 0 &lt; n &lt; 30.
  2. Compare orange `n=` under % values vs primary numeric scan path.
- **Expected:** Small-base caution is discoverable but does not outrank percentages.
- **Actual:** Orange `--status-warning-text` on `n=` draws excessive attention; undermines “evidence” framing.
- **Heuristic:** #8 Aesthetic and minimalist design
- **Related:** UXP-035; `CrosstabCell.tsx` `smallBaseClass()`; delight Idea 4; UXP-040 (visibility toggle)
- **Screenshot:** `screenshots/vp-d-05/01-crosstab-compact-mc-frame-it.png`

---

<!-- Add new findings below as sessions progress -->
