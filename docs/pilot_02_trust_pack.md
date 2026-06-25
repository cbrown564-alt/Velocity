# PILOT-2: Trust & Performance Evidence Pack

**Status:** Done (June 2026)  
**Scope contract:** [`docs/pilot_00_brief.md`](pilot_00_brief.md)  
**Audience:** Pilot buyers, agency principals, and analysts evaluating Velocity against incumbent survey tools

This document consolidates reproducible evidence for the SAV-to-deck wedge. It states what is validated, how it was tested, known limitations, and commands to reproduce results locally.

---

## 1. Executive summary

| Dimension | Status | Evidence |
| :--- | :--- | :--- |
| **Crosstab & significance methodology** | Validated | Survey-native cell-vs-rest, Welch's t, Kish ESS — documented in `arch_04_statistical_engine.md` |
| **R statistical parity** | Validated on 2 real SAV files | 12 active tests on `sleep.sav` (271 rows) and `bsa93.sav` (2,945 rows, weighted) |
| **SPSS-style weighted formulas** | Validated on golden fixtures | 18 tests on weighted mean, ESS, frequency, significance |
| **Browser vs Node compute parity** | Validated | 8 adapter parity tests — WASM and Node adapters agree on golden scenarios |
| **SAV ingestion performance** | Benchmarked | `sleep.sav` and WVS Wave 7 (97,220 × 613) — see §5 |
| **Missing values** | Partially validated | User-missing exclusion in SQL and stats; all-NULL column golden; real-SAV coded-missing coverage limited |
| **Weight creation / raking** | Not supported | Apply existing weights only |
| **Client template PPTX loop** | Not supported | Velocity-generated editable export only (PILOT-3) |

**Last verification run:** 2026-06-25 — all commands in §9 passed locally.

---

## 2. Methodology philosophy

Velocity is **survey-native**, not generic BI:

| Principle | Velocity approach | Why it matters |
| :--- | :--- | :--- |
| **Weighting** | Weights represent information density; Kish ESS penalizes inflated effective N | Prevents false significance on weighted data |
| **Comparisons** | Cell vs Rest (not cell vs total) | Avoids biased significance when the total contains the subgroup |
| **Test statistic** | Welch's t-test | Handles unequal variances and weighted samples better than a simple z-test |
| **Chi-square** | Pearson, no Yates correction | Aligns with R `chisq.test(correct=FALSE)` reference fixtures |
| **Stddev** | Population stddev (`STDDEV_POP` / weighted population formula) | Matches R fixture convention in `validation/README.md` |

**Known approximations** (documented, defensible for typical boutique survey sizes):

- Rest ESS for proportions uses an efficiency-factor approximation on the total column.
- Rest variance for means approximates \(s_{rest} \approx s_{total}\) for large samples; exact per-cell `SUM(x²)` decomposition is deferred.

---

## 3. Statistical parity evidence

### 3.1 R reference parity (independent gold standard)

Velocity output is compared against pre-generated R fixtures using `haven` + `survey` on real SPSS files. Fixtures are committed to `tests/golden/expected/r_*.json` — CI requires **no R installation**.

**Datasets:**

| File | Rows | Weight | Tests |
| :--- | ---: | :--- | :--- |
| `test_data/sleep.sav` | 271 | None (body-weight column excluded) | Unweighted frequency, crosstab, χ², mean/stddev by group |
| `test_data/bsa93.sav` | 2,945 | `WTFACTOR` | Weighted/unweighted frequency, weighted crosstab, χ², ESS per group |

**Coverage (12 active tests):**

1. Unweighted frequency (`SEX`)
2. Unweighted crosstab (`MARITAL` × `SEX`)
3. Chi-square + Cramér's V (`MARITAL` × `SEX`)
4. Unweighted mean/stddev (`AGE` by `SEX`)
5. Unweighted mean/stddev (`AGE` by `MARITAL`)
6. Unweighted frequency (`TAXSPEND`)
7. Weighted frequency (`TAXSPEND` + `WTFACTOR`)
8. Unweighted crosstab (`NHSSAT` × `VERSION`)
9. Weighted crosstab (`NHSSAT` × `VERSION` + `WTFACTOR`)
10. Chi-square (`NHSSAT` × `VERSION`)
11. Weighted frequency (`DOLE` + `WTFACTOR`)
12. Kish ESS per group (`VERSION` + `WTFACTOR`)

**WVS Wave 7:** R fixtures exist; 3 weighted parity tests remain `todo` pending browser WASM parse fix (Node/DuckDB `read_stat` path can ingest — see benchmarks).

### 3.2 SPSS-style formula parity

`tests/golden/spss_parity.test.ts` validates weighted mean, weighted stddev, ESS, weighted frequency bases, NULL exclusion from denominators, and cell-vs-rest t-tests on documented synthetic fixtures.

### 3.3 Golden regression suite

`tests/golden/golden.test.ts` covers:

| Fixture | Validates |
| :--- | :--- |
| `all_missing_column` | All-NULL column handling |
| `empty_cells` | Sparse crosstab cells |
| `filtered_query` | Numeric filter in SQL (`salary > 5500`) |
| `grid_expansion` | Synthetic grid unpivot |
| `significance_test` | Proportion significance markers |
| `weighted_crosstab` | Weighted frequency |
| `weighted_validation` | Weighted mean/stddev/significance |
| `large_perf_baseline` | Performance logging (not parity) |

All golden tests run in CI via `npm run test:run`.

---

## 4. Compute-path parity (browser vs Node)

`npm run test:parity` verifies that **DuckDB WASM (browser path)** and **DuckDB Node (CLI/MCP path)** produce identical crosstab output on golden fixtures (tolerance `1e-10`).

| Test | Result (2026-06-25) |
| :--- | :--- |
| Adapter parity suite | **8/8 passed** (1.3s) |

Status: `tests/parity/KNOWN_DIVERGENCES.md` — parity achieved on current fixtures.

**Note:** Adapter parity is optional in CI (local/dev gate). Statistical correctness is enforced by golden + R parity in CI.

---

## 5. Performance benchmarks (SAV ingestion)

Generated by `npm run benchmark:sav` → `validation/benchmark_sav_ingestion_latest.json`

**Run date:** 2026-06-25

### sleep.sav (pilot regression baseline)

| Metric | Value |
| :--- | ---: |
| File size | 26.8 KB |
| Rows × variables | 271 × 55 |
| Metadata parse | 11.0 ms |
| Full WASM parse | 6.9 ms |
| Windowed parse (5k chunks) | 9.3 ms |
| Node/DuckDB ingestion | 118.1 ms |
| Row-count parity (all paths) | ✓ |

### WVS Cross-National Wave 7 (stress reference)

| Metric | Value |
| :--- | ---: |
| File size | 185 MB |
| Rows × variables | 97,220 × 613 |
| Metadata parse | 70.9 ms |
| Full WASM parse | 2,283 ms |
| Windowed parse (20 windows) | 2,915 ms |
| Node/DuckDB ingestion | 17,255 ms (~17 s) |
| Peak RSS (full parse) | ~1.6 GB |
| Row-count parity (all paths) | ✓ |

### Browser guardrails (product)

From `src/features/workspace/hooks/useFileUpload.ts`:

| Threshold | Behavior |
| :--- | :--- |
| ≥ 50 MB | Size warning |
| ≥ 200 MB | Metadata-only path (user must confirm full load) |
| ≥ 40M estimated cells | High cell-risk warning |

**What benchmarks do not measure:** end-user wall-clock from upload to first crosstab or PPTX export in the browser UI. Those are PILOT-1 instrumentation + PILOT-6 observed workflows.

---

## 6. Missing-value behavior

### How Velocity handles missing data

1. **SPSS user-missing codes** — When `.sav` metadata defines discrete or range missing values, they are stored on `Variable.missingValues` and excluded from analysis SQL (`crosstabRunner.significance.test.ts`: `injects missing-value exclusions into analysis SQL`).
2. **System missing / NULL** — Excluded from frequency and numeric aggregates (`variableStatsRunner.test.ts`).
3. **R alignment** — Fixtures use `haven::zap_missing()` + NA exclusion (`validation/README.md`).

### Validated scenarios

| Scenario | Test |
| :--- | :--- |
| User-missing excluded from top frequency | `variableStatsRunner.test.ts` |
| User-missing excluded from numeric aggregates/histograms | `variableStatsRunner.test.ts` |
| All-NULL column | `all_missing_column.config.json` golden |
| Missing-value SQL injection in crosstabs | `crosstabRunner.significance.test.ts` |

### Gaps (disclose to pilots)

- No dedicated golden test on **real SAV** with SPSS-coded missing values (8/9 = Don't know/Refused) — behavior depends on metadata fidelity at ingest.
- BSA-style split-sample variables (high % missing on one version) require analyst judgment — not auto-flagged as broken data.
- Agent `describe()` surfaces missing-value definitions; analysts should verify exclusions on first crosstab.

---

## 7. Weighting assumptions

### Supported today

- **Apply existing weight variable** from SAV metadata or dataset config.
- Weighted counts, weighted means, weighted stddev, Kish ESS, weighted significance tests.
- Validated against R `survey` on `bsa93.sav` with `WTFACTOR`.

### Not supported

| Capability | Status |
| :--- | :--- |
| Weight creation / raking / RIM | Deferred (`docs/blue_02_feature_matrix.md`) |
| Complex sample design (strata/PSU) | Not planned (`arch_04` §4) |
| Taylor Series Linearization (TSL) | Not planned |

### Pilot expectation

Per `pilot_00_brief.md`: pilots should bring **analysis-ready SAV files with weights already applied**. Velocity applies the weight column through the crosstab pipeline; it does not create or diagnose weighting schemes.

---

## 8. Known limitations & unsupported cases

### Product scope (pilot non-goals)

- Broad SPSS replacement, enterprise collaboration, survey-platform imports
- General-purpose AI; unsupervised agent analysis
- Client PowerPoint template import, saved slide recipes, wave-in-place deck refresh
- Advanced methods: mixed effects, MaxDiff, conjoint, TURF, key drivers
- Cloud/team governance, realtime multi-user

### Technical limits

| Limit | Detail |
| :--- | :--- |
| **File formats** | `.sav` and `.csv` only (MCP returns `UNSUPPORTED_FORMAT` for others) |
| **Large files** | WVS-scale (~185 MB) ingests on Node; browser may warn or gate; memory-bound |
| **WVS WASM parse** | Browser ReadStat-WASM may fail on some label structures; Node `read_stat` path works |
| **OPFS dependency** | Workspace reopen requires browser storage; private browsing can force re-upload |
| **PPTX quality** | Editable native objects exported; client-brand template mapping not validated (PILOT-3) |
| **Confidence level UI** | Defaults to 95%; toggle deferred |

### Real-SAV edge cases (documented, not exhaustive)

| Case | Observation | Action |
| :--- | :--- | :--- |
| WVS Wave 7 browser parse | WASM "Levels read error" on some paths; Node ingestion succeeds | Use qualified file profile for pilots; full WVS parity tests pending |
| Wide surveys (500+ vars) | Variable discovery friction (EVAL-02 semantic score 2/5 on 654-var BSA) | Cap pilot files; improve discovery in product |
| Coded missing (8/9) | Correct only if SPSS metadata marks user-missing | Verify first crosstab bases |
| Multiple-response sets | Supported with overlap-aware significance | Golden grid fixture; complex MR edge cases may vary |
| Body-weight vs survey-weight columns | `sleep.sav` `WEIGHT` is respondent weight, not survey design weight | Analyst must select correct weight variable |

Further edge-case corpus from real pilot files is **PILOT-4a** (processing gap discovery).

---

## 9. Reproduce evidence locally

```bash
# Full CI statistical suite (golden + R + SPSS parity)
npm run test:run

# Targeted suites
npx vitest run tests/golden/r_parity.test.ts
npx vitest run tests/golden/spss_parity.test.ts
npx vitest run tests/golden/golden.test.ts

# Browser vs Node adapter parity (optional)
npm run test:parity

# SAV ingestion benchmarks (writes validation/benchmark_sav_ingestion_latest.json)
npm run benchmark:sav

# Regenerate R reference fixtures (requires R + haven)
Rscript validation/r/install_packages.R
Rscript validation/r/generate_ground_truth.R
```

**Committed artifacts (no rerun required):**

- `validation/benchmark_sav_ingestion_latest.json`
- `tests/golden/expected/r_*.json`

**Methodology references:**

- `validation/README.md` — R fixture generation and formula decisions
- `docs/arch_04_statistical_engine.md` — significance methodology
- `docs/playbooks/stats_integrity.md` — engineering rules for stats changes

---

## 10. Safe claims for pilot outreach

### You can say

- Velocity uses survey-native significance (cell-vs-rest, Welch's t, Kish ESS).
- Statistical output matches R `survey` on two independent real SPSS files in CI.
- Weighted crosstabs, frequencies, means, and ESS are tested against R and SPSS-style fixtures.
- Browser and Node compute paths agree on validated golden scenarios.
- Small and large SAV ingestion is benchmarked with published timings.
- User-missing values from SPSS metadata are excluded from analysis when correctly defined at ingest.
- Data stays on-device; session handoffs exclude respondent rows.

### Do not say (yet)

- Decimal-for-decimal SPSS parity on **your** client files at scale
- Published third-party audit or certification
- Weight creation, raking, or complex sample design support
- Client template / wave-refresh PowerPoint automation
- Sub-5-minute / sub-15-minute workflow guarantees without PILOT-6 measured outcomes
- WVS-scale browser reliability until WASM parse gap is closed

---

## 11. Validation gates (PILOT-2)

| Gate | Result | Notes |
| :--- | :--- | :--- |
| **G** (golden/parity/benchmark) | Pass | Fresh run 2026-06-25; benchmark JSON updated |
| **A** (architecture/invariants) | Pass | Claims bounded to `pilot_00_brief.md` scope |
| **V** (market validation) | Partial | Trust pack enables buyer conversations; WTP proof is PILOT-6 |
