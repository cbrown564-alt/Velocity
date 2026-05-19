# Eval 02: BSA 2017 — Agent Analysis Scripts

**Date:** 2026-03-12  
**Dataset:** `test_data/British Social Attitudes Survey/bsa2017_for_ukda.sav`  
**Frozen deliverables:** `runs/run-2026-03-13/artifacts/deck.pptx`, `session.velocity`, `summary.json`

Reproducible scripts that drove VelocityEngine for the EVAL-02 benchmark run. Run from the **repository root**.

## Scripts (in order)

### 1. `01_explore.ts` — Variable inspection

```bash
npx tsx evals/eval-02/scripts/01_explore.ts
```

### 2. `02_crosstabs_raw.ts` — Raw crosstab output

```bash
npx tsx evals/eval-02/scripts/02_crosstabs_raw.ts
```

### 3. `03_crosstabs_formatted.ts` — Formatted percentage tables

```bash
npx tsx evals/eval-02/scripts/03_crosstabs_formatted.ts
```

### 4. `04_build_deck.ts` — Build and export PPTX

Writes scratch output under `output/` (gitignored). Canonical deck for scoring is in `runs/run-2026-03-13/artifacts/`.

```bash
mkdir -p output
npx tsx evals/eval-02/scripts/04_build_deck.ts
```

## Notes

- Imports resolve to `src/engine/` via relative paths; do not move scripts without updating imports.
- Weight variable: `WtFactor`.
- Session narrative: `runs/run-2026-03-13/process_log.md` and `docs/archive/2026-03/phase4-eval/eval_02_process_log.md`.
