# SBT-001 Turn 6 — Publication-Quality Reference Deck

## Artifact status and provenance

This document records the **historical eight-slide Turn 6 design**, not the current ten-slide design or a verified reference for corrected v2 data. The later direction is owned by `sbt_001_slide_design_iteration.md` and `reference/story/category_board_storyboard_v2.json`; it removes the deliberate-omission slide described below.

The [original research conversation](https://chatgpt.com/c/6aaa9d34-4428-83eb-a4aa-dd87a352e481) contains `SBT-001_category_board_reference.pptx`, its v2 revision, and the later PR 73 `SBT-001_Category_Board_Canonical_v1.pptx`. These are searchable in the source account's [ChatGPT Library](https://chatgpt.com/library?search=SBT-001). The later canonical deck's ten-slide preview was located on 2026-09-21. Account-scoped conversation downloads are provenance, not a portable checked-in reference.

PR 73 subsequently added `scripts/python/research_pptx/build_sbt001_native_deck.py`. It uses fixed numerical literals; it is a separate prototype, not a data-bound v2 renderer. The project manifest therefore leaves `reference.deck` null. Before E6 reference acceptance, bind a renderer to the corrected analysis output, retain the PPTX and rendered slides with hashes, and inspect the full result. No historical image-base values below should be used as v2 evidence.

## Historical purpose

Turn 6 establishes the first concrete visual/research-design target for Velocity. It is intentionally not a generic auto-report template. The reference artifact is an 8-slide **Category Board** readout built from the frozen SBT-001 story hierarchy and deterministic data.

The editable PPTX is generated as a conversation artifact during Turn 6; this document freezes the design rationale so future renderers/models can be evaluated against the underlying decisions rather than exact pixels.

## Visual principles

### 1. Editorial headline first

Slide titles state the bounded finding or editorial point. Avoid questionnaire labels such as `Awareness by wave` as primary titles.

### 2. One dominant reading path

Each slide should have a clear first object, then supporting evidence. Avoid dashboard mosaics where every object has equal visual weight.

### 3. Evidence is native and editable

Charts/lines/bars are composed from editable PowerPoint shapes. Do not use screenshots of tables/charts as the reference output.

### 4. Consistency without sameness

The deck uses one typography/palette/spacing system but varies composition by analytical job:

- executive story cards;
- competitive small-multiple trends;
- hero trend + KPI evidence;
- contrasting customer/market measures;
- long-run single-story trend;
- editorial restraint/counterexample;
- decision-oriented close.

### 5. Restrained palette

Warm off-white paper background; dark navy/ink typography; blue for Pulse; red only for Northstar deterioration; grey for Harbour; limited accent colours. Colour carries semantics rather than decoration.

### 6. Caveats live beside the claim they qualify

Weighting, universe and causal limitations are local to the relevant slide. Methodological restraint is not hidden solely in an appendix.

## Slide architecture

### 1 — Cover / thesis

**Job:** establish that the deck is about three competitive dynamics, not a survey walkthrough.

Headline: `The category is splitting into three different competitive stories`.

### 2 — Executive readout

**Job:** compress the tracker into three decision-relevant stories.

Three cards: Pulse momentum; Northstar customer vulnerability; Harbour structural youth erosion.

### 3 — Competitive context

**Job:** show that Pulse has changed competitive shape while preserving overall context.

Use aligned mini-trends rather than one dense multi-series chart. The design lets the reader compare movement without forcing five coloured lines into one plotting area.

### 4 — Pulse

**Job:** show real momentum while demonstrating methodological restraint.

Primary evidence: weighted consideration trend. Supporting evidence: younger-consumer movement and innovation image. Explicit note: tracker association is not campaign causality; unweighted movement is diagnostic only.

### 5 — Northstar

**Job:** make the divergence itself visible.

Left: current-customer NPS trajectory. Right: prompted-awareness trajectory and recent-problem incidence. The contrast is the research story.

### 6 — Harbour

**Job:** make a gradual structural trend visually legible.

Single youth-consideration trajectory with ample whitespace. The slide deliberately avoids manufacturing drama with unnecessary decoration.

### 7 — Restraint

**Job:** make omission/taste visible as a product capability.

Contrast a tempting low-base Mosaic headline with the researcher's correct action: notice it, check it, leave it out.

This slide is unusual for a client deck but valuable in the reference/demo because it demonstrates the difference between mechanical automation and editorial judgement.

### 8 — Decision close

**Job:** leave the board with three actions/questions, not a recap of every metric.

## Reference numerical continuity

The generated reference uses deterministic SBT-001 values. Key displayed values include:

- Pulse total-sample consideration: ~20.3% W2 → ~27.2% W3 (+6.9pp in the total-incidence view used by the visual reference).
- Pulse 18–34 total-sample consideration: ~26.0% W2 → ~37.1% W3.
- Pulse innovation image: ~75.6% W2 → ~83.5% W3 among the valid familiar-brand base.
- Northstar current-customer NPS: ~−12.5 W3 → ~−60.7 W4 → ~−33.2 W5.
- Northstar prompted awareness: ~93.5% W3 and W4.
- Northstar recent-problem incidence: ~13.8% W3 → ~34.1% W4 → ~21.8% W5 among current customers.
- Harbour 18–34 total-sample consideration: ~22.1% W1 → ~15.0% W5.

Note that Turn-4's earlier `F_PULSE_CONSID_UP` finding uses the prompted-aware denominator and therefore has a different percentage-point change. Turn 6 deliberately labels its displayed Pulse measure as **total-sample consideration incidence**. This is a useful example of why every visual claim must carry its universe rather than assuming all 'consideration' measures are interchangeable.

## Turn 7 implications

The historical design proposed these controlled negative variants; a verified, retained reference is still required:

1. questionnaire-order/mechanical deck;
2. dashboard-density deck;
3. AI-consultant overclaiming deck;
4. visually polished but methodologically wrong deck;
5. overcautious data-dump deck.

Pairwise evaluation should compare rendered slides/decks while deterministic checks independently verify numbers, bases and claim support.
