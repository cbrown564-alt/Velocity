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
