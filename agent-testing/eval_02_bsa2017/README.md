# Eval 02: BSA 2017 — Agent Analysis Scripts

**Date:** 2026-03-12
**Agent:** Claude Opus 4.6 via Claude Code CLI
**Dataset:** `test_data/British Social Attitudes Survey/bsa2017_for_ukda.sav`
**Output:** `output/bsa2017_analysis.pptx`

## Scripts (run in order)

All scripts drive VelocityEngine directly via `npx tsx` from the repo root.

### 1. `01_explore.ts` — Variable Inspection
Loads the dataset, sets weight, and prints frequency distributions for 13 key variables.
```bash
npx tsx agent-testing/eval_02_bsa2017/01_explore.ts
```

### 2. `02_crosstabs_raw.ts` — Raw Crosstab Output
Runs 12 crosstabs and prints raw JSON rows + chi-square stats. Useful for debugging.
```bash
npx tsx agent-testing/eval_02_bsa2017/02_crosstabs_raw.ts
```

### 3. `03_crosstabs_formatted.ts` — Formatted Percentage Tables
Runs 14 crosstabs and formats them as column-percentage tables with bases. This is the analysis the deck was designed from.
```bash
npx tsx agent-testing/eval_02_bsa2017/03_crosstabs_formatted.ts
```

### 4. `04_build_deck.ts` — Build & Export PPTX
Builds the 13-slide DeckSpec and exports to `output/bsa2017_analysis.pptx`.
```bash
mkdir -p output
npx tsx agent-testing/eval_02_bsa2017/04_build_deck.ts
```

## Notes

- Scripts import from `../src/engine/index.js` — they must be run from the repo root
- The engine uses ReadStat-WASM fallback for SAV loading (DuckDB read_stat extension not available at v1.4.4)
- `exportSession()` fails with undefined data — known bug, PPTX export works fine
- Chi-square `statistic` field returns undefined in crosstab results (p-values are present)
- All analyses are weighted with `WtFactor`

## What was NOT scripted

Several steps were run as inline `npx tsx -e` one-liners during the session:
- Initial `loadFile()` + `describe()` to get dataset overview
- `annotateDataset()` (287/654 annotated)
- `searchVariables()` × 5 themed queries
- `describeVariable()` for return-shape probing
- Direct name-pattern filtering for demographic variables

These are documented in `docs/eval_02_process_log.md`.
