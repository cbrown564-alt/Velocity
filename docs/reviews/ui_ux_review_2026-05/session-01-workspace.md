# Session 1 — Workspace, Ingest & Reopen

**Date:** May 19, 2026  
**Driver:** Agent (cursor-ide-browser) + Playwright supplement  
**Build:** `http://127.0.0.1:4174/`  
**Journeys:** J1 (partial), J2 (primary)  
**Fixtures:** F1 `mock_data.csv` (browser); F2 `test_small.sav` + `sleep.sav` (Playwright `workspace-switch.spec.ts`)

## J1 — Workspace orientation

| Task | Result | Notes |
| :--- | :--- | :--- |
| Return from Canvas to Workspace | **Pass** | Home control lands on Recent with dataset card |
| Tab: Recent / All Datasets | **Pass** | Same `mock_data.csv` card; section headings update |
| Tab: Starred | **Partial** | Card visible (verify whether auto-starred is intended) |
| Tab: Projects | **Fail (empty state)** | Blank content area — no copy, CTA, or create-project affordance (see UXR-008) |
| Search filter | **Partial** | Typing `mock` filters card on Recent; Starred with filter showed heading only — no “no results” copy (UXR-007) |
| Grid vs list view | **Partial** | Grid shows cards in a11y tree; list view on Recent dropped card from tree (UXR-009) |
| Dataset card metadata | **Issue** | Shows `250 rows · 7 cols · 0 B` while Local Storage reports ~819 KB (UXR-006) |
| Session badge | **Pass** | “Session saved” + sparkle on card builds trust |
| Cold empty workspace | **Not run** | Profile already has data; J1 empty state covered in Session 0 |

## J2 — Enter analysis and reopen

| Task | Result | Notes |
| :--- | :--- | :--- |
| Open dataset from Workspace | **Pass** | Open button → Canvas without re-upload |
| Deck state restored | **Pass** | 3 slides preserved (from Session 0 `D` duplicates); slide 3 active with gender×region crosstab |
| Per-slide state | **Pass** | Slide 1 empty (suggestions shown); slide 3 has full table — per-slide configs persist |
| Theme on reopen | **Note** | Mission Control from prior session → Soft Machine after reopen (theme persistence TBD) |
| SAV upload + multi-dataset switch | **Pass (automated)** | `npm run test:e2e -- tests/e2e/workspace-switch.spec.ts` — 7.3s, OPFS + switch without re-upload |

**J2 success criteria met** for mock example path and for SAV/OPFS via Playwright. Browser agent cannot attach files to `<input type="file">`; keep Playwright in the program for F2/F4 ingest.

## UI observations (big picture)

**Strengths**

- Workspace library metaphor is clear: tabs, search, prominent Upload, storage meter.
- Return-to-Workspace is discoverable and fast; no data-loss anxiety on navigation.
- Reopen path is the stabilization win — deck and active analysis return correctly for `mock_data.csv`.

**Risks**

- Projects and list-view empty/broken states undermine polish for organizing work.
- Misleading `0 B` on cards erodes trust next to accurate storage meter.
- Starred tab showing datasets without an explicit user star action needs product clarification.

## Heuristic snapshot (Workspace)

| # | Heuristic | Score (0–4) | Comment |
| :---: | :--- | :---: | :--- |
| 1 | Visibility of system status | 1 | Storage meter good; file size wrong |
| 6 | Recognition vs recall | 1 | Projects tab gives no guidance |
| 8 | Aesthetic & minimalist | 1 | Projects blank panel feels unfinished |

## Console

- One historical MIME/module warning in log (worker); no new errors during Session 1 interactions.

## Next session

**Session 2** — J3 Canvas analysis core: filters, chart toggle, weight, statistical settings (F1). Fix or avoid `D` shortcut (UXR-000) before deck-heavy testing.
