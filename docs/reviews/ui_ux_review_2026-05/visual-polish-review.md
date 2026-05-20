# Visual Polish Review — Making Velocity Look Great

**Date:** May 20, 2026  
**Focus:** Perceived quality, visual coherence, and “product-grade” finish — not defect hunting  
**Complements:** `docs/audit_06_ui_ux_review_2026-05.md` (UXR program outcomes)  
**Delight validation:** `visual-polish-delight-validation-plan.md` (multi-session browser test plan for `visual-polish-vision-delight.md`)  
**Evidence:** Live UI (`mock_data.csv`, Mission Control), `DataTable.tsx`, design system docs  
**IDs:** `UXP-###` (Visual Polish) — separate from `UXR-###` bug register

---

## Why this review exists

The May 2026 comprehensive review (`plan_01_comprehensive_ui_ux_review.md`) optimized for **journey success and trust blockers**. That was the right first pass, but it under-weighted questions like:

- Do numbers **feel anchored** in the layout?
- Is there a **single alignment grammar** for data vs labels?
- Does the interface read as **intentionally designed** or “assembled from good parts”?

This review uses a different rubric. Findings here are not “broken” — they are **polish gaps** that separate a capable tool from one that feels premium (Qualtrics crosstabs, Displayr tables, Bloomberg grids, Apple Numbers).

---

## Review rubric (5 lenses)

| Lens | Question | Fail mode in Velocity today |
| :--- | :--- | :--- |
| **Anchoring** | Does every value have a clear visual “home” under its header / beside its label? | Crosstab % values float mid-column |
| **Rhythm** | Do repeated elements share baselines, gutters, and type scale? | Mixed caps, 10px/11px/14px without hierarchy |
| **Honesty** | Does layout reflect what is visible, not ghost content? | Invisible `n=` still reserves horizontal space |
| **Restraint** | Is density earned, or accidental empty space? | Wide columns with one short number |
| **Presentation** | Would you put this slide in front of a client without tweaking? | Title/subtitle strong; table body feels draft |

Scores below use **impact on “looks great”** (not severity of failure).

---

## Exemplar: Crosstab table (your screenshot)

This is the highest-leverage polish surface — it is the hero output of Analysis Canvas.

### What feels wrong (user-visible)

1. **Percentages look centered/floating** in East–West columns while row labels and column headers are left-aligned.
2. **Total column looks “correct”** (`52.4%` + visible `n=131`) while other columns look empty on the right.
3. **Column headers (EAST, NORTH…)** and **cell values** do not share a vertical edge — the eye cannot scan down a column.
4. **Bottom Total row** shows raw counts (`44`, `48`…) in the same columns as % above — correct statistically, but visually another alignment dialect.

### Root cause (code, not opinion)

Cell layout in `DataTable.tsx` combines three conflicting choices:

```284:326:src/features/dashboard/components/DataTable.tsx
              const cellContent = (
                <div className="flex flex-row items-baseline justify-start gap-2 text-left w-full">
                  ...
                      <div className="flex items-center gap-0.5">
                        <span className={`font-mono text-sm font-bold tabular-nums text-right w-[48px] ${textClass}`}>{cell.percent.toFixed(1)}%</span>
                        ...
                      </motion.div>
                      <span className={`text-[10px] ${secondaryTextClass} font-mono tracking-tight opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>n={cell.count}</span>
```

| Choice | Effect |
| :--- | :--- |
| `<td className="... text-left">` + `<th className="... text-left">` | Table grammar says “labels left” |
| `w-[48px] text-right` on the % | Number box is right-aligned inside a left-aligned cell |
| `opacity-0` on `n={count}` (frequency cells) | Sample size is **invisible but still in flex layout** — reserves width → empty gutter to the right of % |
| Total column (same file, ~387–388) | `n=` is **always visible** — column looks balanced; others look hollow |

So the screenshot is not a rendering bug — it is a **layout policy** problem: hover-reveal metadata was implemented without changing the column’s spatial contract.

Metric cells repeat the pattern (`w-[42px]` + visible secondary stats on hover for SD).

### Recommended direction (UXP-001 — P0 polish)

**Pick one column grammar and enforce it everywhere** (including Total row and footer counts):

| Strategy | When to use | Sketch |
| :--- | :--- | :--- |
| **A. Label-left, number-right (financial table)** | Power users, dense grids | Header left-aligned text; numeric block `text-align: right` flush to column’s right padding; `n=` subline right-aligned under % |
| **B. Label-left, number-left (document table)** | Stakeholder decks, fewer columns | Stack `%` and `n=` left under header; sig arrows inline after % |
| **C. Centered numeric block** | Very narrow columns | Only if header is also centered — rare for survey tools |

**Recommendation:** **A** for Canvas — matches Mission Control / terminal lineage and fixes the “floating” feeling immediately.

**Implementation notes (small, high ROI):**

1. Remove `opacity-0` gutter — use `visibility: hidden` + `position: absolute` for hover `n=`, **or** always show a muted `n=` (preferred for research trust).
2. Drop magic `w-[48px]` / `w-[42px]` — use `min-width` on a `.cell-numeric` class tied to column `w-*` or `table-layout: fixed` + `%` width columns.
3. Align **header label** and **numeric block** to the same right edge (or same left edge if strategy B).
4. Make Total column use the **same cell component** as data cells (today it’s a simplified markup path — asymmetry by construction).

**Acceptance:** A stakeholder can draw a straight vertical line from “EAST” through 47.7% and 52.3% without the numbers drifting.

---

## UXP register (prioritized for “looks great”)

### Tier 1 — Hero surfaces (do first)

| ID | Surface | Issue | Impact | Direction |
| :--- | :--- | :--- | :--- | :--- |
| **UXP-001** | Crosstab cells | Floating % / ghost `n=` gutters | **Critical** — undermines trust in primary output | See exemplar above; single `CrosstabCell` component |
| **UXP-002** | Crosstab column widths | `w-28` columns with ~5 characters of data | High — amplifies emptiness | `table-layout: fixed`; proportional widths; min-width from longest label |
| **UXP-003** | Total row vs body | Counts vs % share columns without visual differentiation | Medium | Subtle row role: smaller type for marginals, or `%` row + separate `Base n` row |
| **UXP-004** | Slide chrome vs table | Title/subtitle in slide padding; table in inner panel — weak “one artifact” | Medium | Optional: bleed table to slide edges in Focus mode; tighten header-to-table gap (`SlideHeader` `padding-bottom: 1rem`) |
| **UXP-005** | Statistics footer | Methodology + χ² + legend compete at 10–11px | Medium | Two-line footer: (1) method + settings, (2) test results; align χ² to numeric column grammar |

### Tier 2 — Typographic coherence

| ID | Surface | Issue | Direction |
| :--- | :--- | :--- | :--- |
| **UXP-010** | Case system | Title `gender by region`, headers `GENDER` / `EAST`, rows `Male` | Document one **case map**: slide title = Title Case; axis headers = UI caps; category labels = sentence case from data |
| **UXP-011** | Mono vs body | Bold mono % + body row labels — good — but headers use body bold caps | Keep mono for **all numeric columns** including Total row counts |
| **UXP-012** | Accent overuse | Column headers, sig arrows, active shelf, focus mode all compete for cyan | Reserve accent for **interactive** and **significant**; headers = `text-secondary` or muted accent |

### Tier 3 — Spatial patterns (app-wide)

| ID | Pattern | Where | Direction |
| :--- | :--- | :--- | :--- |
| **UXP-020** | `opacity-0` + hover reveal | `DataTable` n=, `SlideHeader` pencil, `DraggableVariable` affordances | For **layout-affecting** content: never `opacity-0` in flow. For **chrome**: OK with absolutely positioned icons |
| **UXP-021** | Shelf layout | `w-16` right-aligned “COLUMNS” / “ROWS” vs left-aligned chips | Align shelf labels **left** with slide title for one vertical rhythm |
| **UXP-022** | Nested panels | Canvas: app bg → SmartCanvas padding → panel border → table | One fewer box, or stronger contrast between “workspace” and “slide artifact” |
| **UXP-023** | Chart ↔ table parity | Chart has padding `p-6` and border; table is borderless inside panel | Shared `AnalysisOutputFrame` — same padding, title band, footer band |

### Tier 4 — Theme-specific polish

| ID | Theme | Note |
| :--- | :--- | :--- |
| **UXP-030** | Mission Control | Radar hover on rows is delightful — but floating numbers break the “instrument panel” illusion | Fix UXP-001 first; then tune row hover so column highlight + scanline share one focus model |
| **UXP-031** | Soft Machine | Warmer panels forgive empty space more — still benefit from alignment fix | — |
| **UXP-032** | Liquid Glass | Translucency exposes misalignment more | Defer glass polish until table grammar is stable |

---

## What the first review got right (keep doing)

From `session-02-canvas.md` and synthesis — these are **polish positives**, not bugs:

- Suggested starting points → fast first crosstab.
- Sig legend + χ² line + Welch label — credible research chrome.
- Mission Control tokens on headers and shelf chips read “serious tool.”
- Filter chips and chart count/% toggles are well labeled.

The gap is not feature discovery — it is **finish on the object users photograph**.

---

## Comparison targets (brief)

| Product | What they do well | Velocity opportunity |
| :--- | :--- | :--- |
| **Displayr / Q Research** | Stable column grids; bases visible without hover | Always-visible `n=` or footnoted bases |
| **Apple Numbers / Excel** | Clear number column alignment | Adopt fixed numeric column strategy |
| **Bloomberg** | Dense but aligned — nothing floats | Mission Control already aims here — table must match |
| **Figma / Linear** | One spacing scale (4/8/12/16) | Audit canvas padding stack (UXP-022) |

---

## Suggested workstream: `STAB-UI-P` (Visual Polish)

Distinct from `STAB-UI-D` (trust/a11y/responsive). Proposed slices:

1. **Crosstab cell system** (UXP-001–003) — one component, unit tests for layout classes, Storybook or visual snapshot optional  
2. **Typography & case pass** (UXP-010–012) — document in `design_01_system.md` §data display  
3. **Canvas frame unification** (UXP-004–005, 022–023) — table/chart/footer share one frame  
4. **Hover/layout audit** (UXP-020–021) — grep `opacity-0` in `src/features/dashboard`  

**Out of scope for STAB-UI-P:** OPFS errors, keyboard conflicts, filter modal dead-ends — keep in `STAB-UI-D`.

---

## Quick validation checklist (human, 10 minutes)

After UXP-001 fix, re-run on `gender` × `region` (Mission Control):

- [ ] Vertical scan: EAST header → both % cells → column total — no horizontal drift  
- [ ] Total column and East column use same internal layout  
- [ ] Hover does not shift column width  
- [ ] Screenshot-ready: would embed in a deck without red circles  

---

## Relationship to `audit_06`

| Document | Optimizes for | ID prefix |
| :--- | :--- | :--- |
| `audit_06` + UXR register | Correctness, trust, a11y, journeys | `UXR-###` |
| This review | Delight, alignment, presentation quality | `UXP-###` |

No UXP item duplicates UXR-010 (filtered N in subtitle) — that is trust; UXP-004 is presentation of the same slide. Fix both, but schedule separately.

---

## Implementation status

**UXP-001 (Strategy B)** — implemented May 20, 2026:

- `src/features/dashboard/components/CrosstabCell.tsx` — left-stacked `%` + visible `n=`, sig inline
- `DataTable.tsx` — data cells, row totals, and column base row use `CrosstabCell`
- Tests: `CrosstabCell.test.tsx`

**UXP-002–003, UXP-005** — implemented May 20, 2026:

- **UXP-002:** `table-layout: fixed` + `computeCrosstabColumnWidths()` — proportional data columns weighted by header label length
- **UXP-003:** Total row uses `size="marginal"` on `CrosstabCell`; muted uppercase row label distinguishes counts from body `%`
- **UXP-005:** `StatisticsStatusBar` split into two rows — methodology + legend on line 1; χ² results right-aligned on line 2
- Tests: `crosstabColumnWidths.test.ts`, `DataTable.test.tsx`, `CrosstabCell.test.tsx`

**Quick validation checklist** (after UXP-001–003):

- [x] Vertical scan: EAST header → both % cells → column total — no horizontal drift  
- [x] Total column and East column use same internal layout  
- [x] Hover does not shift column width  
- [ ] Screenshot-ready: would embed in a deck without red circles  
