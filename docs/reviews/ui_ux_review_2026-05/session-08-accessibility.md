# Session 8 — Accessibility & Keyboard

**Date:** May 19, 2026  
**Driver:** Agent (cursor-ide-browser)  
**Build:** `http://127.0.0.1:4174/`  
**Focus:** §8 Session 8 — UI focus/contrast spot-check + UX shortcut audit vs `plan_01` §14  
**Fixture:** F1 `mock_data.csv` (persisted OPFS; Mission Control / Soft Machine)

## Methods

| Technique | Result |
| :--- | :--- |
| Shortcut registry audit | Code vs `KeyboardShortcuts.tsx` vs plan §14 |
| Live keyboard pass | `?`, `⌘D`, `D`, `N`, `F`, `Esc` on Canvas + Variable Manager |
| Accessibility tree | Snapshot at shortcuts modal, Manager close, table/chart toggles |
| `prefers-reduced-motion` | Code review — `useReducedMotion` wired in modals, `AppShell`, `TimelineDock`; no OS-level pass |
| Focus visibility | Not scored in browser (deferred to human pass + Session 11 contrast) |

## Shortcut audit (plan §14)

| Key | Plan | Code (pre-fix) | Live test | Status |
| :--- | :--- | :--- | :--- | :--- |
| `D` | Toggle Variable Manager | `AppShell` | Opens/closes Manager | **Pass** |
| `⌘/Ctrl+D` | Duplicate slide | `TimelineDock` | Duplicates only; Manager stays closed | **Pass** (UXR-017 fix held) |
| `F` | Focus mode | `AppShell` | Toggles on Canvas | **Pass** |
| `N` | New slide | `TimelineDock` | Worked on Canvas | **Fail** when Manager open (UXR-032) |
| `←` / `→` | Slide nav | `TimelineDock` | Not re-tested at Manager boundary | Open |
| `Delete` | Delete slide | `TimelineDock` | Not re-tested | Open |
| `?` | Shortcuts reference | `AppShell` | Opens modal | **Pass** |
| `⌘K` | Command palette | `AppShell` | Not re-tested | Open |
| `Esc` | Manager exit | `VariableManager` | Clears selection then closes | **Pass** |
| `⌘A` | Select all (Manager) | `VariableManager` | Not re-tested | Open |

### Shortcuts reference modal (`STAB-UI-C` seed)

| Issue | Severity | ID |
| :--- | :--- | :--- |
| Canvas group listed `⌘A` as “Select all variables” (Manager-only) | P2 | UXR-033 — **fixed** |
| Missing `N`, `⌘D`, `Backspace` in reference | P2 | UXR-033 — **fixed** |
| Shortcut rows not exposed as list text in a11y tree (headings only) | P2 | UXR-034 — **fixed** (`<ul>` + dialog semantics) |
| Close control unnamed | P2 | UXR-035 — **fixed** |

## Mode-boundary keyboard leak

**UXR-032 (P1):** With Variable Manager open, `N` added slide 7 (“New Slide”) behind the overlay without user intent. Canvas `TimelineDock` listeners did not check `appMode`.

**Fix (May 19):** `TimelineDock` returns early when `appMode === 'variables'`. `AppShell` ignores `F` in Manager mode. Tests added.

## Accessibility spot-check

| Control | Before | After session |
| :--- | :--- | :--- |
| Variable Manager close (X) | Unnamed | `aria-label="Close Variable Manager"` (UXR-004 **fixed**) |
| Table / chart toggles | Unnamed icon buttons | `aria-label` + `aria-pressed` (UXR-012 **fixed**) |
| Focus mode button | Named | Already had `aria-label` / `aria-pressed` |
| Export modal scope | Named radios | Unchanged (good) |
| Export format tiles | Unnamed | Still open (UXR-022) |
| Facet dropdown options | Div-only | Still open (UXR-019) |

## `prefers-reduced-motion`

| Area | Observation |
| :--- | :--- |
| `src/lib/motion.ts` | Central hook + `getMotionProps` flatten animations |
| Modals / overlays | `SessionImportModal`, `ExportModal`, `InputModal`, etc. use hook |
| `AppShell` | Manager slide-up respects reduced motion |
| Gap | No automated test tying OS media query to rendered duration; chart transitions not fully audited |

## Heuristic snapshot (keyboard + a11y)

| # | Heuristic | Workspace | Canvas | Var. Manager |
| :---: | :--- | :---: | :---: | :---: |
| 3 | User control & freedom | — | 1 (deck keys under overlay) | 1 |
| 4 | Consistency & standards | — | 2 (reference doc drift) | 2 |
| 7 | Flexibility & efficiency | — | 1 | 2 (facets) |
| 9 | Help users recover | — | — | 1 |

Scores 0–4; lower is better.

## Validations

| Item | Verdict |
| :--- | :--- |
| UXR-000 / UXR-017 shortcut conflicts | **Still fixed** |
| UXR-004 close button | **Fixed** this session |
| UXR-012 table/chart toggles | **Fixed** this session |
| Session 7 “motion audit deferred” | **Partial** — infrastructure confirmed; OS toggle pass still Session 9/11 |

## Recommended next session (9 — Performance perception)

- Loading/skeleton on filter value fetch (UXR-014)
- Workspace list view regression (UXR-009)
- Perceived latency on crosstab recompute

## Code changes this session

- `TimelineDock.tsx` — suppress deck shortcuts when Manager open
- `AppShell.tsx` — suppress `F` in Manager mode
- `VariableManager.tsx` — close button label
- `DashboardShell.tsx` — table/chart toggle labels
- `KeyboardShortcuts.tsx` — accurate registry + dialog/list semantics
- Tests: `TimelineDock.test.tsx`, `AppShell.test.tsx`, `KeyboardShortcuts.test.tsx`
