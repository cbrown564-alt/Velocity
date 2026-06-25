# Architecture 04: The Statistical Engine

**Status:** Phase 2 core implemented (weighted means/stddev validated; see `tests/golden/spss_parity.test.ts`, `r_parity.test.ts`, `pilot_02_trust_pack.md`)
**Reference:** [Displayr Statistical Methodology](https://www.displayr.com/)
**Owner:** Analysis Engine Core (`src/core/analysis/`)

## 1. Overview & Philosophy

Velocity's statistical engine is designed to be **Survey-Native**. Unlike general-purpose tools (Excel, Python's `scipy.stats`) which often assume Simple Random Sampling (SRS), Velocity treats survey data as a non-random distribution where:
1.  **Weighting represents information density, not just frequency.**
2.  **Part vs Whole comparisons are biased** (we use Cell-vs-Rest).
3.  **Variances must be corrected** for weighting efficiency (ESS).

This philosophy creates a "methodological moat" against generic BI tools, positioning Velocity as a professional-grade research instrument.

## 2. Methodology

### 2.1. Significance Testing Strategy

Velocity performs **Column Proportions Tests** and **Means Tests** automatically.

| Test Component | General Purpose (SRS) | Velocity (Survey-Native) | Why? |
| :--- | :--- | :--- | :--- |
| **Test Statistic** | Z-Test | **Welch's T-Test** | Better handles weighted data and smaller sample sizes. Welch's handles unequal variances. |
| **Comparison** | Cell vs Total | **Cell vs Rest** | Comparing a subgroup to a total that *contains* it artificially lowers significance. |
| **Sample Size** | Weighted Count | **Effective N (ESS)** | Weighted counts inflate power (Type I errors). ESS penalizes $N$ based on weighting inefficiency. |

### 2.2. Effective Sample Size (ESS)

We use **Kish's Approximation** to calculate the Effective Sample Size ($n_{eff}$) for every cell and total:

$$ n_{eff} = \frac{(\sum w)^2}{\sum w^2} $$

*   **Implementation:** Calculated in SQL via DuckDB aggregation capturing `SUM(w)` and `SUM(w * w)`.
*   **Usage:** $n_{eff}$ replaces raw count ($n$) in all Standard Error calculations. This is a critical trust signal for researchers.

### 2.3. The "Exception Test" (Arrows) logic

Visual indicators (Green/Red Arrows) are determined by testing the **Cell** against its **Complement** (the "Rest").

1.  **Thresholds**:
    *   **Strong Sig (95% CI):** $|t| > 1.96$ → Green/Red Arrows.
    *   **Weak Sig (80% CI):** $|t| > 1.28$ → Optional Grey Indicators (Phase 2).

### 2.4. Known Approximations & Limitations

To maintain "Speed > Power," certain complex decompositions use defensible approximations:

*   **Rest ESS (Proportions):** Approximated using the efficiency factor ($ESS/N$) of the total column applied to the rest-base.
*   **Rest Variance (Means):** Currently approximates $s_{rest} \approx s_{total}$ for large samples. Exact variance decomposition requires tracking `SUM(x²)` per cell, which is deferred.
*   **Weighted Mean/StdDev:** Implemented via weighted SQL aggregates; validated by `tests/golden/spss_parity.test.ts`, `weighted_validation` golden fixture, and R parity tests 4–5, 7, 9, 12 on `bsa93.sav`.

## 3. Implementation Details

Velocity's engine has been refactored into a platform-agnostic **Headless Core** under `src/core/analysis/`.

1.  **`crosstabRunner.ts`**: High-level orchestration, unpivoting grids, and applying significance logic.
2.  **`queryBuilder.ts`**: Pure SQL generation (CTEs for weighted stats).
3.  **`statistics.ts`**: Pure mathematical primitives (Welch's T, ESS, p-value approximations).

## 4. Roadmap

### Phase 2: Correctness & Trust
*   **Weighted Statistics:** Shipped and validated (see `docs/pilot_02_trust_pack.md`).
*   **Validation Suite:** R parity on real SAVs, SPSS-style golden fixtures, adapter parity (`npm run test:parity`).
*   **Exact Rest Variance:** Capture `SUM(x²)` to remove approximations in means testing (deferred).

### Phase 3+: Premium Features
*   **Pairwise Column Comparisons:** Side-by-side significance (Letters A/B/C) with $O(N^2)$ complexity.
*   **Multiple Comparison Corrections:** False Discovery Rate (FDR) and Bonferroni.
*   **Dependent Samples:** Handling overlaps in Multiple Response sets.

### Not Planned (Non-Goals)
*   **Taylor Series Linearization (TSL):** Over-engineering for boutique agency needs.
*   **Complex Strata/PSU Support:** Velocity targets "flat" panel data, not government stratified samples.

