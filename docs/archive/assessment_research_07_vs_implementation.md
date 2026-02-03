# Assessment: Market Research vs. Implementation

**Document:** `docs/research_07_velocity_market_assessment.md`
**Status:** Valid & High Value
**Date:** 2026-01-20

## Executive Summary
The Market Assessment accurately reflects the architectural strengths of Velocity (Local-First, Wasm, DuckDB) and validates the product strategy (PLG, Free Viewer -> Pro Workbench).

However, a **Critical Strategic Discrepancy** exists regarding the **Weighting Engine**. The research positions "Generalized Raking" (Weight Creation) as a "Killer Feature" powered by C++ Wasm that gives Velocity parity with desktop tools *now*. The current implementation and roadmap defer this to Phase 3 (Academic) via WebR.

## 1. Validity Assessment
| Claim | Status | Notes |
| :--- | :--- | :--- |
| **Architecture** | ✅ **Valid** | Wasm/DuckDB/Arrow stack is correctly implemented. |
| **Performance** | ✅ **Valid** | "Zero-latency" goal matches current `analysisWorker.ts` outcome. |
| **Market Gap** | ✅ **Valid** | Identifying the "Fast but Isolated" (SPSS) vs "Connected but Slow" (Displayr) gap is accurate. |
| **Strategy** | ✅ **Valid** | The "Free Viewer" (PLG) strategy aligns with the current "Analysis Canvas" capability. |

## 2. Gap Analysis (Research vs. Codebase)

### 🔴 Critical Gap: The Raking (Weighting) Engine
*   **Research Claim:** "Velocity implements Generalized Raking (GREG) and Iterative Proportional Fitting (IPF) directly in Wasm... using C++ libraries." (Section 4.2)
*   **Implementation Reality:**
    *   **Current Code:** `store/index.ts` and `types/index.ts` support **applying** an existing weight variable (`dataset.weightVariable`). There is **zero code** for *calculating* weights (Raking).
    *   **Roadmap (Tracker):** Milestone 2.4 explicitly limits scope to "Application Only (No Weight Creation)". Milestone 3.2 (Phase 3) schedules "Implement `survey` package (Raking)" via **WebR**.
*   **Impact:** If Raking is the "Killer Feature" to replace SPSS for freelancers (Phase 2 target), then deferring it to Phase 3 is a strategic risk. Using WebR (Tracker) vs C++ Wasm (Research) is also a technical divergence.

### 🟡 Moderate Gap: Export Capabilities
*   **Research Claim:** Acknowledges Velocity uses Canvas/PNG and lacks native PowerPoint export.
*   **Implementation Reality:** Milestone 2.5 ("The Output") is scheduled but not started.
*   **Impact:** This is a known gap, but essential for the "Reporting Parity" goal of Phase 2.

### 🟢 aligned: Modes & UX
*   **Research Claim:** Describes a "Free Viewer" and a "Pro Workbench".
*   **Implementation Reality:** Milestone 2.1 ("UX Architecture") plans to separate these modes ("Variable Manager" vs "Analysis Canvas"). This work is pending but planned.

## 3. Recommendations

1.  **Accelerate Weight Creation (Raking):** Move "Weight Creation" from Phase 3 (Academic) to **Phase 2 (Commercial)**. If the research is correct that this is a primary differentiator against stripped-down cloud tools, it cannot wait.
2.  **Decide on Raking Engine:**
    *   **Option A (Research):** Port C++ Raking library to Wasm (High performance, harder dev).
    *   **Option B (Tracker):** Wait for WebR (Easier implementation, heavier download).
    *   *Recommendation:* Stick to the Research plan (C++/Wasm) for performance and keeping the bundle size smaller than adding full R support just for Raking.
    *   *Recommendation:* Stick to the Research plan (C++/Wasm) for performance and keeping the bundle size smaller than adding full R support just for Raking.
    *   **UPDATE 2026-01-20:** User decision: Keep "Weight Creation" in **Phase 3**, but switch technology to **C++ Wasm** (Option A) instead of WebR. Roadmap updated.
3.  **Prioritize Export:** Ensure Milestone 2.5 (PPTX Export) remains a high priority for Phase 2 completion.

## 4. Conclusion
The research document is a solid strategic anchor. The roadmap should be adjusted to pull "Weight Creation" forward to align with the "Uncompromising Hybridity" value proposition.
