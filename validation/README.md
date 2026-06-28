# Validation

This directory holds two kinds of artifact:

1. **Performance benchmarks** — regenerable JSON readings of build size, SAV
   ingestion, crosstab processing, and the production-browser dashboard (see
   below).
2. **R reference fixtures** — R scripts that generate statistical ground-truth
   fixtures (see [Validation: R Reference Fixtures](#validation-r-reference-fixtures)).

## Performance Benchmarks

These scripts produce the `*_latest.json` readings that the performance review
(`docs/reviews/performance_review_2026-06-28.md`) cites.

| Command | Output | What it measures |
| :--- | :--- | :--- |
| `npm run benchmark:sav` | `benchmark_sav_ingestion_latest.json` | SAV metadata/parse/ingest time + peak RSS (Node) |
| `npm run benchmark:sav:v2v3` | `benchmark_sav_v2_v3_latest.json` | v2 vs v3 SAV parser parse/vectorize time (Node) |
| `npm run benchmark:crosstab` | `benchmark_crosstab_render_latest.json` | `processAnalysisData`/`buildTree` time on stress shapes (Node) |
| `npm run benchmark:perf` | `performance_dashboard_latest.json` | Production-browser cold start → first crosstab → export modal (Playwright) |

The medium-band SAV fixtures write to `benchmark_sav_ingestion_midsize.json`
(`npm run benchmark:sav -- --output=validation/benchmark_sav_ingestion_midsize.json`);
those `.sav` inputs are local-only / gitignored.

### Reproducible working artifacts vs. frozen pilot evidence

The `*_latest.json` files are **reproducible working artifacts**, not frozen
evidence. Treat them as the *current local baseline*: regenerate them freely,
and let a performance PR overwrite them intentionally. Two consequences:

- **Timing is environment-sensitive.** The Node benchmarks' RSS high-water marks
  are GC-noisy, and the `benchmark:perf` dashboard is a single-sample wall-clock
  reading on whatever machine runs it. Only the dashboard's **byte** metrics
  (`startupJsTransferBytes`) are deterministic for a given build — those are the
  ones gated in CI (`tests/e2e/production-smoke.spec.ts`,
  `tests/e2e/helpers/performanceBudget.ts`). Compare timings only within the same
  machine/run, never across machines.
- **Do not cite `*_latest.json` directly to stakeholders.** When a measurement
  becomes a *pilot claim*, copy it to a dated, descriptive filename
  (e.g. `validation/frozen/perf_dashboard_2026-06-29_macbook.json`) so a later
  rerun cannot silently overwrite the evidence behind the claim. Frozen evidence
  is never regenerated in place.

# Validation: R Reference Fixtures

This directory contains R scripts that generate reference JSON fixtures for
Velocity's statistical correctness tests. The fixtures are committed to
`tests/golden/expected/r_*.json` so CI has **no R dependency** — R is only
needed when regenerating fixtures (e.g., after algorithm changes).

## Why R?

R's `haven` + `survey` packages are the academic gold standard for weighted
survey statistics. By comparing Velocity's output against R on real SPSS files
(`sleep.sav`, `bsa93.sav`) we get an independent verification that Velocity's
crosstab engine, weighting, chi-square, and ESS calculations are correct.

## Setup (one-time)

### 1. Install R

- macOS: `brew install r` or download from <https://cran.r-project.org/>
- The scripts assume Rscript is on your PATH

### 2. Install R packages

```bash
Rscript validation/r/install_packages.R
```

Required packages: `haven`, `jsonlite`

## Generating Fixtures

Run from the repository root:

```bash
Rscript validation/r/generate_ground_truth.R
```

This reads the SPSS files in `test_data/` and writes fixture JSON files to
`tests/golden/expected/r_*.json`. Commit the updated fixtures alongside any
algorithm changes.

## Running Parity Tests

```bash
# R parity tests only
npx vitest run tests/golden/r_parity

# Full test suite
npm run test:run
```

## Test Coverage

### sleep.sav (271 rows, no survey weight)

> Note: the `WEIGHT` column in sleep.sav is respondent body weight, not a
> survey weight. All sleep.sav tests are unweighted.

| Test | What it validates |
|------|------------------|
| 1 | Unweighted frequency: `SEX` |
| 2 | Unweighted crosstab: `MARITAL` × `SEX` |
| 3 | Chi-square + Cramér's V: `MARITAL` × `SEX` |
| 4 | Unweighted mean/stddev: `AGE` by `SEX` |
| 5 | Unweighted mean/stddev: `AGE` by `MARITAL` |

### bsa93.sav (2,945 rows, survey weight: `WTFACTOR`)

| Test | What it validates |
|------|------------------|
| 6  | Unweighted frequency: `TAXSPEND` |
| 7  | Weighted frequency: `TAXSPEND` with `WTFACTOR` |
| 8  | Unweighted crosstab: `NHSSAT` × `VERSION` |
| 9  | Weighted crosstab: `NHSSAT` × `VERSION` with `WTFACTOR` |
| 10 | Chi-square + Cramér's V: `NHSSAT` × `VERSION` |
| 11 | Weighted frequency: `DOLE` with `WTFACTOR` |
| 12 | ESS per group: `VERSION` with `WTFACTOR` (Kish's approximation) |

### WVS Wave 7 (97,220 rows) — fixtures only, tests skipped

The WVS file fails to parse in Velocity's ReadStat-WASM with
`Levels read error. Magic value Expected: 4 Actual: 0`.
R fixtures are committed so parity tests can be activated immediately when
the parsing bug is fixed (change `.todo` → `it` in `r_parity.test.ts`).

## Key Formula Decisions

| Formula | Velocity | R fixture |
|---------|---------|-----------|
| Stddev (unweighted) | `STDDEV_POP` (population) | `pop_stddev()` |
| Stddev (weighted) | `sqrt(E[x²] - E[x]²)` (population) | `pop_stddev()` |
| Chi-square | Pearson, no Yates correction | `chisq.test(correct=FALSE)` |
| Missing values | DuckDB NULL exclusion | `haven::zap_missing()` + `NA` exclusion |
| ESS | Kish: `sum(w)² / sum(w²)` | computed directly |

## Column Name Note

ReadStat-WASM (used by Velocity in Node.js) returns **lowercase** column names
(`sex`, `age`, `marital`, `taxspend`, etc.). DuckDB queries are case-insensitive
so most tests work with uppercase names, but measure-variable auto-promotion
requires the exact lowercase id for context lookup (tests 4 & 5).
