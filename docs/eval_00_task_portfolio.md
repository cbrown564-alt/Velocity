# Phase 4 Task Portfolio

## Purpose

This document concretizes the six task families defined in `plan_phase4_agent_capability_validation.md` into a specific set of eval tasks with assigned datasets, difficulty ratings, and coverage status.

It is the canonical reference for which evals exist, what they test, and where the portfolio has gaps.

Use with:

- [plan_phase4_agent_capability_validation.md](/Users/cobro/Code/Velocity/docs/plan_phase4_agent_capability_validation.md)
- [eval_00_outcome_decision_framework.md](/Users/cobro/Code/Velocity/docs/eval_00_outcome_decision_framework.md)

---

## Task Family Reference

| Family | Code | Core question |
|---|---|---|
| Unfamiliar dataset discovery | A | Can the agent find the right variables without brute force? |
| End-to-end deck creation | B | Can the agent produce a presentation-quality deck, not just correct tables? |
| Session handoff and browser refinement | C | Can the agent leave behind work a human can meaningfully inspect and continue? |
| Browser-agent convergence | D | Does a skilled browser user get materially better results from the same substrate? |
| Harmonization and cross-wave work | E | Can the agent use workspace capabilities beyond single-dataset analysis? |
| Stress and edge cases | F | Is success robust or only on favorable datasets? |

---

## Difficulty Rating Dimensions

Per `eval_00_outcome_decision_framework.md`, every eval should be tagged on these five dimensions.

| Dimension | Low | Medium | High |
|---|---|---|---|
| Dataset size | < 50 variables | 50–500 variables | 500+ variables |
| Naming quality | Clear, labeled variables | Mixed | Mostly raw codes or abbreviations |
| Domain specificity | General-purpose data | Some domain knowledge needed | Deep domain expertise required |
| Analysis complexity | Single crosstab | Multi-table with filters/weights | Longitudinal, multi-dataset, or custom statistics |
| Deliverable expectations | Raw findings | Formatted tables/charts | Presentation-ready deck with narrative |

---

## Portfolio

### Eval 01 — Sleep Health Study

| Field | Value |
|---|---|
| **ID** | EVAL-01 |
| **Brief** | `eval_01_sleep_research_brief.md` |
| **Dataset** | `test_data/sleep.sav` (271 respondents, 59 variables) |
| **Primary family** | B (end-to-end deck creation) |
| **Secondary families** | A (discovery on small dataset) |
| **Status** | Brief complete. Not yet run under Phase 4 contract. |

**Difficulty ratings:**

| Dimension | Rating | Notes |
|---|---|---|
| Dataset size | Low | 59 variables — full inventory reviewable |
| Naming quality | Medium | Most labeled, some opaque (`qualsleep4gp`, `hourwknight`) |
| Domain specificity | Medium | Clinical scales (ESS, HADS) require some health domain knowledge |
| Analysis complexity | Medium | Multi-table, filtering (sleep-problem subgroup), metric variable handling |
| Deliverable expectations | High | Presentation-ready 8–12 slide deck with narrative |

**Key pitfalls:** Body-weight variable mistaken for survey weight; metric variables producing 30+ row tables; impact variables needing subgroup filter.

---

### Eval 02 — British Social Attitudes 2017

| Field | Value |
|---|---|
| **ID** | EVAL-02 |
| **Brief** | `eval_02_bsa2017_research_brief.md` |
| **Benchmark plan** | `plan_eval_02_benchmark.md` |
| **Process log** | `eval_02_process_log.md` |
| **Dataset** | `test_data/British Social Attitudes Survey/bsa2017_for_ukda.sav` (3,988 respondents, 654 variables) |
| **Primary family** | A (unfamiliar dataset discovery) |
| **Secondary families** | B (deck creation at scale) |
| **Status** | Brief complete. Initial run logged. Benchmark rerun pending (per `plan_eval_02_benchmark.md`). |

**Difficulty ratings:**

| Dimension | Rating | Notes |
|---|---|---|
| Dataset size | High | 654 variables — cannot be reviewed manually |
| Naming quality | Medium | Abbreviated but usually interpretable (`Redistrb`, `NHSSat`, `GovTrust`) |
| Domain specificity | High | British politics (post-Brexit), survey methodology (split questionnaire, derived scales) |
| Analysis complexity | High | Multi-table, required weighting (`WtFactor`), split-sample awareness, derived vs raw variables |
| Deliverable expectations | High | 12–18 slide presentation deck with thematic narrative |

**Key pitfalls:** Variable overload (654); questionnaire versioning (75% missing ≠ broken); coded missing values (`8`/`9`); redundant raw vs derived scales; high-cardinality cross-tabs.

---

### Eval 03 — Session Handoff Round-Trip (Planned)

| Field | Value |
|---|---|
| **ID** | EVAL-03 |
| **Brief** | `eval_03_session_handoff_roundtrip_brief.md` |
| **Dataset** | Reuse EVAL-01 or EVAL-02 output session |
| **Primary family** | C (session handoff and browser refinement) |
| **Secondary families** | — |
| **Status** | Brief complete. Run pending. |

**Purpose:** Test whether an agent-produced session file can be loaded in the browser, inspected, and meaningfully refined by a human without rebuilding from scratch. Validates provenance, slide spec round-trip, and filter/weight persistence.

**Difficulty ratings:**

| Dimension | Rating | Notes |
|---|---|---|
| Dataset size | Low | Reuses existing dataset — discovery is not the test |
| Naming quality | N/A | Not testing discovery |
| Domain specificity | Low | Handoff mechanics, not domain analysis |
| Analysis complexity | Low | Pre-built deck; test is inspection and refinement |
| Deliverable expectations | Medium | Refined session file; documented what survived and what broke |

---

### Eval 04 — Browser vs Agent Convergence (Planned)

| Field | Value |
|---|---|
| **ID** | EVAL-04 |
| **Brief** | `eval_04_browser_vs_agent_convergence_brief.md` |
| **Dataset** | `test_data/sleep.sav` (controlled; same task, both paths) |
| **Primary family** | D (browser-agent convergence) |
| **Secondary families** | B (deck creation as the shared task) |
| **Status** | Brief complete. Run pending. |

**Purpose:** Run the same concrete task ("produce a 5-slide deck on sleep quality by demographics") through both the browser UI and the MCP/engine path. Compare outputs side-by-side on: variable selection, chart quality, export fidelity, total effort, and required workarounds.

Per `eval_00_agent_interface_validation.md` §3 convergence testing guidance, this is the minimum viable convergence eval.

**Difficulty ratings:**

| Dimension | Rating | Notes |
|---|---|---|
| Dataset size | Low | 59 variables — keeps the task controlled |
| Naming quality | Medium | Same as EVAL-01 |
| Domain specificity | Low | Deliberately simple to isolate interface differences |
| Analysis complexity | Low | Single-theme, 5 slides — complexity is not the variable |
| Deliverable expectations | Medium | Side-by-side comparison document, not a standalone deck |

---

### Eval 05 — Cross-Wave Harmonization (Planned)

| Field | Value |
|---|---|
| **ID** | EVAL-05 |
| **Brief** | `eval_05_cross_wave_harmonization_brief.md` |
| **Dataset** | `test_data/English Longitudinal Study of Ageing/` (multiple wave files) |
| **Primary family** | E (harmonization and cross-wave work) |
| **Secondary families** | A (discovery across waves) |
| **Status** | Brief complete. Run pending on data availability and workspace maturity. |

**Purpose:** Test whether the agent can load multiple wave files, discover mapping candidates across waves, interpret harmonization suggestions, and produce a harmonized cross-wave analysis. ELSA provides a real longitudinal dataset with wave-to-wave variable drift.

**Difficulty ratings:**

| Dimension | Rating | Notes |
|---|---|---|
| Dataset size | High | Multiple wave files, each with substantial variable inventories |
| Naming quality | Medium | ELSA uses systematic naming but conventions shift across waves |
| Domain specificity | High | Ageing research, longitudinal methodology |
| Analysis complexity | High | Multi-dataset, cross-wave mapping, harmonized table construction |
| Deliverable expectations | Medium | Harmonized table + summary of mapping decisions; not a full presentation deck |

---

### Eval 06 — Stress: Messy Labels and Weak Metadata (Planned)

| Field | Value |
|---|---|
| **ID** | EVAL-06 |
| **Brief** | `eval_06_stress_wvs_brief.md` |
| **Dataset** | `test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav` |
| **Primary family** | F (stress and edge cases) |
| **Secondary families** | A (discovery under adversity) |
| **Status** | Brief complete. Run pending. Note: WVS parsing has known issues (3 `.todo` tests in S2-VAL-1 pending ReadStat-WASM fix). Trust dataset remains the explicit fallback. |

**Purpose:** Test agent resilience on a large, internationally-sourced dataset with high variable count, multi-language labels, complex coding schemes, and high missingness from country-level question routing. If the WVS file cannot be parsed, substitute `test_data/People_s Trust - A Survey-Based Experiment/trust.sav` as a smaller stress case with potentially weaker metadata.

**Difficulty ratings:**

| Dimension | Rating | Notes |
|---|---|---|
| Dataset size | High | WVS Wave 7 has 500+ variables across 60+ countries |
| Naming quality | High | Abbreviated, code-heavy naming (`Q1`–`Q290`); multi-language value labels |
| Domain specificity | High | Cross-national survey methodology, country-level weighting |
| Analysis complexity | High | Country filtering, complex weighting, high missingness from routing |
| Deliverable expectations | Medium | Findings summary; test is resilience, not presentation quality |

---

## Coverage Matrix

| Family | Code | Covered by | Gap |
|---|---|---|---|
| Unfamiliar dataset discovery | A | EVAL-02 (primary), EVAL-01 (secondary) | None — well covered at both low and high difficulty |
| End-to-end deck creation | B | EVAL-01 (primary), EVAL-02 (secondary) | None — covered at both scales |
| Session handoff | C | EVAL-03 (planned) | None — brief exists |
| Browser-agent convergence | D | EVAL-04 (planned) | None — brief exists |
| Harmonization / cross-wave | E | EVAL-05 (planned) | Workspace maturity and local data availability remain gating factors |
| Stress / edge cases | F | EVAL-06 (planned) | WVS parsing feasibility remains uncertain; fallback is defined |

---

## Portfolio Completion Criteria

The portfolio is considered complete for S4-EVAL-1 purposes when:

1. Every task family (A–F) has at least one eval with an assigned dataset and difficulty ratings.
2. Families A and B have concrete briefs with run-ready detail (done).
3. Families C–F have concrete briefs with purpose, task, deliverable, and difficulty framing (done).
4. Remaining blockers are runtime readiness, dataset availability, and workflow maturity — not missing brief documents.

The distinction matters: the **portfolio structure** is an S4-EVAL-1 deliverable. The **individual briefs** for later families are S4-EVAL-2/S4-EVAL-3 deliverables, because they depend on intended-path readiness work to be meaningfully specified.
