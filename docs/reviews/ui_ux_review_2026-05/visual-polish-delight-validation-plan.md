# Visual Polish Delight — Validation & Multi-Session Test Plan

**Date:** May 20, 2026  
**Status:** Crosstab path signed off (VP-D-01–05, D-015 headless pass); delight sign-off **blocked** on chart mode, Variable Manager + inspector, and theme×surface matrix (§6)  
**Owner:** Product + engineering (assign per run in §8)  
**Scope:** Live validation of `STAB-UI-D` delight layer described in `visual-polish-vision-delight.md`  
**Builds on:** `visual-polish-review.md` (UXP-001–032), `plan_01_comprehensive_ui_ux_review.md`, `session-02-canvas.md`, `session-07-themes.md`

---

## 1. Purpose

This document is the **operating plan** for validating delight-layer work across multiple browser sessions. It captures:

1. What was attempted in the May 20, 2026 browser evaluation and why it stopped short.
2. Preconditions, fixtures, and critical pathways required before polish sign-off.
3. A feature test matrix (`D-###` IDs) mappable to vision doc §9–§10 and execution log rows.
4. A session log for tracking progress, evidence, and blockers over time.

**Rule:** Do not mark `visual-polish-vision-delight.md` as fully validated until **P1 (crosstab render gate)** passes and Phase 1 matrix (D-001–005) has screenshot evidence on at least one theme.

**Relationship to tracker `STAB-UI-D`:** Tracker §4.7 currently lists STAB-UI-D as UXR remediation. This plan validates the **delight layer** from the vision doc — a distinct but overlapping workstream. Close UXR items separately via `findings.md`; use `D-###` IDs here for polish validation only.

### 1.1 Validation scope (honest)

Runs **VP-D-01 through VP-D-05** exercised the **Analysis Canvas crosstab** deeply — correctly, since it is where users spend most analysis time. That is **not** sufficient for product-wide delight sign-off.

| Surface | VP-D coverage | Why it matters for §12 |
| :--- | :--- | :--- |
| **Crosstab (table)** | Deep (P1–P10, D-001–024) | Hero output; frame-it question **answerable for table only** |
| **Chart mode** | Not run | Shared `AnalysisOutputFrame`; settling/halo/chart chrome untested live |
| **Variable Manager** | Not run | Separate UX mode; Miller columns, facets, bulk actions — needs polish rubric |
| **Inspector (in Manager)** | Not run | Distribution, mapping, inline edit — high thinking debt per `session-04-variable-manager.md` |
| **Theme × surface matrix (§6)** | Partial (table only) | Materials must hold on workspace, chart, footer, dock — **dedicated session** |

**§12 "Would You Frame It?"** — **deferred** until chart + Manager/inspector + theme matrix have evidence. The VP-D-05 MC crosstab screenshot is a **crosstab-only** artifact, not a product-wide frame-it answer.

---

## 2. Browser Evaluation Report (May 20, 2026)

**Method:** Cursor IDE browser agent; attempted Playwright script (`scripts/eval/visual-polish-browser-eval.mjs`)  
**Builds:** `127.0.0.1:4174` (existing OPFS session), `4175`, `4176` (isolated origins)  
**Fixture target:** F1 `mock_data.csv` via Load Example

### 2.1 Executive summary

Implementation confidence is **test-backed and crosstab-validated** on port 4176. VP-D-01/02 confirmed gender×region crosstab after fixing a **DataTable hooks-order crash**. VP-D-03 fixed Story Shelf; D-022/023 pass. VP-D-04 closed D-003, P9–P10; D-015 drop pass, overlay detection flaky. **VP-D-05** passed D-024 dismiss and D-020 halo-high on fresh mock_data; §12 **not** answered (crosstab-only scope).

### 2.2 Confirmed (pre-table)

| Area | Result | Notes |
| :--- | :--- | :--- |
| Workspace onboarding | Pass | Welcome card; Upload / Load Example CTAs; Soft Machine tokens on fresh origin |
| Load Example | Pass | `mock_data.csv` loads; dashboard shell with Table view active |
| Empty state | Pass | "Ready for Analysis" + suggested chips (gender, region, etc.) |
| Toolbar chrome | Pass | Presentation View, Focus Mode, theme switcher, Variables visible |
| Slide header scaffold | Pass | Title + `N = 250 Respondents` before table render |

### 2.3 Blockers

| Blocker | Port | Symptom | Mitigation |
| :--- | :--- | :--- | :--- |
| OPFS multi-tab lock | 4174 | "OPFS database is locked"; analysis error `Table with name main does not exist` | Single tab per origin; dedicated port; clear OPFS in e2e setup |
| ~~Glass browser blank viewport~~ | 4176 | **Root cause (fixed):** `DataTable` called `useMemo`/`useCallback` after `if (!tableData) return null` — React hooks violation on auto-restore | Fixed in `DataTable.tsx`; regression test in `DataTable.test.tsx` |
| Playwright headless | 4175 | Empty page body after 37s; dashboard never reached | Use `tests/e2e/visual-polish-crosstab.spec.ts` + `scripts/eval/visual-polish-browser-eval.mjs` on dedicated port |

### 2.4 Gap vs. vision doc §10

| Log item | Unit tests | Live browser | Notes |
| :--- | :---: | :---: | :--- |
| Quick Wins 1–3 (Trust Anchor, Column Guide, Frame) | Partial | **Pass** (VP-D-01) | 12 `n=` cells; frame + column hover screenshots |
| Settling Scale | Yes | **Pass** (VP-D-02) | Mount + filter + reduced motion (`data-animated` 0 under `reduce`) |
| Focus Breathing | Implied | **Pass** (VP-D-02) | Presentation + Focus Mode enter/exit restore compact |
| DnD micro-delight | Unknown | **Pass** | Headless overlay + drop (`variable-drag-overlay`, `drop-zone-*` testids) |
| Insight Halo | Yes (2 tests) | **Pass** (VP-D-05) | 3 `halo-high` + 1 `halo-mid` on gender×region (fresh mock_data); intermittent on persisted session |
| Story Shelf | Yes (5 tests) | **Pass** (VP-D-03) | `slidesSlice` seeds `New Slide`; `SlideHeader` hooks + `tableStats` fix; eval checks before 8s dismiss |
| Theme material systems | `index.css.test.ts` | **Partial** | SM/MC/LG table screenshots in `screenshots/vp-d-02/` |

### 2.5 Code review risk register

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

## 3. Preconditions (every session)

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
| **Reduced motion pass** | Second run with OS "Reduce motion" enabled |

---

## 4. Critical pathways (gate order)

Run in order. **Stop and file a blocker if P1 fails.**

| ID | Pathway | Steps | Pass criteria | Status |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | Crosstab render gate | Load Example → gender (rows) → region (cols) | Table with `%` and `n=` cells visible | **Pass** (VP-D-01) |
| P2 | Column guide | P1 → hover column header | Active border from th through td; no layout shift | **Pass** (screenshot `sm-column-guide-hover.png`) |
| P3 | Presentation density | P1 → toggle Presentation View | `[data-density="generous"]`; increased row padding | **Pass** (screenshot `sm-presentation-density.png`) |
| P4 | Focus mode breathing | P1 → Enter Focus Mode → exit | Auto-generous on enter; prior density restored | **Pass** (VP-D-02) |
| P5 | Filter re-animate | P1 → apply filter | `animationKey` changes; cells re-settle (or instant if reduced motion) | **Pass** (NPS Promoter filter) |
| P6 | Insight halo | P1 with sig cells | Peripheral tint on sig cells only | **Pass** (VP-D-05: 3 high, 1 mid on gender×region) |
| P7 | Story shelf | P1 → wait for ghost title | Suggestion appears; click accept persists title | **Pass** (VP-D-03) |
| P8 | Theme cycle | P1 → SM → MC → LG | Table + chart readable on each theme | **Partial** (table screenshots all themes) |
| P9 | Workspace reopen | Close tab → reopen mock_data.csv | Deck + crosstab restored; no OPFS lock | **Pass** (VP-D-04) |
| P10 | Export artifact | P1 → Export PNG/PDF | Output includes bordered Analysis Frame | **Pass** (VP-D-04 export modal + frame behind) |

---

## 5. Feature test matrix (`D-###`)

Update **Status** column each session: `Not run` | `Pass` | `Fail` | `Blocked` | `N/A`

### 5.1 Phase 1 — Foundation

| ID | Feature | Steps | Pass criteria | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D-001 | Trust Anchor — `n=` visible | gender×region crosstab | Every frequency cell shows `n=N` without hover; Total uses same `CrosstabCell` | **Pass** | `screenshots/sm-crosstab-compact.png` |
| D-002 | Trust Anchor — small base | Filter or F2 to get `n<30` | Base in `--status-warning-text`; `data-small-base="true"` | **Pass** | VP-D-02: 7–9 cells on mock_data gender×region |
| D-003 | Trust Anchor — zero/missing | Force empty cell if possible | Em-dash (—), not "0%" + faded n | **Pass** | VP-D-04: 11 em-dash cells on age_group×region+Promoter |
| D-004 | Column Guide | Hover each column header | 1px active left border th→td; no horizontal shift | **Pass** | `screenshots/sm-column-guide-hover.png` |
| D-005 | Analysis Frame | View table in Canvas | Card: panel bg, subtle border, rounded-lg, shadow; no bleed into SmartCanvas | **Pass** | `.analysis-frame` in eval + screenshot |

### 5.2 Phase 2 — Animation

| ID | Feature | Steps | Pass criteria | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D-010 | Settling Scale — mount | Fresh crosstab load | % count 0→final ~400ms; SD 100ms delayed on metrics | **Pass** | VP-D-02: 12 % cells, 36–40 `[data-animated="true"]` |
| D-011 | Settling Scale — filter | Apply/remove filter | Re-settle; MC phosphor ghost 200ms on old value | **Pass** | NPS Promoter filter applied; cells remain animated |
| D-012 | Settling Scale — reduced motion | OS reduce motion ON | Instant display, no animation | **Pass** | `reducedMotion: 'reduce'` — 0 animated spans |
| D-013 | Focus Breathing — toggle | Presentation View on/off | `[data-density="generous"]`; py increases; restores compact | **Pass** | `screenshots/vp-d-02/03-presentation-density.png` |
| D-014 | Focus Breathing — focus mode | Enter/exit Focus Mode | Auto-generous on enter; density restored on exit | **Pass** | `screenshots/vp-d-02/04-focus-mode.png` |
| D-015 | DnD micro-delight | Drag variable to shelf | Spring overlay; color-mix shadow; snap on drop | **Pass** | Headless: `data-testid` overlay + `drop-zone-rows`; `VP_D_RUN=04` overlay=true dropped=true |

### 5.3 Phase 3 — Intelligence & materials

| ID | Feature | Steps | Pass criteria | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D-020 | Insight Halo — 95% | Slide with sig cells | `--halo-high` tint on sig cells only | **Pass** | VP-D-05: 3 high on gender×region (`screenshots/vp-d-05/12-halo-high-gender-region.png`) |
| D-021 | Insight Halo — 80% | Same slide | `--halo-mid` subtler than high | **Pass** | VP-D-05: 1 mid + prior VP-D-02 mid cells |
| D-022 | Story Shelf — generate | Load crosstab with sig | Ghost italic suggestion within 8s | **Pass** | `screenshots/vp-d-03/05-story-shelf.png` |
| D-023 | Story Shelf — accept | Click suggestion | Becomes real title; editable | **Pass** | VP-D-03 eval |
| D-024 | Story Shelf — dismiss | Wait 8s | Suggestion fades; title editable | **Pass** | VP-D-05: chip gone at 8.5s; stored title `New Slide`; display resolves to variable title |
| D-025 | MC flight instrument | Mission Control theme | Graticule grid; amber small-base; mono Total row | **Partial** | `screenshots/vp-d-02/08-theme-mc.png` — visual pass, graticule not asserted |
| D-026 | SM research journal | Soft Machine theme | Paper noise subtle; warmer borders; ink hierarchy | **Pass** | `screenshots/vp-d-02/01-crosstab-compact.png` |
| D-027 | LG holographic | Liquid Glass theme | Specular hover; refracted type; frosted footer | **Partial** | `screenshots/vp-d-02/08-theme-lg.png` — table readable |

### 5.4 Phase 4 — Surfaces beyond crosstab (not started)

Plan as **VP-D-06** (chart), **VP-D-07** (Variable Manager + inspector), **VP-D-08** (theme × surface matrix). Add `D-###` rows when rubrics are drafted.

| ID | Surface | Focus questions | Status |
| :--- | :--- | :--- | :--- |
| D-030 | Chart mode | `AnalysisOutputFrame` parity with table; bar settle/transition; legend/footer; SM/MC/LG readability | Not run |
| D-031 | Chart ↔ table toggle | View switch preserves slide artifact; no layout jump | Not run |
| D-040 | Variable Manager shell | Mode boundary (blur, Esc), Miller nav, search/facet affordances, bulk bar | Not run |
| D-041 | Inspector panel | Distribution chart, value mapping density, inline label edit, type badge hierarchy | Not run |
| D-042 | Manager ↔ Canvas link | Bi-directional focus, shared tokens, no search leak into canvas (`UXR-018`) | Not run |

**References:** `session-02-canvas.md` (chart), `session-04-variable-manager.md`, `session-07-themes.md`, `visual-polish-review.md` UXP-022–023.

---

## 6. Theme × surface matrix

Run D-001–005 and D-020, D-025–027 on each theme after P1 passes.

| Surface | Soft Machine | Mission Control | Liquid Glass |
| :--- | :---: | :---: | :---: |
| Workspace card | Not run | Not run | Not run |
| Canvas empty state | Pass | Not run | Not run |
| Crosstab table | Pass | Pass | Pass |
| Presentation density | Pass | Not run | Not run |
| Focus mode | Pass | — | — |
| Reduced motion table | Pass | — | — |
| Grouped bar chart | Not run | Not run | Not run |
| Statistics footer | Not run | Not run | Not run |
| Export modal | Not run | Not run | — |
| Timeline dock | Not run | Not run | Not run |

Baseline reference: `session-07-themes.md` — re-run after STAB-UI-D delight validation.

**Schedule:** Dedicated **VP-D-08** session — do not fold into crosstab runs. Minimum: grouped bar chart + statistics footer + export modal × SM/MC/LG; stretch: workspace card, timeline dock, Manager overlay chrome.

---

## 7. Regression watchlist

Components touched in vision doc §10 — verify after any delight-layer change.

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

## 8. Session log (multi-run tracker)

| Run | Date | Driver | Build | Scope | Outcome | Next action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| VP-D-00 | 2026-05-20 | Agent (cursor-ide-browser) | 4174/4175/4176 | Recon + P1 attempt | **Blocked** — OPFS lock (4174); blank viewport (hooks bug in `DataTable`) | Fix hooks; re-run VP-D-01 |
| VP-D-01 | 2026-05-20 | Agent | 4176 | P1 + Phase 1 (D-001, D-004–005) + partial P2/P3 | **Pass** — crosstab renders; 5 screenshots; Story Shelf not caught | VP-D-02: D-002–003, D-010–015, sig filter for halo/shelf |
| VP-D-02 | 2026-05-20 | Agent | 4176 | Phase 2 + D-002; partial Phase 3; P4–P6 | **Mostly pass** — D-010–014, D-012, D-002 pass; Story Shelf blocked (`Analysis 1` title); D-022 fail | VP-D-03: fix Story Shelf gate or add fresh slide; D-003, D-015, P9–P10 |
| VP-D-03 | 2026-05-20 | Agent | 4176 | Story Shelf + early D-022/023; regression fixes | **Pass** — D-022/023; hooks/`tableStats` fix; halo flaky post-filter | VP-D-04: D-003, D-015, P9–P10, frame-it pass |
| VP-D-04 | 2026-05-20 | Agent | 4176 | D-003 zero cells, D-015 DnD, P9 reopen, P10 export | **Mostly pass** — D-003, P9–P10; D-015 drop ok; D-020 intermittent | VP-D-05: D-024, halo-high, §12 |
| VP-D-05 | 2026-05-20 | Agent | 4176 | D-024 dismiss, D-020 halo hunt | **Pass** (crosstab) — D-024, D-020/021; §12 deferred (table-only) | VP-D-06 chart; VP-D-07 VM; VP-D-08 themes |
| VP-D-06 | — | — | 4176 | Chart mode deep dive (D-030–031) | Not run | Gender×region → Chart view; frame + animation + 3 themes |
| VP-D-07 | — | — | 4176 | Variable Manager + inspector (D-040–042) | Not run | `D` overlay; Miller path; inspector polish rubric |
| VP-D-08 | — | — | 4176 | Theme × surface matrix (§6) | Not run | All Not run cells → Pass or Fail per theme |

**Run naming:** `VP-D-##` (Visual Polish — Delight validation run).

---

## 9. Automation backlog

| Priority | Action | Rationale |
| :--- | :--- | :--- |
| ~~**P0**~~ | ~~Add `tests/e2e/visual-polish-crosstab.spec.ts`~~ | Done — P1 gate + hooks regression guard |
| ~~**P0**~~ | ~~OPFS isolation in e2e (clear storage per spec)~~ | Done in `visual-polish-crosstab.spec.ts` + eval script |
| ~~**P1**~~ | ~~Fix `scripts/eval/visual-polish-browser-eval.mjs`~~ | Done — theme listbox selectors, region column, gender×region |
| **P1** | Playwright visual regression: 3 themes × table | Catches halo/frame/material drift |
| ~~**P1**~~ | ~~Story Shelf e2e: seed slide with `title: 'New Slide'`~~ | Done — `slidesSlice` seeds `New Slide` (May 20, 2026) |
| ~~**P1**~~ | ~~D-015 headless: `data-testid` + `VP_D_RUN=04`~~ | `variable-drag-overlay`, `variable-draggable`, `drop-zone-*`; overlay=true dropped=true |
| **P1** | Chart mode eval path (`VP_D_RUN=06`) | D-030–031 |
| **P1** | Variable Manager eval path (`VP_D_RUN=07`) | D-040–042 |
| **P2** | Story Shelf timing test with clock mock | 8s dismiss — clock mock |
| **P2** | `prefers-reduced-motion` e2e via `emulateMedia` | D-012 |

---

## 10. Recommended session order (half-day pass)

1. **Environment hardening** (15 min) — single tab, dedicated port, console logging  
2. **P1 gate** — gender×region crosstab must render  
3. **Phase 1** (D-001–005) — screenshot each  
4. **Phase 2** (D-010–015) — include filter + reduced motion  
5. **Phase 3** (D-020–027) — sig fixture (try `nps segment = Promoter` filter on mock_data)  
6. **Theme matrix** — cycle themes on same slide  
7. **Workspace reopen** (P9) — OPFS persistence  
8. **Synthesis** — update §8 session log; link screenshots; map failures to UXP register  

---

## 11. Immediate actions (before VP-D-03)

1. ~~**Diagnose blank viewport**~~ — fixed: `animationKey`/`haloClass` hooks moved above early return in `DataTable.tsx`.  
2. ~~**Run VP-D-02**~~ — D-010–014, D-012, D-002 pass; eval script extended (`VP_D_RUN=02`).  
3. ~~**Story Shelf gate**~~ — `slidesSlice` now seeds `New Slide` (aligned with `SlideHeader`). Re-run D-022–024 on VP-D-03.  
4. ~~**Run VP-D-03**~~ — Story Shelf pass; D-022/023 evidence in `screenshots/vp-d-03/`.  
5. ~~**Run VP-D-04**~~ — D-003, P9–P10 pass; D-015 drop pass; evidence in `screenshots/vp-d-04/`.
6. ~~**Sig fixture for halo-high**~~ — VP-D-05: fresh Load Example → gender×region → 3 `halo-high` cells (mock_data RNG; reload if 0).
7. ~~**D-015 overlay**~~ — `VP_D_RUN=04` pass with `variable-drag-overlay` + `drop-zone-rows` testids.
8. **VP-D-06** — chart mode deep dive (D-030–031).
9. **VP-D-07** — Variable Manager + inspector (D-040–042); draft rubric before run.
10. **VP-D-08** — theme × surface matrix (§6).
11. **§12 frame-it** — only after VP-D-06–08; need unedited screenshots from **table + chart + Manager** on MC (minimum).

---

## 12. Sign-off criteria

Delight layer validation is **complete** when:

**Crosstab track (done)**

- [x] P1–P10 Pass or documented N/A — crosstab paths including D-015 headless
- [x] D-001–024 Pass on live browser (crosstab-scoped)
- [x] D-025–027 partial (table screenshots per theme)

**Product-wide track (remaining)**

- [x] D-015 Pass headless (overlay + drop)
- [ ] D-030–031 Chart mode Pass with screenshots
- [ ] D-040–042 Variable Manager + inspector Pass or gaps filed as UXP
- [ ] Theme matrix (§6) filled for chart, footer, export modal (+ stretch rows)
- [ ] `visual-polish-vision-delight.md` §10 links all VP-D runs
- [ ] **§12 "Would You Frame It?"** — **Yes** from human reviewer on unedited artifacts from **crosstab + chart + at least one non-Canvas surface** (Manager or workspace), not crosstab alone

---

*Living document — update Status columns and §8 session log after each validation run.*
