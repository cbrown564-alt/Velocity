# Session 2 — Canvas Analysis Core (J3)

**Date:** May 19, 2026  
**Driver:** Agent (cursor-ide-browser)  
**Build:** `http://127.0.0.1:4174/`  
**Journey:** J3  
**Fixture:** F1 `mock_data.csv` (persisted OPFS, Mission Control theme)

## J3 — Task results

| Task | Result | Notes |
| :--- | :--- | :--- |
| Suggested starting point (`gender`) | **Pass** | One click adds row variable; empty state clears |
| Sidebar add column (`region`) | **Pass** | Second click populates column shelf; crosstab renders with sig markers |
| Table ↔ chart toggle | **Pass** | Chart types (`Grouped Bar`, etc.) and count/% controls have good names |
| Statistical settings | **Partial** | Panel opens with Compare/Correct/Intervals; popover clipped until inner scroll (UXR-015) |
| Add filter + verify N | **Partial** | Filter applies to table (cell % and totals change); subtitle still shows `N = 250` (UXR-010) |
| Optional weight | **Not run** | `WEIGHT` control visible; deferred to Session 6/7 |

**J3 success criteria:** Core analysis loop is credible and discoverable without docs. Filter trust label is the main gap.

## UI observations

**Strengths**

- Suggested starting points + sidebar clicks are a fast path to first crosstab.
- Crosstab hierarchy, sig legend (`↑`/`↓`, Welch's T, χ² line), and Mission Control tokens read well.
- Chart view: grouped bar, swap axes, count/% toggles are labeled; data updates with row/column config.
- Filter chip `nps segment = Promoter` and `Remove filter: nps segment` are accessible.
- Filter modal step 2 uses clear value buttons and `Apply Filter (N selected)` state.

**Issues**

| ID | Severity | Summary |
| :--- | :--- | :--- |
| UXR-010 | P1 | Subtitle `N` stays at full sample (250) when filters active; table counts reflect filter |
| UXR-011 | P2 | Chart legend truncates region labels (`Internatio...`, `Sout`) |
| UXR-012 | P2 | Table/chart header toggles are icon-only (no name in a11y tree) |
| UXR-013 | P2 | `age group` filter step shows “No values found” — cannot apply |
| UXR-014 | P2 | Filter value list briefly shows previous variable’s values while loading |
| UXR-015 | P2 | Statistical settings popover clipped; must scroll slide container to reach control |
| UXR-016 | P2 | Column shelf `region` chip is unnamed in a11y tree |

## Heuristic snapshot (Canvas)

| # | Heuristic | Score (0–4) | Comment |
| :---: | :--- | :---: | :--- |
| 1 | Visibility of system status | 2 | Filter chip good; filtered N wrong in subtitle |
| 3 | User control & freedom | 1 | Filter modal back/close works; age_group dead-end |
| 4 | Consistency & standards | 1 | Export modal sets a11y bar; shelf chips/toggles lag |
| 6 | Recognition vs recall | 0 | Starting points + labeled chart controls help discovery |
| 8 | Aesthetic & minimalist | 1 | Legend truncation; stats footer dense but acceptable |

## Code pointers (for fixes)

- Filtered N: `SlideHeader.tsx` passes `dataset?.rowCount` into `resolveSlideSubtitle` — should use effective/filtered base N from crosstab result.
- Filter values: `FilterModal.tsx` (`No values found` when `availableValues.length === 0`).

## Console

- No errors during Session 2 interactions; DuckDB/worker warnings only (same as Session 0/1).

## Next session

**Session 3** — J4 Deck, timeline, focus (`F`, `N`, `←/→`, `⌘/Ctrl+D`). Re-validate UXR-003 duplicate slide titles in export list.
