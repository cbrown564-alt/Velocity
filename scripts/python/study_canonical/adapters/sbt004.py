"""SBT-004 PantryWorks household grocery and meal-planning needs (usage and attitudes)."""
from __future__ import annotations
import json
import pandas as pd
from .common import proj, sources, study_record
from .rich import make_var

SID = "SBT-004"
ROLE = {"identifier": "admin", "weight": "weight", "sample_profile": "profile", "observed": "core"}
STEMS = {
    "attitudes": ("A1-A9", "How much do you agree or disagree with each statement?"),
    "needs": ("N1", "Which tasks, if any, would you like more help with? Select all that apply."),
    "barriers": ("N2", "What, if anything, would make it difficult to start using a digital grocery/meal-planning helper, "
                       "or to use one more often? Select all that apply."),
}


def build(root):
    p = proj(root, SID)
    cb = json.loads((p / "model_inputs/codebook.json").read_text())
    sm = json.loads((p / "model_inputs/study_materials.json").read_text())
    df = pd.read_csv(p / "model_inputs/respondents.csv")
    vs = []
    for v in cb["variables"]:
        n = v["name"]; role_src = v.get("role", "observed")
        role = "derived" if role_src.startswith("derived") else ROLE.get(role_src, "core")
        vtype = "identifier" if role_src == "identifier" else ("weight" if n == "wt_final" else None)
        if n.endswith("_block_status"): role = "admin"
        set_id = "attitudes" if n.startswith("att_") else ("needs" if n.startswith("support_") else ("barriers" if n.startswith("barrier_") else None))
        qtext = f"{STEMS[set_id][1]} — {v['label']}" if set_id else v["label"]
        uexpr, utext = None, v.get("universe", "All respondents")
        if n in ("tool_satisfaction_5", "shared_list_use_28d"):
            uexpr, utext = "planning_tool_28d in [1, 2, 3]", "Used a digital planning tool in the past 28 days (U1 = 1, 2 or 3)"
        deriv = json.dumps(v["derivation"]) if v.get("derivation") else None
        vs.append(make_var(n, v["question_id"], v["label"], v.get("codes"), v.get("missing_codes"), role if vtype != "weight" else "weight",
                           uexpr, utext, question_text=qtext, set_id=set_id, derivation=deriv, vtype=vtype,
                           notes=v.get("clarification")))
    for x in vs:
        if x["name"] == "wt_final": x["type"], x["measure"], x["role"] = "weight", "scale", "weight"
    sets = [
        {"id": "attitudes", "type": "battery", "label": "Attitudes to meal planning", "question_id": STEMS["attitudes"][0],
         "question_text": STEMS["attitudes"][1], "members": [c for c in df.columns if c.startswith("att_")]},
        {"id": "needs", "type": "multi_response", "label": "Tasks wanting more help with", "question_id": "N1",
         "question_text": STEMS["needs"][1], "members": [c for c in df.columns if c.startswith("support_")],
         "status_variable": "needs_block_status", "base": "Answered the block (status = 1); percentages of respondents"},
        {"id": "barriers", "type": "multi_response", "label": "Barriers to using a digital helper", "question_id": "N2",
         "question_text": STEMS["barriers"][1], "members": [c for c in df.columns if c.startswith("barrier_")],
         "status_variable": "barriers_block_status", "base": "Answered the block (status = 1); percentages of respondents"},
    ]
    study = study_record(
        study_id=SID, title=sm["title"], archetype="usage_attitudes",
        design={"type": "cross_sectional_usage_and_attitudes", "n": len(df)},
        brief=sm["brief"], decision_question=sm["decision_question"], population=sm["population"],
        waves=None, weight="wt_final", id_variable="respondent_id", wave_variable=None,
        variables=vs, sets=sets,
        banner_candidates=["age_band", "children_u16", "work_hours_band", "planning_tool_28d"],
        provenance={"adapter": "sbt004", "sources": sources(root, SID, ["model_inputs/codebook.json", "model_inputs/respondents.csv",
                                                                          "model_inputs/study_materials.json", "questionnaire.md"])},
        conversion_notes=["Source missing codes already match the canonical convention (97 DK, 98 refused, 99 not derivable, blank = not asked); values unchanged.",
                          "Question text for items is the codebook statement with the block stem prefixed."],
    )
    return df, study
