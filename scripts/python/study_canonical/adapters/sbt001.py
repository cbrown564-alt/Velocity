"""SBT-001 UK mobile-network brand tracker, five waves (stacked).

The source CSVs are generated (gitignored) by scripts/python/synthetic_tracker/generate_sbt001.py.
This adapter refuses to run unless their hashes match hidden/validation_report.json,
so canonical files always derive from the validated v2 materialisation.

Missing-code translation (the one study whose codes differ in meaning):
  source 97 structural/not asked -> system-missing
  source 98 don't know           -> 97
  source 99 refused              -> 98
"""
from __future__ import annotations
import json
import pandas as pd
from .common import proj, sources, study_record, var, scale_meta, recode_text, binary_values, sha256

SID = "SBT-001"
BRANDS = ["northstar", "pulse", "mosaic", "lumen", "harbour"]
BNAME = {b: b.capitalize() for b in BRANDS}
ATTR = {"reliable": "Reliable network", "value": "Good value for money", "innovative": "Innovative", "trust": "A brand I trust",
        "customer_service": "Good customer service", "premium": "Premium", "environmental": "Environmentally responsible",
        "people_like_me": "For people like me"}
SRC_MISSING = {97: None, 98: 97, 99: 98}
TRACKED = "S8_current_provider in [1, 2, 3, 4, 5]"
TEXT = {
    "S1_age": ("S1", "Age band", "ordinal", ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"], {}),
    "S2_gender": ("S2", "Gender", "single", ["Man", "Woman", "Non-binary/another identity"], {"Prefer not to say": 98}),
    "S3_region": ("S3", "Region", "single", ["London", "South East", "South West", "East", "Midlands", "North", "Wales", "Scotland", "Northern Ireland"], {}),
    "S5_income": ("S5", "Household income", "ordinal", ["<£20k", "£20-39k", "£40-59k", "£60-99k", "£100k+"], {"Prefer not to say": 98}),
    "S4_employment": ("S4", "Employment status", "single", ["Full-time", "Part-time", "Self-employed", "Student", "Not working", "Retired", "Other"], {}),
    "S6_decision_role": ("S6", "Decision role for personal mobile service", "single", ["Sole", "Shared"], {}),
    "S7_contract_type": ("S7", "Contract type", "single", ["SIM-only", "Handset contract", "PAYG", "Other"], {}),
    "S8_current_provider": ("S8", "Current provider", "single", BRANDS + ["other"], {}),
    "S9_provider_tenure": ("S9", "Provider tenure", "ordinal", ["<1 year", "1-2 years", "3-4 years", "5+ years"], {}),
    "F3_preference": ("F3", "Most preferred brand", "single", BRANDS, {}),
    "O1_reason_code": ("O1", "Main reason for preferring brand (coded)", "single",
                       ["network_quality", "price", "service", "trust", "innovation", "habit", "recommendation", "other"], {}),
}
PRETTY = {"northstar": "Northstar", "pulse": "Pulse", "mosaic": "Mosaic", "lumen": "Lumen", "harbour": "Harbour", "other": "Other provider",
          "Sole": "Sole decision maker", "Shared": "Share the decision", "<1 year": "Less than 1 year", "network_quality": "Network quality",
          "price": "Price", "service": "Customer service", "trust": "Trust", "innovation": "Innovation", "habit": "Habit / familiarity",
          "recommendation": "Recommendation", "Non-binary/another identity": "Non-binary or another identity",
          "<£20k": "Under £20k", "£100k+": "£100k or more"}
QTEXT = {
    "S1_age": "Age", "S2_gender": "Gender", "S3_region": "Region", "S4_employment": "Employment status", "S5_income": "Household income",
    "S6_decision_role": "Who decides on your personal mobile service?", "S7_contract_type": "What type of mobile contract do you have?",
    "S8_current_provider": "Which network provides your personal mobile service?", "S9_provider_tenure": "How long have you been with your current provider?",
    "F3_preference": "Which one brand would you most prefer to use?", "O1_reason_code": "What is the main reason you prefer this brand? (open end, coded)",
}


def _check_materialisation(p):
    rep = json.loads((p / "hidden/validation_report.json").read_text())
    for w in range(1, 6):
        f = p / "raw" / f"wave_{w:02d}.csv"
        if not f.exists():
            raise FileNotFoundError(f"{f} missing: run scripts/python/synthetic_tracker/generate_sbt001.py first")
        if sha256(f) != rep["canonicalSha256"][str(w)]:
            raise ValueError(f"{f.name} does not match the validated v2 hash; regenerate before converting")
    return rep


def build(root):
    p = proj(root, SID)
    rep = _check_materialisation(p)
    src = pd.concat([pd.read_csv(p / "raw" / f"wave_{w:02d}.csv") for w in range(1, 6)], ignore_index=True)
    df = pd.DataFrame(index=src.index); vs = []; unexpected = {}
    for c in src.columns:
        if c == "respondent_id":
            df[c] = src[c]; vs.append(var(c, "Respondent ID", "identifier", "admin")); continue
        if c == "wave":
            df[c] = src[c].astype(float)
            vs.append(var(c, "Tracking wave", "ordinal", "design", question_id="WAVE", values=[(w, f"Wave {w}") for w in range(1, 6)])); continue
        if c == "wt_final":
            df[c] = src[c]; vs.append(var(c, "Final weight (rim, within wave)", "weight", "weight")); continue
        if c in TEXT:
            qid, lab, vt, order, special = TEXT[c]
            df[c], rec = recode_text(src[c], order, special)
            vs.append(var(c, lab, vt, "screener" if c.startswith("S") else "core", question_id=qid, question_text=QTEXT[c], text_source="questionnaire",
                          values=[(i, PRETTY.get(t, t)) for i, t in enumerate(order, 1)], missing=sorted(set(special.values())), recode=rec)); continue
        # numeric-coded source columns: translate missing codes
        s = src[c]
        present = sorted(set(s.dropna().unique()) & set(SRC_MISSING))
        df[c] = s.astype(float).copy()
        for m in present:
            df.loc[s == m, c] = float("nan") if SRC_MISSING[m] is None else float(SRC_MISSING[m])
        canon_missing = sorted({SRC_MISSING[m] for m in present if SRC_MISSING[m] is not None})
        pre, _, rest = c.partition("_")
        if pre in ("A1", "A2", "F1", "F2", "M2"):
            b = rest
            spec = {"A1": ("A1", "Unaided awareness", "Which mobile network brands come to mind? (unaided, coded)", "unaided", None),
                    "A2": ("A2", "Aided awareness", "Which of these brands had you heard of before today?", "aided", None),
                    "F1": ("F1", "Familiarity", "How familiar are you with each brand?", "familiarity", f"A2_{b} == 1"),
                    "F2": ("F2", "Would seriously consider", "If choosing a mobile provider today, which would you seriously consider?", "consider", f"A2_{b} == 1"),
                    "M2": ("M2", "Prompted ad awareness", "Which of these brands have you seen or heard advertising for recently?", "ad_awareness", None)}[pre]
            qid, lab, q, set_id, uni = spec
            if pre == "F1":
                vals = [(1, "Never heard much about it"), (2, "2"), (3, "3"), (4, "4"), (5, "Know it very well")]
                vs.append(var(c, f"{lab}: {BNAME[b]}", "scale", "core", question_id=qid, question_text=q, text_source="questionnaire",
                              values=vals, missing=canon_missing, universe=uni, universe_text=f"Aware of {BNAME[b]} (A2)",
                              set_id=set_id, scale=scale_meta(range(1, 6), vals[0][1], vals[-1][1], top=[4, 5], bottom=[1, 2])))
            else:
                vs.append(var(c, f"{lab}: {BNAME[b]}", "binary", "core", question_id=qid, question_text=q, text_source="questionnaire",
                              values=binary_values("Not mentioned", "Mentioned") if pre == "A1" else binary_values(), missing=canon_missing,
                              universe=uni, universe_text=f"Aware of {BNAME[b]} (A2)" if uni else "All respondents", set_id=set_id))
            continue
        if pre == "I":
            b = next(x for x in BRANDS if rest.startswith(x + "_")); a = rest[len(b) + 1:]
            vs.append(var(c, f"Image: {BNAME[b]} — {ATTR[a]}", "binary", "core", question_id="I", text_source="questionnaire",
                          question_text=f"Which of these statements apply to {BNAME[b]}? — {ATTR[a]}", values=[(0, "Does not apply"), (1, "Applies")],
                          missing=canon_missing, universe=f"F1_{b} in [3, 4, 5]", universe_text=f"Familiar with {BNAME[b]} (F1 = 3, 4 or 5)",
                          set_id="image")); continue
        if c in ("E1_satisfaction", "E2_nps", "E5_service_satisfaction"):
            lab, q, lo, hi = {"E1_satisfaction": ("Overall satisfaction with current provider (0-10)", "Overall satisfaction with current provider", "Extremely dissatisfied", "Extremely satisfied"),
                              "E2_nps": ("Likelihood to recommend current provider (0-10)", "Likelihood to recommend current provider", "Not at all likely", "Extremely likely"),
                              "E5_service_satisfaction": ("Satisfaction with customer service (0-10)", "Satisfaction with customer service", "Extremely dissatisfied", "Extremely satisfied")}[c]
            uni, ut = (("E4_contacted_service == 1", "Tracked-brand customers who contacted customer service") if c.startswith("E5")
                       else (TRACKED, "Customers of one of the five tracked brands"))
            vals = [(i, lo if i == 0 else hi if i == 10 else str(i)) for i in range(11)]
            vs.append(var(c, lab, "scale", "core", question_id=c[:2], question_text=q, text_source="questionnaire", values=vals, missing=canon_missing,
                          universe=uni, universe_text=ut, scale=scale_meta(range(11), lo, hi, top=[9, 10], bottom=list(range(7)))))
            continue
        if c in ("E3_problem", "E4_contacted_service"):
            lab = "Network/service problem in past 3 months" if c == "E3_problem" else "Contacted customer service in past 3 months"
            vs.append(var(c, lab, "binary", "core", question_id=c[:2], question_text=lab + "?", text_source="questionnaire", values=binary_values(),
                          missing=canon_missing, universe=TRACKED, universe_text="Customers of one of the five tracked brands")); continue
        if c == "M3_pulse_campaign_recognition":
            vs.append(var(c, "Recognise Pulse campaign", "binary", "core", question_id="M3", text_source="questionnaire",
                          question_text="Pulse campaign recognition (synthetic stimulus)", values=binary_values(), missing=canon_missing,
                          universe="wave >= 3", universe_text="Asked from Wave 3 onward", waves=[3, 4, 5],
                          notes="Questionnaire specifies Yes definitely / Yes maybe / No / DK; generated data is 0/1 only.")); continue
        unexpected[c] = True
    if unexpected: raise ValueError(f"unmapped columns {list(unexpected)}")
    sets = [{"id": s, "type": "brand_grid", "label": l, "question_id": q, "dims": {"brand": BRANDS},
             "members": [f"{pre}_{b}" for b in BRANDS]} for s, l, q, pre in
            [("unaided", "Unaided awareness", "A1", "A1"), ("aided", "Aided awareness", "A2", "A2"), ("familiarity", "Familiarity", "F1", "F1"),
             ("consider", "Consideration", "F2", "F2"), ("ad_awareness", "Prompted ad awareness", "M2", "M2")]]
    sets.append({"id": "image", "type": "brand_attribute_grid", "label": "Brand image", "question_id": "I",
                 "question_text": "For each brand you know well, which of these statements apply?",
                 "dims": {"brand": BRANDS, "attribute": list(ATTR)},
                 "members": [f"I_{b}_{a}" for b in BRANDS for a in ATTR]})
    study = study_record(
        study_id=SID, title="UK mobile network brand tracker (five waves)", archetype="tracker",
        design={"type": "repeated_cross_section", "n_per_wave": 2000, "waves": 5, "brands": BRANDS},
        brief=None, decision_question=None, population="UK adults who decide or share the decision on their personal mobile service",
        waves=[{"id": w, "label": f"Wave {w}", "fieldwork": None} for w in range(1, 6)],
        weight="wt_final", id_variable="respondent_id", wave_variable="wave", variables=vs, sets=sets,
        banner_candidates=["wave", "S1_age", "S2_gender", "S3_region", "S7_contract_type", "S8_current_provider"],
        provenance={"adapter": "sbt001", "generator_version": rep["generatorVersion"], "root_seed": rep["rootSeed"],
                    "sources": sources(root, SID, [f"raw/wave_{w:02d}.csv" for w in range(1, 6)] + ["questionnaire.md", "hidden/validation_report.json"])},
        conversion_notes=["Missing codes translated: source 97 (not asked) -> system-missing; 98 (DK) -> 97; 99 (refused) -> 98.",
                          "Waves stacked into one file with 'wave'; respondent IDs are unique across waves (fresh samples).",
                          "S2 gender and S5 income 'Prefer not to say' recoded to 98.",
                          "Generated data deviates from questionnaire.md: M3 is 0/1 (questionnaire has four options), M4 is absent, "
                          "E3/E4 have no don't-know code, S9 has no DK, fieldwork dates are not specified."],
    )
    return df, study
