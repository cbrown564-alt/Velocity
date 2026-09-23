# RQ-COVERAGE-01 — closed development comparison

**Decision (23 September 2026):** Do not promote the structured completeness checklist. The declared six calls are preserved, with five completed and one failed. The protocol permits no retry. In the only pair with completed semantic and numerical adjudication, SBT-004, both the general review and the checklist recover the same missing mandatory finding. The checklist therefore does not meet the predeclared requirement to improve recovery over the matched general review. SBT-005 and SBT-006 each had full mandatory recall in their common drafts, leaving no mandatory finding for either review to recover. Their completed second-pass outputs are preserved but have not been semantically or numerically scored; no safety or quality conclusion is drawn from them.

| Study | Common draft | General review | Checklist review | Decision-relevant result |
| :--- | :--- | :--- | :--- | :--- |
| SBT-004 | 3/4 mandatory findings | 4/4, scored | 4/4, scored | Both recover M3; no checklist advantage. |
| SBT-005 | 4/4 mandatory findings | Completed, unscored | Completed, unscored | Mandatory recall cannot improve. |
| SBT-006 | 4/4 mandatory findings | Completed, unscored | Failed CLI turn | Pair incomplete; no retry under the protocol. |

The two SBT-004 reviews have full resolved-reference coverage, no provisionally identified unsupported selected findings, and passing mapped numerical audits. Both select nine findings. The general review used 6,837 output tokens in 210 seconds; the checklist used 8,973 in 274 seconds. This is one exposed development pair, not a calibrated preference or reliability estimate. The extra output and time are a real burden in this pair.

The study bundles, original one-pass drafts, exact prompts, raw events, run manifests, failure trace, SBT-004 adjudications, scorecards and numeric audits remain at `evals/research_quality/runs/2026-09-completeness-*/`. No failed or completed call was repeated for content quality. Human preference and correction minutes remain unavailable. The result points to **agent prompting and story selection**, not an engine computation defect: a general second pass already recovered the omitted contrast. Use a representative finding-to-evidence review loop in the product before adding another checklist or larger study portfolio. Independent researcher review of the blinded packs remains a separate evidence source.
