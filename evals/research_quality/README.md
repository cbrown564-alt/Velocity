# Research Quality Evaluation Harness

This directory is the implementation home for the evaluation programme defined in `docs/workstreams/research_quality/00_strategy.md`.

## Design rules

1. Split by **project**, never random respondent rows.
2. Freeze hidden eval projects before fine-tuning.
3. Keep objective and subjective grading separate.
4. Numbers and survey invariants are graded by code/reference outputs.
5. Taste is graded primarily by researcher pairwise preference.
6. Store complete run provenance so model, prompt, tools and costs are reproducible.
7. No evaluation artifact becomes training data.

## Planned layout

```text
evals/research_quality/
  README.md
  schemas/
    project_bundle.schema.json
    run_record.schema.json
    finding.schema.json
  registry/
    datasets.jsonl
    splits.jsonl
  projects/
    public/
    synthetic/
  graders/
    prep/
    analysis/
    deck/
    taste/
  runs/
```

## Tracks

| ID | Track | Primary grading |
|---|---|---|
| E1 | Survey interpretation | reference + deterministic |
| E2 | Preparation execution | deterministic |
| E3 | Brief-to-analysis plan | reference + expert |
| E4 | Numerical analysis/findings | deterministic |
| E5 | Story selection | researcher pairwise preference |
| E6 | Deck generation | deterministic + researcher preference |
| E7 | Steerability/revision | invariants + researcher preference |
| E8 | End-to-end outcome | composite scorecard, no single opaque score |

## First milestone

A single runner should execute the same frozen project against multiple approaches and write one run record per system:

- current Velocity baseline;
- strong general model without Velocity tools;
- strong general model with Velocity tools;
- public specialist model where practical;
- later Velocity fine-tunes.

The first milestone is complete when a scorecard can explain not merely which system performed better, but **why**: preparation correctness, analysis correctness, finding coverage, story quality, deck quality, steerability and researcher correction burden.
