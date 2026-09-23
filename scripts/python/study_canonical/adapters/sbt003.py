"""SBT-003 Northline customer experience diagnostic.

The source questionnaire is a one-paragraph summary: it gives no item wording and no
scale end-point labels. Wording here is authored from that summary and marked
text_source="authored"; treat it as a placeholder, not a fielded questionnaire.
"""
from __future__ import annotations
import json
import pandas as pd
from .common import proj, sources, study_record, var, scale_meta, recode_text, binary_values

SID = "SBT-003"
SAT = ("Very dissatisfied", "Very satisfied")
S5 = {
    "overall_satisfaction_5": ("Q2", "Overall satisfaction", "Overall, how satisfied are you with Northline?", *SAT, "core", None, None),
    "renewal_intent_5": ("Q3", "Likelihood to stay at end of agreement", "How likely are you to stay with Northline when your current agreement ends?", "Very unlikely", "Very likely", "core", None, None),
    "reliability_5": ("D1", "Reliability", "How would you rate Northline on the reliability of your connection?", "Very poor", "Very good", "diagnostic", "diagnostics", None),
    "value_5": ("D2", "Value for money", "How would you rate Northline on value for money?", "Very poor", "Very good", "diagnostic", "diagnostics", None),
    "ease_5": ("D3", "Ease of dealing with Northline", "How would you rate Northline on how easy it is to deal with?", "Very poor", "Very good", "diagnostic", "diagnostics", None),
    "trust_5": ("D4", "Trust", "How would you rate Northline on how much you trust it?", "Very poor", "Very good", "diagnostic", "diagnostics", None),
    "outage_severity_5": ("I1a", "Severity of outage", "How much did the outage affect your household?", "Not at all", "A great deal", "core", None, ("outage_90d == 1", "Had an outage in past 90 days")),
    "support_quality_5": ("I2b", "Support quality", "How would you rate the quality of the support you received?", "Very poor", "Very good", "core", None, ("support_contact_90d == 1", "Contacted support in past 90 days")),
}
BIN = {
    "legacy_plan": ("ADMIN", "On a legacy plan (administrative flag)", "Administrative record: customer is on a legacy plan", "profile", None),
    "outage_90d": ("I1", "Outage in past 90 days", "Have you experienced a broadband outage in the past 90 days?", "core", None),
    "support_contact_90d": ("I2", "Contacted support in past 90 days", "Have you contacted Northline customer support in the past 90 days?", "core", None),
    "resolved_first_contact": ("I2c", "Resolved at first contact", "Was your issue resolved the first time you contacted Northline?", "core", ("support_contact_90d == 1", "Contacted support in past 90 days")),
    "formal_complaint_90d": ("I3", "Formal complaint in past 90 days", "Have you made a formal complaint to Northline in the past 90 days?", "core", None),
}
TEXT = {
    "tenure_band": ("P1", "Tenure", ["<1y", "1-2y", "3-5y", "6+y"], {}, "profile", "ordinal", None, {"<1y": "Under 1 year", "1-2y": "1-2 years", "3-5y": "3-5 years", "6+y": "6 years or more"}),
    "plan_tier": ("P2", "Plan tier", ["Essential", "Standard", "Premium"], {}, "profile", "ordinal", None, {}),
    "region": ("P3", "Nation", ["England", "Scotland", "Wales", "Northern Ireland"], {}, "profile", "single", None, {}),
    "household_type": ("P4", "Household type", ["Single adult", "Adults only", "With children"], {}, "profile", "single", None, {"Adults only": "Two or more adults, no children", "With children": "With children"}),
    "support_channel": ("I2a", "Support channel used", ["Phone", "Chat", "Email"], {"Not asked": None}, "core", "single", ("support_contact_90d == 1", "Contacted support in past 90 days"), {}),
}


def build(root):
    p = proj(root, SID)
    sm = json.loads((p / "model_inputs/study_materials.json").read_text())
    src = pd.read_csv(p / "model_inputs/respondents.csv")
    df = pd.DataFrame(index=src.index); vs = []
    for c in src.columns:
        if c == "respondent_id":
            df[c] = src[c]; vs.append(var(c, "Respondent ID", "identifier", "admin")); continue
        if c == "wt_final":
            df[c] = src[c]; vs.append(var(c, "Final weight", "weight", "weight")); continue
        if c == "nps_0_10":
            df[c] = src[c].astype(float)
            vals = [(i, "Not at all likely" if i == 0 else "Extremely likely" if i == 10 else str(i)) for i in range(11)]
            vs.append(var(c, "Likelihood to recommend (0-10)", "scale", "core", question_id="Q1", text_source="authored",
                          question_text="How likely are you to recommend Northline to a friend or family member?", values=vals,
                          scale=scale_meta(range(11), "Not at all likely", "Extremely likely", top=[9, 10], bottom=list(range(7))),
                          derivation="NPS = weighted % 9-10 minus % 0-6")); continue
        if c in S5:
            qid, lab, q, lo, hi, role, set_id, uni = S5[c]
            vals = [(i, lo if i == 1 else hi if i == 5 else str(i)) for i in range(1, 6)]
            df[c] = src[c].astype(float)
            vs.append(var(c, lab, "scale", role, question_id=qid, question_text=q, text_source="authored", values=vals,
                          scale=scale_meta(range(1, 6), lo, hi), set_id=set_id, universe=uni[0] if uni else None,
                          universe_text=uni[1] if uni else "All respondents")); continue
        if c in BIN:
            qid, lab, q, role, uni = BIN[c]
            df[c] = src[c].astype(float)
            vs.append(var(c, lab, "binary", role, question_id=qid, question_text=q, text_source="authored", values=binary_values(),
                          universe=uni[0] if uni else None, universe_text=uni[1] if uni else "All respondents")); continue
        if c in TEXT:
            qid, lab, order, special, role, vt, uni, fix = TEXT[c]
            df[c], rec = recode_text(src[c], order, special)
            vs.append(var(c, lab, vt, role, question_id=qid, question_text=lab, text_source="authored",
                          values=[(i, fix.get(t, t)) for i, t in enumerate(order, 1)], recode=rec,
                          universe=uni[0] if uni else None, universe_text=uni[1] if uni else "All respondents")); continue
        raise ValueError(f"unmapped column {c}")
    sets = [{"id": "diagnostics", "type": "battery", "label": "Experience diagnostics", "question_id": "D1-D4",
             "question_text": "How would you rate Northline on each of the following?", "members": ["reliability_5", "value_5", "ease_5", "trust_5"]}]
    study = study_record(
        study_id=SID, title=sm["title"], archetype="cx_diagnostic",
        design={"type": sm["design"]["type"], "n": len(df)}, brief=None, decision_question=sm["decision_question"],
        population="Current UK Northline residential broadband customers", waves=None, weight="wt_final",
        id_variable="respondent_id", wave_variable=None, variables=vs, sets=sets,
        banner_candidates=["tenure_band", "plan_tier", "legacy_plan", "household_type", "outage_90d", "support_contact_90d"],
        analysis_policy=sm.get("analysis_policy"),
        provenance={"adapter": "sbt003", "sources": sources(root, SID, ["model_inputs/codebook.json", "model_inputs/respondents.csv",
                                                                          "model_inputs/study_materials.json", "questionnaire.md"])},
        conversion_notes=["Question wording and scale end points are AUTHORED from a one-paragraph summary; the source has no item wording.",
                          "support_channel 'Not asked' (a text value in the source) recoded to system-missing.",
                          "resolved_first_contact stored as 0.0/1.0 floats in the source; now 0/1 codes."],
    )
    return df, study
