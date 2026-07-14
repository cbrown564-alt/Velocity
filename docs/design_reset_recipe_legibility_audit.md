# Recipe Structure Legibility Audit (DESIGN-CONV-Q6)

**Task:** DESIGN-CONV-Q6 — Recipe structure legibility audit  
**Status:** Done — closes tracker Q6; **unblocks `DESIGN-CONV-I`** (docs-only; no UI in this close-out)  
**Date:** July 4, 2026  
**Decision context:** Tracker §4.3.2 Q6 — audit before `DESIGN-CONV-I`  
**Verdict:** Partially legible for human additive refinement; insufficient for MCP handoff without summoned surfaces and a persistent import summary. Recipe truth exists in store/session, but the default UI exposes only a thin slice (rows×cols in the rail; full recipe behind a collapsed panel).

---

## 1. Current surfaces — visible vs hidden

### Story rail (resident, 240px)

| Visible | Hidden / not surfaced |
| :--- | :--- |
| Deck name (from dataset filename) | Section dividers (`sections[]` in store; no rail rendering) |
| Numbered slides, title (custom or auto-resolved) | Filter summary on inactive slides |
| Recipe summary line: `rows × col` only (e.g. `Q5_gender × SEG`) | Weight on any slide (rail or inactive) |
| Active-slide unsaved dot (subtle grey pill) | Chart vs table mode |
| Reorder, duplicate, delete, `+ New slide` | Speaker notes (`Slide.notes`) |
| Persistence footer (OPFS / dataset stats) | Agent import diagnostics / “what changed” (DESIGN-CONV-I not built) |

Recipe summary is rows×cols only (`StoryRail.tsx` → `getRecipeSummary`). Active slide uses live `tableConfig`; inactive slides use saved `slide.analysisState`.

**Evidence:** `docs/assets/design-reset-evidence/screenshots/04-dashboard-story-rail-empty-slide.png`, `15-resumed-analysis-session.png`

### Recipe inspector (summoned, collapsed by default, 280px when open)

| Visible (when open) | Hidden / gaps |
| :--- | :--- |
| Rows / Columns / Filter / Weight chips (edit, remove, drag-reorder rows) | Collapsed by default — not deck-at-a-glance |
| Display: Cell n, Column bases, Compare, Correction, Significance | `visualizationType` / chart type (toolbar only) |
| Auto-opens during drag | Section assignment, speaker notes |

**Evidence:** `docs/assets/design-reset-evidence/screenshots/09-recipe-inspector.png`, `05-building-crosstab-one-variable.png`

### Slide titles (center artifact — active slide only)

| Visible | Hidden |
| :--- | :--- |
| Inline-editable title (auto from vars if still “New Slide”) | Same title/subtitle semantics for inactive slides in rail only |
| Subtitle via `resolveSlideSubtitle` (filters, weight label, N) | Agent speaker notes — no dashboard UI |
| Table/chart output + statistics margin note | |

**Evidence:** `06-crosstab-table-result.png`, `07-chart-view.png`

### Store / session model (source of truth, partially mirrored in UI)

`SlideAnalysisState` captures rows, col, filters, weight per slide. **Seam:** `applySlideAnalysisState` restores rows, cols, and filters on slide switch — not `weightVar`. `analysisSettings` (comparison method, correction, cell n) are workspace-global, not per-slide.

---

## 2. Human additive refinement — three Sarah scenarios

### Scenario A — Friday three-slide crosstab deck (manual build)

Rail shows 3 slides with `var × var` lines; titles editable. Filter/weight invisible until Recipe opened (collapsed). Rail summaries omit filter/weight across slides. Adequate for experts who know the Recipe toggle; weak for additive refinement across slides.

### Scenario B — Tweak filter on slide 2 after slide 3 is built

Filter editable in inspector when slide 2 active; inactive slide 2 gives no filter hint in rail. Weight per slide shown in inspector but slide switch may not restore `weightVar` — global `dataset.weightVariable` can leak across slides.

### Scenario C — Reopen saved session next morning

Structural continuity strong (rail restores outline). Full recipe still collapsed; Sarah must re-discover toolbar “Recipe”. No amnesiac coaching (design reset win).

---

## 3. MCP handoff scenarios (feeds DESIGN-CONV-I)

**Reference:** EVAL-03 (session handoff round-trip), `arch_07` §8.

| Agent authored | Browser shows | Gap |
| :--- | :--- | :--- |
| Slide list + titles | Story rail | OK |
| Row/col bindings | Rail `Q × SEG` + slide output | OK for core crosstab grammar |
| Per-slide filters | Recipe inspector (if opened) | Not in rail; collapsed by default |
| Per-slide weight | Recipe chip when open | Not in rail; switch seam |
| Sections (3 in EVAL-03) | Not rendered | Agent narrative structure invisible |
| Speaker notes | No UI | Agent interpretation lost to human |
| Semantic annotations (30 in EVAL-03) | Preserved in session | No inspection surface |
| Import adjustments | 10s warning toast, then cleared | No persistent diff/summary |

On agent session import, humans need a quiet, persistent summary (story rail footer per Path I): slides added, unresolved variables with affected slides, filters/weights dropped, sections present but not shown.

**Related:** DESIGN-CONV-B export preview should show per-slide recipe summary + significance audit before PPTX.

---

## 4. Gap list (severity → DESIGN-CONV-I mapping)

| ID | Severity | Gap | Recommended fix | Maps to |
| :--- | :--- | :--- | :--- | :--- |
| G1 | P0 | Story rail recipe line is rows×cols only | Extend rail summary (compact tokens: `· filt · wt · table`) | I, G |
| G2 | P0 | Recipe inspector collapsed by default | Default-open on agent import or first insertion | I, H |
| G3 | P0 | Agent import diagnostics ephemeral toast | Story rail footer diff (Path I) | **DESIGN-CONV-I** |
| G4 | P1 | Sections not rendered in story rail | Section headers in rail | I, E |
| G5 | P1 | Speaker notes not surfaced | Notes field in Recipe inspector | I |
| G6 | P1 | `weightVar` not restored on slide switch | Project weight on slide activate | I + correctness |
| G7 | P1 | `analysisSettings` global | Per-slide settings snapshot | I, B |
| G8 | P1 | No deck-level recipe review before export | Export preview lane | **DESIGN-CONV-B** |
| G9 | P2 | Semantic annotations not inspectable | Post-import semantic strip | I (extended) |
| G10 | P2 | Visualization type only in toolbar | Add View row to Recipe inspector | I |
| G11 | P2 | Unsaved dot subtle | Clearer dirty state | I |

### Q6 answer

- **Human manual path:** Borderline yes for single-slide edits if Sarah opens Recipe; no for multi-slide deck scanning without summoning.
- **MCP handoff path:** No for self-explanatory additive refinement — EVAL-03 proves the primitive works, but UI does not expose agent-authored structure. **`DESIGN-CONV-I` is warranted and unblocked.**

---

## 5. Top 3 gaps

1. **P0 — Deck-at-a-glance recipe is incomplete:** Story rail shows only `rows × col`; filter, weight, and view mode hidden until Recipe opened.

2. **P0 — No persistent agent handoff summary:** Import diagnostics appear as a 10-second toast then disappear. EVAL-03 product-defaults score (3/5) reflects this.

3. **P1 — Agent deck grammar not mirrored in UI:** Sections and speaker notes exist in session but have no browser surface; weight may not restore correctly on slide switch.
