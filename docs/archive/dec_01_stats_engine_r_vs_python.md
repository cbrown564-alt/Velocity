# Technology Decision Record: The Statistical Engine (R vs. Python)

## 1. Executive Summary

**The Decision:** We will adopt a **Hybrid Approach**.
*   **Phase 1 & 2 (Core & Commercial):** The engine will be **Language-Agnostic** (DuckDB-Wasm). It handles 90% of user needs (Crosstabs, Basic Weights, Descriptive Stats) without R or Python.
*   **Phase 3 (Aletheia/Advanced):** We will support **BOTH** runtimes as "Plugins," but prioritize **WebR** for the initial "Academic" release due to its statistical rigor. We will architecture the system to allow a **Pyodide** plugin for "Data Science" users (NLP, ML) later.

**Why?**
*   **R (WebR)** is the "Standard of Truth" for Survey Statistics (Weighting, Mixed Models). It is essential for winning the trust of the "Sarah the Strategist" persona who relies on SPSS-grade accuracy.
*   **Python (Pyodide)** is the "Engine of Innovation" (NLP, LLMs, ML). It is essential for the future "Visionary" features (AI Agents).
*   **DuckDB** is the "Universal Translator" that bridges them.

---

## 2. Detailed Comparison: Survey Analysis Capabilities

| Feature Category | Task | **R (The Incumbent)** | **Python (The Challenger)** | **Verdict for Velocity** |
| :--- | :--- | :--- | :--- | :--- |
| **Descriptive Stats** | Crosstabs, Means, Frequencies | **Excellent.** (`base`, `dplyr`) | **Excellent.** (`pandas`) | **Tie.** But DuckDB handles this faster than both. |
| **Weighting** | Raking, Calibration (RIM) | **Gold Standard.** The `survey` package is the academic benchmark. Handles complex designs (stratification, clusters) natively. | **Good but Fragmented.** `quantipy` (mature but niche), `samplics` (newer), `weightipy`. Less unified than R's ecosystem. | **R Wins** for trust/stability. |
| **Advanced Stats** | Mixed Effects Models (MLM) | **Superior.** `lme4` is faster, more robust, and the industry reference implementation. | **Weaker.** `statsmodels` is slower and prone to convergence issues for GLMMs. `gpboost` is a fast alternative but less standard. | **R Wins** for Aletheia's core promise. |
| **Psychometrics** | Factor Analysis, PCA, Cronbach's Alpha | **Standard.** The `psych` package is ubiquitous in social science. | **Available.** `scikit-learn` covers PCA/Factor Analysis well. `pingouin` offers Cronbach's Alpha. | **Tie.** Python is sufficient. |
| **Text Analysis** | Open-Ends, Topic Modeling, Sentiment | **Strong.** `tidytext`, `quanteda`. Good for traditional text mining. | **Unbeatable.** `spaCy`, `Transformers`, `scikit-learn`. Python owns the LLM/NLP space. | **Python Wins** decisively for future features. |
| **Ecosystem** | Plotting & Reporting | **ggplot2.** The best static plotting system in existence. | **Matplotlib/Seaborn.** Powerful but often more verbose. | **Tie** (Velocity uses custom UI rendering). |

---

## 3. The "Me-Too" Risk vs. Innovation

**The Risk:** "If we pick R, are we just building a slower Displayr?"
*   *Analysis:* Displayr's weakness isn't using R; it's being **Server-Side**. By running R **Client-Side** (WebR), we already differentiate on speed/privacy.
*   *Mitigation:* We don't need to "market" the R engine. To the user, it's just "Velocity Stats."

**The Opportunity:** "What does Python give us?"
*   **AI Agents:** The Visionary PRD mentions "Analyst Agents." Pushing raw data to a local LLM or using specialized ML models (scikit-learn) to find outliers is native to Python.
*   **Differentiation:** Python allows us to offer "Data Science" features SPSS doesn't have (e.g., "Cluster this text" using K-Means).

---

## 4. Architectural Implication: The "Plugin" Model

We should NOT hard-commit to a single runtime. The "Heavy" engine should be modular.

```mermaid
graph TD
    A[UI / React] --> B[DuckDB-Wasm (The Core)]
    B -->|Arrow Buffer| C{Advanced Stats Request?}
    C -->|Survey Stats| D[WebR Plugin]
    C -->|Refned NLP/ML| E[Pyodide Plugin]
    D -->|Results| A
    E -->|Results| A
```

## 5. Revised Plan (Phase 3 Updates)

*   **Phase 1 & 2:** Remain **DuckDB-only**. (Focus: Speed, Exports).
*   **Phase 3 (Launch):** Integrate **WebR** to deliver the "Must Have" statistical parity with SPSS (Weighting, Sig Testing fallback).
*   **Phase 4 (Growth):** Integrate **Pyodide** to unlock "AI Analyst" features (NLP on open-ends, Automated Insights).

This approach mitigates the risk of "over-fitting" to R while ensuring we don't ship a product that fails on basic market research math (where R excels).
