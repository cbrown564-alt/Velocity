# Eval Artifacts

Every Phase 4 eval run should produce the same on-disk evidence package so runs are reviewable and machine-comparable.

## Canonical Structure

```text
evals/
  eval-01/
    runs/
      run-YYYY-MM-DD/
        brief.md
        process_log.md
        scorecard.md
        gap_review.md
        artifacts/
          deck.pptx
          session.velocity
          summary.json
```

Use the same shape for `eval-02` through `eval-06`.

## Required Files

- `brief.md`: The exact eval brief used for the run. Copy the brief or link the checked-in doc and record the commit hash in `summary.json`.
- `process_log.md`: Chronological notes on what the agent or human did, where it got stuck, and what workarounds were required.
- `scorecard.md`: Per-layer 1-5 scores using the rubric in `docs/eval_00_outcome_decision_framework.md`.
- `gap_review.md`: Strategic interpretation using `docs/eval_00_capability_gap_review.md`.
- `artifacts/deck.pptx`: The exported deck, or the primary human-facing output format if the eval uses XLSX instead.
- `artifacts/session.velocity`: The exported session file when session handoff is part of the run or when the workflow reaches the intended persist step.
- `artifacts/summary.json`: Structured run metadata matching `docs/eval_00_run_summary_schema.ts`.

## Normalization Rules

- Always create the `artifacts/` directory, even if the run is blocked.
- If a file is not produced because the run failed or the eval does not require it, leave the file absent and record the reason in `summary.json`.
- Keep one run directory per date unless you need multiple runs that day; then suffix with `-a`, `-b`, and so on.
- Prefer relative paths inside `summary.json` so runs stay portable within the repo.
