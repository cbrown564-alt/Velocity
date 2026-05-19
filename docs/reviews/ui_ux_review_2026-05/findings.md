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

- **Status:** open
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

- **Status:** open
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

<!-- Add new findings below as sessions progress -->
