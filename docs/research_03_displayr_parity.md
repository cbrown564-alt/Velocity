# Research Report: Displayr Feature Parity Gap Analysis

## 1. Executive Summary
Phase 2 of Velocity aims for "**Feature Parity with Displayr**".
**Updated Findings (Broad Search):** Displayr positions itself as an **"All-in-One Data Science Platform"** covering the entire workflow: **Data Import -> Cleaning/Prep -> Analysis -> Reporting**.

Velocity Phase 2 focuses heavily on the **Analysis -> Reporting** tail of this workflow. The "Parity" gap is most significant in the **Data Prep/Cleaning** layer (ETL) and the **Advanced/AI Analysis** layer.

**Revised Conclusion:** Phase 2 achieves **"Analysis & Presentation Parity"**, but lacks **"Data Engineering Parity"**.

## 2. Feature Classification: Core vs. Supporting

Based on Displayr’s marketing and user reviews, features fall into two buckets:

### A. Core "Must-Have" Features (The Displayr Value Prop)
*These are the reasons users buy Displayr instead of Tableau/SPSS.*
1.  **Integrated Workflow:** Seamlessly moving from raw data to final report. If data updates, the report updates.
2.  **Semantic Survey Intelegence:** Native handling of "Variable Sets" (Grids, Multi-response, MaxDiff). It "transmits" the meaning of data, not just the values.
3.  **Automated Reporting:** "One-click" export to editable PowerPoint. This is the killer feature for agencies.
4.  **Confidence:** Automated significance testing and weighting.

### B. Supporting Features (Differentiators / Upsells)
1.  **AI/Text Analytics:** Auto-categorizing open-ended responses. (High value, but often treated as a separate module).
2.  **Advanced Visualization:** 100+ chart types (Sankey, Palm trees, etc.).
3.  **Collaboration:** Real-time multi-user editing (Google Docs style).

## 3. Updated Gap Analysis Matrix

| Feature Category | Displayr Capability | Velocity Phase 2 Plan | Gap / Status |
| :--- | :--- | :--- | :--- |
| **Data Engineering (ETL)** | **Core**. Traditional ETL (Stack/Merge/Recode). Reliable but manual. | **Visual / Construct-First**. "Card Sorting" for variables, "Sankey Mapper" for Harmonization, "Visual Bucketing" for Recoding. | ✅ **Differentiation**. Velocity replaces "Scripting" with "Direct Manipulation". This is the specific "Aletheia" value prop. |
| **Survey Intelligence** | **Core**. 13+ Variable Set types. Automated recognition of MaxDiff/Conjoint structures. | **Core**. "Variable Sets" logic is now prioritized as part of the "Card Sorting" UI (Section 4.1 in `ref_4`). | ✅ **Parity Target**. |
| **Analysis** | **Core**. Full stats suite (Regression, Driver Analysis, Maps). | **Basic**. Crosstabs & Significance Testing. | ⚠️ **Medium Gap**. Sufficient for "Descriptive" analysis, insufficient for "Predictive" analysis. |
| **Reporting** | **Core**. Editable PPTX, Live Dashboards. | **Targeted**. Editable PPTX via `PptxGenJS`. | ✅ **Good Parity Target**. If successful, this neutralizes Displayr’s biggest advantage. |
| **AI / Automation** | **Major**. Text categorization, Agents. | **None**. Future (Phase 4). | ⏳ **Acceptable Delay**. Not needed for "Workbench" utility. |

## 4. Strategic Recommendations

### A. The "Visual ETL" Differentator
Instead of competing with Displayr on "Rows and Columns" ETL, Velocity Phase 2 leverages the **Visual Data Engineering** features defined in `ref_4`:
1.  **Card Sorting UI:** Managing 500+ variables spatially, not in a list.
2.  **Sankey Harmonization:** Visualizing wave-over-wave changes.
3.  **Visual Bucketing:** Recoding via histogram interaction.

This shifts the battle from "Feature Parity" (checking boxes) to "Paradigm Shift" (Better UX).

### B. The "Variable Set" Imperative
To match Displayr's "Ease of Use", Velocity MUST implement **Semantic Variable Sets**.
*   *Current Plan:* Visual grouping of columns.
*   *Required:* The "Card Sorting" UI must underpin the variable sets logic. When dragging cards together, they create the semantic construct.

### C. The "Data Prep" External Dependency
While we are adding Visual ETL, we still rely on users bringing relatively standard `.SAV` files. Deep cleaning (fixing corrupted headers) remains an external task, but *Structuring* (Grouping, Renaming, Recoding) is now core to Velocity.
