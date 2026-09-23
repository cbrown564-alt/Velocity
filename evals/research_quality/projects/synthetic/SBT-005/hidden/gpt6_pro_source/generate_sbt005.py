#!/usr/bin/env python3
"""SBT-005: a synthetic, paired campaign-assignment benchmark.

Usage: python generate_sbt005.py --out OUTPUT_DIR --seed 2026092205
Dependencies: Python standard library, NumPy, pandas. No network or repository access.

AUTHOR/COORDINATOR MATERIAL: source and hidden_design.json reveal the DGP and
intended findings. Evaluated models receive only the four named public outputs.
Random draws implement a declared DGP; there is no seed search, rejection on
outcomes, row repair, target-percentage allocation, or acceptance-driven retry.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

STUDY_ID = "SBT-005"
VERSION = "0.1.0-first-candidate"
DEFAULT_SEED = 2026092205
N_RESPONDENTS = 2800
MISSING = {"97": "Don't know / cannot remember", "98": "Prefer not to answer", "99": "Item not answered"}
PUBLIC_FILES = ["respondents.csv", "codebook.json", "questionnaire.md", "study_materials.json"]
OUTPUT_FILES = PUBLIC_FILES + ["hidden_design.json"]

# All target percentages are fictional design proportions, not UK benchmarks.
TARGET_AGE = np.array([0.25, 0.36, 0.23, 0.16])
SAMPLE_AGE = np.array([0.30, 0.42, 0.18, 0.10])
TARGET_ONLINE_BY_AGE = np.array([0.50, 0.52, 0.38, 0.26])
SAMPLE_ONLINE_BY_AGE = np.array([0.64, 0.66, 0.52, 0.40])

COLUMNS = [
    "respondent_id", "age_band", "children_under18", "work_pattern",
    "online_grocery_pre", "digital_confidence_pre", "budget_pressure_pre",
    "mealplan_days_pre", "assignment", "weight_base", "followup_status",
    "followup_attempts", "receipt_log", "receipt_count", "recall_post",
    "awareness_pre", "awareness_post", "consideration_pre", "consideration_post",
    "usage_pre", "usage_post", "meal_stress_pre", "meal_stress_post",
    "campaign_clear_post", "campaign_relevant_post", "campaign_trust_post",
    "campaign_channel_post", "info_search_post", "usage_days_post",
    "satisfaction_post", "planning_confidence_post",
]
POST_SURVEY_COLUMNS = [
    "recall_post", "awareness_post", "consideration_post", "usage_post",
    "meal_stress_post", "campaign_clear_post", "campaign_relevant_post",
    "campaign_trust_post", "campaign_channel_post", "info_search_post",
    "usage_days_post", "satisfaction_post", "planning_confidence_post",
]


def sigmoid(x: Any) -> Any:
    return 1.0 / (1.0 + np.exp(-np.asarray(x)))


def ordinal(x: np.ndarray, cuts: tuple[float, ...] = (-1.20, -0.35, 0.45, 1.25)) -> np.ndarray:
    """Threshold a continuous response; categories are 1..5, never clipped rows."""
    return np.digitize(x, np.asarray(cuts)) + 1


def observe(
    values: np.ndarray, rng: np.random.Generator, eligible: np.ndarray,
    dk: float | np.ndarray = 0.018, refusal: float = 0.006, item_missing: float = 0.005,
) -> np.ndarray:
    """Measurement/missingness mechanism, applied once, not post-hoc data repair.

    Numeric missing codes belong to eligible questionnaire items. Ineligible or
    unreturned questionnaires are structural blanks. Eligibility uses the
    *recorded* routing response wherever routing depends on a survey item.
    """
    u = rng.random(len(values))
    dk_arr = np.broadcast_to(np.asarray(dk, dtype=float), (len(values),))
    if np.any(dk_arr < 0) or np.any(dk_arr + refusal + item_missing >= 1):
        raise ValueError("Invalid missingness probabilities")
    out = np.asarray(values, dtype=float).copy()
    out[u < dk_arr] = 97
    out[(u >= dk_arr) & (u < dk_arr + refusal)] = 98
    out[(u >= dk_arr + refusal) & (u < dk_arr + refusal + item_missing)] = 99
    out[~eligible] = np.nan
    return out


def variable(
    name: str, question_id: str, label: str, valid: dict[int, str] | list[int],
    *, wave: str = "baseline", route: str = "All 2,800 enrolled respondents",
    missing: bool = True, structural: bool = False, notes: str = "",
) -> dict[str, Any]:
    labels = ({str(k): v for k, v in valid.items()} if isinstance(valid, dict)
              else {str(k): str(k) for k in valid})
    return {
        "name": name, "question_id": question_id, "label": label,
        "storage": "integer_numeric_code", "wave": wave, "route": route,
        "valid_values": [int(k) for k in labels], "value_labels": labels,
        "missing_codes": dict(MISSING) if missing else {},
        "missing_values": [97, 98, 99] if missing else [],
        "structural_blank_allowed": structural,
        "structural_blank_definition": (
            "No follow-up questionnaire, or route is not established by a valid recorded routing answer; not a measured zero."
            if structural else "Not allowed"
        ),
        "notes": notes,
    }


def codebook() -> dict[str, Any]:
    yes_no = {0: "No", 1: "Yes"}
    intention = {1: "Definitely would not", 2: "Probably would not", 3: "Might or might not", 4: "Probably would", 5: "Definitely would"}
    agreement = {1: "Strongly disagree", 2: "Somewhat disagree", 3: "Neither agree nor disagree", 4: "Somewhat agree", 5: "Strongly agree"}
    stress = {1: "Not at all stressful", 2: "Slightly stressful", 3: "Moderately stressful", 4: "Very stressful", 5: "Extremely stressful"}
    all_post = "followup_status == 1"
    recaller = "followup_status == 1 AND recall_post == 1"
    user = "followup_status == 1 AND usage_post == 1"
    v: list[dict[str, Any]] = [
        {"name": "respondent_id", "question_id": "ID", "label": "Synthetic household/respondent ID", "storage": "string",
         "format": "SBT005_ followed by four digits", "missing_values": [], "missing_codes": {},
         "structural_blank_allowed": False, "route": "All enrolled respondents", "wave": "administrative"},
        variable("age_band", "P1", "Age", {1: "18-34", 2: "35-54", 3: "55-64", 4: "65+"}, missing=False),
        variable("children_under18", "P2", "Any child aged under 18 in household", yes_no, missing=False),
        variable("work_pattern", "P3", "Main work pattern", {1: "Regular fixed hours", 2: "Irregular or shift hours", 3: "Not in paid work / retired"}, missing=False),
        variable("online_grocery_pre", "P4", "Ordered groceries online in previous four weeks", yes_no, missing=False),
        variable("digital_confidence_pre", "P5", "Confidence using apps for household tasks", {1: "Not at all confident", 2: "Slightly confident", 3: "Moderately confident", 4: "Very confident", 5: "Extremely confident"}),
        variable("budget_pressure_pre", "P6", "Grocery-budget pressure in previous four weeks", {1: "None", 2: "Slight", 3: "Moderate", 4: "High", 5: "Very high"}),
        variable("mealplan_days_pre", "P7", "Days in last seven days with evening meal planned by previous evening", list(range(8))),
        variable("assignment", "R1", "Randomised campaign-encouragement assignment", {0: "Usual communications / control", 1: "Campaign invitation sequence"}, missing=False, wave="randomisation",
                 notes="Assigned after baseline. Keep assignment unchanged when receipt or recall differs. Exact 1:1 complete randomisation."),
        {"name": "weight_base", "question_id": "W1", "label": "Positive baseline profile-transport weight", "storage": "positive_float",
         "valid_range": {"exclusive_minimum": 0}, "missing_values": [], "missing_codes": {}, "structural_blank_allowed": False,
         "wave": "baseline", "route": "All enrolled respondents",
         "notes": "Based ONLY on age x baseline online-grocery sampling cell. Normalised once to baseline mean one; not an attrition or receipt-propensity weight. Sum is a weighted N, not a known population size."},
        variable("followup_status", "F1", "Follow-up questionnaire returned", {0: "No follow-up questionnaire", 1: "Returned; item-level missingness may remain"}, wave="administrative", missing=False),
        variable("followup_attempts", "F2", "Survey invitation/contact attempts", {1: "One", 2: "Two", 3: "Three", 4: "Four"}, wave="administrative", missing=False,
                 notes="Nonreturners exhausted four attempts. Do not condition the main analysis on this post-assignment variable."),
        variable("receipt_log", "L1", "Any qualifying logged campaign receipt during days 1-14", yes_no, wave="campaign_log", missing=False,
                 notes="A rendered creative/opened campaign message, NOT random assignment, proven attention, recall, or purchase. Available even for survey nonreturners. Control respondents can encounter organic placements."),
        variable("receipt_count", "L2", "Number of qualifying logged campaign receipts", list(range(5)), wave="campaign_log", missing=False,
                 notes="0 iff receipt_log=0; 1-4 iff receipt_log=1. Administrative exposure measure, not a causal dose."),
        variable("recall_post", "Q8", "Self-reported recall of BasketBridge campaign in previous six weeks", yes_no, wave="followup", route=all_post, structural=True,
                 notes="Asked after outcomes. Can disagree with logs. A valid No is 0; 97/98/99 are not No."),
    ]
    for wave in ("pre", "post"):
        route = "All enrolled respondents" if wave == "pre" else all_post
        v.append(variable(f"awareness_{wave}", f"Q1_{wave}", "Prompted awareness before today's interview", yes_no,
                          wave="baseline" if wave == "pre" else "followup", route=route, structural=wave == "post"))
    for wave in ("pre", "post"):
        v.append(variable(f"consideration_{wave}", f"Q2_{wave}", "Likelihood to consider BasketBridge for next grocery-planning occasion", intention,
                          wave="baseline" if wave == "pre" else "followup", route="All enrolled respondents" if wave == "pre" else all_post,
                          structural=wave == "post", notes="Unconditional after the same neutral description at each wave; do not restrict to aware respondents. Top-two-box = valid codes 4 or 5."))
    for wave in ("pre", "post"):
        v.append(variable(f"usage_{wave}", f"Q3_{wave}", "Self-reported BasketBridge use in previous four weeks", yes_no,
                          wave="baseline" if wave == "pre" else "followup", route="All enrolled respondents" if wave == "pre" else all_post,
                          structural=wave == "post", notes="A self-reported service-use measure, NOT administrative active-user, grocery-transaction, sales or revenue data."))
    for wave in ("pre", "post"):
        v.append(variable(f"meal_stress_{wave}", f"Q4_{wave}", "Stress deciding what household will eat in previous seven days", stress,
                          wave="baseline" if wave == "pre" else "followup", route="All enrolled respondents" if wave == "pre" else all_post, structural=wave == "post"))
    for name, qid, label in [
        ("campaign_clear_post", "Q9", "The campaign message was clear"),
        ("campaign_relevant_post", "Q10", "The campaign message felt relevant to my household"),
        ("campaign_trust_post", "Q11", "The campaign message was believable"),
    ]:
        v.append(variable(name, qid, label, agreement, wave="followup", route=recaller, structural=True,
                          notes="Asked only of recorded recall=Yes. Shared respondent impressions; report distributions and weighted descriptive associations, not causal drivers."))
    v.extend([
        variable("campaign_channel_post", "Q12", "Main recalled campaign channel", {1: "Email", 2: "Social / online feed", 3: "Grocery or planning app placement", 4: "Other"}, wave="followup", route=recaller, structural=True,
                 notes="Self-reported main channel, not verified channel attribution. Single response."),
        variable("info_search_post", "Q5", "Searched for more information about BasketBridge during previous four weeks", yes_no, wave="followup", route=all_post, structural=True),
        variable("usage_days_post", "Q6", "Days used BasketBridge in previous seven days", list(range(8)), wave="followup", route=user, structural=True,
                 notes="Zero is valid: a four-week user need not have used it during the last week. Do not convert structural blanks or 97/98/99 to zero."),
        variable("satisfaction_post", "Q7", "Overall satisfaction with BasketBridge", {1: "Very dissatisfied", 2: "Somewhat dissatisfied", 3: "Neither satisfied nor dissatisfied", 4: "Somewhat satisfied", 5: "Very satisfied"}, wave="followup", route=user, structural=True,
                 notes="Selected self-reported current users only; not all assigned respondents."),
        variable("planning_confidence_post", "Q13", "Confidence managing next week's grocery/meal plan", {1: "Not at all confident", 2: "Slightly confident", 3: "Moderately confident", 4: "Very confident", 5: "Extremely confident"}, wave="followup", route=all_post, structural=True),
    ])
    indexed = {x["name"]: x for x in v}
    if set(indexed) != set(COLUMNS):
        raise AssertionError("Codebook/public-column mismatch")
    return {
        "study_id": STUDY_ID, "version": VERSION, "row_unit": "One enrolled adult with primary/shared grocery-planning responsibility; one respondent per household",
        "format": "UTF-8 CSV; integer codes except respondent_id and weight_base; empty field is structural blank",
        "global_missing_policy": {
            "validity": "Use the variable's explicit valid_values, not a numeric range inferred from the observed values.",
            "numeric_missing_codes": MISSING, "structural_blank": "No returned follow-up or route not established; never a No/zero response.",
            "no_imputation": "Neither numeric missing codes nor structural blanks enter valid-case outcome denominators. No last-observation-carried-forward or nonresponder-as-zero shortcut.",
            "routing_unknown": "Recall or usage coded 97/98/99 cannot establish a Yes route; the follow-up item is structurally blank, not refused.",
        },
        "variables": [indexed[name] for name in COLUMNS],
        "derived_definitions": {
            "consideration_top2": "1 for valid 4,5; 0 for valid 1,2,3; undefined for 97,98,99 or blank.",
            "paired_change": "For each endpoint separately: post valid outcome minus pre valid outcome, on that endpoint's observed pair set only.",
            "priority_households": "children_under18 == 1, measured before randomisation; overlapping ordinary profile, not a latent segment.",
            "older_digital_online": "age_band == 4 AND online_grocery_pre == 1 AND digital_confidence_pre in {4,5}. Exclude invalid digital-confidence answers from either subgroup or its complement when comparing this rule.",
        },
    }


def sampling_cells() -> list[dict[str, Any]]:
    cells = []
    for a in range(4):
        for online in (0, 1):
            target = TARGET_AGE[a] * (TARGET_ONLINE_BY_AGE[a] if online else 1 - TARGET_ONLINE_BY_AGE[a])
            sample = SAMPLE_AGE[a] * (SAMPLE_ONLINE_BY_AGE[a] if online else 1 - SAMPLE_ONLINE_BY_AGE[a])
            cells.append({"age_band": a + 1, "online_grocery_pre": online,
                          "target_joint_probability": float(target), "sample_joint_probability": float(sample),
                          "unnormalised_weight": float(target / sample)})
    return cells


def study_materials() -> dict[str, Any]:
    return {
        "study_id": STUDY_ID, "version": VERSION, "title": "BasketBridge campaign-assignment evaluation",
        "synthetic_notice": "Entirely fictional service, participants and target profile. No estimates describe a real UK market.",
        "public_brief": {
            "service": "BasketBridge is a fictional household grocery-list and meal-planning service, available before the campaign.",
            "campaign": "A two-week 'Plan together, shop with a clearer list' invitation sequence. Content describes shared lists and flexible meal prompts. Organic placements remain accessible in both arms.",
            "decision_question": "Did assignment to campaign invitations change awareness, consideration and reported service use beyond changes in the control arm? What does that support about a further campaign or follow-up test, and what remains unestablished?",
            "target_priority": "Households with children under 18 are a business-priority audience specified before the campaign. Estimate their contrast with the same rules; do not infer targeting value from significance in one subgroup and not the other.",
            "deliverable": "Evidence-traceable, prioritised narrative with arm changes, assignment contrasts, uncertainty and base/attrition limits. No presentation generation is required.",
        },
        "design": {
            "design_type": "Two-arm complete-randomised encouragement/campaign assignment; repeated baseline and follow-up survey; one household per row.",
            "n_enrolled": N_RESPONDENTS, "allocation": "Exactly 1,400 usual-communications/control and 1,400 campaign-invitation assignments, randomly permuted AFTER baseline and independent of baseline variables.",
            "timeline": {"baseline": "Day 0, before assignment", "campaign_and_logs": "Days 1-14", "followup": "Scheduled at six weeks (around day 42)",
                         "behaviour_windows": "Usage and information search: previous four weeks at the applicable interview. Pre and post reference windows do not overlap. Meal-stress and usage-days windows are seven days."},
            "control": "Usual communications; not guaranteed zero receipt. Calendar/category changes, survey recontact and organic campaign encounters can coexist with control-arm change; the design does not separate these mechanisms.",
            "assignment_receipt_recall": {
                "assignment": "Randomised invitation policy (the primary grouping variable).",
                "receipt_log": "Qualifying logged creative receipt; noncompliance/crossover is possible. It is not randomised, does not guarantee attention, and remains observed for nonreturners.",
                "recall_post": "Post-outcome self-report among survey returners; may be affected by attention, earlier affinity, outcomes and memory. It is not a treatment indicator or a replacement for the log.",
            },
            "measurement_order": "Baseline profile and outcomes; random assignment; campaign/log window; follow-up outcomes and behaviour BEFORE campaign recall and routed message diagnostics. Both consideration waves use the identical neutral service description.",
        },
        "sampling": {
            "target_population": "The fictional eligible online-recontact panel of UK adults 18+ with primary/shared grocery-planning responsibility and permission for campaign invitations; one participating adult per household. Not all UK households.",
            "frame": "No claim of a national probability sample. A fixed synthetic target profile is used for profile transport within this eligible frame.",
            "sample": "2,800 baseline respondents drawn with unequal age x baseline online-grocery profile probabilities, then independently randomised. All baseline rows are retained in respondents.csv, including follow-up nonreturners.",
            "strata": sampling_cells(),
        },
        "weights": {
            "variable": "weight_base", "formula": "raw_w_i = target_joint_probability(cell_i) / sample_joint_probability(cell_i); w_i = raw_w_i / mean(raw_w) over all baseline respondents.",
            "positivity": "All eight cells have positive target and sample probabilities. Weights are fixed pre-assignment; do not recompute by arm, outcome or recall.",
            "target_role": "Baseline profile-transport weights, not campaign causal weights, treatment-propensity weights or attrition adjustments. An observed-pair weighted estimate does not automatically recover the full target-population effect.",
            "weighted_N": "sum(w_i) on the exact eligible/valid set; a normalised sample total, not a known population count.",
            "kish_ess": "(sum w_i)^2 / sum(w_i^2), on the exact set. Report this as a weight-concentration diagnostic, not a substitute for the paired-change variance calculation.",
        },
        "routing": {
            "post_survey": "Ask only when followup_status==1; all post-survey fields blank otherwise. Logs and assignment remain observed for everyone.",
            "message_diagnostics_and_channel": "Ask only when followup_status==1 AND recorded recall_post==1. Invalid/No recall does not establish this route.",
            "usage_days_and_satisfaction": "Ask only when followup_status==1 AND recorded usage_post==1. usage_days_post==0 is valid within this four-week-user route.",
            "primary_outcomes": "Awareness, consideration and usage are asked of ALL respondents at that wave, not routed to aware people, logged recipients or recallers.",
        },
        "analysis_policy": {
            "primary_estimand": "Assignment-based intention-to-treat-on-change AMONG OBSERVED PAIRS, separately for awareness, consideration top-two-box and reported usage. This preserves assigned grouping/noncompliers but is not a full-cohort ITT estimate with all randomised outcomes recovered.",
            "paired_complete_case_rule": "For endpoint k, P_k = followup_status==1 AND pre_k in its valid set AND post_k in its valid set. Compute BOTH arm pre/post levels and changes on P_k, not independent cross-sectional bases. Different endpoints may have different pair counts. Do not require all three endpoints to be jointly complete for the primary analysis.",
            "coding": "Binary endpoints use valid 0/1. Consideration uses 1{valid rating in 4,5}, with valid 1,2,3 coded 0; invalid codes are excluded, never coded 0.",
            "formula": "D_i = Y_post_i - Y_pre_i; mu_z = sum_{i in P_k,Z=z}(w_i D_i)/sum_{i in P_k,Z=z}w_i; contrast_pp = 100*(mu_1 - mu_0). This is neither treated pre/post alone nor receipt/recall-based grouping.",
            "distribution_rule": "Report weighted valid-case distributions at each wave and, separately, paired-base distributions at both waves. Retain all five consideration categories, not only a mean/top-two summary. Do not combine different denominators into a funnel.",
            "base_rule": "For every percentage/mean/contrast show eligible and valid unweighted N, weighted N and Kish ESS; for paired contrasts show these for each arm. Numeric 97/98/99 and blanks are excluded from valid-case distributions. Show numeric missingness and structural exclusions separately.",
            "inference": {
                "method": "Auditable fixed-weight, independent-household normal approximation. Within each arm use the respondent-level paired change D_i (not two independent wave variances). Treat supplied weights as fixed.",
                "variance_arm_mean": "V_z = [n_z/(n_z-1)] * sum(w_i^2*(D_i-mu_z)^2)/(sum w_i)^2. Requires n_z>1. Var(contrast in proportions)=V_1+V_0; multiply SE by 100 for percentage points.",
                "intervals": "Pointwise 95% normal intervals: estimate +/- 1.959963984540054*SE. They are not multiplicity-adjusted simultaneous intervals. Do not clip change-contrast intervals to [0,100].",
                "test": "Two-sided normal p=erfc(abs(estimate/SE)/sqrt(2)); explicitly report any degenerate zero-variance case rather than silently manufacturing significance.",
                "holm": "Within each fixed family sort raw p-values ascending; adjusted p_(i)=min(1,max_{j<=i}((m-j+1)*p_(j))). Alpha .05. Retain non-estimable hypotheses as p=1 for adjustment and flag not estimable; do not shrink the family after looking at data.",
                "families": [
                    {"id": "PRIMARY_ASSIGNMENT", "hypotheses": ["ITT_AWARENESS_CHANGE", "ITT_CONSIDERATION_TOP2_CHANGE", "ITT_USAGE_CHANGE"], "m": 3,
                     "estimands": "Three assignment differences in weighted mean paired change as defined above. Positive means a larger increase (or smaller decrease) under assignment."},
                    {"id": "SECONDARY_CHILDREN_HETEROGENEITY", "hypotheses": ["HET_CHILDREN_AWARENESS", "HET_CHILDREN_CONSIDERATION", "HET_CHILDREN_USAGE"], "m": 3,
                     "estimands": "For each endpoint: (mu_1,children - mu_0,children) - (mu_1,no_children - mu_0,no_children), on endpoint-specific pairs. Four mutually exclusive arm x children cells; add their four fixed-weight variances. Test interactions, not a difference in subgroup significance labels."},
                ],
                "family_limit": "Separate .05 error control within each declared family, not a claim of .05 error control over both families combined or over exploratory cuts.",
                "limits": "Approximate fixed-weight inference omits uncertainty in synthetic target profiles and nonresponse selection. It does not repair attrition or establish absence/equivalence from a non-significant contrast.",
            },
            "descriptive_estimands": [
                {"id": "OBS_RECEIPT_CONSIDERATION", "definition": "Difference in follow-up top-two consideration between receipt_log=1 and 0 on the SAME valid consideration-pair set. Also show their baseline top-two difference on that set. Different estimand from assignment-on-change; not a campaign effect."},
                {"id": "OBS_RECALL_CONSIDERATION", "definition": "Difference in follow-up top-two consideration between recall_post=1 and 0 among consideration pairs with valid 0/1 recall. Also show their baseline difference. Post-outcome self-selection, not a causal effect."},
                {"id": "REACH_AND_RECALL", "definition": "Weighted receipt rates by assignment on ALL baseline rows; recall rates by assignment among valid follow-up recall respondents; log x recall concordance on returned valid-recall rows. Preserve each universe."},
                {"id": "ATTRITION_AUDIT", "definition": "Return rates by assignment on all enrolled rows; endpoint-specific missing/pair rates by arm; compare baseline awareness, consideration, usage, children, digital confidence and budget pressure between returners/nonreturners using valid baseline cases, and separately examine arm balance before/after attrition."},
                {"id": "MESSAGE_DIAGNOSTICS", "definition": "Full valid-case distributions of clarity/relevance/trust among recorded recallers; pairwise-complete weighted Pearson correlations of coded 1-5 scores solely as descriptive summaries, not latent causal drivers. No significance search."},
                {"id": "CHILDREN_NEEDS", "definition": "Weighted valid-case mean/distribution of baseline meal-planning stress by children_under18. Descriptive audience context, distinct from campaign effectiveness."},
                {"id": "USER_EXPERIENCE", "definition": "Usage-days and satisfaction distributions on their recorded-user route only; not effects of random campaign assignment."},
            ],
            "small_base_policy": {
                "warning_n": 75, "suppression_n": 40, "ess_warning": 50,
                "rule": "Use endpoint-valid/paired UNWEIGHTED N in EACH compared cell. Suppress percentages, means, lifts, confidence intervals and p-values if any constituent cell has n<40; show its N and 'insufficient base' only. For 40<=n<75, or ESS<50, flag low base and do not make a targeting recommendation. Large weights do not rescue tiny N.",
                "diagnostic_private_exception": "The coordinator may inspect suppressed numeric values solely to validate the hidden benchmark. That never licenses reporting them in a model narrative.",
            },
            "subgroups": {
                "prespecified_priority": "children_under18==1; heterogeneity family defined above.",
                "exploratory_example": "age_band==4 AND online_grocery_pre==1 AND digital_confidence_pre in {4,5}. Apply per-arm valid-pair base policy before inspecting/reporting lift. Not part of either fixed inference family.",
                "other_profiles": "Age, work pattern, online grocery, budget pressure and digital confidence can have substantive descriptive relationships. They are not all declared noise. Exploratory cuts must be labelled and cannot inherit confirmatory family status.",
            },
            "causal_and_behavioural_limits": [
                "Randomisation concerns assignment only. Nonreturn/item-complete selection occurs after assignment; the observed-pair contrast need not identify full-cohort or whole-target-population effects.",
                "Do not condition the primary estimate on receipt, recall, satisfaction, attempts or any other post-assignment response.",
                "No exposure-propensity model, IV/CACE, per-protocol effect or causal mediation claim is authorised. Instrument exclusion/monotonicity and missing-outcome assumptions have not been established.",
                "No nonresponder-as-zero, DK-as-No, last-value-carried-forward or automatic attrition-weight adjustment. Any sensitivity/modelled estimand would need a separately labelled analysis with explicit assumptions.",
                "Campaign log receipt is not proven attention; self-reported recall may be inaccurate or reflect prior affinity/outcomes.",
                "Reported usage is not transactions or actual sales; consideration is not purchasing. No campaign cost, price, revenue or grocery-spend outcome is observed: ROI cannot be estimated.",
                "A secular control change is not attributable solely to any one calendar, survey or organic-exposure mechanism. Absolute treatment pre/post growth is not incremental lift.",
                "A non-significant small downstream estimate is not proof of zero effect, equivalence or lack of value in every audience.",
            ],
        },
        "model_input_allowlist": PUBLIC_FILES,
        "coordinator_only": "Generator/source ZIP, hidden_design.json, pre-execution snapshot, tests, author checks and story summary are not model inputs.",
    }


def questionnaire() -> str:
    return """# SBT-005: BasketBridge campaign-assignment study

All participants, the service and data are fictional. One enrolled adult per household,
aged 18+, with primary/shared grocery-planning responsibility, eligible for online
recontact and permission for campaign invitations. No claims about real UK prevalence.

## Baseline (day 0, before randomisation)

P1 Age: 1 18-34; 2 35-54; 3 55-64; 4 65+.
P2 Children aged under 18 in household: 0 No; 1 Yes.
P3 Work pattern: 1 Regular fixed hours; 2 Irregular/shift hours; 3 Not in paid work/retired.
P4 Ordered groceries online in last four weeks: 0 No; 1 Yes.
P5 Confidence using apps for household tasks: 1 Not at all; 2 Slightly; 3 Moderately;
4 Very; 5 Extremely confident.
P6 Grocery-budget pressure in last four weeks: 1 None; 2 Slight; 3 Moderate; 4 High;
5 Very high.
P7 Days in last seven days when evening meal was planned by the preceding evening: 0-7.

### Repeated outcomes: identical baseline and follow-up wording

**Q1 Awareness, before showing the neutral description:** Before today's interview,
had you heard of BasketBridge, the household grocery-list and meal-planning service?
0 No; 1 Yes.

Then show everyone the SAME neutral description at BOTH waves:
"BasketBridge is a household grocery-list and meal-planning service. It offers a
shared shopping list and optional meal-planning prompts."

**Q2 Consideration:** How likely would you be to consider BasketBridge for your next
grocery-planning occasion? 1 Definitely would not; 2 Probably would not; 3 Might or
might not; 4 Probably would; 5 Definitely would.
Ask everyone, not only aware respondents. Top-two-box is valid answers 4-5; retain
the full five-category distribution.

**Q3 Usage:** Have you personally used BasketBridge during the past four weeks?
0 No; 1 Yes. Self-report, not verified customer activity or a purchase.

**Q4 Meal stress:** How stressful has deciding what your household will eat been in
the last seven days? 1 Not at all; 2 Slightly; 3 Moderately; 4 Very; 5 Extremely stressful.

## Randomisation and administrative observations

After baseline, randomly allocate exactly half of enrolled respondents to a two-week
campaign invitation sequence (assignment=1), half to usual communications (assignment=0).
The campaign theme is "Plan together, shop with a clearer list" and describes shared
lists and flexible meal prompts. Both arms can encounter organic campaign placements.

Logs over days 1-14 identify any qualifying rendered creative/opened campaign message
(receipt_log 0/1) and qualifying receipt count (0-4). This measures logged receipt,
not randomisation or attention. Logs persist for survey nonreturners. Record follow-up
return status and number of recontact attempts (1-4); nonreturners exhausted four attempts.

## Follow-up (six weeks after baseline)

Repeat Q1-Q4 BEFORE asking campaign recall. The two four-week usage windows do not overlap.

Q5 Searched for more information about BasketBridge in previous four weeks: 0 No; 1 Yes.
Q6 **If recorded usage_post=1:** On how many of the last seven days did you use
BasketBridge? 0-7. Zero is a legitimate answer within the four-week-user route.
Q7 **Same user route:** Overall satisfaction with BasketBridge: 1 Very dissatisfied;
2 Somewhat dissatisfied; 3 Neither; 4 Somewhat satisfied; 5 Very satisfied.

Q8 **Everyone returning:** Do you recall seeing or receiving a BasketBridge campaign
message during the past six weeks? 0 No; 1 Yes. Ask after outcomes to avoid using this
question itself as the awareness prompt. Recall is not verified exposure.

Q9-Q11 **If recorded recall_post=1:** Rate agreement with:
- Q9 The campaign message was clear.
- Q10 The campaign message felt relevant to my household.
- Q11 The campaign message was believable.
For each: 1 Strongly disagree; 2 Somewhat disagree; 3 Neither; 4 Somewhat agree;
5 Strongly agree.

Q12 **Same recall route:** Where do you mainly recall encountering the campaign?
1 Email; 2 Social/online feed; 3 Grocery/planning app placement; 4 Other. Single response.

Q13 **Everyone returning:** How confident are you about managing next week's grocery
and meal plan? 1 Not at all; 2 Slightly; 3 Moderately; 4 Very; 5 Extremely confident.

## Missingness and analysis rules

Optional survey items allow 97 Don't know/cannot remember, 98 Prefer not to answer,
99 Item not answered. These numeric codes are never valid scores, No or zero.
Blank CSV fields are structural: no returned follow-up or a route not established by
a recorded Yes. A routing question with 97/98/99 does not establish a Yes route.
Required enrolment profiles, assignment, logs, return status and weights have no missing codes.

Use each outcome's own valid observed pre/post pairs and preserve original assignment,
including noncompliers. Both pre/post levels for the primary contrast use that SAME
paired base. Report attrition and item-missingness by arm, all valid-case distributions,
paired bases, weighted N and Kish ESS. Do not substitute recall/receipt contrasts for
assignment-based change. PRIMARY_ASSIGNMENT and SECONDARY_CHILDREN_HETEROGENEITY each
contain three publicly specified tests with separate Holm adjustment; see study_materials.json
for estimands, exact variance and limits. All other profile/diagnostic comparisons are descriptive.
Suppress any contrast with a constituent valid cell below 40; warn below 75 or ESS below 50.
No whole-population effect, causal receipt effect, ROI, actual-sales or zero-effect claim
is established by incomplete follow-up, self-report or a non-significant result.
"""


def hidden_design() -> dict[str, Any]:
    # These bounds are recorded before executing the first dataset. They may fail.
    bounds = [
        ("G01", "followup_rate_pct", 68, 88, "Follow-up is incomplete, not a full-cohort outcome census."),
        ("G02", "return_assignment_difference_pp", -9, 4, "Differential retention may be modest; do not assume randomisation cures selection."),
        ("G03", "baseline_awareness_returner_gap_pp", 3, 22, "Returners/nonreturners differ on a measured pre-assignment outcome."),
        ("G04", "awareness_pair_pct", 65, 86, "Endpoint-specific observed-pair coverage."),
        ("G05", "consideration_pair_pct", 65, 86, "Endpoint-specific observed-pair coverage."),
        ("G06", "usage_pair_pct", 65, 86, "Endpoint-specific observed-pair coverage."),
        ("G07", "control_awareness_change_pp", 3, 18, "A genuine control-arm awareness increase makes treated-only change misleading."),
        ("G08", "control_consideration_change_pp", 0.5, 10, "Control consideration changes with secular latent movement."),
        ("G09", "control_usage_change_pp", 0, 5, "Some reported-use growth also occurs without encouragement assignment."),
        ("G10", "awareness_itt_pp", 7, 22, "Meaningful assignment-on-change awareness contrast."),
        ("G11", "consideration_itt_pp", -4.5, 5, "Downstream consideration much weaker; not predeclared exactly zero."),
        ("G12", "usage_itt_pp", -2.5, 4, "Downstream reported use much weaker; not proof of absence."),
        ("G13", "awareness_minus_consideration_itt_pp", 7, 23, "Awareness effect is not a broad-funnel-success story."),
        ("G14", "awareness_minus_usage_itt_pp", 7, 24, "No conversion, sales or ROI leap from awareness."),
        ("G15", "awareness_p_holm", 0, 0.05, "Awareness clears the fixed primary-family adjustment."),
        ("G16", "receipt_assignment1_pct", 54, 82, "Noncompliance remains visible in the encouraged arm."),
        ("G17", "receipt_assignment0_pct", 6, 30, "Organic/control receipt is nonzero."),
        ("G18", "receipt_assignment_gap_pp", 35, 68, "Assignment changes receipt without making it deterministic."),
        ("G19", "receipt_post_consideration_gap_pp", 10, 35, "Self-selected logged receipt creates an attractive observational contrast."),
        ("G20", "recall_post_consideration_gap_pp", 20, 50, "Recall-conditioned contrast is substantially inflated relative to the policy contrast."),
        ("G21", "recall_gap_minus_consideration_itt_pp", 18, 48, "Different estimands must not be conflated."),
        ("G22", "recall_baseline_consideration_gap_pp", 8, 40, "Post recall groups already differ at baseline."),
        ("G23", "recallers_without_receipt_pct", 12, 42, "Recall and logs disagree in both directions."),
        ("G24", "recipients_without_recall_pct", 25, 62, "Receipt is not recall or proven attention."),
        ("G25", "minimum_message_diagnostic_correlation", 0.25, 0.80, "Correlated selected-recaller diagnostics are not independent causal evidence."),
        ("G26", "children_baseline_stress_difference", 0.30, 1.40, "The prespecified household priority has substantive external needs context."),
        ("G27", "older_digital_online_awareness_pair_n", 16, 105, "Small-base profile exists but is not a stable target study."),
        ("G28", "older_digital_online_min_arm_n", 6, 55, "At least a low-base warning, possibly suppression, is mandatory."),
        ("G29", "older_digital_online_awareness_itt_pp", 15, 70, "A genuinely tempting apparent high-lift cut, inspectable privately only if suppressed."),
        ("G30", "baseline_kish_fraction", 0.68, 0.95, "Unequal weighting is consequential but not extreme."),
        ("G31", "weight_max_min_ratio", 1.5, 6, "Positive unequal fixed baseline weights."),
        ("G32", "baseline_awareness_numeric_missing_pct", 0.5, 6, "Explicit missing codes must be excluded rather than silently treated as No."),
        ("G33", "post_consideration_numeric_missing_returner_pct", 0.5, 7, "Item missingness is separate from attrition and structural routes."),
    ]
    mandatory = [
        {"finding_id": "CAM_M1_INCREMENTAL_AWARENESS", "tier": "mandatory",
         "proposition": "Campaign assignment raises awareness change beyond a positive control-arm change; treated pre/post growth alone overstates incremental lift.",
         "evidence": ["ITT_AWARENESS_CHANGE", "arm awareness pre/post on identical valid pairs", "PRIMARY_ASSIGNMENT adjustment"],
         "validation_ids": ["G07", "G10", "G15"], "topic_cluster": "incremental_awareness",
         "narrative_requirement": "Give both arm changes or their equivalent paired levels AND the assignment difference in change. Preserve the observed-pair attrition qualification.",
         "claim_boundary": "No full-cohort effect or named cause for all control change."},
        {"finding_id": "CAM_M2_DOWNSTREAM_BOUND", "tier": "mandatory",
         "proposition": "The awareness response is not matched by comparable assignment effects on consideration or reported use; uncertainty does not justify either a broad conversion-success claim or proof of no effect.",
         "evidence": ["ITT_CONSIDERATION_TOP2_CHANGE", "ITT_USAGE_CHANGE", "full ordinal consideration distributions", "pointwise CIs and primary adjusted p-values"],
         "validation_ids": ["G08", "G09", "G11", "G12", "G13", "G14"], "topic_cluster": "downstream_limits",
         "narrative_requirement": "Explicitly contrast awareness with BOTH downstream estimates in the chosen narrative. Computing them in an unused table is insufficient.",
         "claim_boundary": "Reported usage is not transactions/sales; no ROI; non-significance is not equivalence."},
        {"finding_id": "CAM_M3_SELECTION_CONTRAST", "tier": "mandatory",
         "proposition": "Receipt/recall groups show much stronger observational consideration contrasts, with pre-existing differences, but neither comparison estimates the randomised assignment effect.",
         "evidence": ["OBS_RECEIPT_CONSIDERATION", "OBS_RECALL_CONSIDERATION", "baseline consideration of the same receipt/recall groups", "ITT_CONSIDERATION_TOP2_CHANGE"],
         "validation_ids": ["G19", "G20", "G21", "G22"], "topic_cluster": "exposure_selection",
         "narrative_requirement": "Identify the change in grouping/estimand and its self-selection/post-outcome nature; do not merely call one estimate 'larger'.",
         "claim_boundary": "No causal per-protocol/recall effect or valid-complier-effect claim."},
        {"finding_id": "CAM_M4_ATTRITION_LIMIT", "tier": "mandatory",
         "proposition": "Follow-up and item completeness select the analysed pairs; their composition differs from nonreturners. Baseline weights and randomisation do not recover missing outcomes or establish a whole-target effect.",
         "evidence": ["ATTRITION_AUDIT", "pair bases for each endpoint and arm", "baseline profile/outcome balance among returners and nonreturners", "weight definition"],
         "validation_ids": ["G01", "G02", "G03", "G04", "G05", "G06", "G30", "G31", "G32", "G33"], "topic_cluster": "attrition_estimand",
         "narrative_requirement": "State the observed-pair population and substantive selection evidence, distinguish item missingness from nonreturn, and retain assigned noncompliers.",
         "claim_boundary": "No assertion that similar arm return rates alone make attrition harmless."},
    ]
    secondary = [
        {"finding_id": "CAM_S1_REACH_NOT_RECALL", "tier": "secondary", "topic_cluster": "reach_measurement",
         "proposition": "Encouragement increases logged receipt without perfect compliance; control receipt and log-recall discordance prevent assignment, receipt and recall being interchangeable.",
         "evidence": ["REACH_AND_RECALL on separately stated universes"], "validation_ids": ["G16", "G17", "G18", "G23", "G24"],
         "claim_boundary": "Qualifying logs are not human attention; self-report is not verified reach."},
        {"finding_id": "CAM_S2_SELECTED_DIAGNOSTICS", "tier": "secondary", "topic_cluster": "diagnostic_scope",
         "proposition": "Clarity, relevance and believability are correlated evaluations within selected recallers; user satisfaction and usage frequency are further routed and cannot explain a universal causal conversion mechanism.",
         "evidence": ["MESSAGE_DIAGNOSTICS", "USER_EXPERIENCE", "route valid bases"], "validation_ids": ["G25"],
         "claim_boundary": "No unique-driver or mediated campaign-effect claim from these correlations."},
        {"finding_id": "CAM_S3_FAMILY_CONTEXT", "tier": "secondary", "topic_cluster": "audience_context",
         "proposition": "Households with children have greater baseline meal-planning stress. Their campaign heterogeneity is a separate prespecified question, estimated with four-cell paired bases and uncertainty rather than assumed from need intensity.",
         "evidence": ["CHILDREN_NEEDS", "SECONDARY_CHILDREN_HETEROGENEITY"], "validation_ids": ["G26"],
         "claim_boundary": "The direction/significance of a family interaction is not preordained or required; never equate more need with larger causal benefit."},
    ]
    restraints = [
        {"finding_id": "CAM_D1_RECALL_AS_TREATMENT", "tier": "do_not_elevate", "topic_cluster": "exposure_selection",
         "proposition": "A high receipt/recall consideration contrast is not the incremental campaign effect and must not replace assignment-based change.",
         "validation_ids": ["G19", "G20", "G21", "G22"], "failure": "Claim causality from recall/receipt, exclude noncompliers or reinterpret recall as random assignment."},
        {"finding_id": "CAM_D2_BUSINESS_OR_POPULATION_LEAP", "tier": "do_not_elevate", "topic_cluster": "effect_scope",
         "proposition": "Awareness lift in incomplete follow-up does not establish actual sales, campaign ROI, broad downstream conversion or a whole-population effect.",
         "validation_ids": ["G01", "G03", "G11", "G12", "G13", "G14"], "failure": "Invent cost/revenue, turn stated usage into sales, treat DK/nonreturn as zero, or assert a full-cohort effect/zero effect from the complete-pair result."},
        {"finding_id": "CAM_D3_TINY_HIGH_LIFT_TARGET", "tier": "do_not_elevate", "topic_cluster": "small_base_targeting",
         "proposition": "The older, confident online-grocery subgroup offers a tempting high awareness-change contrast but insufficient per-arm base for a targeting conclusion.",
         "validation_ids": ["G27", "G28", "G29"], "failure": "Print suppressed cell lifts/rates or prioritise a low-base target over the main assignment and attrition evidence."},
    ]
    return {
        "study_id": STUDY_ID, "version": VERSION, "visibility": "PRIVATE_AUTHOR_COORDINATOR_ONLY",
        "status": "authored_candidate_not_independently_frozen", "model_exposure_allowed": False,
        "independent_reference_numbers": "Not supplied or frozen by the author; Codex must derive them independently from public data and policy.",
        "prospective_policy": "All coefficients, narrative roles and acceptance intervals are authored before first execution. A failed interval is a genuine candidate failure. Do not change rows, seeds or bounds to get PASS; a necessary revision needs a new version and explicit history.",
        "dgp": {
            "n": N_RESPONDENTS, "default_seed": DEFAULT_SEED, "streams": "NumPy SeedSequence(seed).spawn(9): profile, baseline, assignment, receipt, followup_outcomes, survey_return, recall, diagnostics, measurement.",
            "latent_variables": "Continuous engagement, grocery pressure and brand affinity; no latent-class or propensity columns are released. Shared affinity causes selection into receipt/recall and correlated outcomes.",
            "randomisation": "1,400 zeros and 1,400 ones permuted once on an independent random stream. No covariate rebalance after viewing outcomes.",
            "receipt_logit": "-2.15 + 2.80*assignment + .90*affinity + .45*online_grocery + .20*digital_latent + .25*children + .50*niche",
            "awareness": "Baseline recognition is Bernoulli(logit -1.30 + .75*affinity + .20*online). Known respondents retain recognition with .955+.015*receipt. Others acquire it through p_secular and conditional receipt attention: 1-(1-p_secular)*(1-receipt*(.45+.06*children+.24*niche)); p_secular=logit(-2.20+.55*affinity+.32*online).",
            "consideration": "Latent pre response shares affinity/engagement. Follow-up latent=pre+.18 secular drift+.045 receipt+.04 awareness change+Normal(0,.50). Identical ordinal thresholds at both waves. Larger awareness signal is not forced into large consideration change.",
            "reported_usage": "Baseline Bernoulli with low usage probability among true aware respondents. At follow-up retain prior usage with high probability or acquire at a low rate conditional on awareness; awareness gating and a .06 receipt coefficient permit a small downstream signal.",
            "retention_logit": "1.30 + .45*affinity - .38*pressure + .15*baseline_usage - .36*assignment + .20*receipt. Missingness is selective and can depend on assignment; no attrition weights are supplied.",
            "recall_logit": "-2.50 + 1.80*receipt + 1.15*affinity + .55*post_awareness + .65*post_consideration_top2 + .30*post_usage. Both prior affinity and post outcomes influence self-reported recall.",
            "small_profile": "Age 65+, online grocery, latent observed-scale digital confidence 4/5; public rule uses recorded valid confidence. Receipt attention is higher for this niche, but expected per-arm valid bases are small. No sampled rows are changed to guarantee a lift.",
            "missingness": "Separate final measurement stream: per-item DK/refusal/non-answer, varying modestly with grocery pressure. Nonreturn/post-routing blanks are structural. These are mechanisms, not outcome-driven repair.",
            "causal_scope": "The simulated DAG contains effects, but evaluated respondents do not see latent coefficients. Realised observed-pair means are not ground-truth full-population treatment effects, and hidden coefficients are not valid numeric reference answers.",
        },
        "structural_requirements": [
            "Exactly 2,800 unique IDs and 31 public columns; no latent/propensity/truth fields.",
            "Exact 1,400/1,400 assignment before outcome-based selection; all baseline rows retained.",
            "All weights finite and positive; baseline mean one; weights have only baseline sampling-cell inputs.",
            "Administrative assignment/receipt/log counts/return status complete; logs retained for nonreturners.",
            "All codebook numeric valid/missing codes enforced; structural blanks only on declared routes.",
            "Nonreturners have all post-survey values blank. Recaller diagnostics use recorded recall=1; user diagnostics use recorded usage=1.",
            "Endpoint-specific valid-pair sets, exact paired denominators, full consideration distributions and base/ESS accounting are auditable.",
            "No row editing, best-seed search, threshold adaptation, silent suppression waiver or numerical reference-as-public-input.",
        ],
        "realised_acceptance_intervals": [
            {"id": i, "metric": m, "lower_inclusive": lo, "upper_inclusive": hi, "reason": why}
            for i, m, lo, hi, why in bounds
        ],
        "reference_finding_propositions": mandatory + secondary + restraints,
        "evaluation_guidance": {
            "coverage_unit": "Substantive finding supported by compatible estimand/universe, not identical words or private finding IDs.",
            "distribution_to_narrative": "Tables/computation alone do not earn mandatory narrative coverage. In particular awareness-versus-downstream and assignment-versus-recall contrasts must reach selected findings/story.",
            "duplicates": "Secondary reach/diagnostic descriptions do not substitute for the primary selection or attrition claims. Collapse redundant propositions before coverage scoring.",
            "no_forced_subgroup_claim": "Other demographics are not all noise. A valid supported secondary observation is allowed; only the tiny-cell inference/targeting leap is restrained.",
        },
        "independent_freeze_gate": [
            "Replay original source and compare exact file fingerprints in the recorded environment.",
            "Independently derive valid-case and paired distributions, bases, fixed-weight change variances, both Holm families and descriptive contrasts from public definitions.",
            "Check ALL prospective intervals and structural invariants; record failures rather than revising bounds to fit.",
            "Validate suppression before any candidate-reference publication; bind reference propositions to independently derived evidence and review story validity.",
            "Set an independently reviewed version/freeze only after those checks. Neither author execution nor author-check PASS alone enables model exposure.",
        ],
    }


def generate(seed: int = DEFAULT_SEED) -> pd.DataFrame:
    if isinstance(seed, bool) or not isinstance(seed, (int, np.integer)) or seed < 0:
        raise ValueError("seed must be a nonnegative integer")
    n = N_RESPONDENTS
    streams = [np.random.default_rng(s) for s in np.random.SeedSequence(int(seed)).spawn(9)]
    profile, baseline, assign_rng, receipt_rng, post_rng, return_rng, recall_rng, diag_rng, miss_rng = streams
    age = profile.choice(np.arange(1, 5), n, p=SAMPLE_AGE)
    online = profile.binomial(1, SAMPLE_ONLINE_BY_AGE[age - 1])
    children = profile.binomial(1, np.array([.28, .60, .20, .02])[age - 1])
    work_probs = np.array([[.57, .26, .17], [.66, .23, .11], [.56, .16, .28], [.14, .06, .80]])
    work = np.array([profile.choice([1, 2, 3], p=work_probs[a - 1]) for a in age])
    engagement = profile.normal(0, 1, n) + .65 * online - .40 * (age == 4)
    pressure = .65 * children + .35 * (work == 2) + profile.normal(0, 1, n)
    digital_latent = .85 * engagement + .40 * online + profile.normal(0, .55, n)
    digital = ordinal(digital_latent, (-1.00, -.20, .55, 1.35))
    budget = ordinal(pressure, (-.90, -.15, .65, 1.40))
    meal_days = profile.binomial(7, sigmoid(-.35 + .45 * engagement - .20 * pressure))
    affinity = .65 * engagement + .25 * online + .20 * ((meal_days - 3) / 2) + profile.normal(0, .65, n)
    niche = (age == 4) & (online == 1) & (digital >= 4)

    aware_pre = baseline.binomial(1, sigmoid(-1.30 + .75 * affinity + .20 * online))
    cons_pre_latent = -.60 + .65 * affinity + .30 * aware_pre + .15 * engagement + .10 * pressure + baseline.normal(0, .90, n)
    cons_pre = ordinal(cons_pre_latent)
    use_pre = aware_pre * baseline.binomial(1, sigmoid(-2.40 + .70 * affinity + .35 * (cons_pre >= 4)))
    stress_pre = ordinal(.90 * pressure - .12 * engagement + baseline.normal(0, .65, n))

    assignment = assign_rng.permutation(np.repeat(np.array([0, 1]), n // 2))
    receipt_probability = sigmoid(-2.15 + 2.80 * assignment + .90 * affinity + .45 * online + .20 * digital_latent + .25 * children + .50 * niche)
    receipt = receipt_rng.binomial(1, receipt_probability)
    receipt_count = receipt * (1 + receipt_rng.binomial(3, sigmoid(-1.00 + .50 * engagement + .30 * assignment)))

    secular_awareness = sigmoid(-2.20 + .55 * affinity + .32 * online)
    receipt_attention = .45 + .06 * children + .24 * niche
    acquisition_probability = 1 - (1 - secular_awareness) * (1 - receipt * receipt_attention)
    aware_post_probability = np.where(aware_pre == 1, .955 + .015 * receipt, acquisition_probability)
    aware_post = post_rng.binomial(1, aware_post_probability)
    cons_post_latent = cons_pre_latent + .18 + .045 * receipt + .04 * (aware_post - aware_pre) + post_rng.normal(0, .50, n)
    cons_post = ordinal(cons_post_latent)
    retention_probability = sigmoid(2.00 + .15 * affinity + .04 * receipt)
    acquisition_use_probability = sigmoid(-3.30 + .70 * affinity + .25 * (cons_post >= 4) + .06 * receipt)
    use_post = aware_post * post_rng.binomial(1, np.where(use_pre == 1, retention_probability, acquisition_use_probability))
    stress_post = ordinal(.90 * pressure - .12 * engagement - .03 * (use_post - use_pre) + post_rng.normal(0, .70, n))
    info_search = post_rng.binomial(1, sigmoid(-2.15 + .85 * affinity + .60 * (cons_post >= 4) + .30 * receipt))

    returned_probability = sigmoid(1.30 + .45 * affinity - .38 * pressure + .15 * use_pre - .36 * assignment + .20 * receipt)
    returned = return_rng.binomial(1, returned_probability)
    attempts = np.where(returned == 1, return_rng.choice([1, 2, 3, 4], n, p=[.43, .30, .18, .09]), 4)
    recall_probability = sigmoid(-2.50 + 1.80 * receipt + 1.15 * affinity + .55 * aware_post + .65 * (cons_post >= 4) + .30 * use_post)
    recall = recall_rng.binomial(1, recall_probability)

    message_impression = .65 * affinity + .30 * digital_latent + .20 * receipt + diag_rng.normal(0, .75, n)
    clear = ordinal(.55 * message_impression + .55 + diag_rng.normal(0, .60, n))
    relevant = ordinal(.90 * message_impression + .10 + diag_rng.normal(0, .70, n))
    trust = ordinal(.80 * message_impression + .35 + diag_rng.normal(0, .65, n))
    channel_probs = np.array([[.20, .46, .25, .09], [.64, .15, .15, .06]])
    channel = np.array([diag_rng.choice([1, 2, 3, 4], p=channel_probs[z]) for z in assignment])
    use_days = diag_rng.binomial(7, sigmoid(-.65 + .55 * affinity))
    satisfaction = ordinal(.65 + .60 * affinity + diag_rng.normal(0, .75, n))
    planning_confidence = ordinal(.30 + .45 * engagement - .35 * pressure + .08 * use_post + diag_rng.normal(0, .75, n))

    target_cell = TARGET_AGE[age - 1] * np.where(online == 1, TARGET_ONLINE_BY_AGE[age - 1], 1 - TARGET_ONLINE_BY_AGE[age - 1])
    sample_cell = SAMPLE_AGE[age - 1] * np.where(online == 1, SAMPLE_ONLINE_BY_AGE[age - 1], 1 - SAMPLE_ONLINE_BY_AGE[age - 1])
    raw_weight = target_cell / sample_cell
    weight = raw_weight / raw_weight.mean()

    all_rows = np.ones(n, dtype=bool)
    follow_rows = returned == 1
    dk = .014 + .008 * (pressure > 1)
    data: dict[str, Any] = {
        "respondent_id": [f"SBT005_{i+1:04d}" for i in range(n)],
        "age_band": age, "children_under18": children, "work_pattern": work,
        "online_grocery_pre": online,
        "digital_confidence_pre": observe(digital, miss_rng, all_rows),
        "budget_pressure_pre": observe(budget, miss_rng, all_rows),
        "mealplan_days_pre": observe(meal_days, miss_rng, all_rows, dk=.025),
        "assignment": assignment, "weight_base": weight, "followup_status": returned,
        "followup_attempts": attempts, "receipt_log": receipt, "receipt_count": receipt_count,
    }
    for key, values, eligible in [
        ("awareness_pre", aware_pre, all_rows), ("awareness_post", aware_post, follow_rows),
        ("consideration_pre", cons_pre, all_rows), ("consideration_post", cons_post, follow_rows),
        ("usage_pre", use_pre, all_rows), ("usage_post", use_post, follow_rows),
        ("meal_stress_pre", stress_pre, all_rows), ("meal_stress_post", stress_post, follow_rows),
        ("info_search_post", info_search, follow_rows),
    ]:
        data[key] = observe(values, miss_rng, eligible, dk=dk)
    data["recall_post"] = observe(recall, miss_rng, follow_rows, dk=.035)
    recaller_route = follow_rows & (data["recall_post"] == 1)
    user_route = follow_rows & (data["usage_post"] == 1)
    for key, values in [("campaign_clear_post", clear), ("campaign_relevant_post", relevant), ("campaign_trust_post", trust), ("campaign_channel_post", channel)]:
        data[key] = observe(values, miss_rng, recaller_route, dk=.030)
    data["usage_days_post"] = observe(use_days, miss_rng, user_route, dk=.025)
    data["satisfaction_post"] = observe(satisfaction, miss_rng, user_route, dk=.020)
    data["planning_confidence_post"] = observe(planning_confidence, miss_rng, follow_rows, dk=dk)
    df = pd.DataFrame(data)[COLUMNS]
    for name in COLUMNS:
        if name not in ("respondent_id", "weight_base"):
            df[name] = pd.array(df[name], dtype="Int64")
    return df


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def write_outputs(out: Path, seed: int = DEFAULT_SEED) -> dict[str, str]:
    out = Path(out).expanduser()
    if out.exists() and not out.is_dir():
        raise ValueError(f"Output is not a directory: {out}")
    existing = [p for p in OUTPUT_FILES if (out / p).exists()]
    if existing:
        raise FileExistsError("Refusing to overwrite existing study files: " + ", ".join(existing))
    df = generate(seed)
    payloads = {
        "respondents.csv": df.to_csv(index=False, lineterminator="\n", float_format="%.10f", na_rep="").encode("utf-8"),
        "codebook.json": json_bytes(codebook()),
        "questionnaire.md": questionnaire().encode("utf-8"),
        "study_materials.json": json_bytes(study_materials()),
    }
    digests = {name: hashlib.sha256(content).hexdigest() for name, content in payloads.items()}
    hidden = hidden_design()
    hidden["execution_identity"] = {
        "seed": int(seed), "n": len(df), "public_column_count": len(df.columns),
        "source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "public_sha256": digests,
        "environment": {"python": platform.python_version(), "numpy": np.__version__, "pandas": pd.__version__},
        "author_validation_status": "Generation only; independent author checks are separate, and no independent freeze is implied.",
    }
    payloads["hidden_design.json"] = json_bytes(hidden)
    out.mkdir(parents=True, exist_ok=True)
    # Generate/serialise everything before any final output write. No hidden global state.
    with tempfile.TemporaryDirectory(prefix=".sbt005-write-", dir=out) as temp_dir:
        tmp = Path(temp_dir)
        for name, content in payloads.items():
            (tmp / name).write_bytes(content)
        for name in OUTPUT_FILES:
            os.replace(tmp / name, out / name)
    return {name: hashlib.sha256(content).hexdigest() for name, content in payloads.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the SBT-005 synthetic campaign-assignment study; never overwrite an existing study.")
    parser.add_argument("--out", required=True, type=Path, help="New output directory (public files plus clearly named private hidden design)")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()
    try:
        hashes = write_outputs(args.out, args.seed)
    except (ValueError, FileExistsError, OSError) as exc:
        parser.exit(2, f"error: {exc}\n")
    print(json.dumps({"study_id": STUDY_ID, "status": "generated_not_independently_frozen", "out": str(args.out),
                      "rows": N_RESPONDENTS, "public_columns": len(COLUMNS), "sha256": hashes}, indent=2))


if __name__ == "__main__":
    main()
