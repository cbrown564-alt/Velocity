# Brand Tracker Story Template

**Status:** Draft for human review
**Date:** 2026-06-28
**Workstream:** Deck-native SAV-to-deck experience
**Supports:** `07_report_quality_experience_plan_v2.md` — the target shape for the **north-star exemplar** (§4) and the **agent story-draft eval** (§10).

> **Purpose.** This is the canonical narrative spine for the primary archetype (brand / category tracker). It is the concrete answer to "what does a *good* tracker deck look like?" so that (a) a human can build the north-star exemplar against it, (b) the action-title and story-quality evals can score against it, and (c) `velocity_draft_deck_plan` has a bounded target instead of inventing structure per run. It is opinionated on purpose. It is **not** a rigid form to fill in — see §6 adaptation rules and §7 anti-patterns.

## 1. What a tracker deck is for

A wave of tracking data answers one standing client question: **"Is our brand getting healthier, and what is moving it?"** Everything in the deck serves that question. A tracker deck is judged differently from a one-off study because the audience has seen prior waves: **change is the story.** A slide that shows a number without showing its movement (vs. prior wave, vs. category) has wasted the slide.

- **Audience:** brand/insights lead and their stakeholders, who have limited time and prior context.
- **Job:** decide whether to stay the course or intervene, and where.
- **The "so what" of the whole deck:** a one-sentence verdict on brand health direction + the one or two levers that explain it.

## 2. Narrative spine (executive summary = SCR)

The deck opens with an executive summary built on **Situation → Complication → Resolution**, not a table of contents. This is the pyramid apex: a reader who sees only this page should get the answer.

| SCR beat | Tracker content | Example sentence |
| :--- | :--- | :--- |
| **Situation** | Where the brand stood / the standing goal | "Brand A entered Q2 as category #2, with health stable across three waves." |
| **Complication** | What changed this wave that demands attention | "This wave, unaided awareness fell 5pts while the new entrant doubled consideration." |
| **Resolution** | The verdict + the lever | "Health is slipping at the top of the funnel, not the bottom — the fix is awareness media, not conversion." |

The exec summary slide carries **3–4 supporting takeaways** (one per body section), each a complete action title. A partner reading only the exec summary + section dividers should follow the whole argument.

## 3. Canonical section order

Order is fixed top-down (conclusion first); within sections, lead with the headline movement. Slide counts are guidance for a ~15–25 slide wave readout, not quotas.

| # | Section | Purpose (the "so what") | Slides | Default slide roles |
| :--- | :--- | :--- | :--- | :--- |
| 0 | **Title + context** | Client, brand, category, wave, fielding dates, base, method | 1 | context |
| 1 | **Executive summary** | The verdict + 3–4 supporting takeaways (SCR) | 1–2 | finding (summary) |
| 2 | **Brand health headline** | Overall health/equity index this wave vs. prior + vs. category | 1–2 | finding |
| 3 | **The funnel** | Where in awareness → consideration → usage → preference → advocacy the movement is | 2–4 | finding, comparison |
| 4 | **Competitive position** | Brand vs. named competitors on the metrics that moved | 2–3 | comparison |
| 5 | **Drivers / why** | What is explaining the movement: imagery/attributes, key drivers, NPS verbatims | 2–4 | finding, comparison |
| 6 | **Segment differences** | Who is moving (demographics, segments, regions) — only where it changes the action | 1–3 | comparison |
| 7 | **Implications / recommendations** | What to do — separated from evidence | 1–2 | recommendation |
| 8 | **Appendix** | Methodology, full funnel table, question wording, base sizes, significance settings | 2+ | appendix, caveat |

## 4. Per-slide blueprint

For each canonical slide: what it shows, the analysis spec (what Velocity computes), the action-title pattern, caveat placement, and wave-refresh behavior. Action-title rules from `07_..._v2.md` §8.1: **conclusion not topic, ≤15 words, direction + magnitude, supported by on-slide data.**

### 2 · Brand health headline

- **Shows:** the headline equity/health metric (or composite index) for the client brand, this wave vs. prior wave(s) and vs. category average. A trend line across available waves is the ideal chart (Pew-style: one clear takeaway, base labelled).
- **Analysis spec:** metric = brand health score; rows = waves; series = client brand + category benchmark; base = total (weighted); significance vs. prior wave flagged.
- **Title pattern:** `[Metric] [direction] [magnitude] to [value], [vs. category / vs. prior]`.
  - ✅ "Brand health up 4pts to 62, closing the gap on the category leader."
  - ❌ "Brand Health Index." (topic, not conclusion → fails action-title eval)
- **Caveats:** if the change is within margin of error, the title must say so ("broadly stable") — never imply significance that isn't there. This is the "confident but indefensible" guard.
- **Wave refresh:** direction + magnitude recompute from the new wave; significance re-tested; title flagged for human confirmation, never silently rewritten.

### 3 · The funnel

- **Shows:** awareness (unaided/aided) → consideration → usage/penetration → preference → advocacy, this wave vs. prior, with the **biggest mover highlighted**. One funnel slide for the client brand; optionally a second comparing conversion rates between steps.
- **Analysis spec:** each funnel stage = a metric over total base (weighted); paired bars or slope (this wave vs. prior); conversion = stage / prior stage.
- **Title pattern:** name the stage that moved and the consequence.
  - ✅ "The leak is at the top: unaided awareness fell 5pts while conversion held."
  - ❌ "Purchase Funnel."
- **Caveats:** low-base funnel stages (e.g., advocacy among a small user base) carry a base flag on the exhibit.
- **Wave refresh:** the highlighted mover recomputes; if a different stage now moves most, the highlight and title follow the data.

### 4 · Competitive position

- **Shows:** client brand vs. named competitors on the one or two metrics that moved (not every metric). Ranking or small-multiples across competitors.
- **Analysis spec:** rows = brands; columns = the moved metric(s); base = total; significance vs. nearest competitor.
- **Title pattern:** state the rank/gap change.
  - ✅ "Brand B overtook us on consideration for the first time in five waves."
- **Caveats:** competitor bases shown if asymmetric.
- **Wave refresh:** rank changes recompute; "for the first time / Nth consecutive wave" phrasing recomputes from history in the recipe.

### 5 · Drivers / why

- **Shows:** what explains the headline — brand imagery/attribute shifts, key-driver analysis, or advocacy verbatims. This section converts "what moved" into "why," which is what separates a story from a crosstab dump.
- **Analysis spec:** attribute battery vs. prior wave (which associations rose/fell); optional derived importance (driver analysis) if available; NPS/verbatim themes as qualitative support.
- **Title pattern:** causal, but honest about correlation.
  - ✅ "'Innovative' associations fell 6pts — the likely driver of weaker consideration."
  - ❌ "Brand Attributes." Also avoid overclaiming causation the data can't support.
- **Caveats:** if driver analysis is inferred, label it; keep recommendation language out of this section (evidence here, action in §7).
- **Wave refresh:** attribute deltas recompute; the attribute(s) called out follow the largest significant shift.

### 6 · Segment differences

- **Rule:** include a segment slide **only when the segment cut changes the recommended action.** A demographic breakdown that says "everyone moved the same way" belongs in the appendix, not the body. This is the most common place trackers bloat into crosstab dumps.
- **Analysis spec:** the moved metric broken by segment (banner); significance between segments; base per segment cell with low-base flags.
- **Title pattern:** name the segment and the divergence.
  - ✅ "The awareness drop is concentrated in under-35s; older buyers are stable."
- **Wave refresh:** segment deltas recompute; section auto-demotes to appendix if no segment diverges significantly.

### 7 · Implications / recommendations

- **Shows:** 1–2 slides translating the verdict into action. Recommendations are **separated from evidence** (pyramid discipline) and each ties back to a finding earlier in the deck.
- **Title pattern:** imperative, specific.
  - ✅ "Defend awareness now: shift Q3 budget to upper-funnel reach in under-35s."
- **Caveats:** recommendations must be supported by a slide in §2–§6; the story-quality eval flags an "unsupported recommendation."
- **Wave refresh:** recommendations are **not** auto-generated on refresh; they are human-authored and flagged stale when the underlying finding changes.

### 8 · Appendix

- Full funnel table, question wording, base sizes per metric, weighting scheme, significance settings, and any low-base or methodology caveats. Defensibility lives here so the body can stay clean. Every body number must be reproducible from the appendix + recipe.

## 5. Mapping to Velocity primitives

So the agent-drafting card and the recipe have a concrete contract:

```text
Brand Tracker Report Job =
  dataset fingerprint (this wave)
  + prior-wave reference(s)              # enables direction + magnitude titles
  + brand set (client + named competitors)
  + funnel metric set (awareness ... advocacy)
  + attribute/driver battery
  + segment banner (demographics / segments)
  + weight + significance settings
  + section template (this document)
  + client template + bindings
```

- **Direction + magnitude in titles** requires the prior wave in the recipe; without it, titles degrade to level-only and the slide is flagged "no comparison available."
- **"For the first time / Nth wave" phrasing** requires wave history, not just the immediately prior wave.
- **Auto-demotion of flat segment slides** requires significance testing on the banner.

## 6. Adaptation rules

The template adapts; it is not a fixed 25-slide form.

- **Add** a section only when the data earns it (e.g., a "category context" section if the whole category shifted).
- **Drop / appendix** any section with no significant movement — a flat funnel or flat segments go to the appendix with a one-line "no significant change" note, not a body slide.
- **Reorder within a section** to lead with the biggest mover.
- **Concept-test variant** (secondary archetype) reuses the SCR spine and action-title discipline but swaps sections 2–6 for: concept appeal → vs. benchmark/norms → diagnostics (likes/dislikes) → segment appeal → recommendation (proceed/iterate/kill).

## 7. Anti-patterns (the failure modes this template prevents)

- **Crosstab dump:** one slide per question in field order, topic titles, no exec summary. → Fails narrative; this template's fixed section order and action titles exist to prevent exactly this.
- **Every-metric competitive slide:** showing all brands on all metrics. → Show only what moved.
- **Significance theatre:** bold causal titles on within-margin-of-error changes. → Honest "broadly stable" language; the defensibility guard blocks it.
- **Recommendations woven into evidence:** → keep §5 evidence-only, §7 action-only.
- **Segment bloat:** a breakdown slide for every demographic regardless of divergence. → §6 rule: only where it changes the action.

## 8. Acceptance checklist ("this deck follows the template")

A deck conforms when:

- [ ] Opens with an SCR executive summary carrying 3–4 supporting takeaways.
- [ ] Sections appear in canonical order; flat sections are demoted to appendix.
- [ ] **Every body slide has a takeaway (action) title** stating a conclusion with direction + magnitude.
- [ ] The headline health slide compares vs. prior wave **and** vs. category.
- [ ] The funnel slide highlights the biggest significant mover.
- [ ] Drivers section explains the headline without smuggling in recommendations.
- [ ] Segment slides appear only where a segment diverges significantly.
- [ ] Recommendations are separated from evidence and each ties to an earlier finding.
- [ ] Every body number is reproducible from the appendix + recipe (bases, weights, significance stated).
- [ ] No "confident but indefensible" titles (no significance claimed beyond what the test supports).

This checklist is the brand-tracker specialization of the story-quality review (`07_..._v2.md` §9.3) and is what the action-title eval and exemplar diff score against.
