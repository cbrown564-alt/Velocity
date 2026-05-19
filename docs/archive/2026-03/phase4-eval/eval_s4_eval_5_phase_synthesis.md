# S4-EVAL-5 Phase Synthesis: Strategy and Roadmap Reset

## Purpose

This is the final Phase 4 output. It turns the S4-EVAL-4 capability gap review into a product decision package: validated claims, unvalidated claims, frozen baselines, and a concrete roadmap reset.

Use with:

- [archive/2026-03/phase4-eval/eval_s4_eval_4_cross_cutting_gap_review.md](archive/2026-03/phase4-eval/eval_s4_eval_4_cross_cutting_gap_review.md) — archived gap review this synthesis is based on
- [archive/2026-03/phase4-eval/plan_phase4_agent_capability_validation.md](archive/2026-03/phase4-eval/plan_phase4_agent_capability_validation.md) — archived Phase 4 mandate
- [eval_00_phase_synthesis_template.md](../../../evals/templates/eval_00_phase_synthesis_template.md) — the template this document follows

---

## 1. Thesis Statement

> **Velocity is a strong analytical backend with proven engine correctness, working export, and narrow browser-agent convergence. It can support agent-authored decks and sessions on well-labeled single-dataset surveys when the agent can navigate the dataset. It is not yet a first-class agent-facing analytical interface, because the layers that guide agent behavior — semantic discovery, MCP workflow breadth, and opinionated defaults — are still materially weaker than the computational substrate.**

This is an honest product claim, not a marketing claim. It describes where current evidence puts the product on the spectrum from "capable backend" to "complete agent interface."

The gap is a capability expansion problem, not an architecture failure or scope crisis. The engine thesis is validated. The interface thesis is partially validated. The remaining work is proportionate and within the current product direction.

**Critical correction (independent review):** The agent's self-assessed scores inflated deliverable quality (scored 4.3, actual ~2.5 for stakeholder-facing output) and missed two structural gaps: (1) PPTX chart rendering is not client-presentable — each bar gets a random color, no gridlines, library defaults throughout; (2) MCP returns crosstab data in raw long format, not standard matrix shape, so agent artifacts look nothing like what a professional would expect. Additionally, EVAL-05's "Pattern 7 success" only tested exact-name harmonization matching, exercising none of the fuzzy/semantic capabilities. See §"Independent Review" in the cross-cutting gap review for full analysis.

---

## 2. Validated Claims

| # | Claim | Supporting evidence | Confidence |
|---|---|---|---|
| V1 | Engine computes weighted crosstabs correctly across dataset sizes | EVAL-02: correct `WtFactor` application on 654-var BSA; EVAL-06: correct `W_WEIGHT` on WVS | High |
| V2 | Deck building and PPTX export produce presentation-quality artifacts | EVAL-01: 9-slide deck; EVAL-02: 13-slide weighted deck with sections and editorial titles | High |
| V3 | Session format v2 supports round-trip between MCP and browser | EVAL-03: browser imported, refined, and re-exported an MCP-authored session; EVAL-04: both paths exported comparable sessions | High |
| V4 | ResultEnvelope provenance wrapping works across the engine surface | All six evals: no provenance failure surfaced | High |
| V5 | Browser and MCP produce materially comparable outputs on bounded deck tasks | EVAL-04: controlled 5-slide comparison on `sleep.sav` showed near-parity | High |
| V6 | Chunked large-file ingestion handles stress-scale datasets in the browser | EVAL-06: WVS Wave 7 (176.6 MB, 693 variables) loaded via 21-chunk path in 12.8s | High |
| V7 | Browser harmonization workspace can complete a bounded cross-wave task | EVAL-05: ELSA IFS wave 4/5, `srh3_hrs` construct auto-matched and confirmed, harmonized table built | High |
| V8 | Semantic annotations survive session round-trip after the EVAL-03 blocker fix | EVAL-03: 30 annotations and 2 concepts preserved through browser re-export | High |
| V9 | MCP deck + session round-trip is viable on both small and large surveys | EVAL-01: sleep.sav; EVAL-02: BSA 2017 (654 vars, weighted) | High |
| V10 | Large-file metadata-first guardrail behaves as an intentional product feature | EVAL-06: WVS uploaded to sampled mode, then full load routed automatically to chunked path | High |

---

## 3. Unvalidated Claims

| # | Claim | Status | Evidence gap or contradiction |
|---|---|---|---|
| U1 | Semantic search is sufficient for large-dataset discovery | **Contradicted** | EVAL-02: discovery scored 2; NHS, trust, and demographics queries returned wrong top-ranked variables on 654-var survey |
| U2 | The agent can find demographic break variables through the current discovery interface | **Contradicted** | EVAL-01: demographics query returned `stressmonth` and impact variables instead of `sex`, `age3gp`, `marital`, `edlevel`; EVAL-02: demographics returned `TVNews` |
| U3 | MCP workflow covers the full product surface | **Contradicted** | EVAL-05: harmonization only reachable through browser; EVAL-06: stress path is browser-only; EVAL-01: deck build transport limit at MCP boundary |
| U4 | Product defaults actively guide agents toward good analytical choices | **Unvalidated** | EVAL-01: no body-weight warning; EVAL-02: no break-variable recommendations after topic selection; product defaults scored 3.0–3.5 across evals |
| U5 | Browser and agent convergence extends beyond bounded single-dataset deck tasks | **Unvalidated** | EVAL-04 proved narrow parity; harmonization (EVAL-05) and stress (EVAL-06) remain browser-first |
| U6 | Session import on exact-match datasets is lossless | **Unvalidated** | EVAL-03: importing exact `sleep.sav` baseline still reported 4 unresolved variables and 4 removed variable sets |
| U7 | The agent can efficiently navigate datasets with 500+ variables | **Unvalidated** | EVAL-02 and EVAL-06 both required bounded, pre-known query targets; broad exploratory discovery at scale was not demonstrated |
| U8 | PPTX export is presentation-ready | **Contradicted** | Independent review of EVAL-04 deck: single-series bars get random colors (palette cycling bug), no gridlines, PptxGenJS defaults throughout. Not client-shareable. |
| U9 | MCP crosstab returns are in a standard analysis format | **Contradicted** | `velocity_crosstab` returns long/tidy format (one row per cell), not a standard crosstab matrix. EVAL-06 CSV artifact is raw computation output. Browser pivots the data; agent surface does not. |
| U10 | Harmonization matching works on real cross-wave drift | **Unvalidated** | EVAL-05 only tested exact-name matching (`srh3_hrs → srh3_hrs`, score 1.0, zero warnings). Jaro-Winkler, Jaccard, scale inversion, and type compatibility algorithms were never exercised on real data. |

---

## 4. "Do Not Assume" List

1. **Do not assume semantic search works for category-level navigation.** The system does not understand "demographic" as a variable category. Text-token search is not a substitute for annotation-type filtering. (Source: EVAL-01, EVAL-02 gap reviews)

2. **Do not assume the MCP surface covers harmonization or stress workflows.** The agent quickstart is explicitly single-dataset. Multi-dataset workspace operations and large-file metadata flow have no MCP tools. (Source: EVAL-05, EVAL-06 gap reviews)

3. **Do not assume the product guides agents toward good break variables.** After topic selection, the system provides no recommended demographics, no break-variable suggestions, and no warnings about common false positives. (Source: EVAL-01, EVAL-02 gap reviews)

4. **Do not assume richer deck builds will work through MCP without transport changes.** EVAL-01's 9-slide chart-heavy deck hit OOM at the MCP stdio boundary. The engine built it correctly, but the JSON payload exceeded serialization limits. (Source: EVAL-01 gap review)

5. **Do not assume session import is lossless even on exact-match datasets.** Browser import still produces spurious unresolved-variable diagnostics. (Source: EVAL-03 gap review)

6. **Do not assume bounded convergence evidence generalizes.** EVAL-04 proved parity on a pre-bounded 5-slide task. This does not imply parity on open-ended discovery or iterative authoring tasks. (Source: EVAL-04 gap review)

7. **Do not assume annotations and concepts are inspectable in the browser after import.** The session carries them, but no browser UI surface exposes them for human review. (Source: EVAL-03 gap review)

8. **Do not assume PPTX chart output is client-presentable.** The current chart rendering applies the full color palette to every data point in single-series charts, producing bars with random colors. There are no gridlines, no bar gap control, and no axis formatting beyond library defaults. The D3 browser charts are far better than the exported PPTX. (Source: independent artifact review of EVAL-04 deck)

9. **Do not assume agent crosstab artifacts look like standard crosstabs.** The MCP `velocity_crosstab` returns data in long/tidy format (one row per cell intersection). The browser pivots this into a matrix, but the agent surface does not. Agent-produced CSVs are raw computation output, not recognizable analysis tables. (Source: independent review of EVAL-06 CSV artifact)

10. **Do not assume the harmonization eval validated matching quality.** EVAL-05 tested only exact-name matching on adjacent ELSA files. The matching engine's Jaro-Winkler, Jaccard, scale inversion, and type compatibility algorithms have unit tests but have never been exercised on a real cross-wave scenario with naming drift. (Source: independent code review of `matchEngine.ts` vs EVAL-05 process log)

---

## 5. Ranked Product Gaps

| Rank | Gap | Response class | Affected layers | Source evals | Priority |
|---|---|---|---|---|---|
| 1 | No category-level discovery primitive (annotation-type filtering, guided "suggest breaks") | Capability expansion | Semantic / discovery, Product defaults | EVAL-01, EVAL-02 | P1 |
| 2 | PPTX chart rendering is not client-presentable: single-series color cycling bug, no gridlines, no bar gap control, PptxGenJS defaults throughout | Capability expansion | Deliverable quality | EVAL-04 (independent review), all chart evals | P2 |
| 3 | MCP crosstab returns raw long/tidy format, not standard crosstab matrix — agent artifacts are unrecognizable to stakeholders | Capability expansion | MCP / workflow, Browser convergence | EVAL-06 (independent review) | P2 |
| 4 | MCP surface does not cover multi-dataset workspace or large-file metadata flow | Capability expansion | MCP / workflow, Browser convergence | EVAL-05, EVAL-06 | P3 |
| 5 | No recommended break variables or false-positive warnings after topic selection | Capability expansion | Product defaults | EVAL-01, EVAL-02 | P3 |
| 6 | EVAL-05 only tested exact-name harmonization — fuzzy matching, scale inversion, label overlap all untested on real data | Eval coverage gap | Harmonization | EVAL-05 (independent review) | P4 |
| 7 | Deck build transport ceiling — large JSON payloads over stdio | Capability expansion | MCP / workflow | EVAL-01 | P4 |
| 8 | Session import variable-resolution diagnostics on exact-match datasets | Rough-edge | Browser convergence | EVAL-03 | P5 |
| 9 | Browser and MCP session export diverge on top-level working-state semantics | Rough-edge | Browser convergence | EVAL-04 | P5 |
| 10 | No browser UI for semantic state inspection after session import | Rough-edge | Browser convergence, Product defaults | EVAL-03 | P5 |
| 11 | Harmonized output uses generic `_wave` markers instead of original wave identifiers | Rough-edge | Deliverable quality | EVAL-05 | P5 |

---

## 6. Recommended Next-Phase Priorities

### Must-do before resuming feature expansion

These items block the thesis statement from advancing beyond "strong backend":

1. **Category-aware discovery.** Expose annotation types as a filterable dimension. Add a `listVariablesByCategory(category)` engine method and MCP tool. Add guided "suggest breaks for topic X" flow. This directly addresses the two contradicted claims (U1, U2) and gap #1.

2. **PPTX chart rendering overhaul.** Fix the single-series color cycling bug (each bar should not get a different color). Add bar gap control, gridlines, axis formatting, data label positioning. Close the quality gap between D3 browser charts and PPTX export so output is client-presentable. This addresses U8 and gap #2. This is not polish — the current output would fail stakeholder review.

3. **Crosstab matrix format for MCP.** Add a `format: 'matrix'` option to `velocity_crosstab` (or a dedicated `velocity_format_crosstab` tool) that returns standard pivot-shaped output instead of raw long/tidy computation rows. Agent artifacts must look like standard crosstabs. This addresses U9 and gap #3.

4. **MCP workspace and large-file tools.** Add `velocity_load_metadata` + `velocity_load_full` two-step flow. Add multi-dataset workspace tools dispatching to existing engine harmonization methods. This addresses U3 and gap #4.

5. **Recommended break variables.** After the agent selects a topic variable, surface recommended demographic or thematic break variables based on annotation types. This addresses U4 and gap #5.

### Should-do in next phase

These strengthen the thesis but do not block it:

6. **Harmonization re-run on fuzzy-match scenario.** Rerun EVAL-05 with a construct that has naming drift, partial label overlap, or scale inversions between waves. Without this, the harmonization claim is only validated for the trivial case. (Gap #6, addresses U10)

7. **Deck build transport resilience.** Stream or chunk `buildDeck` responses to avoid stdio OOM on richer decks. (Gap #7)

8. **Session import fidelity.** Eliminate spurious unresolved-variable diagnostics on exact-match imports. (Gap #8)

9. **Session export alignment.** Ensure browser and MCP export the same top-level working state. (Gap #9)

10. **False-positive warnings.** Warn when a variable name suggests a survey weight but is actually a measurement. Warn before high-cardinality crosstabs. (Part of gap #5)

### Explicitly deferred

11. **Browser semantic inspection UI.** Real but not blocking — annotations are preserved, just not displayed. (Gap #10)

12. **Harmonized output wave identifiers.** Polish issue. (Gap #11)

13. **TF-IDF/BM25 for search ranking.** Defined as the escalation path if category-aware discovery does not raise EVAL-02 discovery above score 3. Not needed until the primary intervention is tested.

### Out of current scope

14. **Embedding-based retrieval.** The evidence does not show synonym drift or concept-level mismatch as the primary discovery failure. The bottleneck is a missing navigational primitive, not a ranking quality problem. Embeddings are premature.

15. **Retrieval-augmented discovery.** The evals show agents struggling to find variables, not struggling to decide what to analyze once variables are found. RAG addresses the wrong level of abstraction.

---

## 7. Frozen Benchmark Baselines

| Eval ID | Task shape | Baseline date | Per-layer scores (Engine / MCP / Semantic / BrowserConv / Deliverable / Defaults / Prompting) | Artifacts |
|---|---|---|---|---|
| EVAL-01 | End-to-end MCP deck on small labeled dataset | 2026-03-13 | 4 / 2 / 3 / N/A / 4 / 3 / 3 | `evals/eval-01/runs/run-2026-03-13/` |
| EVAL-02 | Weighted MCP deck on large social survey | 2026-03-13 | 5 / 4 / 2 / N/A / 5 / 3 / 4 | `evals/eval-02/runs/run-2026-03-13/` |
| EVAL-04 | Controlled browser-vs-MCP convergence | 2026-03-13 | 5 / 4 / N/A / 4 / 5 / 4 / 4 | `evals/eval-04/runs/run-2026-03-13/` |
| EVAL-06 | Browser stress on WVS Wave 7 | 2026-03-13 | 5 / 2 / 3 / 4 / 4 / 4 / 4 | `evals/eval-06/runs/run-2026-03-13/` |

EVAL-03 and EVAL-05 are informative but not frozen as regression baselines because they tested workflow paths (handoff, harmonization) that are expected to change materially with MCP coverage expansion.

### Regression rule

Per `eval_00_outcome_decision_framework.md`: any layer dropping by 2+ points on a re-run warrants investigation. The primary regression targets after the recommended interventions:

- EVAL-02 semantic/discovery should rise from 2 → 3+ after category-aware discovery
- EVAL-01 MCP/workflow should rise from 2 → 3+ after deck transport fix
- EVAL-05 MCP/workflow should rise from 2 → 3+ after workspace MCP tools

---

## 8. Roadmap Implications

### New work items to add to tracker

| Proposed ID | Stream | Outcome | Depends on | Recommended phase |
|---|---|---|---|---|
| S4-DISC-1 | Discovery | Category-aware discovery: annotation-type filters, `listVariablesByCategory` engine method + MCP tool, guided "suggest breaks for topic X" | S4-EVAL-5 | Post-Phase-4 (P1) |
| S4-DELIV-1 | Export | PPTX chart rendering overhaul: fix single-series color cycling, add bar gap/gridline/axis control, close D3→PPTX quality gap | S4-EVAL-5 | Post-Phase-4 (P2) |
| S4-FMT-1 | MCP | Crosstab matrix format: add `format: 'matrix'` to `velocity_crosstab` so agents receive standard pivot-shaped output | S4-EVAL-5 | Post-Phase-4 (P2) |
| S4-MCP-1 | MCP | Workspace-aware MCP: `velocity_load_metadata` + `velocity_load_full` two-step flow; multi-dataset workspace tools | S4-EVAL-5 | Post-Phase-4 (P3) |
| S4-DEF-1 | Defaults | Recommended break variables after topic selection; false-positive weight warnings; high-cardinality guardrails | S4-DISC-1 | Post-Phase-4 (P3) |
| S4-MCP-2 | MCP | Deck build transport resilience: stream or chunk `buildDeck` responses | S4-EVAL-5 | Post-Phase-4 (P4, should-do) |
| S4-EVAL-5b | Eval | Harmonization re-run: EVAL-05 follow-on with naming drift, partial label overlap, or scale inversion construct | S4-EVAL-5 | Post-Phase-4 (P4, should-do) |

### Existing items to re-sequence

- **S5-R-1 (WebR Bridge)** should remain blocked on S4-EVAL-5 as originally specified. The Phase 4 findings do not change its dependencies.
- **S5-HARM-1** is already Done. The next harmonization work should be gated on S4-MCP-1 (workspace MCP tools) so that the agent path catches up with the browser path.
- **S5-PREP-1 (Recipe Manager)** dependency is unchanged but should be informed by the "do not assume" list — particularly U3 (MCP coverage) and U4 (product defaults).

### Items to remove or descope

- No existing tracker items should be removed. The Phase 4 findings reinforce the existing sequencing rather than invalidating it.
- Embedding-based retrieval and RAG should remain explicitly out-of-scope until the primary discovery intervention (category-aware filtering) has been tested and found insufficient.

---

## 9. Appendix: Per-Eval Summary Table

| Eval ID | Task family | Dataset | Overall severity | Key pattern | Key gap |
|---|---|---|---|---|---|
| EVAL-01 | B (deck) | sleep.sav (271 resp, 59 vars) | Significant | Pattern 2: good insight, painful workflow | Missing MCP deck-commit (fixed); deck build transport ceiling; weak demographic discovery |
| EVAL-02 | A (discovery) | BSA 2017 (3,988 resp, 654 vars) | Significant | Pattern 4: agent lost in discovery | Semantic search returns wrong top-ranked variables for category-level and analytical queries |
| EVAL-03 | C (handoff) | Reuse EVAL-01 session | Moderate | Pattern 2: good insight, painful workflow | Browser export dropped semantic state (fixed); import shows spurious unresolved diagnostics |
| EVAL-04 | D (convergence) | sleep.sav (controlled) | Passing | Pattern 7: end-to-end success | Narrow parity achieved; remaining gap is working-state semantics in session export |
| EVAL-05 | E (harmonization) | ELSA IFS waves 4+5 | Passing | Pattern 7: end-to-end success | Browser-only harmonization path; MCP has no workspace tools |
| EVAL-06 | F (stress) | WVS Wave 7 (97,220 resp, 693 vars) | Passing | Pattern 7: end-to-end success | Browser stress path validated; MCP/CLI stress path untested |

---

## 10. Phase 4 Gate Check Summary

### Gate 1: Intended path viability — PASSED

The MCP/browser/engine path is runnable for single-dataset deck workflows. Artifact capture is defined. Session round-trip is testable and tested.

### Gate 2: Benchmark honesty — PASSED WITH CAVEATS

The three Pattern 7 successes were deliberately bounded. Open-ended discovery on large surveys (EVAL-02) drops to Pattern 4. Success at the current level depends on the agent compensating for weak discovery and passive defaults with reasoning effort.

**Independent review addendum:** The agent's self-assessment systematically overrated deliverable quality because language models can work with any data format — but human stakeholders cannot. PPTX output scored 4–5 by the agent is not client-presentable (color cycling bug, library defaults). CSV artifacts scored as adequate are in a format no analyst would recognize as a crosstab. EVAL-05's Pattern 7 claim rests on testing only the trivial exact-match case. The honest summary: computation is strong, communication is weak.

### Gate 3: Strategic sufficiency — PASSED

The current design is strong enough to refine. No layer requires interface re-engineering or scope revision. The gaps are capability expansion problems within the current architectural thesis.

### Gate 4: Thesis statement — WRITTEN

See §1. The honest claim is: strong backend, narrow convergence, not yet a complete agent interface. The gap is discovery, MCP breadth, and defaults.

---

## 11. Core Questions Resolution

Per Phase 4 plan §"Core questions Phase 4 must answer":

### Product-thesis questions

| Question | Answer | Evidence |
|---|---|---|
| Is Velocity credible as a first-class analytical interface for agents for at least one task shape? | **Partially yes.** For bounded single-dataset deck creation on well-labeled surveys, yes. For open-ended discovery on large surveys, not yet. | EVAL-04 (Pattern 7); EVAL-02 (Pattern 4) |
| Is the success broad enough to justify that claim? | **Not yet.** Three of six evals required bounded scoping to succeed. | EVAL-04, 05, 06 succeeded when bounded; EVAL-01, 02 struggled when open-ended |
| Where is the product acting like a real environment vs merely a capable backend? | Engine + export + session = real environment. Discovery + defaults + MCP breadth = capable backend. | Cross-cutting gap review §Executive Summary |

### Interface questions

| Question | Answer | Evidence |
|---|---|---|
| Is the intended MCP/browser/engine path the path an agent would naturally use? | **Yes for single-dataset deck work. No for harmonization or stress.** | EVAL-02 (MCP path viable); EVAL-05 (browser-only harmonization) |
| Are current abstractions high-level enough for research work? | **Mostly yes.** The agent does not need raw SQL or internal wiring. The gap is missing navigational primitives, not too-low-level computation. | All six evals completed through intended abstractions |
| Are there places where the agent compensates for weak interface with reasoning effort? | **Yes: discovery and break-variable selection.** | EVAL-01 (manual curation); EVAL-02 (brute-force variable scanning) |

### Capability questions

| Question | Answer | Evidence |
|---|---|---|
| Is semantic discovery sufficient with heuristic + token-search? | **No for large surveys and category-level navigation.** Sufficient for bounded topic queries on friendly datasets. | EVAL-02 (score 2); EVAL-01 (score 3) |
| What level of intervention is justified? | **Category-aware filtering (Option A+E).** Not embeddings or RAG. | Semantic option study in S4-EVAL-4 |
| Are deck-authoring problems mainly defaults or a missing authoring model? | **Mainly defaults and transport.** The authoring model is adequate. | EVAL-01 (transport ceiling); EVAL-02 (score 5 on deliverable) |
| Is session export/handoff usable for collaboration? | **Yes, with rough edges.** | EVAL-03 (round-trip works); EVAL-04 (sessions comparable) |

### Convergence questions

| Question | Answer | Evidence |
|---|---|---|
| Are browser and agent users on the same effective product surface? | **For single-dataset deck work, yes. For harmonization and stress, no.** | EVAL-04 (near-parity); EVAL-05 (browser-only) |
| What specific affordances remain browser-only? | Harmonization workspace, large-file metadata gate, last-mile editability, semantic inspection UI | EVAL-05, EVAL-06, EVAL-03, EVAL-04 gap reviews |
| Are we converging on one product or just sharing a backend? | **Converging, but the agent path is a release behind the browser path on workflow breadth.** | All six evals |

### Scope questions

| Question | Answer | Evidence |
|---|---|---|
| Which dataset classes can Velocity support for agent-led work today? | Small to medium well-labeled single-dataset surveys. Large surveys require agent-driven curation. Stress-scale datasets are browser-only. | EVAL-01 (small, viable); EVAL-02 (large, viable with effort); EVAL-06 (stress, browser-only) |
| Which deliverable types are in scope? | PPTX decks + .velocity sessions. Harmonization outputs and stress reports are browser-only. | EVAL-01, EVAL-02 (deck + session); EVAL-05, EVAL-06 (browser artifacts) |
| What should be deferred? | Embeddings, RAG, harmonization export formats, stress-report formats | S4-EVAL-4 option study; §6 "Out of current scope" |

---

## 12. Definition of Done Check

| Criterion | Status |
|---|---|
| Thesis statement written | Done (§1) |
| Every Phase 4 core question classified as validated, unvalidated, or contradicted | Done (§11) |
| Every major gap has a response class and recommended next action | Done (§5, §6) |
| At least one benchmark baseline frozen | Done (§7: four baselines frozen) |
| Roadmap implications contain concrete tracker updates | Done (§8) |
| Downstream feature expansion resumes only after this document exists | This document now exists |

**Phase 4 is complete.**
