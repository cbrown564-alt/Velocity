# Architecture 04: The Statistical Engine

**Status:** Phase 1 Implemented
**Reference:** [Displayr Statistical Methodology](https://www.displayr.com/)
**Owner:** Analysis Worker (`src/services/analysisWorker.ts`)

## 1. Overview & Philosophy

Velocity's statistical engine is designed to be **Survey-Native**. Unlike general-purpose tools (Excel, Python's `scipy.stats`) which often assume Simple Random Sampling (SRS), Velocity acknowledges the complex nature of survey data:
1.  **Weighting represents information density, not just frequency.**
2.  **Part vs Whole comparisons are biased.**
3.  **Variances must be corrected for weighting efficiency.**

Our "North Star" for accuracy and methodology is **Displayr (Q)**, the industry standard for market research analysis.

## 2. Methodology

### 2.1. Significance Testing Strategy

Velocity performs **Column Proportions Tests** and **Means Tests** automatically on cross-tabs.

| Test Component | General Purpose (Excel/SPSS Default) | Velocity (Survey-Native) | Why? |
| :--- | :--- | :--- | :--- |
| **Test Statistic** | Z-Test | **Welch's T-Test** | T-distributions better handle weighted data and smaller sample sizes. Welch's correction handles unequal variances robustly. |
| **Comparison** | Cell vs Total (Part vs Whole) | **Cell vs Rest (Part vs Complement)** | Comparing a subgroup to a total that *contains* it artificially lowers significance. We mathematically remove the cell from the total before comparing. |
| **Sample Size** | Weighted Count | **Effective Sample Size (ESS)** | Weighted counts inflate power (Type I errors). ESS penalizes $N$ based on weighting inefficiency ($\sum w^2$). |

### 2.2. Effective Sample Size (ESS)

When weighting is applied, the "information content" of the sample is reduced. We use **Kish's Approximation** to calculate the Effective Sample Size ($n_{eff}$) for every cell and total:

$$ n_{eff} = \frac{(\sum w)^2}{\sum w^2} $$

*   **Implementation:** Calculated purely in SQL via DuckDB aggregation.
*   **Usage:** This $n_{eff}$ value replaces the raw count ($n$) in all Standard Error calculations.

### 2.3. The "Exception Test" (Arrows) logic

Visual indicators (Green/Red Arrows) are determined by testing the **Cell** against the **Rest of the Population** (Complement).

1.  **Define Cell:** Mean $m_1$, Standard Deviation $s_1$, Effective Sample Size $n_1$.
2.  **Define Total:** Mean $m_T$, SD $s_T$, ESS $n_T$.
3.  **Derive Rest:**
    *   $n_2 = n_T - n_1$ (Note: For ESS, this is an approximation; ideally $\sum w_{rest}^2$ is calculated directly).
    *   $m_2 = \frac{m_T n_T - m_1 n_1}{n_2}$ (Algebraic decomposition).
    *   $s_2 \approx s_T$ (Approximation used in Phase 1; exact pooling planned for Phase 2).
4.  **Run Welch's T-Test:** $t = \frac{m_1 - m_2}{\sqrt{s_1^2/n_1 + s_2^2/n_2}}$
5.  **Thresholds**:
    *   **Strong Sig (95% CI):** $|t| > 1.96$ → Green/Red Arrows.
    *   **Weak Sig (80% CI):** $|t| > 1.28$ → Grey Arrows (Indicative).

## 3. Implementation Details

### 3.1. Data Architecture

The engine runs entirely within `analysisWorker.ts` to prevent UI blocking.

1.  **SQL Generation (`queryBuilder.ts`)**:
    *   Dynamically builds queries to fetch `Count`, `Weighted Count`, and `SumSquaredWeights`.
2.  **DuckDB Execution**:
    *   Aggregations are performed in Wasm.
3.  **Post-Processing (`analysisWorker.ts`)**:
    *   Iterates through rows.
    *   Fetches "Row Totals" (Total for the specific row variable category).
    *   Calculates ESS.
    *   Derives "Rest" statistics.
    *   Executes `calculateTScore`.
    *   Flags significance (`sig: 'high' | 'low'`).

### 3.2. Code Structure

*   **`src/services/statistics.ts`**: Pure mathematical functions (`calculateESS`, `calculateTScore`).
*   **`src/services/queryBuilder.ts`**: SQL generation.
*   **`src/services/analysisWorker.ts`**: Orchestration and business logic.

## 4. Future Roadmap (Phase 2)

*   **Pairwise Comparisons (Letters):** Full $O(N^2)$ column comparison matrix (A vs B, A vs C, etc.).
*   **False Discovery Rate (FDR):** Benjamini-Hochberg correction for multiple comparisons.
*   **Dependent Samples:** Handling overlaps in Multiple Response sets (e.g., "Brand A" vs "Total" where Total includes Brand A users) using dependent T-Tests rather than independent logic.
