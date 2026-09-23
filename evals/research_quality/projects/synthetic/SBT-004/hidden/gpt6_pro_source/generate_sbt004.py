#!/usr/bin/env python3
"""SBT-004: synthetic household grocery / meal-planning U&A benchmark.

Only stdlib, numpy and pandas are required. No network, model or repository access.

    python generate_sbt004.py --out OUTPUT_DIR --seed 2026092204

This is private benchmark-authoring source, NOT model-facing research material.
The four public output files are explicitly allowlisted in study_materials.json.
All design checks are specified before simulation. Outcomes are never edited,
resampled, sorted into groups, or accepted/rejected to make a finding pass.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

VERSION = "0.1.0-author-candidate"
DEFAULT_SEED = 2026092204
DEFAULT_N = 2700
DK, REFUSED, NOT_DERIVABLE = 97, 98, 99
PUBLIC_FILES = ["respondents.csv", "codebook.json", "questionnaire.md", "study_materials.json"]
OUTPUT_FILES = PUBLIC_FILES + ["hidden_design.json"]

AGE_LABELS = {1: "18-34", 2: "35-49", 3: "50-64", 4: "65+"}
BINARY_LABELS = {0: "No", 1: "Yes"}
WORK_LABELS = {0: "Not currently in paid work", 1: "Under 30 paid hours/week", 2: "30 or more paid hours/week"}
AGREEMENT = {1: "Strongly disagree", 2: "Tend to disagree", 3: "Neither agree nor disagree", 4: "Tend to agree", 5: "Strongly agree"}
SATISFACTION = {1: "Very dissatisfied", 2: "Fairly dissatisfied", 3: "Neither satisfied nor dissatisfied", 4: "Fairly satisfied", 5: "Very satisfied"}
TOOL_LABELS = {0: "No digital planning tool in past 28 days", 1: "Grocery retailer app/site", 2: "Free recipe or list app/site", 3: "Paid meal-planning app/site"}
BLOCK_LABELS = {1: "Answered (including none of these)", 97: "Don't know for the entire block", 98: "Prefer not to answer the entire block"}

# Disproportionate age x children quotas; targets are FICTIONAL SCENARIO inputs,
# not UK official demographic estimates. The eight shares in each list sum to 1.
STRATA = [
    {"age_band": 1, "children_u16": 0, "sample_share": .10, "target_share": .16},
    {"age_band": 1, "children_u16": 1, "sample_share": .15, "target_share": .06},
    {"age_band": 2, "children_u16": 0, "sample_share": .10, "target_share": .15},
    {"age_band": 2, "children_u16": 1, "sample_share": .25, "target_share": .15},
    {"age_band": 3, "children_u16": 0, "sample_share": .10, "target_share": .20},
    {"age_band": 3, "children_u16": 1, "sample_share": .06, "target_share": .04},
    {"age_band": 4, "children_u16": 0, "sample_share": .22, "target_share": .23},
    {"age_band": 4, "children_u16": 1, "sample_share": .02, "target_share": .01},
]

ATTITUDES = [
    ("att_plan_ahead_5", "A1", "I prefer to decide most of our evening meals several days ahead."),
    ("att_spontaneous_5", "A2", "I prefer to decide what we eat on the day rather than plan ahead."),
    ("att_budget_worry_5", "A3", "Keeping our grocery spending within what we intend is a worry for me."),
    ("att_price_tradeoffs_5", "A4", "I often have to trade off the food I would like against what the household can afford."),
    ("att_time_short_5", "A5", "I struggle to find enough time to organise our household's meals."),
    ("att_decision_fatigue_5", "A6", "Deciding what to cook feels like one decision too many."),
    ("att_waste_concern_5", "A7", "Avoiding wasted food is an important priority in our household."),
    ("att_waste_difficult_5", "A8", "I find it difficult to use up perishable food before it spoils."),
    ("att_digital_help_5", "A9", "I would welcome a digital tool that suggested what our household could cook and buy each week."),
]
NEED_ITEMS = [
    ("support_budget", "Keep grocery spending within what we intend"),
    ("support_quick_meals", "Find quick meals and re-plan when plans change"),
    ("support_use_up", "Use up food and leftovers before they are wasted"),
    ("support_shared_plan", "Share a meal plan or shopping list with other household members"),
]
BARRIER_ITEMS = [
    ("barrier_setup_time", "Time or effort to set it up and keep it updated"),
    ("barrier_rigid", "Suggestions or plans being too rigid for our household"),
    ("barrier_cost", "Another subscription or extra cost"),
    ("barrier_privacy", "Sharing household or shopping information"),
]
DERIVED_STATES = {
    "need_budget": ["att_budget_worry_5", "att_price_tradeoffs_5"],
    "need_effort": ["att_time_short_5", "att_decision_fatigue_5"],
    "need_waste": ["att_waste_concern_5", "att_waste_difficult_5"],
}
COUNT_ITEMS = [
    ("meal_plan_days_7d", "B1", "On how many of the past seven days was your household's main evening meal decided by the previous evening?", "Days with a meal decided by the previous evening"),
    ("unplanned_topups_7d", "B2", "On how many of the past seven days did your household make an unplanned extra grocery shop or order because something was missing?", "Days with at least one unplanned extra grocery shop/order"),
    ("waste_days_7d", "B3", "On how many of the past seven days did your household throw away unused perishable food or an uneaten prepared meal? Exclude unavoidable peelings and bones.", "Days with at least one qualifying food-discard event"),
]

# These parameter values are not adjusted in response to realised data.
DGP_SPEC = {
    "profiles": "Fixed disproportionate age x child quotas, shuffled, then independent within-stratum households.",
    "private_latents": {
        "budget": "0.75*z0 + 0.66*z1 + 0.20*children - 0.10*older",
        "time": "0.35*z0 + 0.90*z2 + 0.55*children + 0.30*fulltime - 0.35*older",
        "planning": "0.85*z3 - 0.25*time + 0.20*older + 0.10*children",
        "waste_care": "0.80*z4 + 0.20*budget + 0.15*older",
        "waste_difficulty": "0.60*time - 0.35*planning + 0.75*z5",
        "digital_fit": "Bernoulli(logistic(0.25*time - 0.30*older - 0.20*budget)); a private taste mode, not a public segment",
    },
    "attitude_model": "Correlated latent response + item-specific Normal error; cutpoints [-1.05,-0.35,0.35,1.05]. A2 has a negative planning loading. A9 has two preference modes (+/-1.4).",
    "external_behaviours": "Binomial counts of days, n=7, and a Bernoulli spending outcome; depend on private traits, never on the observed derived need-state flags.",
    "selection": "Existing tool use is a softmax choice influenced by fit, planning, budget and age; satisfaction is conditional on recorded current use.",
    "multiple_response": "Four support and four barrier Bernoulli choices with shared latent covariates; none is all zeros. No exactly-one constraint.",
    "response_process": "DK/refusal injected by a separately seeded, pre-specified observation mechanism. Structural blanks occur only for unasked tool follow-ups. This is measurement generation, not an outcome correction.",
    "not_present": ["outcome-based row editing", "search over seeds", "redraw until PASS", "latent scores or classes in respondents.csv", "forced narrative labels", "real respondents"],
}


def dumps(obj: Any) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False, allow_nan=False) + "\n"


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def allocate_counts(n: int) -> np.ndarray:
    """Largest-remainder allocation: deterministic profile quotas, not outcomes."""
    raw = np.array([s["sample_share"] for s in STRATA], dtype=float) * n
    count = np.floor(raw).astype(int)
    remaining = n - int(count.sum())
    order = np.argsort(-(raw - count), kind="stable")
    count[order[:remaining]] += 1
    return count


def make_codebook() -> dict[str, Any]:
    variables: list[dict[str, Any]] = []

    def add(name: str, qid: str, label: str, codes: dict[int, str] | None = None,
            *, missing: tuple[int, ...] = (DK, REFUSED), structural: bool = False,
            universe: str = "All eligible sampled households", role: str = "observed",
            **extra: Any) -> None:
        meanings = {97: "Don't know", 98: "Prefer not to answer", 99: "Derived value not computable from required valid items"}
        v = {"name": name, "question_id": qid, "label": label, "role": role,
             "storage": "integer_code", "universe": universe,
             "valid_codes": list(codes) if codes is not None else [],
             "codes": {str(k): val for k, val in (codes or {}).items()},
             "missing_codes": {str(k): meanings[k] for k in missing},
             "structural_blank_allowed": structural}
        v.update(extra)
        variables.append(v)

    add("respondent_id", "ADMIN_ID", "One pseudonymous synthetic household/respondent ID", {}, missing=(), role="identifier", storage="string", pattern="SBT004_000001")
    add("age_band", "P1", "Age of responding grocery/meal planner", AGE_LABELS, missing=(), role="sample_profile")
    add("children_u16", "P2", "At least one child under 16 usually lives in the household", BINARY_LABELS, missing=(), role="sample_profile")
    add("work_hours_band", "P3", "Respondent's usual weekly paid work hours", WORK_LABELS, missing=(), role="profile")
    add("wt_final", "ADMIN_WEIGHT", "Positive relative household analysis weight", {}, missing=(), role="weight", storage="float", minimum_exclusive=0, normalization="Full-sample mean 1; weighted N is an equivalent sample count, not population households")
    for name, qid, stem in ATTITUDES:
        add(name, qid, stem, AGREEMENT, reverse_keyed=(name == "att_spontaneous_5"),
            reverse_for_construct="planning_orientation" if name == "att_spontaneous_5" else None)
    for name, items in DERIVED_STATES.items():
        add(name, "DERIVED", name.replace("_", " "), {0: "Criteria not met", 1: "Criteria met"},
            missing=(NOT_DERIVABLE,), role="derived_overlapping_need_state",
            derivation={"inputs": items, "rule": "1 iff BOTH valid item codes are >=4; 0 otherwise when BOTH are valid; 99 if either input is not in 1..5", "exclusive": False, "priority_assignment": False})
    for name, qid, stem, label in COUNT_ITEMS:
        add(name, qid, stem, {k: f"{k} days" for k in range(8)}, unit="days_in_past_7", construct=label)
    add("over_budget_4w", "B4", "Spent more on groceries than intended in at least one of the past four weeks", BINARY_LABELS,
        clarification="No monetary amount or income is collected. No intended spending limit / unable to judge is coded 97, not No.")
    add("planning_tool_28d", "U1", "Digital grocery/meal planning tool used most often in past 28 days", TOOL_LABELS,
        clarification="Used a planning/list/recipe function, not simply browsed or purchased groceries. If more than one, code the most-used type.")
    tool_universe = "planning_tool_28d in {1,2,3}; missing screener and code 0 are not administered follow-ups"
    add("tool_satisfaction_5", "U2", "Overall satisfaction with the most-used planning tool", SATISFACTION, structural=True, universe=tool_universe)
    add("shared_list_use_28d", "U3", "Used a shared shopping-list/meal-plan function with another household member in past 28 days", BINARY_LABELS, structural=True, universe=tool_universe,
        clarification="Current tool users without a sharing feature or another member to share with answer No, not a structural blank.")
    for name, label in NEED_ITEMS:
        add(name, "N1", label, {0: "Not selected", 1: "Selected"}, block="needs", eligibility_status="needs_block_status=1", respondent_percentages=True)
    for name, label in BARRIER_ITEMS:
        add(name, "N2", label, {0: "Not selected", 1: "Selected"}, block="barriers", eligibility_status="barriers_block_status=1", respondent_percentages=True)
    add("needs_block_status", "N1_STATUS", "Response status for complete support-needs block", {1: "Answered, including none"}, block="needs")
    add("barriers_block_status", "N2_STATUS", "Response status for complete digital-barriers block", {1: "Answered, including none"}, block="barriers")
    return {
        "study_id": "SBT-004", "schema_version": VERSION, "column_count": len(variables),
        "unit_of_record": "One eligible adult reporting for one household; no repeated households",
        "encoding": "UTF-8 CSV; integer response/profile codes; float weight; string ID",
        "missing_definitions": {
            "97": "Explicit Don't know / cannot judge: nonvalid, not a response midpoint or zero",
            "98": "Explicit refusal: nonvalid",
            "99": "Derived state cannot be computed: nonvalid; never an observed answer",
            "empty_csv_field": "Not administered tool follow-up. Derive reason from U1: code 0 = nonuser; 97/98 = screener nonresponse. Not zero, No, or dissatisfaction.",
        },
        "derived_constructs": {
            "planning_orientation": {"stored_in_csv": False, "formula": "(att_plan_ahead_5 + (6 - att_spontaneous_5))/2",
                "validity": "Both original items must be 1..5 before reversal; otherwise missing. Never compute 6-97/98.",
                "range": [1, 5], "primary_use": "Descriptive weighted association with external meal_plan_days_7d; do not use a state-versus-defining-item contrast as validation."},
            "need_states": "Three independent binary flags, not an exclusive segmentation. Do not assign each household to a single need type. For overlap use the joint valid denominator for exactly the flags involved.",
        },
        "multiple_response": {
            "needs": {"items": [x[0] for x in NEED_ITEMS], "status": "needs_block_status"},
            "barriers": {"items": [x[0] for x in BARRIER_ITEMS], "status": "barriers_block_status"},
            "rule": "All eligible households are asked both blocks. Status 1 means every item is 0/1; all zero means None. For status 97/98, every block item has that same nonvalid code. No item-level nonresponse is generated within an answered block.",
            "denominator": "Sum of weights of eligible RESPONDENTS with status 1, not the number or weighted sum of mentions. A valid all-zero row stays in the denominator. Sum of item percentages may exceed 100%.",
        },
        "variables": variables,
    }


def make_study_materials(n: int) -> dict[str, Any]:
    counts = allocate_counts(n)
    quotas = [{**s, "allocated_n": int(counts[i]), "relative_weight": float(n*s["target_share"]/counts[i])} for i, s in enumerate(STRATA)]
    contrasts = [
        {"id": "NEED_EFFORT_TOPUPS", "family": "needs_external", "group_variable": "need_effort", "outcome": "unplanned_topups_7d", "unit": "days", "group_one": 1, "group_zero": 0},
        {"id": "NEED_EFFORT_PLANNING", "family": "needs_external", "group_variable": "need_effort", "outcome": "meal_plan_days_7d", "unit": "days", "group_one": 1, "group_zero": 0},
        {"id": "NEED_BUDGET_OVERSPEND", "family": "needs_external", "group_variable": "need_budget", "outcome": "over_budget_4w", "unit": "percentage_points", "group_one": 1, "group_zero": 0},
        {"id": "NEED_WASTE_DISCARD", "family": "needs_external", "group_variable": "need_waste", "outcome": "waste_days_7d", "unit": "days", "group_one": 1, "group_zero": 0},
        {"id": "CHILDREN_TOPUPS", "family": "household_context", "group_variable": "children_u16", "outcome": "unplanned_topups_7d", "unit": "days", "group_one": 1, "group_zero": 0},
        {"id": "CHILDREN_PLANNING", "family": "household_context", "group_variable": "children_u16", "outcome": "meal_plan_days_7d", "unit": "days", "group_one": 1, "group_zero": 0},
    ]
    return {
        "study_id": "SBT-004", "version": VERSION, "title": "Household grocery and meal-planning needs",
        "synthetic": True,
        "brief": "PantryWorks is a fictional grocery retailer exploring optional meal-planning and shopping-list support. This cross-sectional usage-and-attitudes study describes household tasks, constraints, existing tools and unmet support needs; it does not expose or randomise product concepts.",
        "decision_question": "Which household tasks and audiences should inform a small, optional grocery/meal-planning support pilot, and what further evidence is needed before selecting a delivery format or claiming commercial impact?",
        "decision_limits": "No price test, randomised treatment, observed purchase, revenue, longitudinal change or causal effect is identified.",
        "population": "A fictional UK household population with at least one adult aged 18+ who has main or shared responsibility for grocery shopping and evening-meal decisions. One planner per household. Assume profile eligibility known from recruitment; CSV contains eligible completes only.",
        "sampling": {"n": n, "design": "Disproportionate fixed quotas across responding-planner age x household children-under-16 status; independent synthetic households within each stratum",
            "strata_variables": ["age_band", "children_u16"], "quota_cells": quotas,
            "targets_are": "Fictional benchmark assumptions, not official UK population estimates. Neither quotas nor these results support claims about real UK prevalence.",
            "respondent_vs_household": "Age/work hours describe the responding planner; outcomes and children status refer to the household."},
        "weights": {"variable": "wt_final", "formula": "w_h = n * target_share_h / allocated_n_h", "normalization": "sum(w)=n, mean(w)=1 over the full sample", "positive": True,
            "interpretation": "Relative standardisation to the declared synthetic household profile. Keep these full-sample weights in subgroups; do not recalibrate each cut. Weighted N is an equivalent sample count, not an estimated UK population size.",
            "no_claim": "Weights do not correct nonresponse within variables or unmeasured selection into current tool use."},
        "routing": {"tool_satisfaction_5": "Ask only when planning_tool_28d in {1,2,3}", "shared_list_use_28d": "Same current-tool-user route", "all_other_observed_items": "All recruited households", "needs_and_barriers": "Both asked of users AND nonusers; each allows any number of selections, including none."},
        "need_state_policy": {"derivation": DERIVED_STATES, "cut": "Both items >=4 on valid 1..5 responses", "invalid": "99 if either defining item is nonvalid", "overlap": "No exclusivity, priority allocation, clustering, or latent-class assignment",
            "avoid_tautology": "Assess external reported behaviour/outcomes, not differences on the items that define a need state."},
        "prespecified_subgroup": {"variable": "children_u16", "contrast": "1 versus 0", "role": "Household planning context; this is not a need-state membership rule", "outcomes": ["unplanned_topups_7d", "meal_plan_days_7d"]},
        "additional_subgroups": {"descriptive": ["age_band", "work_hours_band", "planning_tool_28d"], "reporting_example": "age_band=4 AND planning_tool_28d=3 may be examined only subject to base rules", "rule": "Demographic differences are not assumed to be noise. Report sound descriptive differences with bases; additional significance searches are exploratory, not part of the confirmatory families."},
        "analysis_policy": {
            "ordinal": "For every 1..5 item report the full weighted valid-case distribution, with disagree/bottom-two, neutral and agree/top-two summaries where helpful. Means alone are not a sufficient battery summary. Do not report 97/98 as response categories within the valid distribution.",
            "reverse_keying": "Only A2/att_spontaneous_5 is reverse-keyed for planning_orientation. Preserve original response labels in item distributions; reverse valid 1..5 values only when computing that index.",
            "counts": "B1-B3 are 0..7 DAYS, not number of meals, portions, shops or pounds. Zero is valid; numeric 97/98 are nonvalid.",
            "bases": "Every statistic carries eligible unweighted N and weighted N; valid-case unweighted N and weighted N; and Kish ESS on the valid subset. Report DK, refusal, unknown derived state and structural/unasked counts separately. N_eff=(sum valid weights)^2/sum(valid weights^2); it is a weight-dispersion summary, NOT by itself a general variance estimator.",
            "multiple_response": "Weighted respondent incidence: selected weight / answered-eligible respondent weight, separately for each block. Include all-zero/None rows. Do not normalise percentages to sum to 100; report block nonresponse separately.",
            "routed": "Current-tool prevalence uses valid U1 among all eligible households. U2/U3 estimates use valid follow-up answers among recorded current users. Never treat structural blanks as dissatisfaction or no use. A conditional tool-user percentage cannot be relabelled as all-household prevalence.",
            "overlap": "Use joint valid flags for two-state overlap and all three valid flags for eight membership combinations. Pairwise flags are overlapping, not independent samples. Do not use independent-group formulas to compare overlapping states against each other.",
            "warning_n": 75, "suppress_n": 40, "warning_kish_ess": 50,
            "base_rule": "Valid n<40: suppress percentages, means, correlations and inferential rankings; report only base/suppression reason. Valid n=40..74: flag small base; no unqualified headline. Valid Kish ESS<50: warn regardless of n. Apply rules per statistic, not just at full-cell level.",
            "materiality": "Study-specific descriptive attention thresholds: 0.5 days for weekly day-count differences and 8 percentage points for incidence differences. These are pilot-prioritisation heuristics, not validated economic thresholds. Significance alone does not establish commercial value.",
            "association": "Weighted diagnostic/index-outcome associations are descriptive and use pairwise valid responses. Correlated items are not independent corroboration. No causal drivers, exclusive personas, observed conversion, sales or actual retained usage can be inferred.",
        },
        "required_inference": {
            "estimands": contrasts,
            "definition": "For each listed contrast, target-profile-weighted valid-case outcome mean in group=1 minus group=0. A binary mean difference is multiplied by 100 and labelled percentage points. Include only valid group codes {0,1} and valid outcome codes; no comparison with defining attitude items is inferentially required.",
            "null": "Two-sided difference=0", "alpha": .05,
            "families": {"needs_external": {"m": 4, "adjustment": "Holm across exactly the four prespecified need-state/external-outcome contrasts"}, "household_context": {"m": 2, "adjustment": "Holm across exactly the two children-context external-outcome contrasts"}},
            "variance": "Stratified linearisation for a fixed-weight ratio contrast. Retain all sampled rows for variance strata, assigning zero influence to non-domain/nonvalid rows. For group g: mu_g=sum(w I_g Y)/W_g; a_i,g=w_i I_g (Y_i-mu_g)/W_g. For difference a_i=a_i,1-a_i,0. Var(diff)=sum_h [n_h/(n_h-1) * sum_{i in h}(a_i-mean_h(a))^2]. No FPC; independent households within the eight fixed quota strata. Valid groups and outcomes must be selected before forming indicators. Do not substitute weighted N or Kish ESS for n_h.",
            "intervals": "Normal-approximation unadjusted 95% intervals: difference +/-1.959963984540054*SE. Holm adjusts the six p-values within their TWO fixed families; it does not make these intervals simultaneous. Compute p=erfc(abs(diff/SE)/sqrt(2)). Mark an undefined/suppressed test not estimable; retain its family slot conservatively as p=1 for adjustment, without pretending it was observed.",
            "interpretation": "Sampling-model summaries within this synthetic design, conditional on observed valid cases and fixed target profile. Neither nonresponse bias nor causal uncertainty is removed. Secondary associations and other demographic cuts are descriptive; no other confirmatory tests required.",
        },
        "delivery": {"requested_output": "Presentation-neutral prioritised narrative with evidence, estimates, valid bases, explicit qualifiers and research questions; no slides required", "public_input_allowlist": PUBLIC_FILES,
            "do_not_expose": "Generator source, hidden_design.json, author checks, local test outputs and any future reference/adjudication artifacts are not model-facing study materials."},
    }


def make_questionnaire() -> str:
    sections = [
        "# SBT-004 — Household grocery and meal planning\n",
        "All participants and responses are synthetic. This instrument concerns everyday household tasks; no product concept or treatment is randomised.\n",
        "## Recruitment and profile\nRecruit one adult aged 18+ per household who has main or shared responsibility for grocery shopping and evening meals. Age and children status are recruitment quota information and are complete.\n",
        "**P1 Age band:** 1=18–34; 2=35–49; 3=50–64; 4=65+.\n\n**P2 Children:** Does at least one child under 16 usually live in your household? 0=No; 1=Yes.\n\n**P3 Paid work:** How many hours do you usually work for pay each week? 0=Not currently in paid work; 1=Under 30; 2=30 or more.\n",
        "## A. Attitudes\nHow much do you agree or disagree with each statement?\n\n1 Strongly disagree; 2 Tend to disagree; 3 Neither agree nor disagree; 4 Tend to agree; 5 Strongly agree. 97 Don't know; 98 Prefer not to answer. All households answer each item independently.\n",
    ]
    sections += [f"**{qid} — `{name}`**  \n{stem}\n" for name, qid, stem in ATTITUDES]
    sections += [
        "**Analyst keying note:** A2 is reverse-keyed ONLY for the planning-orientation index: `(A1 + (6-A2))/2`, using two valid answers. Item-level distributions retain original codes/wording. A missing code must never be reversed.\n",
        "**Observed need flags (not questions or exclusive segments):** budget = A3>=4 AND A4>=4; effort = A5>=4 AND A6>=4; waste = A7>=4 AND A8>=4. Derive each only when both defining responses are 1..5; otherwise code 99. Overlap is permitted and must be retained.\n",
        "## B. Recent behaviour\nFor B1–B3 record the number of DAYS, 0–7. Use 97 if unable to recall and 98 for refusal. Multiple events on one day still count as one day.\n",
    ]
    sections += [f"**{qid} — `{name}`**  \n{stem}\n" for name, qid, stem, _ in COUNT_ITEMS]
    sections += [
        "**B4 — `over_budget_4w`**  \nIn any of the past four weeks, did your household spend more on groceries than you intended? 0=No; 1=Yes; 97=Don't know/cannot judge/no intended spending limit; 98=Prefer not to answer. This is self-report, not bank or receipt data.\n",
        "## U. Existing tools\n**U1 — `planning_tool_28d`**  \nWhich type of digital tool, if any, have you used most often to plan meals or make a grocery list in the past 28 days? 0=None; 1=Grocery retailer app/site; 2=Free recipe/list app/site; 3=Paid meal-planning app/site; 97=Don't know; 98=Prefer not to answer. Simply buying groceries online is not use of a planning function. Choose the most-used type if several were used.\n",
        "**U2 — `tool_satisfaction_5` — ask only U1=1,2,3**  \nHow satisfied are you overall with this tool? 1=Very dissatisfied; 2=Fairly dissatisfied; 3=Neither; 4=Fairly satisfied; 5=Very satisfied; 97=Don't know; 98=Prefer not to answer.\n",
        "**U3 — `shared_list_use_28d` — ask only U1=1,2,3**  \nHave you used this tool to share a shopping list or meal plan with another member of your household in the past 28 days? 0=No; 1=Yes; 97=Don't know; 98=Prefer not to answer. No feature/no other member to share with is No.\n",
        "**Routing:** U2/U3 are EMPTY for U1=0 or 97/98 because unasked. The route and unknown-screener reasons remain distinguishable through U1. Empty does not mean dissatisfied, No, or Don't know.\n",
        "## N1. Support tasks — ALL households\nWhich tasks, if any, would you like more help with? Select all that apply. The choices are not a ranking or a forced allocation.\n",
    ]
    sections += [f"- `{name}`: {label}.\n" for name, label in NEED_ITEMS]
    sections += [
        "None of these is exclusive of the task choices and is stored as all four item codes=0, block status=1. Don't know for the whole question stores status=97 and all four item codes=97; refusal stores 98 throughout. Otherwise selected=1, unselected=0 and status=1.\n",
        "## N2. Digital barriers — ALL households\nWhat, if anything, would make it difficult to start using a digital grocery/meal-planning helper, or to use one more often? Select all that apply, whether or not you currently use a tool.\n",
    ]
    sections += [f"- `{name}`: {label}.\n" for name, label in BARRIER_ITEMS]
    sections += [
        "None/DK/refusal coding is identical to N1, with `barriers_block_status`. No partial-block omissions are recorded.\n",
        "## Reporting conventions\nReport weighted valid-case distributions, all relevant eligible/valid bases and Kish effective bases. For N1/N2 use eligible answered RESPONDENTS as the denominator, not mentions; sums can exceed 100%. See study_materials.json for exact weights, inference estimands, fixed Holm families, warning/suppression rules and causal limits.\n",
    ]
    return "\n".join(sections)


def make_hidden_design(seed: int, n: int) -> dict[str, Any]:
    """All thresholds/propositions are author-set BEFORE running the DGP."""
    checks = [
        # All intervals inclusive; not calibrated to a realised seed.
        ("D01", "budget_need_pct", 20, 55, "Budget need is neither universal nor negligible", "M1"),
        ("D02", "effort_need_pct", 20, 60, "Effort need is substantial", "M1"),
        ("D03", "budget_effort_joint_pct", 10, 35, "Material measured overlap on joint valid base", "M1"),
        ("D04", "overlap_fraction_of_smaller_state", .28, .80, "Neither exclusive nor almost identical flags", "M1"),
        ("D05", "needs_respondent_percent_sum", 155, 300, "Multiple task selections; respondent percentages legitimately exceed 100", "M1"),
        ("D06", "effort_topup_difference_days", .50, 2.50, "External behaviour difference, not a defining-item contrast", "M2"),
        ("D07", "effort_planning_difference_days", -2.8, -.50, "Incomplete planning associated with effort need", "M2"),
        ("D08", "children_topup_difference_days", .25, 1.60, "Prespecified household context is relevant", "M2"),
        ("D09", "children_planning_difference_days", -1.70, -.10, "Prespecified context, not a universal parent persona", "M2"),
        ("D10", "budget_overspend_difference_pp", 15, 55, "External reported outcome linked to budget need", "M3"),
        ("D11", "budget_support_difference_pp", 15, 55, "Support preference is not a defining attitude item", "M3"),
        ("D12", "digital_agree_pct", 30, 65, "Substantial favourable pole", "M4"),
        ("D13", "digital_disagree_pct", 25, 60, "Substantial unfavourable pole", "M4"),
        ("D14", "digital_neutral_pct", 0, 25, "Midpoint alone is not the population pattern", "M4"),
        ("D15", "digital_mean", 2.5, 3.6, "An ordinary-looking mean can conceal opposing poles", "M4"),
        ("D16", "waste_need_pct", 15, 50, "Waste need remains another overlapping task", "S1"),
        ("D17", "waste_days_difference", .40, 2.80, "External discard-day difference", "S1"),
        ("D18", "waste_useup_support_difference_pp", 10, 45, "Support preference corroborates a distinct task", "S1"),
        ("D19", "planning_index_behaviour_weighted_r", .35, .85, "Reverse-keyed index relates to external planning behaviour", "S2"),
        ("D20", "current_tool_user_pct", 20, 55, "Existing users are a selected minority", "S3"),
        ("D21", "tool_satisfaction_top2_pct", 55, 90, "Good satisfaction within current users is not all-household demand", "S3"),
        ("D22", "older_paid_user_valid_sat_n", 5, 39, "Seductive older/paid tool cell is intentionally below suppression threshold", "R3"),
        ("D23", "older_paid_user_top2_private_pct", 55, 100, "Private-only trap diagnostic; NEVER a publishable subgroup rate", "R3"),
        ("D24", "barriers_respondent_percent_sum", 135, 295, "Multiple barriers can co-exist", "C2"),
        ("D25", "needs_none_valid_n", 10, 500, "None rows must survive the MR denominator", "C2"),
        ("D26", "unknown_need_state_any_n", 40, 500, "Nonresponse is not absence of need", "C1"),
        ("D27", "full_sample_kish_ess_fraction", .72, .95, "Unequal positive weighting has a visible design effect", "C2"),
    ]
    ref = [
        {"finding_id": "M1", "tier": "mandatory", "proposition": "Budget and effort needs overlap materially; household support is a bundle of tasks rather than an exclusive set of personas.", "evidence": ["three-state prevalence and pairwise joint-valid overlap", "N1 weighted respondent incidences, including all-zero cases"], "acceptance_ids": ["D01", "D02", "D03", "D04", "D05"], "narrative_credit": "Must mention overlap and that flags do not partition households; summing need flags to 100% is not acceptable."},
        {"finding_id": "M2", "tier": "mandatory", "proposition": "Effort-relief households report more unplanned top-up days and fewer ahead-planned meal days; households with children are a relevant, but not synonymous, context.", "evidence": ["NEED_EFFORT_TOPUPS", "NEED_EFFORT_PLANNING", "CHILDREN_TOPUPS", "CHILDREN_PLANNING"], "acceptance_ids": ["D06", "D07", "D08", "D09"], "narrative_credit": "Use external behaviour rather than A5/A6; avoid implying every household with children belongs to the effort state."},
        {"finding_id": "M3", "tier": "mandatory", "proposition": "Budget pressure is associated with reported overspending and a stronger request for budget support; this is not proof that any proposed tool will reduce spending.", "evidence": ["NEED_BUDGET_OVERSPEND", "support_budget incidence by need_budget"], "acceptance_ids": ["D10", "D11"], "narrative_credit": "B4 is a binary self-reported experience, not expenditure amount or income. Support selection is external to the need definition."},
        {"finding_id": "M4", "tier": "mandatory", "proposition": "Attitudes to digital meal suggestions are divided into sizeable favourable and unfavourable poles, not neutral consensus; pilot a format rather than assume universal digital uptake.", "evidence": ["Full A9 weighted five-category distribution", "A9 bottom-two, midpoint and top-two with valid bases", "current use and conditional satisfaction as context only"], "acceptance_ids": ["D12", "D13", "D14", "D15"], "narrative_credit": "FULL credit requires the opposing poles to appear in the actual selected finding or narrative. Computing a distribution in an unused table, reporting only the mean, or saying some people disagree is insufficient. Describe the split; exact word 'polarisation' is not required."},
        {"finding_id": "S1", "tier": "secondary", "proposition": "The waste-help need is associated with more reported discard days and demand for use-up support, suggesting a distinct task alongside cost and effort.", "evidence": ["NEED_WASTE_DISCARD", "support_use_up by need_waste"], "acceptance_ids": ["D16", "D17", "D18"]},
        {"finding_id": "S2", "tier": "secondary", "proposition": "Correctly oriented planning attitudes are positively associated with ahead-planned meal days; reversal matters, but association is not intervention effectiveness.", "evidence": ["Pairwise-valid weighted planning_orientation vs B1 association"], "acceptance_ids": ["D19"]},
        {"finding_id": "S3", "tier": "secondary", "proposition": "Current digital-tool users tend to report good satisfaction, but they are a selected minority; shared-list use is a separate conditional behaviour, not all-household penetration.", "evidence": ["U1 prevalence", "U2 valid current-user distribution", "U3 valid current-user incidence"], "acceptance_ids": ["D20", "D21"]},
        {"finding_id": "C1", "tier": "context", "proposition": "Need derivation and reverse keying must exclude 97/98; an unknown flag is not No. Need-state versus defining-item differences provide no independent validation.", "evidence": ["codebook derivations and missingness audit"], "acceptance_ids": ["D26"]},
        {"finding_id": "C2", "tier": "context", "proposition": "Use valid-case weighted research bases, eligible-respondent MR denominators and current-user routes, reporting unweighted N, weighted N and Kish ESS.", "evidence": ["survey design and denominator audits"], "acceptance_ids": ["D24", "D25", "D27"]},
        {"finding_id": "R1", "tier": "do_not_elevate", "proposition": "An attractive exclusive budget/time/waste segmentation, or a claim validated only by the items used to define that state, is not supported.", "failure": "Priority-assign overlapping flags to named personas or treat self-definition as external evidence", "acceptance_ids": ["D03", "D04"]},
        {"finding_id": "R2", "tier": "do_not_elevate", "proposition": "An average-looking digital-attitude mean or good satisfaction among current users does not justify a universal digital-first rollout or a conversion forecast.", "failure": "Erase the two poles, generalise routed satisfaction, or infer observed adoption from stated interest", "acceptance_ids": ["D12", "D13", "D15", "D20", "D21"]},
        {"finding_id": "R3", "tier": "do_not_elevate", "proposition": "The apparently attractive satisfaction of older paid-tool users is a suppressed tiny cell, not evidence of the winning target audience.", "failure": "Publish/rank its rate despite valid n<40 or use it as the launch target", "acceptance_ids": ["D22", "D23"]},
    ]
    return {
        "study_id": "SBT-004", "version": VERSION, "private": True,
        "stage": "Authored candidate; author execution does not substitute for Codex independent freeze validation",
        "model_exposure_allowed": False, "human_review": "pending",
        "seed": seed, "n": n, "default_seed": DEFAULT_SEED,
        "dgp": DGP_SPEC,
        "prospective_validation": {"specified_before_first_execution": True, "intervals_inclusive": True,
            "default_n": DEFAULT_N, "policy": "Run once at the specified seed. Missing metric, invalid denominator or failed interval is FAIL/not established, never an automatic pass. Record every failure. Do not silently tune, change seed, weaken thresholds, or invent a reference finding. Any substantive DGP/design revision is a new pre-exposure candidate version with its prior failures retained.",
            "checks": [{"id": i, "metric": m, "lower": lo, "upper": hi, "rationale": why, "finding": f} for i, m, lo, hi, why, f in checks],
            "structural_requirements": ["Exactly n unique eligible records and 34 public columns", "positive finite weights and declared stratum targets", "all categorical codes documented", "routing and nonresponse semantics correct", "observed need flags exactly match public deterministic definitions", "private scores/mode absent from CSV", "public materials omit proposed truths/reference tiers/acceptance intervals"],
            "inference_readiness": "Independent reviewer checks the six public estimands, family membership and linearisation. Acceptance intervals are effect/shape requirements, NOT required p-values; do not chase significance or label unplanned demographic differences noise.",
        },
        "reference_findings": ref,
        "reference_number_policy": "No author-supplied numbers in these propositions. Codex must independently compute realised values and all valid bases before binding evidence. Local author checks, if supplied, are separate non-gold diagnostics.",
        "synthesis_test": "Distinguish available analysis from narrative selection: for M4 score whether the actual narrative uses both poles, not whether an intermediate distribution happened to be computed.",
        "privacy_and_leakage": {"allowlist": PUBLIC_FILES, "exclude": ["hidden_design.json", "generate_sbt004.py", "author_check.py", "test_sbt004.py", "author check results", "reference artifacts"]},
        "scope_limits": ["Synthetic within-version realised data, not UK empirical facts", "cross-sectional self-report, no causality", "demographics may have meaningful descriptive associations", "no exclusive need-state segments or inferred latent-class labels", "no behavioural response to an untested intervention", "no SBT-005+ or presentation work"],
    }


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -35, 35)))


def ordinal(x: np.ndarray) -> np.ndarray:
    return np.digitize(x, [-1.05, -.35, .35, 1.05]).astype(int) + 1


def derive_need(first: np.ndarray, second: np.ndarray) -> np.ndarray:
    valid = np.isin(first, [1, 2, 3, 4, 5]) & np.isin(second, [1, 2, 3, 4, 5])
    return np.where(valid, ((first >= 4) & (second >= 4)).astype(int), NOT_DERIVABLE)


def simulate(n: int, seed: int) -> pd.DataFrame:
    """Generate response mechanisms once; do not inspect target checks here."""
    root = np.random.SeedSequence(seed)
    profiles, latent_rng, item_rng, behaviour_rng, tool_rng, select_rng, response_rng = [
        np.random.Generator(np.random.PCG64(s)) for s in root.spawn(7)
    ]
    counts = allocate_counts(n)
    stratum = profiles.permutation(np.repeat(np.arange(len(STRATA)), counts))
    age = np.array([STRATA[h]["age_band"] for h in stratum], dtype=int)
    child = np.array([STRATA[h]["children_u16"] for h in stratum], dtype=int)
    older = (age == 4).astype(float)
    # Work profile is observational and may correlate with real generated needs.
    prob_work = np.array([[.22, .16, .62], [.16, .20, .64], [.27, .17, .56], [.80, .12, .08]])[age-1]
    prob_work[:, 1] += .04 * child * (age < 4)
    prob_work[:, 2] -= .04 * child * (age < 4)
    u = profiles.random(n)
    work = (u[:, None] > np.cumsum(prob_work, axis=1)).sum(axis=1).astype(int)
    fulltime = (work == 2).astype(float)
    weights = np.array([n * STRATA[h]["target_share"] / counts[h] for h in stratum], dtype=float)

    z = latent_rng.normal(size=(6, n))
    budget = .75*z[0] + .66*z[1] + .20*child - .10*older
    time = .35*z[0] + .90*z[2] + .55*child + .30*fulltime - .35*older
    planning = .85*z[3] - .25*time + .20*older + .10*child
    waste_care = .80*z[4] + .20*budget + .15*older
    waste_difficulty = .60*time - .35*planning + .75*z[5]
    digital_fit = latent_rng.binomial(1, sigmoid(.25*time - .30*older - .20*budget))

    def observe(values: np.ndarray, dk: float | np.ndarray = .018,
                refused: float = .009) -> np.ndarray:
        draw = response_rng.random(n)
        return np.where(draw < dk, DK, np.where(draw < np.asarray(dk)+refused, REFUSED, values)).astype(int)

    att = {
        "att_plan_ahead_5": ordinal(.95*planning + item_rng.normal(0, .55, n)),
        "att_spontaneous_5": ordinal(-.95*planning + item_rng.normal(0, .55, n)),
        "att_budget_worry_5": ordinal(.90*budget + .15 + item_rng.normal(0, .55, n)),
        "att_price_tradeoffs_5": ordinal(.85*budget + item_rng.normal(0, .60, n)),
        "att_time_short_5": ordinal(.90*time + .05 + item_rng.normal(0, .65, n)),
        "att_decision_fatigue_5": ordinal(.85*time + item_rng.normal(0, .65, n)),
        "att_waste_concern_5": ordinal(.80*waste_care + .60 + item_rng.normal(0, .50, n)),
        "att_waste_difficult_5": ordinal(.85*waste_difficulty + .20 + item_rng.normal(0, .65, n)),
        "att_digital_help_5": ordinal(np.where(digital_fit == 1, 1.4, -1.4) + .25*time + item_rng.normal(0, .70, n)),
    }
    for name in att:
        dk = .018 + (.018*older if name == "att_digital_help_5" else 0)
        att[name] = observe(att[name], dk=dk)
    states = {name: derive_need(att[items[0]], att[items[1]]) for name, items in DERIVED_STATES.items()}

    # External outcomes depend on private traits, never on derived need flags.
    planned = behaviour_rng.binomial(7, sigmoid(.80 + .85*planning - .35*time))
    topups = behaviour_rng.binomial(7, sigmoid(-1.75 + .62*time - .38*planning + .18*child))
    waste = behaviour_rng.binomial(7, sigmoid(-2.20 + .70*waste_difficulty + .30*time - .25*planning + .10*child))
    overspend = behaviour_rng.binomial(1, sigmoid(-.35 + .95*budget + .25*time - .35*planning))
    planned, topups, waste = [observe(a, dk=.025) for a in (planned, topups, waste)]
    overspend = observe(overspend, dk=.055, refused=.012)

    # Current tool use, not a response to a new concept. No usage-outcome causal claim.
    logits = np.column_stack([
        np.zeros(n),
        -1.65 + .75*digital_fit + .15*child,
        -1.80 + .85*digital_fit + .25*planning,
        -3.00 + .80*digital_fit - .45*budget + .15*planning - .50*older,
    ])
    probs = np.exp(logits - logits.max(axis=1, keepdims=True))
    probs /= probs.sum(axis=1, keepdims=True)
    tool = (tool_rng.random(n)[:, None] > np.cumsum(probs, axis=1)).sum(axis=1).astype(int)
    tool_observed = observe(tool, dk=.015, refused=.009)
    eligible = np.isin(tool_observed, [1, 2, 3])
    sat_values = ordinal(1.00 + .50*digital_fit + .18*planning - .40*time - .10*budget + .25*(tool == 3) + .30*older + tool_rng.normal(0, .85, n))
    shared_values = tool_rng.binomial(1, sigmoid(-.25 + .65*child + .25*digital_fit + .20*(tool == 1) - .10*time))
    satisfaction = np.where(eligible, observe(sat_values, dk=.028), np.nan)
    shared = np.where(eligible, observe(shared_values, dk=.025), np.nan)

    def selections(logit_columns: list[np.ndarray], names: list[str], dk: float, refuse: float) -> tuple[dict[str, np.ndarray], np.ndarray]:
        raw = select_rng.binomial(1, sigmoid(np.column_stack(logit_columns)))
        draw = response_rng.random(n)
        status = np.where(draw < dk, DK, np.where(draw < dk+refuse, REFUSED, 1)).astype(int)
        # Whole-block response mechanism. An answered all-zero row means None.
        observed = np.where((status == 1)[:, None], raw, status[:, None])
        return {name: observed[:, i].astype(int) for i, name in enumerate(names)}, status

    need_select, need_status = selections([
        .35 + .95*budget + .12*time,
        .45 + .85*time - .15*planning,
        .30 + .45*waste_care + .60*waste_difficulty,
        -.30 + .65*child + .15*time + .10*digital_fit,
    ], [x[0] for x in NEED_ITEMS], .028, .012)
    barrier_select, barrier_status = selections([
        -.15 + .60*time - .20*digital_fit,
        -.15 - .45*planning + .20*time,
        -.05 + .80*budget,
        -.40 + .45*(1-digital_fit) + .15*older,
    ], [x[0] for x in BARRIER_ITEMS], .033, .012)

    values = {
        "respondent_id": [f"SBT004_{i+1:06d}" for i in range(n)],
        "age_band": age, "children_u16": child, "work_hours_band": work, "wt_final": weights,
        **att, **states,
        "meal_plan_days_7d": planned, "unplanned_topups_7d": topups, "waste_days_7d": waste,
        "over_budget_4w": overspend, "planning_tool_28d": tool_observed,
        "tool_satisfaction_5": satisfaction, "shared_list_use_28d": shared,
        **need_select, **barrier_select,
        "needs_block_status": need_status, "barriers_block_status": barrier_status,
    }
    frame = pd.DataFrame(values)
    # Nullable integers serialise response codes as 1/97, not 1.0/97.0; blank routes stay empty.
    for col in frame.columns:
        if col not in ("respondent_id", "wt_final"):
            frame[col] = pd.array(frame[col], dtype="Int64")
    return frame


def write_study(out: Path, seed: int = DEFAULT_SEED, n: int = DEFAULT_N) -> dict[str, Any]:
    if not 2400 <= n <= 3000:
        raise ValueError("n must be between 2400 and 3000 inclusive")
    if seed < 0:
        raise ValueError("seed must be nonnegative")
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    existing = [f for f in OUTPUT_FILES if (out / f).exists()]
    if existing:
        raise FileExistsError("Refusing to overwrite an existing candidate: " + ", ".join(existing))
    design = make_hidden_design(seed, n)
    # Commit the intended design to the output directory BEFORE simulation.
    design_bytes = dumps(design).encode("utf-8")
    (out / "hidden_design.json").write_bytes(design_bytes)
    (out / "codebook.json").write_text(dumps(make_codebook()), encoding="utf-8")
    (out / "questionnaire.md").write_text(make_questionnaire(), encoding="utf-8")
    (out / "study_materials.json").write_text(dumps(make_study_materials(n)), encoding="utf-8")
    frame = simulate(n, seed)
    frame.to_csv(out / "respondents.csv", index=False, na_rep="", float_format="%.15g", lineterminator="\n", encoding="utf-8")
    receipt = {
        "design_before_execution_sha256": digest_bytes(design_bytes),
        "generator_source_sha256": digest_bytes(Path(__file__).read_bytes()),
        "respondents_sha256": digest_bytes((out / "respondents.csv").read_bytes()),
        "public_file_sha256": {f: digest_bytes((out / f).read_bytes()) for f in PUBLIC_FILES},
        "runtime": {"python": platform.python_version(), "numpy": np.__version__, "pandas": pd.__version__},
        "execution": "Generated only; no hidden acceptance checks or reference freeze performed by this generator.",
    }
    design["execution_receipt"] = receipt
    (out / "hidden_design.json").write_text(dumps(design), encoding="utf-8")
    return {"study_id": "SBT-004", "out": str(out), "n": len(frame), "columns": len(frame.columns),
            "seed": seed, "files": OUTPUT_FILES, "respondents_sha256": receipt["respondents_sha256"],
            "status": "GENERATED_NOT_INDEPENDENTLY_VALIDATED"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="Output directory; refuses to overwrite study files")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--n", type=int, default=DEFAULT_N, help="2400..3000; default 2700. Nondefault samples are separate candidates.")
    args = parser.parse_args()
    try:
        receipt = write_study(args.out, args.seed, args.n)
    except (ValueError, FileExistsError) as exc:
        parser.error(str(exc))
    print(dumps(receipt), end="")


if __name__ == "__main__":
    main()
