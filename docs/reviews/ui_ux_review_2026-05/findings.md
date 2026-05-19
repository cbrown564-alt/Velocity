# UI/UX Review Findings Register

**Program:** `docs/plan_01_comprehensive_ui_ux_review.md`  
**Started:** May 19, 2026

Log one entry per `UXR-###`. Update **Status** when fixed: `open` | `confirmed` | `fixed` | `wontfix`.

---

## UXR-000 — `D` key binds both Variable Manager and duplicate slide

- **Status:** open (confirmed Session 0)
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

---

## UXR-001 — “Data D” label vs Variable Manager shortcut

- **Status:** open
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

<!-- Add new findings below as sessions progress -->
