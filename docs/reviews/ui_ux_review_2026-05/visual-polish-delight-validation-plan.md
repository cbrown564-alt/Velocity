# Visual Polish Delight — Validation & Multi-Session Test Plan

**Date:** May 20, 2026  
**Status:** VP-D-01–09 automation **complete**; §12 frame-it **No** (May 20, 2026, human reviewer) — MC crosstab + chart fail “screenshot-ready”; UXP-033–035 polish required before re-test  
**Owner:** Product + engineering (assign per run in session log)  
**Scope:** Live validation of `STAB-UI-D` delight layer described in `visual-polish-vision-delight.md`  
**Builds on:** `visual-polish-review.md` (UXP-001–032), `plan_01_comprehensive_ui_ux_review.md`, `session-02-canvas.md`, `session-04-variable-manager.md`, `session-07-themes.md`

---

## 1. Current priorities

### 1.1 What’s done

The **Analysis Canvas crosstab** path is signed off. VP-D-01 through VP-D-05 (May 20, 2026) validated pathways P1–P10 and features D-001–024 on port 4176 with `mock_data.csv`. D-015 (DnD micro-delight) passes headless. Theme materials D-025–027 have table-only screenshots on all three themes.

Evidence lives under `docs/reviews/ui_ux_review_2026-05/screenshots/vp-d-01/` … `vp-d-05/`.

### 1.2 What’s blocking sign-off

Crosstab coverage alone does not answer **§12 “Would You Frame It?”** for the product. Remaining work:

| Priority | Session | Scope | IDs | Pass criteria |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | **STAB-UI-D polish** | Visual hierarchy on hero output | UXP-033–035 | MC chart palette + footer χ² + cell `n=` warning color; re-run frame-it after fix |
| **P2** | After UXP-033–035 | Frame-it re-test | §12 | Human reviewer **Yes** on MC crosstab + chart (+ Manager inspector optional) |

**Rule:** Do not mark `visual-polish-vision-delight.md` as fully validated until the product-wide track below is complete.

### 1.3 Sign-off checklist

**Crosstab track (done)**

- [x] P1–P10 Pass or documented N/A — crosstab paths including D-015 headless
- [x] D-001–024 Pass on live browser (crosstab-scoped)
- [x] D-025–027 partial (table screenshots per theme)

**Product-wide track (remaining)**

- [x] D-030–031 Chart mode Pass with screenshots (VP-D-06; D-030 **mostly pass** — no stats footer on chart, settling N/A)
- [x] D-040–042 Variable Manager + inspector Pass or gaps filed as UXP (VP-D-07; D-041 distribution confirmed live, headless stats flake)
- [x] Theme matrix (§5) — chart (VP-D-06), statistics footer + export modal × SM/MC/LG (VP-D-08)
- [x] Theme matrix stretch rows — workspace card, timeline dock, Manager overlay (VP-D-09)
- [x] `visual-polish-vision-delight.md` §10 links VP-D-01–08 runs
- [x] **§12 “Would You Frame It?”** — **No** (May 20, 2026) — MC `vp-d-05/01` + `vp-d-06/05-chart-theme-mc`; SM/LG better but not ready; see §6 Frame-it

### 1.4 Next session playbook

Implement **UXP-033–035** (visual hierarchy), then re-run frame-it on MC artifacts.

| Session | First steps | Evidence target |
| :--- | :--- | :--- |
| **Frame-it (re-test)** | Regenerate MC crosstab + chart shots after UXP-033–035; human §12 review | New **Yes/No** in §6; only sign off vision doc when **Yes** |

**Automation backlog (supports next runs):**

| Priority | Action | Status |
| :--- | :--- | :--- |
| P1 | Playwright visual regression: 3 themes × table | Open |
| P1 | Chart mode eval path (`VP_D_RUN=06`) | Done |
| P1 | Variable Manager eval path (`VP_D_RUN=07`) | Done |
| P1 | Theme matrix eval path (`VP_D_RUN=08`) | Done |
| P2 | Stretch theme surfaces (`VP_D_RUN=09`) | Done |
| P2 | Story Shelf timing test with clock mock | Open |
| P2 | `prefers-reduced-motion` e2e via `emulateMedia` | Open |

Completed automation: `tests/e2e/visual-polish-crosstab.spec.ts`, OPFS isolation, eval script fixes, Story Shelf seed, D-015 headless testids.

---

## 2. Validation scope

Runs **VP-D-01 through VP-D-05** exercised the **Analysis Canvas crosstab** deeply — correctly, since it is where users spend most analysis time. That is **not** sufficient for product-wide delight sign-off.

| Surface | VP-D coverage | Why it matters |
| :--- | :--- | :--- |
| **Crosstab (table)** | Deep (P1–P10, D-001–024) | Hero output; frame-it question **answerable for table only** |
| **Chart mode** | VP-D-06 (D-030–031) | Shared `AnalysisOutputFrame`; chart path lacks stats footer band |
| **Variable Manager** | VP-D-07 (D-040–042) | Mode boundary, Miller nav, facets, bulk bar; UXR-018 fixed (`managerSearchQuery`) |
| **Inspector (in Manager)** | VP-D-07 (D-041) | Distribution + value mapping pass live; headless stats load flaky |
| **Theme × surface matrix (§5)** | Full matrix VP-D-02/06/08/09 (table, chart, footer, export, workspace, dock, Manager) | Materials hold; frame-it still **No** on MC hero output |

**Relationship to tracker `STAB-UI-D`:** Tracker §4.7 lists STAB-UI-D as UXR remediation. This plan validates the **delight layer** from the vision doc — a distinct but overlapping workstream. Close UXR items via `findings.md`; use `D-###` IDs here for polish validation only.

---

## 3. Session preconditions

| Requirement | Detail |
| :--- | :--- |
| **Single tab rule** | Close all other Velocity tabs before starting |
| **Dedicated port** | e.g. `npm run dev -- --port 4176 --host 127.0.0.1` |
| **Primary fixture** | F1 `mock_data.csv` via Load Example |
| **Secondary fixture** | F2 `test_data/fixtures/test_small.sav` for small-base cells |
| **Pre-built deck** | Optional: `evals/eval-04/runs/run-2026-03-13/artifacts/browser_session.velocity` |
| **Viewport** | 1440×900 desktop; 1100px width for responsive pass |
| **Evidence folder** | `tmp/visual-polish-eval/` or `docs/reviews/ui_ux_review_2026-05/screenshots/` |
| **Screenshot naming** | `{theme}-{feature}-{state}.png` (e.g. `mc-column-guide-hover.png`) |
| **Console capture** | Required on every Fail; mandatory for blank-viewport incidents |
| **Reduced motion pass** | Second run with OS “Reduce motion” enabled |

---

## 4. Feature matrix — upcoming (Phase 4)

Update **Status** each session: `Not run` | `Pass` | `Fail` | `Blocked` | `N/A`

| ID | Surface | Focus questions | Status |
| :--- | :--- | :--- | :--- |
| D-030 | Chart mode | `AnalysisOutputFrame` parity with table; bar settle/transition; legend/footer; SM/MC/LG readability | **Mostly pass** (VP-D-06) — frame + legend + 3 themes; chart lacks `StatisticsStatusBar` footer; settling scale N/A on bars |
| D-031 | Chart ↔ table toggle | View switch preserves slide artifact; no layout jump | **Pass** (VP-D-06) — width/position stable; height delta expected |
| D-040 | Variable Manager shell | Mode boundary (blur, Esc), Miller nav, search/facet affordances, bulk bar | **Pass** (VP-D-07) |
| D-041 | Inspector panel | Distribution chart, value mapping density, inline label edit, type badge hierarchy | **Pass** (VP-D-07 live; Playwright headless misses stats load) |
| D-042 | Manager ↔ Canvas link | Bi-directional focus, shared tokens, no search leak into canvas (`UXR-018`) | **Pass** (VP-D-07; isolated `managerSearchQuery`) |

**References:** `session-02-canvas.md` (chart), `session-04-variable-manager.md`, `session-07-themes.md`, `visual-polish-review.md` UXP-022–023.

---

## 5. Theme × surface matrix

Run D-001–005 and D-020, D-025–027 on each theme after P1 passes. **Dedicated VP-D-08 session** — do not fold into crosstab runs.

| Surface | Soft Machine | Mission Control | Liquid Glass |
| :--- | :---: | :---: | :---: |
| Workspace card | Pass | Pass | Pass |
| Canvas empty state | Pass | Not run | Not run |
| Crosstab table | Pass | Pass | Pass |
| Presentation density | Pass | Not run | Not run |
| Focus mode | Pass | — | — |
| Reduced motion table | Pass | — | — |
| Grouped bar chart | Pass | Pass | Pass |
| Statistics footer | Pass | Pass | Pass |
| Export modal | Pass | Pass | Pass |
| Timeline dock | Pass | Pass | Pass |
| Manager overlay | Pass | Pass | Pass |

Baseline reference: `session-07-themes.md` — re-run after STAB-UI-D delight validation.

---

## 6. Session log

| Run | Date | Driver | Build | Scope | Outcome | Next action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| VP-D-06 | 2026-05-20 | Agent (Playwright) | 4176 | Chart mode (D-030–031) | **Mostly pass** | Evidence `screenshots/vp-d-06/`; run VP-D-07 Manager |
| VP-D-07 | 2026-05-20 | Agent (Playwright + live browser) | 4176 | Variable Manager + inspector (D-040–042) | **Pass** | Evidence `screenshots/vp-d-07/`; run VP-D-08 theme matrix |
| VP-D-08 | 2026-05-20 | Agent (Playwright) | 4176 | Theme × surface matrix (§5) | **Pass** | Evidence `screenshots/vp-d-08/`; §12 frame-it synthesis |
| VP-D-09 | 2026-05-20 | Agent (Playwright) | 4176 | Stretch surfaces (§5) | **Pass** | Evidence `screenshots/vp-d-09/`; workspace + dock + Manager × 3 themes |
| Frame-it | 2026-05-20 | Human reviewer (product) | 4176 | §12 synthesis | **No** | MC crosstab + chart; UXP-033–035 filed; Manager inspector not reviewed |

### VP-D-06 notes (2026-05-20)

**Driver:** Playwright `VP_D_RUN=06` on `127.0.0.1:4176`  
**Fixture:** gender×region grouped horizontal bar (mock_data.csv)

| Check | Result | Detail |
| :--- | :--- | :--- |
| D-030 Analysis Frame — table | Pass | `.analysis-frame` wraps crosstab |
| D-030 Analysis Frame — chart | Pass | Same frame wraps chart canvas (`role="img"`) |
| D-030 Legend | Pass | Region labels + color key readable (SM truncates in axis labels only — UXR-011) |
| D-030 Stats footer | Gap | Table has `StatisticsStatusBar`; chart path has no footer band |
| D-030 Settling scale | N/A | 0 `data-animated` on chart bars (table-only feature today) |
| D-030 Themes SM/MC/LG | Pass | `05-chart-theme-{sm,mc,lg}.png` |
| D-031 Toggle artifact | Pass | Table restores with 12 % cells after chart round-trip |
| D-031 Layout jump | Pass | Frame x/y/width stable; height 229→482 (expected for chart) |

Evidence: `screenshots/vp-d-06/` (7 PNGs).

### VP-D-07 notes (2026-05-20)

**Driver:** Playwright `VP_D_RUN=07` + live browser confirmation on `127.0.0.1:4176`  
**Fixture:** mock_data.csv → Variable Manager → gender inspector

| Check | Result | Detail |
| :--- | :--- | :--- |
| D-040 Canvas recedes | Pass | `scale(0.95)` + `blur(4px)` on hub |
| D-040 Miller columns | Pass | Sources / Folders / Variable Sets |
| D-040 Facets + bulk | Pass | Type/Status/Quality; ⌘A bulk bar |
| D-041 Distribution + mapping | Pass (live) | Headless eval flaky until worker stats load |
| D-041 Inline label edit | Pass | Click title → input; Esc cancels |
| D-042 Search isolation | Pass | `managerSearchQuery` does not filter Canvas sidebar (UXR-018 remediated) |

Evidence: `screenshots/vp-d-07/` (4 PNGs).

### VP-D-08 notes (2026-05-20)

**Driver:** Playwright `VP_D_RUN=08` on `127.0.0.1:4176`  
**Fixture:** gender×region crosstab (mock_data.csv)

| Check | Result | Detail |
| :--- | :--- | :--- |
| Statistics footer — SM | Pass | Welch's T · Cell vs Rest; χ² badge; sig legend |
| Statistics footer — MC | Pass | Same methodology strip; MC material tokens |
| Statistics footer — LG | Pass | Frosted footer band readable (frosted footer from Phase 3) |
| Export modal — SM | Pass | PPTX tile + table frame behind modal |
| Export modal — MC | Pass | Token-consistent dark panel |
| Export modal — LG | Pass | Previously marked N/A in §5; modal opens and reads cleanly |

Evidence: `screenshots/vp-d-08/` (6 PNGs: `01-footer-theme-{sm,mc,lg}`, `02-export-modal-theme-{sm,mc,lg}`).

### VP-D-09 notes (2026-05-20)

**Driver:** Playwright `VP_D_RUN=09` on `127.0.0.1:4176`  
**Fixture:** gender×region crosstab → per-theme workspace / dock / Manager captures

| Check | Result | Detail |
| :--- | :--- | :--- |
| Timeline dock — SM/MC/LG | Pass | Slide counter (`N / M`) + New Slide control visible on Canvas |
| Workspace card — SM/MC/LG | Pass | Return-to-workspace → `Velocity Workspace` + `mock_data` dataset card |
| Manager overlay — SM/MC/LG | Pass | Glass shell + Miller columns after reopen from workspace |

Evidence: `screenshots/vp-d-09/` (9 PNGs: `01-timeline-dock-theme-{sm,mc,lg}`, `02-workspace-card-theme-{sm,mc,lg}`, `03-manager-overlay-theme-{sm,mc,lg}`).

**Note:** `index.css` defines `.timeline-dock` theme tokens, but `TimelineDock.tsx` does not apply that class — eval targets the live film-strip rail (border-t footer band).

### Frame-it synthesis (§12) — 2026-05-20

**Reviewer:** Product (human)  
**Artifacts reviewed:** `vp-d-05/01-crosstab-compact-mc-frame-it.png`, `vp-d-06/05-chart-theme-mc.png`  
**Not reviewed this pass:** `vp-d-07/02-inspector-gender.png`

| Artifact | Verdict | Rationale |
| :--- | :---: | :--- |
| MC crosstab (`vp-d-05/01`) | **No** | Orange cell `n=` (small-base warning) draws too much attention; green χ² badge in footer competes with data; overall not “screenshot-ready” |
| MC chart (`vp-d-06/05-chart-theme-mc`) | **No** | Multi-hue / “rainbow” region palette on dark MC chrome does not read as one coherent instrument |
| SM / LG (informal) | **No** (provisional) | Less harsh than MC; still not frame-ready |

**Product-wide §12 verdict:** **No** — does not meet vision doc §8 (“feel proud pasting into a deck without cropping”).

**Filed as polish work (extends UXP-005, UXP-012, UXR-031):**

| ID | Issue | Direction |
| :--- | :--- | :--- |
| **UXP-033** | MC grouped-bar chart uses high-saturation multi-hue series on dark panel | Theme-scoped chart palette: fewer hues, muted fills, or sequential ramp; align with “flight instrument” metaphor |
| **UXP-034** | Footer χ² result uses success green even when p ≥ 0.05 — reads as “good news” | Demote insignificance: `text-secondary` only, or move χ² to second line per UXP-005; reserve green for p &lt; 0.05 only |
| **UXP-035** | Small-base `n=` uses `--status-warning-text` (orange on MC) at full cell prominence | Whisper: smaller type, muted token, or footnote style; consider UXP-040 toggle for deck mode |

Cross-reference: `findings.md` UXR-049–051; `visual-polish-review.md` Tier 4b.

**Run naming:** `VP-D-##` (Visual Polish — Delight validation run).

---

## 7. Historical — crosstab validation (May 20, 2026)

VP-D-00 through VP-D-05 established test-backed, live-browser confidence on the crosstab path. This section is **archival**; do not re-run unless regressions appear.

### 7.1 Executive summary

**Method:** Cursor IDE browser agent; Playwright script `scripts/eval/visual-polish-browser-eval.mjs`  
**Builds:** `127.0.0.1:4174` (existing OPFS session), `4175`, `4176` (isolated origins)  
**Fixture:** F1 `mock_data.csv` via Load Example

Implementation confidence is **test-backed and crosstab-validated** on port 4176. VP-D-01/02 confirmed gender×region crosstab after fixing a **DataTable hooks-order crash**. VP-D-03 fixed Story Shelf; D-022/023 pass. VP-D-04 closed D-003, P9–P10; D-015 drop pass. VP-D-05 passed D-024 dismiss and D-020 halo-high on fresh mock_data.

### 7.2 Blockers resolved

| Blocker | Mitigation |
| :--- | :--- |
| OPFS multi-tab lock (4174) | Single tab per origin; dedicated port; clear OPFS in e2e setup |
| Blank viewport (4176) | Fixed `DataTable` hooks violation (`useMemo`/`useCallback` after early return); regression test in `DataTable.test.tsx` |
| Playwright headless empty page (4175) | Use `tests/e2e/visual-polish-crosstab.spec.ts` + eval script on dedicated port |

### 7.3 Completed session log

| Run | Outcome |
| :--- | :--- |
| VP-D-00 | **Blocked** — OPFS lock (4174); blank viewport (hooks bug in `DataTable`) |
| VP-D-01 | **Pass** — P1 + Phase 1 (D-001, D-004–005); 5 screenshots |
| VP-D-02 | **Mostly pass** — D-010–014, D-012, D-002; Story Shelf blocked (`Analysis 1` title) |
| VP-D-03 | **Pass** — D-022/023; hooks/`tableStats` fix; `slidesSlice` seeds `New Slide` |
| VP-D-04 | **Mostly pass** — D-003, P9–P10; D-015 drop ok; D-020 intermittent |
| VP-D-05 | **Pass** (crosstab) — D-024, D-020/021; §12 deferred (table-only scope) |

### 7.4 Completed pathways (P1–P10)

| ID | Pathway | Status |
| :--- | :--- | :--- |
| P1 | Crosstab render gate | **Pass** (VP-D-01) |
| P2 | Column guide | **Pass** |
| P3 | Presentation density | **Pass** |
| P4 | Focus mode breathing | **Pass** (VP-D-02) |
| P5 | Filter re-animate | **Pass** |
| P6 | Insight halo | **Pass** (VP-D-05: 3 high, 1 mid on gender×region) |
| P7 | Story shelf | **Pass** (VP-D-03) |
| P8 | Theme cycle | **Partial** (table screenshots all themes) |
| P9 | Workspace reopen | **Pass** (VP-D-04) |
| P10 | Export artifact | **Pass** (VP-D-04) |

### 7.5 Completed feature matrix (Phases 1–3)

| ID | Feature | Status | Evidence |
| :--- | :--- | :--- | :--- |
| D-001 | Trust Anchor — `n=` visible | **Pass** | `screenshots/sm-crosstab-compact.png` |
| D-002 | Trust Anchor — small base | **Pass** | VP-D-02: 7–9 cells on mock_data gender×region |
| D-003 | Trust Anchor — zero/missing | **Pass** | VP-D-04: 11 em-dash cells |
| D-004 | Column Guide | **Pass** | `screenshots/sm-column-guide-hover.png` |
| D-005 | Analysis Frame | **Pass** | `.analysis-frame` in eval + screenshot |
| D-010 | Settling Scale — mount | **Pass** | VP-D-02 |
| D-011 | Settling Scale — filter | **Pass** | NPS Promoter filter |
| D-012 | Settling Scale — reduced motion | **Pass** | 0 animated spans under reduce |
| D-013 | Focus Breathing — toggle | **Pass** | `screenshots/vp-d-02/03-presentation-density.png` |
| D-014 | Focus Breathing — focus mode | **Pass** | `screenshots/vp-d-02/04-focus-mode.png` |
| D-015 | DnD micro-delight | **Pass** | Headless: overlay + drop testids |
| D-020 | Insight Halo — 95% | **Pass** | VP-D-05: 3 high on gender×region |
| D-021 | Insight Halo — 80% | **Pass** | VP-D-05: 1 mid |
| D-022 | Story Shelf — generate | **Pass** | `screenshots/vp-d-03/05-story-shelf.png` |
| D-023 | Story Shelf — accept | **Pass** | VP-D-03 eval |
| D-024 | Story Shelf — dismiss | **Pass** | VP-D-05: chip gone at 8.5s |
| D-025 | MC flight instrument | **Partial** | `screenshots/vp-d-02/08-theme-mc.png` |
| D-026 | SM research journal | **Pass** | `screenshots/vp-d-02/01-crosstab-compact.png` |
| D-027 | LG holographic | **Partial** | `screenshots/vp-d-02/08-theme-lg.png` |

### 7.6 Pre-crosstab checks (VP-D-01 recon)

| Area | Result |
| :--- | :--- |
| Workspace onboarding | Pass |
| Load Example | Pass |
| Empty state | Pass |
| Toolbar chrome | Pass |
| Slide header scaffold | Pass |

### 7.7 Code review risk register (archival)

| Feature | Risk | Concern |
| :--- | :--- | :--- |
| Settling Scale (`AnimatedNumber`) | Medium | MotionValue as JSX child; re-animates on every `animationKey` change |
| Phosphor ghost (`CrosstabCell`) | Low–Medium | DOM theme read during render; absolute ghost overlay |
| Insight Halo | Low | 4–6% opacity — may be invisible in screenshots without sig cells |
| Story Shelf | Medium | 3s auto-dismiss easy to miss manually |
| Focus Breathing | Low | Focus mode must restore prior density on exit |
| Column Guide | Low | Verify no layout shift on hover |
| Trust Anchor | Low | mock_data may lack `n < 30` cells — need sparse fixture |
| Theme materials | Medium | CSS-only; needs per-theme screenshot baselines |
| Analysis Frame | Low | Risk of double-card nesting (UXP-022) |

---

## 8. Regression watchlist

Verify after any delight-layer change. Components from vision doc §10.

| Component | Delight features | Automated guard |
| :--- | :--- | :--- |
| `CrosstabCell.tsx` | Trust Anchor, Settling Scale, phosphor | `CrosstabCell.test.tsx` + D-001–003, D-010–011 |
| `DataTable.tsx` | Frame, Column Guide, Halo, density, animationKey | `DataTable.test.tsx` + D-004–005, D-020–021 |
| `AnimatedNumber.tsx` | Settling Scale | `AnimatedNumber.test.tsx` + D-010–012 |
| `SlideHeader.tsx` | Story Shelf | `SlideHeader.test.tsx` + D-022–024 |
| `DashboardShell.tsx` | Focus Breathing, DnD overlay | D-013–015 |
| `SlideContainer.tsx` | Suggested variables, density prop | Empty state + D-013 |
| `uiSlice.ts` | `tableDensity` | D-014 focus restore |
| `index.css` | Halo tokens, theme materials | `index.css.test.ts` + D-025–027 |
| `themes.ts` / `tailwind.config.cjs` | Material tokens | `npm run check:design-tokens` |

---

*Living document — update §1 sign-off checklist, §4–5 matrices, and §6 session log after each validation run.*
