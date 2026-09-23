"""SBT-006 PantryPace monadic stated-intent pricing test."""
from __future__ import annotations
import json
import pandas as pd
from .common import proj, sources, study_record
from .rich import make_var

SID = "SBT-006"
BATTERY = ["value_5", "fit_5", "affordability_5", "ease_5", "trust_5", "differentiation_5"]


def route_expr(r):
    t = r.get("type")
    if t == "all_assigned": return None
    if t == "equals": return f"{r['field']} == {r['value']}"
    if t == "in": return f"{r['field']} in {list(r['values'])}"
    if t == "all_of": return " and ".join(f"({route_expr(c)})" for c in r["conditions"])
    raise ValueError(f"unknown route type {t}")


def build(root):
    p = proj(root, SID)
    cb = json.loads((p / "model_inputs/codebook.json").read_text())
    sm = json.loads((p / "model_inputs/study_materials.json").read_text())
    df = pd.read_csv(p / "model_inputs/respondents.csv")
    vs = []
    for v in cb["variables"]:
        n = v["name"]; q = v["question_id"]
        role = ("admin" if q.startswith("ADMIN") and n != "wt_design" else "weight" if n == "wt_design" else "design" if q.startswith("RAND")
                else "profile" if q.startswith("B") else "derived" if q.startswith("DERIVED") else "core")
        vtype = {"respondent_id": "identifier", "wt_design": "weight", "anticipated_use_days_7": "count", "plan_ahead_days_7": "count",
                 "assigned_price_gbp": "ordinal", "assigned_price_arm": "single", "design_stratum": "single"}.get(n)
        codes = dict(v.get("codes") or {})
        if n == "assigned_price_gbp": codes = {k: f"£{k}" for k in codes}
        if vtype == "count": codes = {}
        vs.append(make_var(n, q, v["label"], codes, v.get("missing_values"), role, route_expr(v["route"]), v["route"].get("text"),
                           set_id="post_price_evaluation" if n in BATTERY else None, vtype=vtype,
                           derivation=json.dumps(v["derivation"]) if v.get("derivation") else None,
                           notes=v.get("note") or v.get("definition")))
    sets = [{"id": "post_price_evaluation", "type": "battery", "label": "Evaluation at the shown price", "question_id": "P02-P07",
             "question_text": "Thinking about the service at the monthly price shown, how would you rate it on each of the following?",
             "members": BATTERY}]
    study = study_record(
        study_id=SID, title=sm["title"], archetype="pricing",
        design={"type": sm["design"]["type"], "n": len(df), "price_levels_gbp": sm["design"]["price_levels_gbp"]},
        brief=sm["brief"], decision_question=sm["decision_question"], population=sm["population"],
        waves=None, weight="wt_design", id_variable="respondent_id", wave_variable=None,
        variables=vs, sets=sets, banner_candidates=["assigned_price_gbp", "age_band", "household_children", "budget_band", "time_pressed_family"],
        provenance={"adapter": "sbt006", "sources": sources(root, SID, ["model_inputs/codebook.json", "model_inputs/respondents.csv",
                                                                          "model_inputs/study_materials.json", "questionnaire.md"])},
        conversion_notes=["Source missing codes already match the canonical convention; values unchanged.",
                          "Structured route objects converted to executable universe expressions.",
                          "Battery stem for P02-P07 authored (source has item labels only)."],
    )
    for x in study["variables"]:
        if x["set"] == "post_price_evaluation": x["text_source"] = "codebook (stem authored)"
    return df, study
