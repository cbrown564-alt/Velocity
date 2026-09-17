# Design Iteration 05 — Full-Deck Integration QA

## Status

The 10-slide Category Board design is now analytically unblocked. Slide 6 has been rebound to deterministic values from the committed SBT-001 generator, and the branch is confirmed **ahead of `main` by 6 commits and behind by 0**. The earlier GitHub `mergeable=false` value was therefore not evidence of branch divergence; current CI status on the head is successful for Vercel.

## Canonical sequence

1. Category thesis
2. Executive synopsis — selected Alternative A
3. Competitive position × momentum
4. Pulse breakout
5. Pulse younger-audience momentum
6. Pulse conversion gap
7. Northstar market/customer divergence
8. Northstar partial recovery
9. Harbour aggregate/youth divergence
10. Next-wave management questions

There is deliberately no slide explaining omitted findings.

## Evidence corrections incorporated

### Slide 6

All four stages now use deterministic weighted values:

- awareness: 57.79% → 73.82%;
- total-sample consideration: 20.29% → 29.59%;
- preference: 15.34% → 25.11%;
- usage/current provider: 15.16% → 19.79%.

Innovation is removed from the conversion ladder because it uses a familiar-brand routed universe and would visually imply denominator comparability that does not exist.

### Slide 9

Use aggregate consideration versus 18–34 consideration on the same scale. Do not use the earlier unverified installed-base framing.

## Whole-deck narrative QA

### Opening

Slides 1–3 should progressively narrow:

- Slide 1: thesis;
- Slide 2: evidence-backed synopsis;
- Slide 3: category structure.

Slide 2 Alternative A is canonical. Do not reintroduce card-based executive-summary layouts.

### Pulse chapter

Slides 4–6 form one argument:

1. **breakout** — Pulse moves to a new consideration range;
2. **audience** — younger consumers disproportionately drive the movement;
3. **conversion** — mental availability/preference have moved further than actual usage.

Avoid repeating the same campaign caveat at equal prominence on every page. State the observational limitation locally where causality is most tempting, then allow subsequent slides to focus on the evidence.

### Northstar chapter

Slides 7–8 intentionally change rhythm:

- Slide 7 is a juxtaposition of two universes, not a generic trend dashboard;
- Slide 8 is a W3/W4/W5 recovery comparison, not another line-chart page.

Red means deterioration/event shock, not permanent Northstar brand identity. W5 recovery uses amber/neutral rather than green-success semantics.

### Harbour chapter

Slide 9 should feel quieter than the Pulse/Northstar pages. The story is slow erosion, so the visual treatment should not manufacture drama. Identical scales make the divergence legible without exaggeration.

### Close

Slide 10 asks three management questions. It does not introduce new empirical claims or generic recommendations.

## Visual rhythm QA

The deck should alternate page jobs rather than repeat one template:

- thesis / typography;
- editorial evidence strip;
- analytical map;
- hero trend;
- dumbbell/audience comparison;
- conversion ladder;
- juxtaposition;
- recovery table/comparison;
- paired trends;
- typography-led close.

This variation is intentional and should survive implementation.

## Final render checklist

Before treating a generated PPTX as the canonical E6 reference:

- render all 10 slides to images/PDF;
- inspect at full size and thumbnail/contact-sheet scale;
- verify no connector discontinuities, clipping or overlap;
- verify Slide 3 labels do not collide;
- verify Slides 4, 7 and 9 line paths are continuous;
- verify Slide 5 dumbbell endpoints/labels remain legible;
- verify Slide 6 W2/W5 labels cannot be mistaken for a common denominator where definitions differ;
- verify all displayed values against deterministic analysis/generator outputs;
- verify footnotes accurately state universe/weight;
- verify no low-base Mosaic material appears;
- verify the deck reads as one argument without speaker narration.

## Repository status

At this iteration, `design/sbt001-publication-deck` is six commits ahead of `main` and zero commits behind. Vercel status on the current head is successful. If GitHub UI still reports the PR as non-mergeable, refresh PR mergeability before taking corrective branch action; do not force-update or synthesize a merge solely from a stale mergeability field.
