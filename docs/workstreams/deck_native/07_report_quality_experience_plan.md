# Report Quality Experience Plan

**Status:** Draft plan for human review  
**Date:** 2026-06-28  
**Workstream:** Deck-native SAV-to-deck experience  

## 1. Scope Gate

**Workstream sentence:** Build and evaluate the primary Velocity journey from analysis-ready SAV file to defensible, editable, client-quality PowerPoint deck.

**Gate result:** In scope, but narrow.

This work directly advances the active market-reset wedge:

```text
analysis-ready SAV file -> defensible, editable client deck
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

Velocity should not merely prove that a PPTX download can happen. It should prove that a researcher can produce a deck they would plausibly send to a client after normal professional review.

The target experience:

1. Load an analysis-ready SAV or CSV file.
2. Build or accept a first-pass deck outline.
3. Inspect findings, caveats, and proposed slide sequence.
4. Edit titles, notes, visual treatments, filters, weights, and template bindings.
5. Export a PowerPoint that is editable, visually coherent, narratively useful, and statistically defensible.
6. Reopen or refresh the job for a later wave without rebuilding from scratch.

## 3. Core User Stories

### Story 1: First-Pass Client Deck

As an independent research consultant, I want Velocity to turn an analysis-ready SAV file into a first-pass client deck so I can start from a coherent story rather than a blank PowerPoint.

Acceptance:

- The deck has a title, sections, and slide sequence.
- Each slide has a clear question/finding, analysis table or chart, base size, filters, weight status, and notes.
- The user can approve, reject, reorder, or edit every generated slide before export.
- The exported PPTX is editable and does not contain clipped text or unreadable tables.

### Story 2: Researcher-Controlled Story Building

As a researcher, I want to stitch individual analyses into a narrative arc so the report answers the client question rather than listing crosstabs.

Acceptance:

- Slides can be grouped into sections such as "Executive Summary", "Key Drivers", "Segment Differences", and "Implications".
- Each slide can carry a role: context, finding, comparison, caveat, recommendation, appendix.
- The deck review surface highlights gaps such as no summary, unsupported recommendation, repeated chart, missing base note, or weak transition.
- Speaker notes preserve interpretation separately from slide visuals.

### Story 3: Template and Brand Fit

As a boutique agency user, I want exports to fit my client's template so I spend minutes polishing rather than hours rebuilding.

Acceptance:

- A user can import a client template and map placeholders.
- The export preserves untouched template content where possible.
- The user can choose wave refresh vs full rebuild.
- The review surface identifies unmapped placeholders, missing content slots, and template warnings before export.
- Exported slides use stable typography, spacing, and colors appropriate for the selected template or theme.

### Story 4: Wave Refresh

As a tracker owner, I want to refresh a previous deck with a new wave of data so recurring reporting is repeatable.

Acceptance:

- The user can compare the saved deck recipe against the replacement dataset.
- Missing row, column, filter, weight, and variable-set references are grouped by slide.
- Blocking issues prevent only affected selected slides from export.
- Non-blocking assumptions are visible and auditable.

### Story 5: Trust and Audit

As a client-facing analyst, I want every slide to be defensible so I can explain how the number was produced.

Acceptance:

- Every slide carries provenance: dataset, row/column variables, filters, weight, base size, significance settings, and warnings.
- The review surface flags low bases, missing weights, unresolved filters, unsupported variables, and statistical caveats.
- PPTX speaker notes or an appendix can include methodology notes and limitations.
- A reviewer can reproduce a slide from the deck recipe.

### Story 6: Smooth Working Session

As a deadline-driven user, I want the workflow to feel immediate and predictable so I trust the tool under pressure.

Acceptance:

- Common interactions respond without visible stall: selecting variables, opening export review, switching scope, toggling options, and moving slides.
- Long operations show progress and remain cancel-safe where feasible.
- The user never has to guess whether export is blocked, running, failed, or complete.
- The app does not lose current work when returning to Workspace or reopening a stored dataset.

## 4. Report Quality Standard

A Velocity report is "good enough" only when it passes all five dimensions below. "Works" is not enough.

| Dimension | Minimum Standard | Evaluation Evidence |
| :--- | :--- | :--- |
| Analytical defensibility | Numbers, bases, filters, weights, and caveats are visible or inspectable. No silent unresolved references. | readiness diagnostics, provenance metadata, parity/golden checks |
| Narrative usefulness | Slides answer a client question in a coherent order, with section intent and notes. | deck-story rubric, human review, agent eval artifact |
| PowerPoint quality | PPTX is editable, visually readable, consistently styled, and free of clipping/overlap. | automated PPTX inspection, rendered slide screenshots, manual review |
| Workflow smoothness | The primary journey feels fast, recoverable, and predictable. | Playwright timings, UI screenshots, console/log review, user observation |
| Configurability | User can adapt scope, template, refresh mode, title, notes, display options, and selected slides without code. | UI tests, demo contract, user story task run |

### Quality Rubric

Score each deck 0-3 per dimension.

| Score | Meaning |
| :--- | :--- |
| 0 | Fails the user goal or produces misleading/unusable output. |
| 1 | Technically completes but requires heavy manual repair. |
| 2 | Usable after normal professional review and light polish. |
| 3 | Strong enough to be a credible pilot demo with clear evidence and low rework. |

Promotion bar:

- No dimension below 2.
- PowerPoint quality, analytical defensibility, and workflow smoothness must each score 2+.
- At least one real or representative pilot deck must score 3 on narrative usefulness or configurability before claiming "works well".

## 5. Evaluation Harness

### 5.1 Automated PPTX Inspection

Add a repeatable inspector that opens exported `.pptx` files and reports:

- slide count
- section/title slide presence
- editable text boxes and tables
- speaker notes presence
- placeholder replacement status
- remaining `{{...}}` template tokens
- empty slides
- text overflow/clipping heuristics where XML bounds allow it
- theme/font/color usage
- file size and media inventory

Validation output:

```text
demo/artifacts/report-quality/<run-id>/
  exported.pptx
  pptx_inspection.json
  slide_renders/
  visual_review.md
```

### 5.2 Rendered Slide Review

Render exported PPTX slides to images and check:

- title legibility
- table readability
- chart axis/legend readability
- no obvious overlap
- no important content outside slide bounds
- consistent margins
- sufficient contrast

Use rendered images as evidence in PRs and pilot readouts.

### 5.3 Story Quality Review

Add a lightweight deck-story evaluator:

- Does the deck have a stated audience and job?
- Does each section have a purpose?
- Does each slide have one clear point?
- Are findings supported by data on the slide?
- Are caveats placed where a user will see them?
- Are recommendations separated from evidence?
- Is there too much repetition?
- Is there an executive summary or equivalent?

This can start as a human checklist, then become an agent-evaluable artifact.

### 5.4 UX Smoothness Review

Extend demo contracts to measure:

- time to load dataset
- time to first crosstab
- time to create first slide
- time to open export review
- time to switch scope and template mode
- time to export PPTX
- console errors/warnings
- long task count if available
- whether controls are visible and unclipped at desktop and tablet widths

Target initial thresholds:

- first representative crosstab under 5 seconds on pilot-sized files
- export review opens under 1 second after the deck is ready
- one-slide PPTX export under 3 seconds for small files
- no modal clipping at 1280px and 1440px desktop widths
- no blocking console errors

### 5.5 Pilot Review Loop

For each paid or representative pilot:

1. Capture the original user job.
2. Capture the source file type and row/variable count.
3. Run the deck journey.
4. Save the exported deck and session.
5. Score the deck against the quality rubric.
6. Record rework needed in PowerPoint.
7. Record whether the user would use the output as a starting point.

## 6. Buildout Kanban

### Ready

| Card | Outcome | Dependencies | Parallelizable | Owner | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Define report-quality fixtures | 2-3 representative datasets plus expected deck jobs exist. | none | yes | unassigned | fixture brief + checked-in small fixtures or documented private pilot placeholders |
| Build PPTX inspection script | Exported decks produce `pptx_inspection.json` with editability/template/notes checks. | none | yes | unassigned | script test on `demo/artifacts/deck-export-complete/latest/downloads/velocity-export.pptx` |
| Add rendered slide evidence | Demo flow renders exported PPTX slides into PNGs for visual review. | PPTX inspection script | after inspection | unassigned | artifact folder contains slide PNGs and no render failures |
| Extend demo timing contract | Demo runner records journey timings and key UI states for deck-native path. | none | yes | unassigned | updated `steps.json` includes timing fields for export review and PPTX export |
| Draft story-quality checklist | Human-review rubric exists for narrative coherence and slide usefulness. | none | yes | unassigned | checklist used on one existing demo deck |

### In Progress

| Card | Outcome | Dependencies | Parallelizable | Owner | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Fix current-standard blockers | Export modal is centered, title state is coherent, component tests run under Node 25. | none | no | Codex | targeted component tests pass |

### Backlog

| Card | Outcome | Dependencies | Parallelizable | Owner | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Deck review panel v2 | Review surface includes story role, caveats, bases, template status, and readiness in one pass. | story-quality checklist | no | unassigned | component tests + browser walkthrough screenshots |
| Story outline editor | Users can group slides into sections and assign slide roles. | deck review panel v2 | after panel | unassigned | user can create/reorder sections and export sections to PPTX |
| Configurable visual presets | Users can choose report visual treatments without code: table density, chart style, theme/template mode. | PPTX quality rubric | after rubric | unassigned | exported slides differ visibly and pass readability checks |
| Template mapping editor | Users can inspect and adjust placeholder-slot bindings. | PPTX inspection script | after inspection | unassigned | mapping editor test + template mismatch demo |
| Agent story draft eval | `velocity_draft_deck_plan` runs through an eval-style deck story task. | story-quality checklist, fixtures | after fixtures | unassigned | eval artifact scored with report-quality rubric |
| Wave refresh pilot task | Replacement dataset review and template refresh are tested end to end. | report-quality fixtures | after fixtures | unassigned | compatible and incompatible wave fixtures both reviewed |
| PowerPoint rework log | Pilot users record how much manual PPTX cleanup remained. | pilot review loop | after pilots | human owner | 5-8 pilot records or explicit blocker |

### Blocked

| Card | Outcome | Dependencies | Parallelizable | Owner | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Claim "works well" publicly | Product claim backed by deck quality, smoothness, and pilot evidence. | quality rubric scores, pilot records | no | human owner | no dimension below 2 on representative decks, pilot evidence accepted |

## 7. Dependency Notes

- PPTX inspection and rendered slide evidence should come before large UI expansion. They define what "good PowerPoint" means.
- Story-quality rubric can proceed in parallel with technical inspection because it evaluates a different failure mode.
- Template mapping editor should wait until inspection tells us which template failures are common.
- Agent drafting should stay bounded until human story-review criteria are stable.
- Configurable visual presets should be narrow at first: table density, chart/table style, theme/template mode. Avoid a broad design studio.

## 8. Parallelization Opportunities

Safe to start in parallel:

- report-quality fixtures
- PPTX inspection script
- story-quality checklist
- demo timing contract

Should stay single-threaded:

- deck review panel v2, because it defines the shared review surface
- template mapping editor, because it touches export contracts and UI
- public product claims, because they depend on pilot evidence

Recommended first pull:

1. Build PPTX inspection script.
2. Draft story-quality checklist.
3. Extend demo timing contract.

This creates the evidence loop before more product surface area is added.

## 9. PR Evidence Standard

Any PR that claims to improve the deck-native journey should include:

- user story covered
- before/after screenshots or PPTX renders
- exported PPTX artifact path
- timing evidence for the affected flow
- tests run
- rubric impact: which report-quality dimension improved
- remaining rework a human would still need in PowerPoint

## 10. Open Questions

1. What are the first two report archetypes to optimize: brand tracker, concept test, CX/NPS, employee survey, or generic cross-tab report?
2. Should the first narrative standard optimize for executive summary decks or appendix-heavy research decks?
3. Which client-template constraints matter most in pilots: brand colors, master layouts, placeholder mapping, chart styling, or editable table fidelity?
4. What is the acceptable manual-rework budget after export: 5 minutes, 15 minutes, or "less than rebuilding from scratch"?
5. Should speaker notes be treated as required for agent-generated slides, or optional for human-created slides?

