# SBT-001 Publication Deck — Design Iteration Workstream

## Purpose

This branch starts after the evaluation-first research-quality backbone was merged. Its job is now narrower: turn the frozen SBT-001 visual arguments and storyboard into a genuinely publication-quality research deck, then iterate against rendered evidence rather than aesthetic intuition.

## Source of truth

Build from the merged research-quality artifacts:

- publication-quality reference analysis;
- visual-argument schema;
- Category Board visual-argument plan;
- redesigned 10-slide storyboard;
- deterministic SBT-001 analysis outputs and finding inventory.

Do not reopen the research story merely to make rendering easier. If a slide cannot express the specified analytical relationship cleanly, improve the visual form rather than reverting to a generic chart/card template.

## Design target

The intended quality bar is closer to a strong Pew / YouGov / Deloitte / Ipsos research publication than to automated PowerPoint reporting.

The deck should demonstrate:

1. strong page-level hierarchy;
2. chart forms selected for the analytical relationship;
3. direct annotation and context where it changes interpretation;
4. commentary that synthesises rather than repeats plotted values;
5. varied narrative rhythm across the deck;
6. aggressive editing and whitespace;
7. methodological qualification adjacent to the affected claim;
8. native/editable PowerPoint output;
9. correct rendering with no broken connectors, clipping, overlaps or fragile line construction.

## Planned iterations

### Iteration A — visual system + first three pages

Build and render:

1. cover/category thesis;
2. executive synthesis;
3. competitive landscape position × momentum map.

Freeze typography, spacing, chart-label conventions, source-note treatment and semantic colour only after these three pages work as a coherent opening.

### Iteration B — Pulse chapter

Build:

4. breakout hero trend;
5. younger-consumer driver comparison;
6. perception → behaviour progression.

The three pages should read as one argument: breakout → audience → conversion challenge.

### Iteration C — Northstar + Harbour

Build:

7. market/customer divergence;
8. multidimensional recovery;
9. installed-base versus future-acquisition diagnosis.

### Iteration D — close + deck-level QA

Build:

10. implications framed as management questions.

Then review the deck as a sequence rather than ten independent slides: pacing, repetition, density, transitions, colour burden and whether each page has one dominant message.

## QA gates

A slide is not accepted because the PPTX was generated successfully.

For every iteration:

- render every changed slide to an image/PDF;
- visually inspect the rendered artifact;
- verify plotted geometry against source values;
- verify labels/annotations against the visual-argument contract;
- ensure commentary adds information not already legible from the chart;
- reject any slide whose hierarchy depends on reading body copy first;
- reject any broken or visually discontinuous trend line;
- reject any page that looks like a dashboard/card grid unless the analytical relationship specifically calls for a matrix/small-multiple form;
- preserve editability where practical.

## First implementation target

Do not immediately regenerate all ten slides. Start with slides 1–3 because they establish the publication system and contain three different design jobs: editorial opening, synthesis, and analytical overview. Once those survive rendered review, extend the system through the brand chapters.
