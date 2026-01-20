# Research Report: SPSS Feature Parity Gap Analysis

## 1. Executive Summary
While Velocity Phase 2 can compete with Displayr on **Reporting**, it cannot compete with SPSS on **Data Engineering** or **Statistical Depth**.

*   **SPSS's Role:** The heavy-lifting "Data Factory" (Cleaning, Recoding, Merging, Syntax).
*   **Velocity's Role:** The "Agile Workbench" (Data is already clean -> Explore -> Report).

**Conclusion:** Velocity should **complement** SPSS, not try to replace it in Phase 2. We should optimize for "Perfect SPSS Import" rather than "Building SPSS inside the Browser."

## 2. Feature Classification: Core vs. Supporting

### A. Core "Must-Have" Features (The SPSS Moat)
1.  **Syntax (Reproducibility):** The #1 reason researchers stick to SPSS. They can re-run a 500-line cleaning script on next month's data. Velocity has *no equivalent* in Phase 2.
2.  **Data Management (ETL):** `MERGE FILES`, `AGGREGATE`, `Restructure` (Wide-to-Long). Velocity assumes data is already the right shape.
3.  **Complex Sampling:** Complex Samples module (Stratification, Clusters). Velocity only handles simple weights.
4.  **Deep Stats:** Factor Analysis, Cluster Analysis, specialized Modules (Exact Tests).

### B. Supporting Features
1.  **Output via OMS:** Exporting tables to XML/HTML (Clunky, but functional).
2.  **Python/R Extensions:** For when Syntax isn't enough.

## 3. Gap Analysis Matrix

| Feature Category | SPSS Capability | Velocity Phase 2 Plan | Gap / Status |
| :--- | :--- | :--- | :--- |
| **Data Engineering** | **Dominant**. Industrial-strength cleaning & restructuring. | **None**. View-only. | ❌ **No Parity**. Velocity cannot be the *first* tool a researcher touches if the data is raw. |
| **Reproducibility** | **Syntax**. Text-based audit trail of every step. | **None**. Actions are click-based (Wait for Phase 3 "Syntax Drawer"). | ⚠️ **High Risk**. Researchers fear "losing their work" or forgetting how they calculated a variable. |
| **Analysis** | **Deep**. 50+ years of statistical procedures. | **Light**. Crosstabs, T-Tests, Chi-Square. | ❌ **Complementary**. Use Velocity for descriptive "Story finding", use SPSS for the "Hard Math". |
| **Visualization** | **Functional**. Static, often ugly charts (Chart Builder). | **Superior**. Interactive, semantic, modern UI. | ✅ **Velocity Wins**. This is our wedge. |
| **Speed** | **Slow**. Clunky UI, legacy codebase. | **Instant**. Local-first, modern stack. | ✅ **Velocity Wins**. |

## 4. Strategic Recommendations

### A. The "Compliment Strategy"
Acknowledge the gap. Position Velocity as:
> *"The tool you use **AFTER** you clean your data in SPSS."*

Don't try to build `AGGREGATE` or `MATCH FILES` in the browser yet. It's too complex and DuckDB-Wasm might struggle with the UI complexity for those operations.

### B. The "Syntax" Problem
We need a bridge for "Trust". If a user filters by "Young Males" and Recodes "Income", they need to know *exactly* what happened.
*   *Recommendation:* Even if we don't have editable Syntax yet, we should have a **"Read-Only Log"** (like the SPSS Output window) that prints the SQL/Logic for every action.
    *   *Action:* User clicks "Filter".
    *   *Log:* `FILTER WHERE age < 30 AND gender = 1`
    *   *Why:* This builds trust with the "SPSS Persona" who is used to checking the log.

### C. Import Fidelity is King
If we are the "Viewer for SPSS files", our `.SAV` parser must be bulletproof.
*   Missing Values (User Defined vs System)
*   Variable Labels (Long strings)
*   Value Labels (Formatting)
*   Weights (Applying them correctly)

If we fail to render an SPSS file exactly as they see it in IBM SPSS Statistics, they will not trust the tool.
