# Eval Artifacts

Frozen benchmark evidence and canonical briefs. Scoring and gap review: **`docs/eval_framework.md`**. Schema: `docs/eval_00_run_summary_schema.ts`. Templates: `evals/templates/`.

## Canonical briefs

| Family | Brief |
| :--- | :--- |
| EVAL-03 | [`eval-03/brief.md`](eval-03/brief.md) |
| EVAL-04 | [`eval-04/brief.md`](eval-04/brief.md) |
| EVAL-05 | [`eval-05/brief.md`](eval-05/brief.md) |
| EVAL-06 | [`eval-06/brief.md`](eval-06/brief.md) |

EVAL-01 and EVAL-02 briefs live in their frozen `runs/run-2026-03-13/` directories.

## Run structure

```text
evals/eval-NN/
  brief.md
  runs/run-YYYY-MM-DD/
    brief.md
    process_log.md
    scorecard.md
    gap_review.md
    artifacts/
```

## Required per run

- `scorecard.md` — per `docs/eval_framework.md` Part I
- `gap_review.md` — per `docs/eval_framework.md` Part II
- `artifacts/summary.json` — per `docs/eval_00_run_summary_schema.ts`
