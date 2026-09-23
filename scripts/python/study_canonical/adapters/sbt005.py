"""SBT-005 BasketBridge campaign-assignment evaluation (randomised, baseline + follow-up)."""
from __future__ import annotations
import json, re
import pandas as pd
from .common import proj, sources, study_record
from .rich import make_var

SID = "SBT-005"
DESIGN = {"assignment", "followup_status", "followup_attempts", "receipt_log", "receipt_count"}
PROFILE = {"age_band", "children_under18", "work_pattern", "online_grocery_pre", "digital_confidence_pre", "budget_pressure_pre", "mealplan_days_pre"}
PAIRS = ["awareness", "consideration", "usage", "meal_stress"]
TYPES = {"followup_attempts": "count", "receipt_count": "count", "mealplan_days_pre": "count", "usage_days_post": "count",
         "digital_confidence_pre": "scale", "budget_pressure_pre": "scale", "consideration_pre": "scale", "consideration_post": "scale",
         "meal_stress_pre": "scale", "meal_stress_post": "scale", "campaign_clear_post": "scale", "campaign_relevant_post": "scale",
         "campaign_trust_post": "scale", "satisfaction_post": "scale", "planning_confidence_post": "scale", "assignment": "single"}


def route_expr(route: str):
    if not route or route.lower().startswith("all"): return None
    e = route.replace(" AND ", " and ").replace(" OR ", " or ")
    if not re.fullmatch(r"[\w\s=<>!.\[\],]+", e): raise ValueError(f"unparsed route: {route}")
    return e


def build(root):
    p = proj(root, SID)
    cb = json.loads((p / "model_inputs/codebook.json").read_text())
    sm = json.loads((p / "model_inputs/study_materials.json").read_text())
    df = pd.read_csv(p / "model_inputs/respondents.csv")
    vs = []
    for v in cb["variables"]:
        n = v["name"]
        role = ("admin" if n == "respondent_id" else "weight" if n == "weight_base" else "design" if n in DESIGN
                else "profile" if n in PROFILE else "core")
        vtype = {"respondent_id": "identifier", "weight_base": "weight"}.get(n, TYPES.get(n))
        set_id = next((f"pair_{k}" for k in PAIRS if n in (f"{k}_pre", f"{k}_post")), None)
        if n in ("campaign_clear_post", "campaign_relevant_post", "campaign_trust_post"): set_id = "campaign_diagnostics"
        codes = v.get("value_labels") or {}
        if vtype == "count": codes = {}  # plain numbers; labels would just repeat the number
        vs.append(make_var(n, v["question_id"], v["label"], codes, v.get("missing_codes"), role,
                           route_expr(v.get("route", "")), v.get("route", "All respondents"), set_id=set_id,
                           vtype=vtype, notes=v.get("notes") or None, waves=[v["wave"]] if v.get("wave") else None))
    sets = [{"id": f"pair_{k}", "type": "paired_measure", "label": f"{k.replace('_', ' ').capitalize()} before and after",
             "members": [f"{k}_pre", f"{k}_post"], "dims": {"time": ["baseline", "followup"]}} for k in PAIRS]
    sets.append({"id": "campaign_diagnostics", "type": "battery", "label": "Campaign message diagnostics", "question_id": "Q9-Q11",
                 "question_text": "How much do you agree or disagree with each statement about the campaign?",
                 "members": ["campaign_clear_post", "campaign_relevant_post", "campaign_trust_post"]})
    brief = sm["public_brief"]
    study = study_record(
        study_id=SID, title=sm["title"], archetype="campaign_evaluation",
        design={"type": sm["design"]["design_type"], "n": len(df), "arms": {"0": "Usual communications (control)", "1": "Campaign invitation"}},
        brief=json.dumps(brief) if not isinstance(brief, str) else brief, decision_question=brief.get("decision_question") if isinstance(brief, dict) else None,
        population=sm.get("sampling", {}).get("population") if isinstance(sm.get("sampling"), dict) else None,
        waves=[{"id": "baseline", "label": "Baseline (day 0)"}, {"id": "followup", "label": "Follow-up (six weeks)"}],
        weight="weight_base", id_variable="respondent_id", wave_variable=None,
        variables=vs, sets=sets, banner_candidates=["assignment", "age_band", "children_under18", "work_pattern", "online_grocery_pre"],
        provenance={"adapter": "sbt005", "sources": sources(root, SID, ["model_inputs/codebook.json", "model_inputs/respondents.csv",
                                                                          "model_inputs/study_materials.json", "questionnaire.md"])},
        conversion_notes=["Source missing codes already match the canonical convention; values unchanged.",
                          "Baseline and follow-up are columns in one row per household (wide), linked by *_pre/*_post pairs.",
                          "Route strings converted to executable universe expressions (AND -> and)."],
    )
    return df, study
