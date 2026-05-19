# Session 7 — Themes & Visual System

**Date:** May 19, 2026  
**Driver:** Agent (cursor-ide-browser)  
**Build:** `http://127.0.0.1:4174/`  
**Focus:** Cross-theme UI audit (§8 Session 7)  
**Fixture:** F1 `mock_data.csv` (persisted OPFS; gender × region crosstab, nps filter)

## Methods

| Technique | Result |
| :--- | :--- |
| Theme cycle (Canvas) | Soft Machine → Liquid Glass → Mission Control on same slide |
| Chart/table parity | Table + grouped bar chart on each theme |
| Workspace persistence | Liquid Glass tokens apply on Workspace after Canvas switch |
| `npm run check:design-tokens` | **Pass** (empty allowlist) |
| Export modal (Mission Control) | Scope radios/checkboxes named; format tiles still unnamed (UXR-022) |
| Console | No React errors during review |

## Theme-by-theme summary

### Soft Machine (default)

| Surface | Assessment |
| :--- | :--- |
| Workspace | Warm cream palette; serif “Velocity Workspace” title; dataset card readable |
| Canvas table | Strong hierarchy; left-accent row hover per `design_01` |
| Canvas chart | Muted earth-tone bars legible; legend truncation still present (UXR-011) |
| Typography | Atkinson Hyperlegible + display serif on slide title — on-spec |

### Mission Control

| Surface | Assessment |
| :--- | :--- |
| Workspace | N/A toggle in Workspace — inherits theme from last Canvas session |
| Canvas table | Excellent contrast; radar-sweep row hover; sig markers clear |
| Canvas chart | Cyan/orange palette pops on dark chrome; best chart readability of three |
| Export modal | Token-consistent dark panel; accessible scope section |

### Liquid Glass

| Surface | Assessment |
| :--- | :--- |
| Workspace | Glass overrides on cards/header (`WorkspaceView.module.css`); no blur backdrop behind flat beige — reads closer to Soft Machine than “spatial” spec |
| Canvas slide | `SlideContainer` uses `--mat-panel-bg` + backdrop filter; effect subtle without layered background |
| Canvas table | `data-[theme=liquid-glass]` sticky headers use material tokens — **good** |
| Canvas chart | iOS-style palette; **low bar/legend contrast** on light slide (UXR-031); legend truncation (UXR-011) |
| Discoverability | Third theme hidden behind binary Sun/Moon icon and misleading tooltip (UXR-027–029) |

## Component consistency pass

| Component | Soft Machine | Mission Control | Liquid Glass | Notes |
| :--- | :---: | :---: | :---: | :--- |
| Header actions | ✓ | ✓ | ✓ | Same layout; theme toggle icon binary only |
| Shelves (row/col) | ✓ | ✓ | ✓ | Token-based pills |
| Slide card | ✓ | ✓ | ✓ | Radius follows `--radius` (lg / sm / 2xl) |
| Timeline dock | ✓ | ✓ | ✓ | Liquid Glass glow in `index.css` |
| Export modal | ✓ | ✓ | Not re-opened | Format grid still a11y gap (UXR-022) |
| Toasts | ✓ | ✓ | ✓ | “Export dialog opened” still noisy (UXR-023) |

## New findings

| ID | Severity | Summary |
| :--- | :--- | :--- |
| UXR-027 | P2 | Theme toggle `title` only names Soft Machine ↔ Mission Control; runtime cycles **three** themes |
| UXR-028 | P2 | Theme toggle exists only in **Canvas** (`DashboardShell`); Workspace has no control |
| UXR-029 | P3 | Sun/Moon icon implies light/dark binary; does not signal Liquid Glass or current theme name |
| UXR-030 | P2 | Liquid Glass material blur under-realized on Canvas chrome (sidebar/shelves read flat) |
| UXR-031 | P2 | Liquid Glass chart bars/legend low contrast vs slide background |

## Validations (audit_02 / gap analysis)

| Hypothesis | Verdict |
| :--- | :--- |
| Liquid Glass “not yet exercised” (plan §10) | **Exercised** — functional but immature vs spec |
| Token drift in dashboard shell | **Rejected** for surveyed paths — CI clean |
| No `prefers-reduced-motion` | **Partially superseded** — `src/lib/motion.ts` + `AccessibleMotion`; full audit deferred to Session 8 |
| Chart token parity across themes | **Confirmed** — CSS vars; contrast varies by theme palette not hardcoded hex |

## Heuristic snapshot (visual system)

| # | Heuristic | Score (0–4) | Comment |
| :---: | :--- | :---: | :--- |
| 4 | Consistency & standards | 2 | Three themes apply globally; toggle UX does not |
| 8 | Aesthetic & minimalist | 1 | Mission Control strongest; Liquid Glass chart washout |
| 1 | Visibility of system status | 1 | User cannot see active theme name without inferring from palette |

## Code pointers

- Theme cycle: `src/context/ThemeContext.tsx` (`themes` array, `toggleTheme`)
- Misleading tooltip/icon: `src/features/dashboard/DashboardShell.tsx` ~510–516
- Liquid Glass materials: `src/theme/themes.ts` (`liquidGlass.materials`)
- Table material headers: `src/features/dashboard/components/DataTable.tsx`
- Slide material panel: `src/features/dashboard/components/SlideContainer.tsx`

## Console

No errors during Session 7. Worker/DuckDB warnings only.

## Next session

**Session 8** — Accessibility + keyboard: audit §14 shortcut registry vs code; focus rings; contrast spot-check; `prefers-reduced-motion` OS test.
