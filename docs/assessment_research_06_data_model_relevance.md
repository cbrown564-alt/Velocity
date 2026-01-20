# Research Assessment: Survey Data Model Evolution vs. Velocity Architecture

**Source Document:** `docs/research_06_survey_data_model_evolution.md`
**Target Architecture:** `docs/arch_02_data_model.md` & `src/types/index.ts`

## Executive Summary

The research document outlines the unique challenges of survey data (sparsity, metadata dependence, multiple-response handling) and traces the evolution from punch cards to AI-native models. A comparison with Velocity's current architecture reveals that **Velocity is well-positioned as a "Modern" tool (Columnar/OLAP-style)** but currently lacks the underlying support for the **"AI-First" (Vector/Semantic)** capabilities predicted to be next.

## 1. Strong Architectural Alignment

The current `arch_02_data_model.md` correctly implements several critical requirements identified in the research:

*   **The "Dual-State" Principle (Codeframe vs. Matrix):**
    *   *Research:* Emphasizes the separation of "Codeframe" (metadata) from "Matrix" (microdata).
    *   *Velocity:* Explicitly defines `Variable` (metadata) separate from the raw DuckDB storage. The implementation of `ValueLabel` and the "Raw vs. Labeled" rule in `arch_02` is a perfect match.
*   **Semantic "Nothingness" (Missing Values):**
    *   *Research:* Distinguishes "User Missing" (Refused) from "System Missing" (Skip).
    *   *Velocity:* `MissingValueDef` allows for defining `discrete` values (e.g., 99) and `ranges` as missing, ensuring correct statistical baselining.
*   **Variable Sets (Multiple Response):**
    *   *Research:* Discusses the complexity of "Multipunch" data.
    *   *Velocity:* The `VariableSet` type with `structure: 'multi'` allows grouping variables to handle this. While Velocity likely uses a "Spread" storage (separate columns) rather than "Bitstrings" (legacy), this is appropriate for a modern Columnar engine like DuckDB.

## 2. Strategic Gaps & Opportunities

The research points to two major areas where the current architecture is silent or structurally structurally limited:

### A. The "AI-First" Vector Model (High Relevance)
The research argues that the industry is moving from "Symbolic" (Codes) to "Sub-Symbolic" (Vectors) models.
*   **Current State:** `src/types/index.ts` has no support for embeddings. `Variable` is strictly defined by `ValueLabels`.
*   **Implication:** To support "Semantic Search" (e.g., "Find respondents who are price-sensitive" without an explicit code), we would need to extend the `Variable` or `Dataset` model to include `vectorEmbeddings` or integration with a Vector Store (e.g., a WASM-based HNSW index).
*   **Recommendation:** Flag this for a future "AI Layer" architecture update.

### B. Longitudinal/Lifecycle Support (DDI) (Medium Relevance)
The research highlights DDI-Lifecycle for mapping "Concepts" across time (e.g., "Income" variable changing definitions over years).
*   **Current State:** `Dataset` is a single file entity. There is no higher-level "Study" or "Wave" object, nor a "Concept" entity that abstracts `Variable`.
*   **Implication:** Velocity is currently designed for *Cross-Sectional* analysis (one-off files). Merging datasets (Wave 1 + Wave 2) will be difficult without a "Concept Mapping" layer.
*   **Recommendation:** If multi-wave analysis is a goal for "Project Aletheia," a new `Concept` entity should be introduced to link `Variable`s across `Dataset`s.

## 3. Technology Choice Validation

*   **DuckDB-WASM:** The research contrasts "Row-based" (Transactional) vs "Wide-Column" (Analytical) storage. It notes that modern dashboards use **Columnar Stores** (Snowflake/Vertica) for speed.
*   **Assessment:** Velocity's choice of DuckDB (an in-process OLAP database) is **optimal**. it bridges the gap between the "Wide" source data (SAV files) and the need for "Long" processing or high-speed aggregation, avoiding the EAV anti-pattern while maintaining performance.

## 4. Immediate Action Items

1.  **Semantic Type Metadata:** Consider adding a `semanticType` field to `Variable` (e.g., `Text`, `Entity`, `Sentiment`) to prepare for future AI features, distinct from the statistical `VariableType` (`nominal`, `scale`).
2.  **Verify Multi-Response Interaction:** Ensure `VariableSet` (`structure: 'multi'`) is fully supported in the `DataTable` and `Crosstab` engine, as this is the most complex "Legacy" feature to get right.
