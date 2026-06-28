# Report Quality Experience Plan (v2)

**Status:** Revised draft for human review
**Date:** 2026-06-28
**Workstream:** Deck-native SAV-to-deck experience
**Supersedes:** `07_report_quality_experience_plan.md` (v1)

> **What changed from v1.** v1 was disciplined about *not fooling ourselves* ("works" ≠ good) but set its quality ceiling at the **absence of defects** (no clipping, consistent styling, editable). That is the floor, not the bar, and it lands squarely in the documented "AI deck uncanny valley": polished enough not to look terrible, generic enough that a consultant rebuilds it anyway. v2 keeps v1's evaluation rigor and raises the ceiling: it commits to a **report archetype**, anchors quality to **external, named craft standards** rather than home-grown heuristics, adds **design craft / taste** and **narrative** as load-bearing dimensions, makes **action titles** a first-class primitive, names a **competitive floor and wedge**, and commits to a **north-star exemplar** to diff against. See §3, §4, §5, §8, and §15.

**Companion artifacts (checked in alongside this plan).** This plan defines *what good means*; two sibling documents make it operational and are referenced throughout:

- `08_brand_tracker_story_template.md` — the concrete narrative spine for the primary archetype (SCR exec summary, fixed section order, per-slide blueprints, a `Report Job` contract, and a conformance checklist). It is the target shape for the north-star exemplar (§4) and the agent story-draft eval (§10).
- `09_action_title_eval_rubric.md` — the scoreable rubric behind the **narrative usefulness** dimension (§7): two gates, four graded criteria, per-title bands, a deck-level rollup tied to the promotion bar, an agent-evaluable JSON schema, and a calibration set. It is the action-title eval named in §9.3.

## 1. Scope Gate

**Workstream sentence:** Build and evaluate the primary Velocity journey from analysis-ready SAV file to defensible, editable, client-quality PowerPoint deck.

**Gate result:** In scope, narrow.

This work advances the active market-reset wedge:

```text
analysis-ready SAV file -> defensible, editable, client-quality deck
```

It belongs to:

- `PILOT-3`: PowerPoint loop, template mapping, saved slide recipes, review-before-export.
- `PILOT-5`: bounded agent outcomes with manual control adjacent to proposed actions.
- `PILOT-6`: paid-pilot evidence and observed workflow records.

It must not expand into:

- generic dashboard building
- broad SPSS replacement
- unsupervised analyst chat
- template marketplace
- WebR/raking unless pilot evidence makes it adoption-blocking
- cloud collaboration

## 2. Product Goal

Velocity should not merely prove that a PPTX download can happen. v1 set the goal as "a deck a researcher would plausibly send after normal professional review." v2 raises it:

> **A first-pass Velocity deck should be mistaken for one a competent research consultant built by hand — structured as an argument, defensible on every number, and visually intentional — such that the human's remaining work is editorial judgement, not reconstruction.**

The distinction matters because the failure mode of every AI deck tool is not "broken." It is *generic*. Tools that start from a template and fill it in produce slides that are "polished enough to not look terrible but generic enough that people feel something is missing." Professional designers start from the content and make dozens of micro-decisions per slide. Our target is the second posture, automated.

The target experience:

1. Load an analysis-ready SAV or CSV file.
2. Build or accept a first-pass deck **outline that reads as a story**, not a list of crosstabs.
3. Inspect findings, caveats, and proposed slide sequence — including the **takeaway (action) title** proposed for each slide.
4. Edit titles, notes, visual treatments, filters, weights, and template bindings.
5. Export a PowerPoint that is editable, **visually intentional**, narratively coherent, and statistically defensible.
6. Reopen or refresh the job for a later wave without rebuilding from scratch.

## 3. Competitive Frame

We are not entering an empty market. "Crosstab → formatted PPT" already exists and is mature. We must beat it on the axes it is weak, not re-ship its strengths as if they were novel.

**The incumbent floor (table stakes — we must match, not celebrate):**

- **Displayr / Q** — one-click PPT export, brand templates, **auto-update on data refresh** (a quoted client saved "95% time on updates"), advanced visuals beyond native PowerPoint, batch/filtered report variants from one source.
- **E-Tabs** — 20+ years of charting/reporting automation built specifically for the MR industry, with explicit storytelling positioning.
- **OfficeReports / Presento** — crosstab → PowerPoint native inside Excel/PPT.

If our wave-refresh, brand-template, and one-click export are *worse* than these, defensibility and AI narrative will not save us. Treat them as the floor.

**The Velocity wedge (where incumbents are weak):**

1. **Defensibility baked into every slide.** Q exports numbers but does not auto-build a defensible, provenance-carrying story; Gamma/Tome/Plus AI cannot produce a statistically defensible research deck at all. Per-slide provenance (base, filter, weight, sig settings, warnings) that a reviewer can reproduce is a genuine moat. Lead with it.
2. **AI-drafted narrative, not just AI-drafted charts.** Incumbents automate *production* (charts, formatting, refresh). They do not automate the *argument*. Research buyers' #1 complaint about supplier reports is "no story." The thing nobody automates well is exactly the thing buyers say is missing.

Every card in §10 should be scored against the question: *does this widen the wedge, or just close the floor?* Both are legitimate, but we must know which we are doing.

## 4. Chosen Archetype and North-Star Exemplar

v1 left "which archetype" as an open question and tried to define "good narrative" generically. You cannot — a brand tracker's story is structurally different from a concept test's. v2 commits so the rubric can be calibrated against something concrete. (Human owner may override the choice; the plan must not stay archetype-agnostic.)

**Primary archetype: Brand / category tracker.**

Rationale: recurring revenue and repeat reporting; **wave refresh is a natural fit** (directly exercises the deck-recipe primitive); the story template is stable and repeatable (health metrics, vs. category, vs. prior wave, drivers, implications); and it overlaps most directly with the incumbents we intend to displace.

**Secondary archetype: Concept / product test.**

Rationale: clearest pass/fail narrative (this concept wins/loses, here's why, here's what to change), which is the best surface for demonstrating *decisive* storytelling and recommendation slides.

**North-star exemplar (the diff target).**

Before scoring any generated deck, assemble a **gold-standard reference deck for the brand-tracker archetype on one of our fixture datasets** — ideally a real human-made deck, otherwise a hand-built one a consultant signs off on. "Score 3" is meaningless without a reference that embodies the dozens of micro-decisions taste is made of. Evaluation = *diff our output against this exemplar*, not score it in a vacuum. The exemplar must conform to the brand-tracker story spine in `08_brand_tracker_story_template.md` — its §8 conformance checklist is the acceptance test for "is this a valid exemplar." See §5 for the public references that calibrate each dimension.

## 5. Exemplar Library (External Benchmarks)

These are real, mostly public references. Each calibrates a specific quality dimension so reviewers anchor to a known bar instead of a home-grown one. Store local copies / screenshots under `demo/artifacts/report-quality/exemplars/`.

| Dimension it anchors | Exemplar | Why it is gold-standard | What we copy |
| :--- | :--- | :--- | :--- |
| Survey-data design craft **+** defensibility | **Pew Research Center** reports & data-viz | Public, free, the benchmark for presenting survey data clearly: story-driven titles, small multiples, in-chart benchmark annotation, transparent bases, topline/methodology appendix. | Chart-type matched to the data relationship; titles that state the "so what"; bases/source on every exhibit; methodology appendix pattern. |
| Narrative structure & action titles | **Slideworks "160+ real McKinsey" & "105 real BCG"** decks (free, downloadable, genuine client/public deliverables) | Exemplify action titles ("German market is growing three times faster than rest of Europe"), pyramid principle, executive summary on every deck, one message per slide. Concrete decks: *The Future of Trash* (2023), *Building a Best-in-Class DOT* (2019). | Action-title grammar; SCR executive summary; one-message-per-slide discipline. |
| Brand-tracker archetype story | **Kantar BrandZ** annual report (public PDF) | The reference shape for brand health storytelling: ranking, health metrics, year-over-year movement, category benchmarking, drivers. | Section order and metric framing for the tracker story template. |
| Competitive floor (production automation) | **Displayr / Q / E-Tabs / OfficeReports Presento** outputs | Define what "table-stakes auto-crosstab-to-PPT" already looks like in 2026. | Match: one-click export, brand template fidelity, auto-update on refresh. |
| Default taste / anti-uncanny-valley | **Gamma** default decks | 70M users largely on *defaults that look intentional without configuration* — the bar for "looks good with zero knobs touched." | Defaults must look deliberate, not templated. |

## 6. Core User Stories

### Story 1: First-Pass Client Deck (with takeaway titles)

As an independent research consultant, I want Velocity to turn an analysis-ready SAV file into a first-pass client deck so I can start from a coherent story rather than a blank PowerPoint.

Acceptance:

- The deck has a title, sections, and slide sequence.
- **Each slide carries a proposed action/takeaway title that states the finding as a complete sentence** (see §8.1), not a topic label.
- Each slide has a clear question/finding, analysis table or chart, base size, filters, weight status, and notes.
- The user can approve, reject, reorder, edit, or **rewrite the title of** every generated slide before export.
- The exported PPTX is editable and free of clipped text, overlap, or unreadable tables.

### Story 2: Researcher-Controlled Story Building

As a researcher, I want to stitch individual analyses into a narrative arc so the report answers the client question rather than listing crosstabs.

Acceptance:

- Slides group into sections such as "Executive Summary", "Key Drivers", "Segment Differences", "Implications".
- The deck opens with an **executive summary built on the Situation–Complication–Resolution pattern**, not a table of contents.
- Each slide carries a role: context, finding, comparison, caveat, recommendation, appendix.
- The deck review surface flags story defects: no summary, **topic title instead of takeaway title**, unsupported recommendation, repeated chart, missing base note, weak transition.
- Speaker notes preserve interpretation separately from slide visuals.

### Story 3: Template and Brand Fit

As a boutique agency user, I want exports to fit my client's template so I spend minutes polishing rather than hours rebuilding.

Acceptance:

- A user can import a client template and map placeholders.
- The export preserves untouched template content where possible.
- The user can choose wave refresh vs full rebuild.
- The review surface identifies unmapped placeholders, missing content slots, and template warnings before export.
- Exported slides obey the template's typographic and color discipline (see §8.2): ≤2 fonts, a constrained palette, consistent action-title size/position, grid alignment.

### Story 4: Wave Refresh

As a tracker owner, I want to refresh a previous deck with a new wave of data so recurring reporting is repeatable. *(This is the competitive floor — incumbents lead here. Match them.)*

Acceptance:

- The user can compare the saved deck recipe against the replacement dataset.
- Missing row, column, filter, weight, and variable-set references are grouped by slide.
- Blocking issues prevent only affected selected slides from export.
- Non-blocking assumptions are visible and auditable.
- **Takeaway titles re-compute against the new wave** (e.g., movement direction and magnitude update) and are flagged for human confirmation rather than silently overwritten.

### Story 5: Trust and Audit

As a client-facing analyst, I want every slide to be defensible so I can explain how the number was produced. *(This is the wedge. Lead with it.)*

Acceptance:

- Every slide carries provenance: dataset, row/column variables, filters, weight, base size, significance settings, warnings.
- The review surface flags low bases, missing weights, unresolved filters, unsupported variables, statistical caveats.
- PPTX speaker notes or an appendix can include methodology notes and limitations.
- A reviewer can reproduce a slide from the deck recipe.

### Story 6: Smooth, Recoverable Working Session

As a deadline-driven user, I want the workflow to feel immediate, forgiving, and predictable so I trust the tool under pressure.

Acceptance:

- Common interactions respond without visible stall: selecting variables, opening export review, switching scope, toggling options, moving slides, **editing titles**.
- **Edits are reversible** (undo/redo) and the app **never silently loses work** on navigation, refresh, or reopening a stored dataset.
- Long operations show progress and remain cancel-safe where feasible.
- The user never has to guess whether export is blocked, running, failed, or complete.

## 7. Report Quality Standard

A Velocity report is "good enough" only when it passes all six dimensions. v1 had five and folded "not broken" together with "looks good"; v2 splits them, because a deck can be defect-free and still feel auto-generated.

| Dimension | Minimum Standard | External anchor | Evaluation Evidence |
| :--- | :--- | :--- | :--- |
| Analytical defensibility | Numbers, bases, filters, weights, caveats are visible or inspectable. No silent unresolved references. | Pew topline/methodology transparency | readiness diagnostics, provenance metadata, parity/golden checks |
| **Narrative usefulness** | Deck answers a client question in a coherent order; opens with an SCR executive summary; **every slide has a takeaway title**; recommendations separated from evidence. | MBB action titles + pyramid principle | deck-story rubric, action-title eval (`09_action_title_eval_rubric.md`), human review |
| **Technical PPTX integrity** | PPTX is editable, well-formed, free of clipping/overlap, no leftover `{{tokens}}`, no empty slides. | — (defect floor) | automated PPTX inspection |
| **Design craft (taste)** | Slides look *intentional*, not templated: ≤2 fonts, constrained palette, consistent title size/position, grid alignment, deliberate white space, chart type matched to the data. Does **not** read as auto-generated. | Pew viz + MBB design discipline + Gamma defaults | rendered-slide review, uncanny-valley check (§9.2) |
| Workflow smoothness | Primary journey feels fast, **reversible**, recoverable, predictable. | — | Playwright timings, UI screenshots, undo/loss-of-work tests |
| Configurability | User can adapt scope, template, refresh mode, title, notes, display options, selected slides without code. | — | UI tests, demo contract, user story task run |

### Named failure modes (force reviewers to look for these)

- **"Feels auto-generated."** Defect-free but generic — uniform slides, topic titles, default chart picks, no emphasis hierarchy. This is a **design-craft score of 1 or below**, regardless of technical integrity.
- **"Crosstab dump."** Correct numbers, no argument — no executive summary, no takeaway titles, no section intent. This is a **narrative score of 1 or below**.
- **"Confident but indefensible."** Looks polished but a number cannot be reproduced or a base is unstated. This caps **defensibility at 0** — it is the most dangerous failure for a research tool and is never offset by visual polish.

### Quality Rubric

Score each deck 0–3 per dimension.

| Score | Meaning |
| :--- | :--- |
| 0 | Fails the user goal or produces misleading/unusable output. |
| 1 | Technically completes but requires heavy manual repair, **or reads as auto-generated / a crosstab dump**. |
| 2 | Usable after normal professional review and light polish. |
| 3 | Strong enough to be a credible pilot demo: an argument, defensible, and visually intentional, with low rework. |

**Promotion bar (revised so configurability cannot substitute for story):**

- No dimension below 2.
- **Defensibility, narrative usefulness, technical integrity, and design craft must each score 2+** on representative decks.
- At least one real or representative pilot deck must score **3 on narrative usefulness** (not configurability) before claiming "works well." Narrative is the wedge; a flexible deck with a mediocre story does not clear the bar.
- The "confident but indefensible" failure is an automatic block at any visual quality.

Narrative ≥2 is *evidenced*, not asserted: it requires meeting the deck-level action-title gate in `09_action_title_eval_rubric.md` §4 (zero gate failures, ≥90% of body titles Good-or-Strong, ≥40% Strong). Narrative = 3 requires that document's stricter "works well" thresholds (≥95% Good-or-Strong, ≥70% Strong, all exec-summary takeaways Strong).

## 8. Narrative & Design Primitives

These are the two most under-specified, highest-leverage parts of the experience. They are first-class, not backlog.

### 8.1 Action / takeaway titles

The single highest-leverage, most automatable storytelling element. An action title states the slide's conclusion as a complete sentence; a partner can read only the titles and follow the whole argument.

Spec for generated titles:

- **Conclusion, not topic.** "Awareness up 7pts to 41%, now ahead of Brand B" — not "Brand Awareness."
- **≤15 words, ≤2 lines, active voice, specific and quantitative.**
- **Must be supported by the data on the slide** (the "so what" test: every element traces to the title).
- **Carries direction + magnitude** where the data has them (movement vs. prior wave, vs. category).
- **Editable and regenerable**; on wave refresh, recomputed and flagged for confirmation, never silently changed.

Concrete per-section title patterns (with ✅/❌ examples) live in `08_brand_tracker_story_template.md` §4. This is gradeable: the **action-title eval rubric** (`09_action_title_eval_rubric.md`, summarized in §9.3) scores each title against two gates — *supported* and *defensible* — and four graded criteria — *conclusion, specificity, comparison, form*.

### 8.2 Design discipline (so defaults have taste)

Defaults must look deliberate with zero knobs touched. Enforce, by default and in the template binding:

- **Typography:** ≤2 fonts; one size per element type; action titles identical size and position on every slide (they "don't move" when flipping through).
- **Color:** constrained palette (≈3–4 roles); accent used to highlight the point, not decorate; semantic consistency (if positive is green on slide 5 it is green on slide 50).
- **Layout:** grid alignment; deliberate white space; one message per slide; source/base attribution on every exhibit.
- **Charts:** type matched to the data relationship (Pew-style), legible at tablet width, no 3-D, no chartjunk.

These are not a "design studio" (still a non-goal). They are *defaults that prevent the uncanny valley*. Configurable presets stay narrow: table density, chart/table style, theme/template mode.

## 9. Evaluation Harness

### 9.1 Automated PPTX Inspection

A repeatable inspector that opens exported `.pptx` files and reports:

- slide count; section/title slide presence
- editable text boxes and tables; speaker notes presence
- placeholder replacement status; remaining `{{...}}` tokens; empty slides
- text overflow/clipping heuristics where XML bounds allow
- theme/font/color usage **+ font-count and palette-size checks against §8.2**
- file size and media inventory

Output:

```text
demo/artifacts/report-quality/<run-id>/
  exported.pptx
  pptx_inspection.json
  slide_renders/
  visual_review.md
  exemplar_diff.md      # NEW: diff vs the north-star exemplar (§4)
```

### 9.2 Rendered Slide Review + Uncanny-Valley Check

Render exported slides to images and check legibility, table/axis readability, overlap, bounds, margins, contrast (as v1). **Add the taste check:** alongside the defect checklist, a reviewer (human first, agent later) answers one forced question per deck — *"Could this be mistaken for a deck a competent consultant made by hand, or does it read as auto-generated? Cite three specifics."* A deck that is defect-free but reads as auto-generated fails design craft.

### 9.3 Story Quality Review + Action-Title Eval

The action-title eval is fully specified in `09_action_title_eval_rubric.md` (per-title gates + criteria, deck-level rollup, JSON output schema, calibration set); the tracker-specific story checklist is `08_brand_tracker_story_template.md` §8. This section is the harness summary that ties them in.

Lightweight deck-story evaluator (human checklist first, agent-evaluable later):

- Stated audience and job? SCR executive summary present?
- Each section has a purpose? Each slide one clear point?
- **Each slide a takeaway title, not a topic title?** (action-title eval scores conclusion-vs-topic, support, length)
- Findings supported by on-slide data? Caveats placed where the user will see them?
- Recommendations separated from evidence? Excess repetition?

### 9.4 UX Smoothness Review

Extend demo contracts to measure (as v1): time to load dataset, first crosstab, first slide, open export review, switch scope/template mode, export PPTX; console errors; long-task count; control visibility at desktop/tablet widths. **Add recoverability:** undo/redo present on edits; **no work lost** on navigation/refresh/reopen.

Target initial thresholds:

- first representative crosstab under 5 seconds on pilot-sized files
- export review opens under 1 second once the deck is ready
- one-slide PPTX export under 3 seconds for small files
- no modal clipping at 1280px and 1440px widths
- no blocking console errors
- title edit and slide reorder reversible via undo; reopening a stored dataset restores in-progress work

### 9.5 Pilot Review Loop

For each paid or representative pilot: capture the user job; source file type and row/variable count; run the journey; save deck + session; **score against the rubric and diff against the exemplar**; record PowerPoint rework needed; record whether the user would use the output as a starting point.

## 10. Buildout Kanban

> Reordering vs v1: **the north-star exemplar, action titles, and the story outline move to the near term** — they define narrative quality and are the wedge. Wave refresh and template mapping (the floor) follow once narrative + defensibility are real.

### Ready

| Card | Outcome | Dependencies | Parallelizable | Owner | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Define report-quality fixtures | 2–3 representative datasets + expected deck jobs, **brand-tracker first**. | none | yes | unassigned | fixture brief + checked-in small fixtures or documented private placeholders |
| **Assemble north-star exemplar** | One gold-standard brand-tracker deck on a fixture dataset, signed off by a consultant. | fixtures | yes | human owner | exemplar deck + screenshots in `exemplars/`; used as diff target |
| Build PPTX inspection script | Exported decks produce `pptx_inspection.json` incl. font/palette checks. | none | yes | unassigned | script test on existing exported pptx |
| Add rendered slide evidence + uncanny-valley check | Slides render to PNG; reviewer answers the "mistaken for hand-made?" question. | PPTX inspection | after inspection | unassigned | artifact folder with PNGs + filled taste check |
| Draft story-quality checklist + action-title rubric | Human-review rubric for narrative coherence, slide usefulness, and title quality. **Action-title rubric drafted (`09_...`); tracker story checklist drafted (`08_...` §8).** Remaining: generalize the story checklist beyond the tracker archetype and apply both to a deck. | none | yes | unassigned | both applied to one existing demo deck; bands match expected on the §8 calibration set |
| Extend demo timing + recoverability contract | Runner records journey timings, UI states, and undo/loss-of-work checks. | none | yes | unassigned | updated `steps.json` includes timing + recoverability fields |

### In Progress

| Card | Outcome | Dependencies | Parallelizable | Owner | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Fix current-standard blockers | Export modal centered, title state coherent, component tests run under Node 25. | none | no | Codex | targeted component tests pass |

### Backlog

| Card | Outcome | Dependencies | Parallelizable | Owner | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Action-title generation + editing** | Every generated slide gets an editable takeaway title meeting §8.1. | story/title rubric (drafted: `09_...`), fixtures | high priority — rubric ready | unassigned | action-title eval (`09_...`) passes the deck-level gate on a fixture deck; titles editable/regenerable |
| **Story outline editor** | Users group slides into sections, assign roles, get an SCR exec summary. | action titles | after titles | unassigned | create/reorder sections + exec summary export to PPTX |
| Default design discipline | Defaults enforce §8.2 (fonts, palette, grid, white space) so output isn't templated-looking. | PPTX inspection, exemplar | after exemplar | unassigned | rendered decks pass uncanny-valley check; font/palette checks pass |
| Deck review panel v2 | Review surface shows story role, takeaway title status, caveats, bases, template status, readiness in one pass. | story checklist, action titles | no | unassigned | component tests + browser walkthrough screenshots |
| Configurable visual presets | Narrow presets: table density, chart/table style, theme/template mode. | design discipline | after discipline | unassigned | exported slides differ visibly and pass readability + taste checks |
| Template mapping editor | Inspect/adjust placeholder–slot bindings. | PPTX inspection | after inspection | unassigned | mapping editor test + template mismatch demo |
| Agent story draft eval | `velocity_draft_deck_plan` runs an eval-style deck-story + action-title task against the `08_...` story spine. | story checklist, fixtures, action titles | after titles | unassigned | eval artifact scored with `09_...` rubric + exemplar diff; output conforms to `08_...` §8 |
| Wave refresh pilot task | Replacement dataset review + template refresh + title recompute, end to end. | fixtures, action titles | after titles | unassigned | compatible + incompatible wave fixtures reviewed; titles recompute |
| PowerPoint rework log | Pilot users record remaining manual PPTX cleanup. | pilot review loop | after pilots | human owner | 5–8 pilot records or explicit blocker |

### Blocked

| Card | Outcome | Dependencies | Parallelizable | Owner | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Claim "works well" publicly | Backed by defensibility, narrative, design, smoothness, and pilot evidence. | rubric scores, pilot records | no | human owner | promotion bar met (§7); ≥1 deck at narrative=3; pilot evidence accepted |

## 11. Dependency Notes

- The **north-star exemplar comes first** with the inspector: together they define what "good" means before we build surface area.
- PPTX inspection and rendered-slide evidence precede large UI expansion.
- **Action titles precede the story outline editor**, which precedes deck review panel v2 — narrative is the spine the review surface displays.
- Default design discipline depends on the exemplar (it is the visual target).
- Story-quality rubric can proceed in parallel with technical inspection (different failure mode).
- Template mapping waits until inspection tells us which template failures are common.
- Agent drafting stays bounded until human story-review criteria and the action-title rubric are stable.

## 12. Parallelization Opportunities

Safe to start in parallel:

- report-quality fixtures
- north-star exemplar assembly
- PPTX inspection script
- story-quality checklist + action-title rubric
- demo timing + recoverability contract

Should stay single-threaded:

- action titles → story outline editor → deck review panel v2 (shared narrative spine)
- template mapping editor (touches export contracts and UI)
- public product claims (depend on pilot evidence)

Recommended first pull:

1. Assemble the north-star exemplar and build the PPTX inspection script.
2. Draft the story-quality checklist + action-title rubric.
3. Extend the demo timing + recoverability contract.

This creates the evidence loop *and the quality target* before more product surface is added.

## 13. PR Evidence Standard

Any PR claiming to improve the deck-native journey should include:

- user story covered
- before/after screenshots or PPTX renders
- exported PPTX artifact path
- **exemplar diff: how output compares to the north-star deck**
- timing + recoverability evidence for the affected flow
- tests run
- rubric impact: which dimension improved (defensibility / narrative / technical integrity / design craft / smoothness / configurability)
- remaining rework a human would still need in PowerPoint

## 14. Open Questions (most v1 questions now resolved)

Resolved in v2:

- **Archetype:** brand tracker first, concept test second (§4).
- **Narrative standard:** SCR executive summary + per-slide action titles + one-message-per-slide (§8.1, anchored to MBB/Pew), now concretely specified in `08_brand_tracker_story_template.md` (story spine) and `09_action_title_eval_rubric.md` (title scoring).

Still open for the human owner:

1. Which client-template constraint matters most in the first pilots: brand colors, master layouts, placeholder mapping, chart styling, or editable-table fidelity?
2. Acceptable manual-rework budget after export: 5 minutes, 15 minutes, or "less than rebuilding from scratch"? (Recommend setting it per archetype against the exemplar.)
3. Are speaker notes required for agent-generated slides, or optional for human-created slides?
4. Do we license/commission a real brand-tracker deck as the exemplar, or hand-build one a consultant signs off on?

## 15. References

- The Power of Storytelling in Market Research — E-Tabs: https://www.e-tabs.com/newsevents/the-power-of-storytelling-in-the-market-research-industry/
- Market Research PowerPoint: Automate Your Reports — E-Tabs: https://www.e-tabs.com/newsevents/market-research-powerpoint-automate-your-reports/
- Beyond Numbers: The Art of Storytelling — Kadence: https://kadence.com/knowledge/beyond-numbers-the-art-of-storytelling-in-market-research/
- Displayr PowerPoint Automation: https://www.displayr.com/powerpoint-automation/
- Consulting Slide Standards (MBB) — Deckary: https://deckary.com/blog/consulting-slide-standards
- Consulting Presentations Guide — Deckary: https://deckary.com/blog/pillar-consulting-presentations-guide
- Why Your AI Slides Look Generic — Winning Presentations: https://winningpresentations.com/ai-generated-slides-look-generic/
- How to Make AI Slides Look Designer-Made — Alai: https://getalai.com/blog/make-ai-slides-look-designer-made
- 160+ Real McKinsey Presentations — Slideworks: https://slideworks.io/resources/47-real-mckinsey-presentations
- 105 Real BCG Presentations — Slideworks: https://slideworks.io/resources/54-real-bcg-presentations
- Top Data Visualizations of 2025 — Pew Research Center: https://www.pewresearch.org/short-reads/2025/12/15/our-favorite-data-visualizations-of-2025/
- How Pew Research Center uses small multiple charts — Pew Decoded: https://medium.com/pew-research-center-decoded/how-pew-research-center-uses-small-multiple-charts-2531bfc06419
- Kantar BrandZ 2025 report (public PDF): https://www.scribd.com/document/866015937/Kantar-Brandz-2025
- Gamma — AI Presentation Maker: https://gamma.app/
