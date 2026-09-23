#!/usr/bin/env python3
"""SBT-006: PantryPace randomised monadic stated-intent pricing study.

Reproduce all five study files with this file alone:
    python generate_sbt006.py --out OUTPUT_DIR --seed 2026092206

Dependencies: Python stdlib, numpy, pandas. No network or companion input files.
This source and hidden_design.json are AUTHOR/VALIDATOR ONLY: they reveal the DGP
and intended findings. Only respondents.csv, codebook.json, questionnaire.md and
study_materials.json belong in a later evaluated-model input bundle.

There is one probabilistic draw per seed. No seed search, row replacement,
acceptance-conditioned generation, or reference-number tuning is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

VERSION = "SBT-006-author-candidate-1.0.0"
DEFAULT_SEED = 2026092206
N_HOUSEHOLDS = 3000
PRICES = (4, 7, 10, 13)
COST_SCENARIOS = (0.50, 2.00, 3.00)
BASE_COST = 2.00
MISSING = {97: "Don't know / unable to judge", 98: "Prefer not to answer", 99: "Item not answered after entering module"}
INTENT_LABELS = {
    1: "Definitely would not subscribe", 2: "Probably would not subscribe",
    3: "Might or might not subscribe", 4: "Probably would subscribe",
    5: "Definitely would subscribe",
}
# Joint shares are hypothetical FRAME/DESIGN ASSUMPTIONS, not measured UK totals.
STRATA = [
    {"code": 1, "children": 1, "budget": 1, "sample_share": .22, "target_share": .16},
    {"code": 2, "children": 1, "budget": 2, "sample_share": .22, "target_share": .18},
    {"code": 3, "children": 1, "budget": 3, "sample_share": .08, "target_share": .06},
    {"code": 4, "children": 0, "budget": 1, "sample_share": .12, "target_share": .18},
    {"code": 5, "children": 0, "budget": 2, "sample_share": .24, "target_share": .30},
    {"code": 6, "children": 0, "budget": 3, "sample_share": .12, "target_share": .12},
]
PAIRWISE = [[a, b] for i, a in enumerate(PRICES) for b in PRICES[i + 1:]]


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def variable(name: str, question: str, label: str, codes: dict[int, str] | None,
             valid: list[int] | None, route: dict[str, Any], *,
             missing: tuple[int, ...] = (), structural: bool = False,
             kind: str = "integer", extra: dict[str, Any] | None = None) -> dict[str, Any]:
    item = {
        "name": name, "question_id": question, "label": label, "storage": kind,
        "codes": {str(k): v for k, v in (codes or {}).items()},
        "valid_values": valid,
        "missing_values": {str(k): MISSING[k] for k in missing},
        "route": route, "structural_blank_allowed": structural,
    }
    if extra:
        item.update(extra)
    return item


def make_codebook() -> dict[str, Any]:
    all_rows = {"type": "all_assigned", "text": "All 3,000 baseline-complete, randomly assigned households."}
    post = {"type": "equals", "field": "postprice_responded", "value": 1,
            "text": "Reached the post-price evaluation module (postprice_responded=1)."}
    intent_valid_route = {"type": "all_of", "conditions": [post, {"type": "in", "field": "intent_5", "values": [1, 2, 3, 4, 5]}],
                          "text": "Reached module AND gave a valid 1-5 intent answer."}
    use_route = {"type": "all_of", "conditions": [post, {"type": "in", "field": "intent_5", "values": [3, 4, 5]}],
                 "text": "Reached module AND intent_5 is 3, 4 or 5. Missing intent does not satisfy the route."}
    reason_route = {"type": "all_of", "conditions": [post, {"type": "in", "field": "intent_5", "values": [1, 2, 3]}],
                    "text": "Reached module AND intent_5 is 1, 2 or 3. Missing intent does not satisfy the route."}
    agree = {1: "Strongly disagree", 2: "Somewhat disagree", 3: "Neither agree nor disagree", 4: "Somewhat agree", 5: "Strongly agree"}
    vs = [
        variable("respondent_id", "ADMIN_ID", "Synthetic household/respondent ID", None, None, all_rows, kind="string",
                 extra={"pattern": "SBT006_0001 ... SBT006_3000", "grain": "One adult reporting for one household; no repeated prices."}),
        variable("age_band", "B01", "Age of household respondent", {1: "18-34", 2: "35-54", 3: "55-64", 4: "65+"}, [1, 2, 3, 4], all_rows),
        variable("household_children", "B02", "Child aged under 18 lives in household", {0: "No", 1: "Yes"}, [0, 1], all_rows),
        variable("budget_band", "B03", "Household grocery-budget position", {1: "Often difficult to keep within budget", 2: "Managing, with some trade-offs", 3: "Generally comfortable"}, [1, 2, 3], all_rows),
        variable("meal_planning_role", "B04", "Responsibility for household grocery/meal planning", {1: "Main responsibility", 2: "Shared responsibility"}, [1, 2], all_rows),
        variable("weekday_time_pressure_5", "B05", "Usually rushed when deciding weekday meals", agree, [1, 2, 3, 4, 5], all_rows, missing=(97, 98)),
        variable("current_planning_method", "B06", "Main existing grocery/meal-planning method", {1: "Paper, memory or printed recipes", 2: "General notes/calendar/spreadsheet app", 3: "Free dedicated planning app", 4: "Paid dedicated planning app or subscription", 5: "No regular method"}, [1, 2, 3, 4, 5], all_rows),
        variable("digital_confidence_5", "B07", "Confidence using household digital services", {1: "Not at all confident", 2: "Slightly confident", 3: "Moderately confident", 4: "Very confident", 5: "Extremely confident"}, [1, 2, 3, 4, 5], all_rows, missing=(97, 98)),
        variable("plan_ahead_days_7", "B08", "Evenings planned before the day, last seven days", {i: f"{i} evening(s)" for i in range(8)}, list(range(8)), all_rows, missing=(97, 98)),
        variable("subscription_spend_band", "B09", "Current household optional digital-subscription spending per month", {0: "None", 1: "Under GBP 10", 2: "GBP 10-29", 3: "GBP 30 or more"}, [0, 1, 2, 3], all_rows, missing=(97, 98), extra={"note": "Reported spend band on other existing services, not PantryPace revenue."}),
        variable("household_size_band", "B10", "Household size", {1: "One", 2: "Two", 3: "Three", 4: "Four or more"}, [1, 2, 3, 4], all_rows),
        variable("design_stratum", "ADMIN_STRATUM", "Baseline design cell", {s["code"]: f"children={s['children']}; budget_band={s['budget']}" for s in STRATA}, list(range(1, 7)), all_rows),
        variable("wt_design", "ADMIN_WEIGHT", "Fixed positive baseline design weight", None, None, all_rows, kind="float", extra={"valid_range": {"lower_exclusive": 0}, "definition": "target_share[stratum]/sample_share[stratum], scaled once so baseline weights sum to 3000; never adjusted for assignment or post-price response."}),
        variable("assigned_price_arm", "RAND01", "Randomised monadic price arm", {i + 1: f"GBP {p} per month" for i, p in enumerate(PRICES)}, [1, 2, 3, 4], all_rows),
        variable("assigned_price_gbp", "RAND02", "Monthly GBP price shown", {p: f"GBP {p}" for p in PRICES}, list(PRICES), all_rows, extra={"definition": "Actual price value, not the arm code. One price per household."}),
        variable("postprice_responded", "ADMIN_RESPONSE", "Entered post-price evaluation module", {0: "Exited after price assignment; no evaluation module responses", 1: "Entered evaluation module"}, [0, 1], all_rows),
        variable("intent_5", "P01", "Stated likelihood to take subscription at assigned price", INTENT_LABELS, [1, 2, 3, 4, 5], post, missing=(97, 98, 99), structural=True),
        variable("value_5", "P02", "Expected value at shown price", {1: "Very poor", 2: "Poor", 3: "Neither poor nor good", 4: "Good", 5: "Very good"}, [1, 2, 3, 4, 5], post, missing=(97, 98, 99), structural=True),
        variable("fit_5", "P03", "Fit with household meal-planning needs", {1: "Not at all relevant", 2: "Slightly relevant", 3: "Moderately relevant", 4: "Very relevant", 5: "Extremely relevant"}, [1, 2, 3, 4, 5], post, missing=(97, 98, 99), structural=True),
        variable("affordability_5", "P04", "Affordability of shown monthly price", {1: "Very difficult to afford", 2: "Difficult to afford", 3: "Neither difficult nor easy", 4: "Easy to afford", 5: "Very easy to afford"}, [1, 2, 3, 4, 5], post, missing=(97, 98, 99), structural=True),
        variable("ease_5", "P05", "Expected ease of using described service", {1: "Very difficult", 2: "Difficult", 3: "Neither difficult nor easy", 4: "Easy", 5: "Very easy"}, [1, 2, 3, 4, 5], post, missing=(97, 98, 99), structural=True),
        variable("trust_5", "P06", "Confidence service would do what is described", {1: "No confidence", 2: "Little confidence", 3: "Some confidence", 4: "Much confidence", 5: "Complete confidence"}, [1, 2, 3, 4, 5], post, missing=(97, 98, 99), structural=True),
        variable("differentiation_5", "P07", "Difference from planning options respondent knows", {1: "Not at all different", 2: "Slightly different", 3: "Moderately different", 4: "Very different", 5: "Extremely different"}, [1, 2, 3, 4, 5], post, missing=(97, 98, 99), structural=True),
        variable("certainty_5", "P08", "Certainty about the stated intent answer", {1: "Not at all certain", 2: "Slightly certain", 3: "Moderately certain", 4: "Very certain", 5: "Extremely certain"}, [1, 2, 3, 4, 5], intent_valid_route, missing=(97, 98, 99), structural=True),
        variable("primary_use_goal", "P09", "Most useful possible role for the service", {0: "None of these", 1: "Reduce deciding/planning effort", 2: "Keep grocery spending organised", 3: "Use food already at home", 4: "Find practical recipe variety"}, [0, 1, 2, 3, 4], post, missing=(97, 98, 99), structural=True),
        variable("anticipated_use_days_7", "P10", "Hypothetical days of use per week", {i: f"{i} day(s)" for i in range(8)}, list(range(8)), use_route, missing=(97, 98, 99), structural=True, extra={"note": "Conditional expectation among maybe/probably/definitely interested respondents, not observed usage and not all-household usage."}),
        variable("reason_not_commit", "P11", "Main reason for not giving a positive intent answer", {1: "Monthly price", 2: "Free options already adequate", 3: "Not enough need", 4: "Trust or privacy concern", 5: "Setup/ongoing effort", 6: "Other reason"}, [1, 2, 3, 4, 5, 6], reason_route, missing=(97, 98, 99), structural=True),
        variable("time_pressed_family", "DERIVED01", "Prespecified baseline audience: children plus weekday meal time pressure", {0: "Does not meet criteria", 1: "Children under 18 and pressure answer 4 or 5"}, [0, 1], all_rows, missing=(97,), extra={"derivation": "If household_children=0, set 0. If children=1 and weekday_time_pressure_5 in {4,5}, set 1. If children=1 and pressure in {1,2,3}, set 0. Otherwise set 97 (unknown). No outcome or price field is used.", "missing_values": {"97": "Need-group status unknown because qualifying baseline time-pressure answer is nonvalid"}}),
    ]
    return {
        "study_id": "SBT-006", "version": VERSION, "title": "PantryPace monthly-price study: data dictionary",
        "grain": "One row per randomly assigned baseline-complete household; keep module exits in the CSV.",
        "csv": {"encoding": "UTF-8", "delimiter": ",", "structural_blank": "Empty CSV field (read as NaN); never an observed zero or DK.", "numeric_missing_codes": {str(k): v for k, v in MISSING.items()}, "note": "Codes apply only where listed for a variable. 0 is a genuine valid response for several variables."},
        "variables": vs,
    }


QUESTIONNAIRE = """# SBT-006 — PantryPace monthly-price study

## Population and design

One adult aged 18+ with main or shared household grocery/meal-planning responsibility
in a hypothetical UK-address household research frame. All households and service
responses are synthetic. No nationally representative or current-customer claim is made.
Baseline profiling is completed before randomisation. Each household sees ONE of
four prices, assigned at random; nobody rates multiple prices. This is a randomised
monadic stated-intent study, not a purchase task, price auction or longitudinal study.

## Baseline questions (all before price assignment)

B01 Age: 1=18-34; 2=35-54; 3=55-64; 4=65+.
B02 Child under 18 in household: 0=No; 1=Yes.
B03 Grocery-budget position: 1=Often difficult; 2=Managing with trade-offs;
3=Generally comfortable.
B04 Grocery/meal-planning responsibility: 1=Main; 2=Shared.
B05 “I am usually rushed when deciding what to make for weekday meals.”
1=Strongly disagree; 2=Somewhat disagree; 3=Neither; 4=Somewhat agree; 5=Strongly agree.
B06 Main method: 1=Paper/memory/printed recipes; 2=General notes/calendar/spreadsheet;
3=Free dedicated app; 4=Paid dedicated planning service; 5=No regular method.
B07 Confidence with household digital services: 1=Not at all; 2=Slightly;
3=Moderately; 4=Very; 5=Extremely.
B08 How many of the last seven evening meals were planned before that day? 0-7.
B09 Monthly optional digital-subscription spending: 0=None; 1=Under GBP 10;
2=GBP 10-29; 3=GBP 30+ (existing services, NOT PantryPace).
B10 Household size: 1=One; 2=Two; 3=Three; 4=Four or more.

B05/B07/B08/B09 permit 97=Don't know and 98=Prefer not to answer. Required
baseline frame/profile variables have no nonvalid codes in this baseline-complete file.

## Randomised stimulus

Arm 1 shows GBP 4/month; arm 2 GBP 7; arm 3 GBP 10; arm 4 GBP 13.
Only the price changes; feature copy, billing period and cancellation terms are identical.

> PantryPace is an optional digital household meal-planning subscription. It creates
> editable weekly meal suggestions, a shared grocery list, and reminders to use food
> already at home. You can adapt recipes and lists to your household. It does not
> include groceries, deliveries, discounts or human nutrition advice. The price is
> GBP [ASSIGNED PRICE] per household per month, billed monthly; cancel before the
> next billing month. No free trial, annual commitment or promotional discount is shown.

Record assignment for everyone. postprice_responded=0 denotes an exit after price
assignment and before entering evaluation: ALL P01-P11 fields are structural blanks.
Do not remove those rows or label the blanks as “definitely would not”.

## Post-price evaluation (module respondents only)

P01 “At GBP [PRICE] each month, how likely would your household be to start this
subscription in the next four weeks?”
1=Definitely would not; 2=Probably would not; 3=Might or might not;
4=Probably would; 5=Definitely would.

P02 Expected value at this price: 1=Very poor; 2=Poor; 3=Neither; 4=Good; 5=Very good.
P03 Fit with household needs: 1=Not at all relevant; 2=Slightly; 3=Moderately;
4=Very; 5=Extremely relevant.
P04 Price affordability: 1=Very difficult; 2=Difficult; 3=Neither;
4=Easy; 5=Very easy to afford.
P05 Expected ease of use: 1=Very difficult; 2=Difficult; 3=Neither; 4=Easy; 5=Very easy.
P06 Confidence in delivery of the described features: 1=None; 2=Little;
3=Some; 4=Much; 5=Complete confidence.
P07 Difference from known alternatives: 1=Not at all; 2=Slightly; 3=Moderately;
4=Very; 5=Extremely different.
P08 Ask ONLY if P01 is valid 1-5: certainty about that intent answer,
1=Not at all; 2=Slightly; 3=Moderately; 4=Very; 5=Extremely certain.
P09 Most useful role: 0=None; 1=Reduce planning effort; 2=Organise grocery spending;
3=Use existing food; 4=Practical recipe variety.
P10 Ask ONLY if P01 in {3,4,5}: “Supposing you did subscribe, on how many days in a
usual week do you imagine using it?” 0-7. This is NOT measured use or uptake.
P11 Ask ONLY if P01 in {1,2,3}: main reason not to give a positive answer,
1=Monthly price; 2=Free alternatives; 3=Not enough need; 4=Trust/privacy;
5=Effort; 6=Other. P01=3 legitimately receives both P10 and P11.

Every eligible P item permits 97=Don't know/unable to judge, 98=Prefer not to
answer, 99=Question not answered after entering module. Outside a route use an
empty CSV field, never 97/98/99. Items are not reverse-keyed. Preserve all five
intent categories rather than reducing the evidence to the top-two percentage alone.

## Prespecified audience and small-cell rules

Main audience: time_pressed_family, derived solely from B02 and B05 as in the
codebook. It is a baseline audience, not a randomised attribute.
An exploratory premium-niche cut is age_band in {3,4}, budget_band=3, and
current_planning_method=4. It is not an independently powered pricing experiment.
Never publish a cell rate or comparison if any component valid cell has n<40;
warn at 40<=n<75. Print the base and suppression status instead. Kish ESS<40
requires an additional precision warning even if unweighted n is larger.

## Analysis

See study_materials.json for the fixed estimands, all-assigned sensitivity,
variance formula, adjustment families and hypothetical cost assumptions. Baseline
weights do not correct post-price missingness. No payments, transactions, churn,
retention, real sales, variable costs or realised profits were observed.
"""


def make_study_materials(seed: int = DEFAULT_SEED) -> dict[str, Any]:
    return {
        "study_id": "SBT-006", "version": VERSION,
        "title": "PantryPace: choosing prices for a future behavioural validation test",
        "decision_question": "Which of GBP 4, 7, 10 and 13 monthly merits further real-behaviour testing, considering stated interest, clearly labelled price-times-intent proxies, response uncertainty and assumed variable costs?",
        "brief": "Compare monadic price assignments on full stated-intent distributions, do not declare an actual market optimum. Deliver a concise evidence-traceable research narrative, not a presentation.",
        "service": {"name": "PantryPace", "type": "Fictional optional household digital meal-planning subscription", "features": ["Editable weekly meal suggestions", "Shared grocery list", "Use-up reminders"], "excludes": ["Groceries", "Deliveries", "Discounts", "Human advice"], "billing": "Per household per month, cancellable before next billing month; no trial or annual commitment."},
        "population": "Baseline-complete adult main/shared grocery or meal planners in a hypothetical UK-address household frame. Target is the specified synthetic frame, NOT all UK households or actual customers.",
        "design": {"type": "Randomised monadic pricing", "n_assigned": N_HOUSEHOLDS, "seed": int(seed), "one_household_one_price": True, "price_levels_gbp": list(PRICES), "allocation": "A random permutation of 750 labels of each price arm, independent of all baseline attributes and fixed baseline weights.", "timing": "Baseline -> random assignment and price display -> possible module exit -> item responses.", "no_reassignment_or_replenishment": True},
        "sampling": {"kind": "Unequal-probability synthetic frame sample across six baseline design cells", "joint_cells": STRATA, "joint_shares_status": "EXPLICIT SCENARIO ASSUMPTIONS, not external UK population statistics.", "within_cell": "One independent simulated household per draw; no respondent clustering.", "realised_balance_required": "Report unweighted assigned N, sum(wt_design), Kish ESS and weighted baseline profile distributions by arm. Exact arm n does not imply identical weighted or covariate composition."},
        "weights": {"variable": "wt_design", "formula": "raw_i = target_share[h_i]/sample_share[h_i]; wt_design_i = raw_i * 3000/sum(raw_all_baseline)", "fixed_at": "Baseline, before price allocation", "use": "Use the same stored positive weight for assigned, valid-case and routed analyses. Never reweight by intent or price arm.", "limitations": "Not an attrition weight, not a nonresponse correction and not proof of external representativeness. Weighted N is a weight sum, not effective or literal population size."},
        "coding_and_routing": {"authoritative": "codebook.json and questionnaire.md", "nonvalid_numeric_codes": {str(k): v for k, v in MISSING.items()}, "structural_blank": "Empty CSV field outside route; all P fields blank for postprice_responded=0.", "rule": "Never compare 97/98/99 numerically to intent>=4. First restrict to the enumerated valid set. Missing numeric values and structural blanks are counted separately.", "intent_route": "postprice_responded=1", "certainty_route": "Valid intent 1-5", "anticipated_use_route": "Valid intent 3/4/5", "reason_route": "Valid intent 1/2/3", "baseline_subgroup_unknown": "time_pressed_family=97 is unknown, not 0."},
        "estimands": {
            "intent_definition": "Positive stated intent Y=1 iff intent_5 in {4,5}; Y=0 iff intent_5 in {1,2,3}. Neither outcome represents an actual purchase.",
            "valid_case_intent": "q_v(p) = sum_i(w_i * I[intent_i in {4,5}]) / sum_i(w_i) over assigned_price_gbp=p AND intent_i in {1,2,3,4,5}.",
            "full_distributions": "Within each arm, weighted valid-case shares of EACH category 1,2,3,4,5 (sum=1), plus top-two and bottom-two. DK/refusal/skipped/module-exit shares use all assigned as denominator and remain separate.",
            "all_assigned_sensitivity": "q_0(p) = weighted count of recorded intent in {4,5} / sum weights of ALL households assigned p. Every nonvalid or structurally absent intent contributes 0 only to this explicitly conservative scoring sensitivity, NOT by relabelling intent or its five-category distribution.",
            "logical_completion_bounds": "[q_0(p), q_0(p)+weighted_nonvalid_share(p)] brackets possible all-assigned positive-intent means if missing responses were completed as binary outcomes. It is a missing-data range, not a confidence interval and not a bound on actual demand.",
            "price_contrast": "For ordered pair a<b report q(a)-q(b); positive means the cheaper assignment has more recorded/stated interest. Analyse participants by assigned price, never by perceived affordability or intent.",
            "gross_proxy": "G_v(p)=p*q_v(p), G_0(p)=p*q_0(p), GBP per hypothetical household-month on that denominator. This is a gross PRICE-TIMES-STATED-INTEREST index, sometimes called a gross-revenue proxy; it is not measured revenue or a forecast.",
            "contribution_proxy": "C_v(p;c)=(p-c)*q_v(p); C_0(p;c)=(p-c)*q_0(p). c is ASSUMED variable GBP cost per proxy-positive subscriber-month, not a cost per research respondent. These are hypothetical contribution proxies, not profits.",
            "proxy_assumption": "The mechanical index treats each positive stated response as one subscriber-month and all other scored responses as zero, without conversion calibration. Do NOT infer that this mapping is true.",
            "subgroup": "At GBP 7 and GBP 10, q_v(time_pressed_family=1,p)-q_v(time_pressed_family=0,p), using valid subgroup and intent. Observational audience contrast at the same assigned price, not an effect of having children or being time-pressed.",
            "cost_crossing": "Optional descriptive crossing of the two mid-price C lines: c_star=(7*q7-10*q10)/(q7-q10), when denominator nonzero. It is unstable when q7~q10 and has no standalone causal/optimal-price interpretation. Show the three predeclared scenarios first.",
            "routed": "P08/P10/P11 distributions use route-eligible AND item-valid respondents, report both eligible and valid bases. In particular P10 is a selected hypothetical-use question, not behavioural corroboration of conversion.",
            "associations": "Diagnostic correlations with intent are fixed-weight valid-pair Pearson DESCRIPTIVE summaries of numeric ordinal codes; preserve ordinal distributions, no causal 'drivers', and no unregistered significance scan."
        },
        "financial_scenario_assumptions": {"currency": "GBP", "cost_unit": "Assumed variable cost per proxy-positive subscriber-month", "base_case": BASE_COST, "sensitivity_costs": list(COST_SCENARIOS), "source": "Deliberately hypothetical analyst scenarios for this exercise; NOT actual business costs, audited estimates or observed economics.", "constant_across_prices": True, "excludes": ["Fixed development and content costs", "Acquisition/marketing", "Taxes and VAT treatment", "Refunds", "Discounts", "Payment failures", "Retention and churn", "Conversion of stated interest to real paid take-up"], "instruction": "Retain all scenarios even if one changes the point leader. Do not select a scenario after inspecting results, and do not call C profit or calculate ROI."},
        "base_reporting": {"every_estimate": ["unweighted eligible N", "weighted eligible N=sum(w)", "eligible Kish ESS", "unweighted valid N", "weighted valid N=sum(w_valid)", "valid Kish ESS"], "kish": "ESS=(sum w)^2/sum(w^2)", "unknowns": "List counts of codes 97,98,99 and structural blanks separately.", "assignment": "Audit covariate composition and weights before conditioning on module response or valid intent."},
        "inference": {
            "alpha": .05, "direction": "All named tests two-sided.",
            "working_variance": "For a weighted mean mu on n independent analysis rows with fixed weights, V(mu)=[n/(n-1)] * sum(w_i^2*(y_i-mu)^2)/(sum(w_i)^2). Use n>=2, otherwise variance unavailable. The rows are intent-valid for q_v and all assigned for q_0. This estimates a working independent-row ratio variance; not exact randomisation inference or a general complex-survey variance.",
            "proxy_variance": "For a fixed coefficient k (p or p-c), V(k*mu)=k^2*V(mu). For different disjoint price arms, V(k_a*mu_a-k_b*mu_b)=k_a^2*V(mu_a)+k_b^2*V(mu_b). Within an arm, scenarios share the SAME q; never treat them as independent samples.",
            "interval": "Pointwise normal 95% CI=estimate +/- 1.959963984540054*SE; p=erfc(abs(estimate/SE)/sqrt(2)). Label pointwise CIs as unadjusted, NOT simultaneous. No test when invalid/suppressed. Do not force bounded means/proxies into a Wald CI support by quietly clipping.",
            "adjustment": "Holm step-down within each fixed family; sort raw p ascending, adjusted p at rank j is min(1, max_{k<=j}((m-k+1)*p_(k))). Unavailable/suppressed family members retain slots with p=1 for adjustment only and no reported test.",
            "families": [
                {"id": "P1_VALID_INTENT", "members": PAIRWISE, "m": 6, "statistic": "q_v(a)-q_v(b)"},
                {"id": "P2_ALL_ASSIGNED_INTENT", "members": PAIRWISE, "m": 6, "statistic": "q_0(a)-q_0(b)"},
                {"id": "P3_GROSS_PROXY", "members": PAIRWISE, "m": 6, "statistic": "a*q_v(a)-b*q_v(b)"},
                {"id": "P4_CONTRIBUTION_SCENARIOS", "members": [{"a": a, "b": b, "cost": c} for c in COST_SCENARIOS for a, b in PAIRWISE], "m": 18, "statistic": "(a-c)*q_v(a)-(b-c)*q_v(b)", "note": "One joint 18-test family, not a newly chosen family for the apparent winning scenario."},
                {"id": "P5_BASELINE_AUDIENCE", "members": [7, 10], "m": 2, "statistic": "q_v(group=1,p)-q_v(group=0,p)", "interpretation": "Descriptive audience association, not attribute causality."},
            ],
            "all_assigned_financial": "Report point estimates and pointwise intervals as sensitivity; no extra confirmatory tests beyond P2. Other demographic and diagnostic comparisons are descriptive/exploratory.",
            "winner_policy": "A point leader is not a certain optimum. Report contrasts, uncertainty, multiplicity, other candidates and sensitivity. Nonsignificance is not equivalence. Do not pick just one of the four prices after inspecting unadjusted tests."
        },
        "small_base_policy": {"suppress_below_n": 40, "warn_below_n": 75, "ess_warning_below": 40, "applies_to": "Unweighted valid denominator of EVERY component cell, not just pooled group total. Suppress rates, proxies, associations and tests if any required cell is below 40; show n and a suppression label. Warn for 40-74; additional precision warning for ESS<40.", "premium_niche": "Exploratory age_band in {3,4} AND budget_band=3 AND current_planning_method=4. Pooling prices cannot rescue price-specific evidence or identify its best price."},
        "limits": [
            "Randomised assignment supports price effects on REPORTED responses within this synthetic design when outcome observation is adequate; it does not identify actual buying, demand, demand elasticity, uptake, revenue, sales or profit.",
            "Valid-case contrasts condition on post-randomisation response and are not automatically full-sample causal effects. Report module and item missingness by assignment. q_0 is the assignment contrast on recorded-positive-response yield, combining response and stated intent, not recovered missing preferences.",
            "Fixed baseline weights are not nonresponse adjustments. Do not assert a whole-population intent or economic effect from incomplete item observation.",
            "Household attributes are not randomised; heterogeneous subgroup levels and diagnostic correlations are not causal effects of those attributes or mechanisms.",
            "No actual transaction, observed uptake, repeat use, retention or business cost data were collected. Do not extrapolate an elasticity curve, interpolate an optimum, or calculate campaign ROI.",
        ],
        "model_output": "Present the substantive price trade-offs and qualifications with evidence and full distribution context. No slides required. No hidden sources, validation targets or anticipated reference propositions are part of this brief.",
    }


def make_hidden_design() -> dict[str, Any]:
    # These ranges are prospective FIRST-CANDIDATE tests. A failure is retained,
    # not resolved by seed hunting, relabelling a finding, or editing realised rows.
    checks = [
        ("C01", "valid_intent_4", .48, .80, "M1"),
        ("C02", "valid_intent_7", .30, .65, "M1"),
        ("C03", "valid_intent_10", .16, .49, "M1"),
        ("C04", "valid_intent_13", .05, .36, "M1"),
        ("C05", "interest_gap_4_minus_13", .22, .62, "M1"),
        ("C06", "interest_4_13_holm_p", 0, .05, "M1"),
        ("C07", "interest_nonincreasing", 1, 1, "M1"),
        ("C08", "gross_mid_best_minus_extremes_best", .05, 1.50, "M2"),
        ("C09", "gross_7_minus_10", .00, .65, "M2"),
        ("C10", "contribution_base_10_minus_7", .00, .65, "M2"),
        ("C11", "gross_point_leader_is_7", 1, 1, "M2"),
        ("C12", "base_contribution_point_leader_is_10", 1, 1, "M2"),
        ("C13", "gross_mid_ci_includes_zero", 1, 1, "M3"),
        ("C14", "base_contribution_mid_ci_includes_zero", 1, 1, "M3"),
        ("C15", "contribution_cost_0_5_7_minus_10", .00, .65, "M3"),
        ("C16", "contribution_cost_3_0_10_minus_7", .00, .75, "M3"),
        ("C17", "mid_price_cost_crossing", .50, 3.00, "M3"),
        ("C18", "intent_valid_fraction_all", .77, .96, "M4"),
        ("C19", "nonvalid_share_13_minus_4", .01, .13, "M4"),
        ("C20", "largest_valid_minus_all_assigned_intent", .025, .13, "M4"),
        ("C21", "module_exit_fraction", .012, .12, "M4"),
        ("C22", "baseline_audience_share", .18, .42, "S1"),
        ("C23", "audience_intent_gap_at_7", .07, .35, "S1"),
        ("C24", "audience_intent_gap_at_10", .07, .35, "S1"),
        ("C25", "corr_intent_value_weighted", .30, .86, "S2"),
        ("C26", "corr_value_affordability_weighted", .30, .88, "S2"),
        ("C27", "anticipated_use_eligible_fraction", .25, .72, "S3"),
        ("C28", "anticipated_use_ge3_conditional", .35, .92, "S3"),
        ("C29", "premium_niche_assigned_n", 20, 110, "R2"),
        ("C30", "premium_niche_min_valid_cell_n", 1, 39, "R2"),
        ("C31", "premium_niche_max_valid_cell_n", 1, 39, "R2"),
        ("C32", "premium_niche_pooled_interest_gap_private", .06, .48, "R2"),
    ]
    refs = [
        {"id": "M1", "tier": "mandatory", "proposition": "Cheaper assigned prices increase stated subscription interest, with a much lower full-intent profile at the high end; this is not revealed demand.", "evidence": ["Full 1-5 distributions by assigned price", "P1 valid-case differences", "P2 all-assigned sensitivity"], "claim_boundary": "Do not rename reported likelihood a purchase probability, demand curve or actual price elasticity."},
        {"id": "M2", "tier": "mandatory", "proposition": "The cheapest price is not the strongest price-times-interest candidate. Gross and assumed-cost contribution proxies favour different closely competing mid-price candidates in the intended first-candidate design.", "evidence": ["All four G_v point estimates", "C_v at the fixed GBP 2 base-cost assumption", "P3 and P4 comparisons"], "claim_boundary": "Retain any failure to realise the anticipated different point leaders; do not manufacture or silently rewrite it. These indices do not measure revenue or profit."},
        {"id": "M3", "tier": "mandatory", "proposition": "Close mid-price proxy leads are uncertain and sensitive to the predeclared variable-cost scenarios, so recommend further behavioural validation rather than a certain optimal price.", "evidence": ["Mid-price differences and pointwise confidence intervals", "Holm families P3/P4", "All three assumed costs"], "claim_boundary": "Not equivalence from a wide CI, no data-chosen cost scenario, no universally optimal point leader."},
        {"id": "M4", "tier": "mandatory", "proposition": "Price-related incomplete observation makes valid-case interest conditional; show conservative all-assigned sensitivity, missing-data ranges and fixed-weight denominators before generalising.", "evidence": ["Module exits and 97/98/99 by arm", "q_v and q_0", "Logical completion bounds", "Assigned/valid N, weighted N, Kish ESS"], "claim_boundary": "q_0 is a lower coding sensitivity for recorded positive intent, not observed rejection or a bound on sales. Baseline weights do not fix missingness."},
        {"id": "S1", "tier": "secondary", "proposition": "The prespecified time-pressed-family audience has higher stated interest at the same mid-price assignments, without establishing that children/time pressure causes that interest.", "evidence": ["Two fixed same-price group contrasts P5", "Baseline-derived groups and component bases"], "claim_boundary": "Do not turn an observational audience contrast into attribute causality or a proven subgroup price optimum."},
        {"id": "S2", "tier": "secondary", "proposition": "Value, affordability and intent show correlated diagnostic patterns; these support interpretation but not independently identified causal mechanisms.", "evidence": ["Weighted valid-pair correlations", "Ordinal diagnostic distributions by price"], "claim_boundary": "Price randomisation does not randomise perceived value, trust or affordability separately."},
        {"id": "S3", "tier": "secondary", "proposition": "Hypothetical use and certainty are selectively routed follow-ups, not independent evidence of actual uptake or all-household usage.", "evidence": ["P08/P10 route-eligible and valid bases", "P10 distribution with stated-intent route visible"], "claim_boundary": "Never generalise P10's frequency to all assigned households or treat hypothetical days as measured behaviour."},
        {"id": "R1", "tier": "do_not_elevate", "proposition": "An apparent largest proxy point estimate is not a certain economically optimal price.", "temptation": "Report a winner from unadjusted point ranking while omitting uncertainty or cost sensitivity.", "required_restraint": "Preserve candidate uncertainty and all fixed cost scenarios."},
        {"id": "R2", "tier": "do_not_elevate", "proposition": "Older comfortable households already paying for planning can look unusually interested but their price-specific cells are too small for rates or targeting claims.", "temptation": "Use a tiny premium subgroup to justify a high-price rollout.", "required_restraint": "Suppress each n<40 component rate/proxy/contrast. Do not rescue it with a pooled n across unlike prices."},
        {"id": "R3", "tier": "do_not_elevate", "proposition": "Stated intent and assumed-cost arithmetic establish neither actual demand nor sales, elasticity, uptake, profit, ROI or an effect on all UK households.", "temptation": "Treat top-two intent as conversion, supplied scenario costs as known business costs, or complete cases as complete population evidence.", "required_restraint": "Label the estimands and scenario assumptions; preserve randomisation and missingness limits."},
    ]
    return {
        "study_id": "SBT-006", "version": VERSION, "visibility": "PRIVATE AUTHOR AND INDEPENDENT VALIDATOR ONLY",
        "status": "Prospective candidate design; not independently validated, not a frozen reference key.",
        "fixed_seed": DEFAULT_SEED, "n": N_HOUSEHOLDS,
        "dgp": {
            "model": "Baseline heterogeneous households, balanced independent monadic assignment, continuous latent utility plus logistic ordinal-response noise, separate probabilistic module/item response.",
            "price_component": "-0.25*(price-4)*(1+0.15*I[budget=1]-0.08*I[budget=3]) in the private intent index.",
            "private_preference_component": "0.80*(true_time_pressed-.30)+0.55*(paid_planning-.12)+0.35*(comfortable-.20)-0.25*(tight_budget-.34)+0.40*z_need+0.20*z_tech+0.90*older_comfortable_paid.",
            "intent": "score=0.62+preference+price_component+Logistic(0,1); cut at [-1.50,-0.55,0,1.10] into codes 1..5. Positive intent is score>=0. Latent preference, score and propensities are NOT exported.",
            "monotonicity": "The individual latent price component declines with price. Realised arm summaries can deviate through sampling, varying composition and response selection; there is no row-level forced monotonicity across arms.",
            "module_exit": "logit Pr(reached)=3.70-.07*(price-4)-.35*true_time_pressed-.25*I[digital_true<=2]+.15*z_tech-.10*z_need.",
            "item_missingness": "Intent DK probability=.025+.006*(price-4)+.030*I[digital_true<=2]; refusal=.007+.012*I[tight_budget]; skipped=.008+.005*true_time_pressed. Codes are drawn, not overwritten to satisfy targets. Other items have modest separate DK/refusal/skipped processes.",
            "diagnostics": "Shared post-stimulus halo links expected value, fit, affordability, trust and other diagnostic ratings to private intent. No independent diagnostic intervention.",
            "small_group": "age>=55, comfortable budget, already paying for planning: moderate prevalence but very small within-price cells, plus higher private preference. This is intentionally tempting, not inferentially reliable.",
            "weights": "Six unequal-probability baseline strata with prespecified hypothetical sample and target shares; weights computed before independent price assignment. No outcome- or response-based calibration.",
            "routing": "Use observed intent codes for all routes. Missing intent does not receive conditional follow-ups. All module exits retain their baseline row and assignment.",
            "no_guarantee": "No acceptance loop, no sample replacement, no row edits, no seed selection, no guaranteed optimum. Threshold failures are reportable design failures.",
        },
        "reference_propositions": refs,
        "prospective_checks": [{"id": i, "metric": m, "lower_inclusive": lo, "upper_inclusive": hi, "reference": r, "policy": "Check first realised dataset once; retain failure."} for i, m, lo, hi, r in checks],
        "check_interpretation": "Effect checks test whether the author candidate supplies the intended benchmark challenge; passing is not model performance, independent validation or human endorsement. Qualitative boundaries R1/R3 and causal wording require independent review, not a fabricated automatic PASS.",
        "freeze_rules": ["Save original source, public definitions, hidden design and hashes before first execution.", "Keep every failed prospective check. Do not tune rows/seed/thresholds after seeing outputs.", "If a future revised candidate is necessary, preserve this candidate and version the revision explicitly before a new execution.", "Codex must independently derive numbers and audit formulas/routes/traps before freezing reference values and exposing evaluated models.", "Human validation remains a separate gate; a software/author-check PASS does not substitute for it."],
        "public_exposure_allowlist": ["respondents.csv", "codebook.json", "questionnaire.md", "study_materials.json"],
        "never_expose_to_evaluated_model": ["generate_sbt006.py", "hidden_design.json", "pre_execution", "author_checks", "STORY_AND_VALIDATION.md", "source ZIP"],
    }


def derive_audience(children: np.ndarray, pressure: np.ndarray) -> np.ndarray:
    """Deterministic derivation from OBSERVED baseline answers; unknown stays unknown."""
    result = np.full(len(children), 97, dtype=int)
    result[children == 0] = 0
    result[(children == 1) & np.isin(pressure, [1, 2, 3])] = 0
    result[(children == 1) & np.isin(pressure, [4, 5])] = 1
    return result


def ordinal(x: np.ndarray, cuts: tuple[float, ...] = (-1.25, -.45, .25, 1.05)) -> np.ndarray:
    return np.digitize(x, cuts).astype(int) + 1


def mask_answers(values: np.ndarray, eligible: np.ndarray, rng: np.random.Generator,
                 dk: float | np.ndarray, refusal: float | np.ndarray, skipped: float | np.ndarray = 0) -> np.ndarray:
    """Measurement/nonresponse process, not a data repair or result-conditioned edit."""
    u = rng.random(len(values))
    dk_a, rf_a, sk_a = (np.broadcast_to(np.asarray(t, dtype=float), (len(values),)) for t in (dk, refusal, skipped))
    if np.any(dk_a < 0) or np.any(rf_a < 0) or np.any(sk_a < 0) or np.any(dk_a + rf_a + sk_a >= 1):
        raise ValueError("Missingness probabilities must be nonnegative with sum <1.")
    measured = np.select([u < dk_a, u < dk_a + rf_a, u < dk_a + rf_a + sk_a], [97, 98, 99], default=values).astype(float)
    return np.where(eligible, measured, np.nan)


def categorical_rows(rng: np.random.Generator, probabilities: np.ndarray) -> np.ndarray:
    """Return zero-based draws from one categorical distribution per row."""
    pr = np.asarray(probabilities, dtype=float)
    if pr.ndim != 2 or not np.allclose(pr.sum(axis=1), 1) or np.any(pr < 0):
        raise ValueError("Invalid categorical probability matrix.")
    return (rng.random(len(pr))[:, None] > np.cumsum(pr, axis=1)).sum(axis=1)


def generate_respondents(seed: int = DEFAULT_SEED) -> pd.DataFrame:
    streams = [np.random.default_rng(s) for s in np.random.SeedSequence(seed).spawn(7)]
    rb, rm, ra, ri, rd, rr, rq = streams  # baseline, baseline missing, assignment, intent, diagnostics, response, routed
    n = N_HOUSEHOLDS
    all_eligible = np.ones(n, dtype=bool)
    sh = rb.choice(np.arange(1, 7), size=n, p=[s["sample_share"] for s in STRATA])
    children = np.array([STRATA[h - 1]["children"] for h in sh], dtype=int)
    budget = np.array([STRATA[h - 1]["budget"] for h in sh], dtype=int)
    age_probs = np.where(children[:, None] == 1, np.array([.31, .57, .10, .02]), np.array([.27, .31, .23, .19]))
    age = categorical_rows(rb, age_probs) + 1
    household_size = np.where(children == 1, np.where(rb.random(n) < .35, 3, 4), np.where(rb.random(n) < .40, 1, 2))
    role = np.where(rb.random(n) < .62, 1, 2)
    z_need = rb.normal(0, 1, n) + .30 * children + .20 * (budget == 1)
    z_tech = rb.normal(0, 1, n)
    pressure_true = ordinal(.10 + .80 * children + .25 * (budget == 1) + .70 * z_need + rb.normal(0, 1, n))
    p_paid = .035 + .30 * (budget == 3) + .04 * children
    paid = rb.random(n) < p_paid
    otherwise = rb.choice([1, 2, 3, 5], size=n, p=[.38, .30, .22, .10])
    method = np.where(paid, 4, otherwise)
    digital_true = ordinal(.35 + .60 * paid + .30 * (age == 1) + .65 * z_tech + rb.normal(0, .60, n))
    plan_probability = 1 / (1 + np.exp(-(.10 - .28 * (pressure_true - 3) + .25 * paid + .15 * z_need)))
    plan_days = rb.binomial(7, plan_probability)
    spend_score = .25 + .80 * paid + .45 * (budget == 3) + rb.normal(0, 1, n)
    spend_band = np.digitize(spend_score, [-.70, .40, 1.40])
    pressure = mask_answers(pressure_true, all_eligible, rm, .015, .008).astype(int)
    digital = mask_answers(digital_true, all_eligible, rm, .012, .006).astype(int)
    planned = mask_answers(plan_days, all_eligible, rm, .022, .008).astype(int)
    spend = mask_answers(spend_band, all_eligible, rm, .020, .025).astype(int)
    audience = derive_audience(children, pressure)
    true_pressed = (children == 1) & (pressure_true >= 4)
    older_paid = (age >= 3) & (budget == 3) & paid

    # These weights are finished BEFORE the independent random allocation.
    raw_w = np.array([STRATA[h - 1]["target_share"] / STRATA[h - 1]["sample_share"] for h in sh])
    weights = raw_w * (n / raw_w.sum())
    arm = ra.permutation(np.repeat(np.arange(1, 5), n // 4))
    price = np.take(np.array(PRICES), arm - 1)

    preference = (.80 * (true_pressed.astype(float) - .30) + .55 * (paid.astype(float) - .12)
                  + .35 * ((budget == 3).astype(float) - .20) - .25 * ((budget == 1).astype(float) - .34)
                  + .40 * z_need + .20 * z_tech + .90 * older_paid)
    price_component = -.25 * (price - 4) * (1 + .15 * (budget == 1) - .08 * (budget == 3))
    core = .62 + preference + price_component
    intent_score = core + ri.logistic(0, 1, n)
    intent_true = ordinal(intent_score, (-1.50, -.55, 0.0, 1.10))
    p_reached = 1 / (1 + np.exp(-(3.70 - .07 * (price - 4) - .35 * true_pressed
                                  - .25 * (digital_true <= 2) + .15 * z_tech - .10 * z_need)))
    reached = rr.random(n) < p_reached
    intent = mask_answers(intent_true, reached, rr, .025 + .006 * (price - 4) + .030 * (digital_true <= 2),
                          .007 + .012 * (budget == 1), .008 + .005 * true_pressed)

    halo = .45 * intent_score + rd.normal(0, .50, n)
    post_latent = {
        "value_5": .90 - .10 * (price - 4) + .60 * preference + .65 * halo + rd.normal(0, .65, n),
        "fit_5": .20 + .70 * preference + .38 * halo + rd.normal(0, .65, n),
        "affordability_5": 1.15 - .15 * (price - 4) + .45 * (budget == 3) - .40 * (budget == 1) + .32 * halo + rd.normal(0, .65, n),
        "ease_5": .55 + .45 * z_tech + .22 * halo + rd.normal(0, .60, n),
        "trust_5": .45 + .25 * z_tech + .25 * halo + rd.normal(0, .70, n),
        "differentiation_5": .35 * z_need + .20 * paid + .15 * halo + rd.normal(0, .90, n),
    }
    diagnostics = {k: mask_answers(ordinal(x), reached, rr, .025 + .008 * (digital_true <= 2) + .008 * (intent_true == 3), .004, .005) for k, x in post_latent.items()}
    intent_valid = np.isin(intent, [1, 2, 3, 4, 5])
    certainty = mask_answers(ordinal(.60 + .50 * np.abs(intent_score) + rq.normal(0, .90, n)), reached & intent_valid, rq, .020, .004, .005)
    # A single-response goal question, not an exclusive latent segmentation.
    goal_scores = np.column_stack([
        -.50 - .20 * preference,
        .30 + .75 * true_pressed,
        .20 + .70 * (budget == 1),
        .10 + .25 * z_need,
        .00 + .30 * (budget == 3),
    ])
    goal_pr = np.exp(goal_scores - goal_scores.max(axis=1, keepdims=True))
    goal_pr /= goal_pr.sum(axis=1, keepdims=True)
    goal = mask_answers(categorical_rows(rq, goal_pr), reached, rq, .015, .003, .006)
    expected_use_prob = 1 / (1 + np.exp(-(-.15 + .30 * (intent_true - 3) + .35 * true_pressed + .12 * z_need)))
    expected_use = mask_answers(rq.binomial(7, expected_use_prob), reached & np.isin(intent, [3, 4, 5]), rq, .040, .007, .010)
    reason_scores = np.column_stack([
        .00 + .12 * (price - 4) + .40 * (budget == 1),
        .10 + .45 * (method == 3),
        .00 - .35 * preference,
        -.60 - .15 * z_tech,
        -.25 + .25 * true_pressed,
        np.full(n, -.90),
    ])
    reason_pr = np.exp(reason_scores - reason_scores.max(axis=1, keepdims=True))
    reason_pr /= reason_pr.sum(axis=1, keepdims=True)
    reason = mask_answers(categorical_rows(rq, reason_pr) + 1, reached & np.isin(intent, [1, 2, 3]), rq, .030, .006, .008)

    df = pd.DataFrame({
        "respondent_id": [f"SBT006_{i + 1:04d}" for i in range(n)],
        "age_band": age, "household_children": children, "budget_band": budget,
        "meal_planning_role": role, "weekday_time_pressure_5": pressure,
        "current_planning_method": method, "digital_confidence_5": digital,
        "plan_ahead_days_7": planned, "subscription_spend_band": spend,
        "household_size_band": household_size, "design_stratum": sh, "wt_design": weights,
        "assigned_price_arm": arm, "assigned_price_gbp": price, "postprice_responded": reached.astype(int),
        "intent_5": intent, **diagnostics, "certainty_5": certainty, "primary_use_goal": goal,
        "anticipated_use_days_7": expected_use, "reason_not_commit": reason,
        "time_pressed_family": audience,
    })
    expected_columns = [v["name"] for v in make_codebook()["variables"]]
    if list(df.columns) != expected_columns:
        raise RuntimeError("Generator and codebook column orders differ.")
    # Nullable integers preserve literal numeric codes and genuine empty fields.
    for v in make_codebook()["variables"]:
        if v["storage"] == "integer":
            df[v["name"]] = pd.array(df[v["name"]], dtype="Int64")
    return df


def write_study(out: Path, seed: int = DEFAULT_SEED) -> dict[str, str]:
    out = Path(out)
    names = ["respondents.csv", "codebook.json", "questionnaire.md", "study_materials.json", "hidden_design.json"]
    if out.exists() and not out.is_dir():
        raise ValueError(f"Output path is not a directory: {out}")
    existing = [name for name in names if (out / name).exists()]
    if existing:
        raise FileExistsError("Refusing to overwrite study files; use a new output directory: " + ", ".join(existing))
    if seed < 0 or seed >= 2**64:
        raise ValueError("Seed must be an integer in [0, 2**64).")
    out.mkdir(parents=True, exist_ok=True)
    df = generate_respondents(seed)
    df.to_csv(out / "respondents.csv", index=False, encoding="utf-8", na_rep="", float_format="%.15g", lineterminator="\n")
    (out / "codebook.json").write_bytes(json_bytes(make_codebook()))
    (out / "questionnaire.md").write_bytes(QUESTIONNAIRE.encode("utf-8"))
    (out / "study_materials.json").write_bytes(json_bytes(make_study_materials(seed)))
    hidden = make_hidden_design()
    hidden["executed_seed"] = int(seed)
    hidden["seed_note"] = "Canonical prospective checks apply to the declared default seed; other seeds are new, unfrozen draws, not a seed search."
    (out / "hidden_design.json").write_bytes(json_bytes(hidden))
    return {name: digest_bytes((out / name).read_bytes()) for name in names}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="New/empty output directory; existing study files are never overwritten.")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()
    try:
        hashes = write_study(args.out, args.seed)
    except (ValueError, FileExistsError, OSError) as exc:
        parser.exit(2, f"error: {exc}\n")
    print(json.dumps({"status": "generated_not_independently_validated", "study": "SBT-006", "seed": args.seed,
                      "n": N_HOUSEHOLDS, "public_columns": len(make_codebook()["variables"]),
                      "output_dir": str(args.out), "sha256": hashes,
                      "private_file": "hidden_design.json; never include source/hidden design in evaluated-model inputs"}, indent=2))


if __name__ == "__main__":
    main()
