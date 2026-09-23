"""SBT-002 everyday meal-kit concept test (randomised monadic, three concepts).

The source codebook stores text answers and gives scale codes as bare numbers
("See questionnaire endpoints"). Question wording and end-point labels are taken
from questionnaire.md; the concept roles in manifest.json are hidden answer-key
material and are deliberately not used.
"""
from __future__ import annotations
import json
import pandas as pd
from .common import proj, sources, study_record, var, scale_meta, recode_text, binary_values

SID = "SBT-002"
AGREE = ("Strongly disagree", "Strongly agree")
LIKELY = ["Definitely would not", "Probably would not", "Might or might not", "Probably would", "Definitely would"]
SCALES = {  # name: (qid, label, question text, low, high, full labels or None, role, set)
    "mealkit_open_5": ("S4", "Meal-kit openness", "How likely are you to consider using a meal-kit delivery service in the next 12 months?", None, None, LIKELY, "screener", None),
    "food_p1": ("P1", "Enjoy trying new foods or flavours", "I enjoy trying foods or flavours that are new to me.", *AGREE, None, "profile", "food_exploration"),
    "food_p2": ("P2", "Look for meals that feel different", "I often look for meals that feel different from my usual choices.", *AGREE, None, "profile", "food_exploration"),
    "food_p3": ("P3", "Willing to pay more for special food", "I am willing to pay a little more for food that feels special or distinctive.", *AGREE, None, "profile", "food_exploration"),
    "appeal_5": ("Q1", "Overall appeal", "How appealing is this concept to you?", "Not at all appealing", "Extremely appealing", None, "core", "concept_evaluation"),
    "purchase_intent_5": ("Q2", "Purchase intent", "If this service were available at a reasonable price, how likely would you be to subscribe or try it?", None, None, LIKELY, "core", "concept_evaluation"),
    "uniqueness_5": ("Q3", "Uniqueness", "How different does this concept feel from meal-kit services you already know about?", "Not at all different", "Very different", None, "core", "concept_evaluation"),
    "relevance_5": ("Q4", "Relevance", "How relevant does this concept feel to your needs?", "Not at all relevant", "Extremely relevant", None, "core", "concept_evaluation"),
    "credibility_5": ("Q5", "Credibility", "How believable is it that a meal-kit provider could deliver this proposition consistently?", "Not at all believable", "Extremely believable", None, "core", "concept_evaluation"),
    "value_5": ("Q6", "Value for money", "Assuming a modest premium over a standard meal-kit subscription, how good or poor would you expect the value for money to be?", "Very poor", "Very good", None, "core", "concept_evaluation"),
    "understanding_5": ("Q7", "Ease of understanding", "How easy is the concept to understand?", "Very difficult", "Very easy", None, "core", "concept_evaluation"),
    "premium_value_5": ("Q8", "Premium proposition convincing", "Thinking specifically about what makes this concept premium, how convincing is the premium proposition?", "Not at all convincing", "Extremely convincing", None, "core", None),
}
LIKES = {"like_flexibility": "Flexibility / ability to pause or swap", "like_ease": "Ease / convenience", "like_broad_choice": "Broad menu choice",
         "like_familiar": "Familiar meals", "like_new_flavours": "New or unusual flavours", "like_chef": "Chef-led inspiration",
         "like_quality": "Ingredient quality", "like_provenance": "Provenance / sourcing", "like_premium": "Premium feel", "like_none": "None of these"}
DISLIKES = {"dislike_expensive": "Too expensive", "dislike_complicated": "Too complicated", "dislike_not_different": "Not different enough",
            "dislike_too_adventurous": "Too unfamiliar / adventurous", "dislike_limited_choice": "Limited choice",
            "dislike_unclear_benefit": "Unclear benefit", "dislike_low_frequency": "Would not use often enough", "dislike_none": "None of these"}
TEXT = {  # name: (qid, label, question, order, special, role, type)
    "age": ("S1", "Age", "Age", ["18-24", "25-34", "35-44", "45-54", "55-64"], {}, "screener", "ordinal"),
    "gender": ("S2", "Gender", "Gender", ["Woman", "Man", "Non-binary/other"], {"Prefer not": 98}, "screener", "single"),
    "region": ("S3", "Region", "Region", ["London", "South East", "South West", "East", "Midlands", "North", "Scotland", "Wales", "Northern Ireland"], {}, "screener", "single"),
    "mealkit_usage": ("P4", "Current meal-kit usage", "Current meal-kit usage", ["Never", "Previous", "Occasional", "Regular"], {}, "profile", "ordinal"),
    "concept": ("RAND", "Concept shown (random assignment)", "Randomly assigned concept", ["Flex", "Plus", "Simple"], {}, "design", "single"),
}
LABEL_FIX = {"Never": "Never used", "Previous": "Used previously", "Occasional": "Use occasionally", "Regular": "Use regularly",
             "Non-binary/other": "Non-binary or another identity", "East": "East of England", "North": "North of England"}


def build(root):
    p = proj(root, SID)
    sm = json.loads((p / "model_inputs/study_materials.json").read_text())
    src = pd.read_csv(p / "model_inputs/respondents.csv")
    df = pd.DataFrame(index=src.index); vs = []; notes = []
    for c in src.columns:
        if c == "respondent_id":
            df[c] = src[c]; vs.append(var(c, "Respondent ID", "identifier", "admin")); continue
        if c == "wt_final":
            df[c] = src[c]; vs.append(var(c, "Final weight", "weight", "weight", notes="Supplied calibration weight")); continue
        if c in TEXT:
            qid, lab, q, order, special, role, vt = TEXT[c]
            df[c], rec = recode_text(src[c], order, special)
            vs.append(var(c, lab, vt, role, question_id=qid, question_text=q, text_source="questionnaire",
                          values=[(i, LABEL_FIX.get(t, t)) for i, t in enumerate(order, 1)], missing=sorted(set(special.values())),
                          recode=rec))
            continue
        if c in SCALES:
            qid, lab, q, lo, hi, full, role, set_id = SCALES[c]
            values = [(i, (full[i - 1] if full else (lo if i == 1 else hi if i == 5 else str(i)))) for i in range(1, 6)]
            uni, utext = (("understanding_5 >= 3", "Rated ease of understanding 3 or higher (Q7 >= 3)") if c == "premium_value_5" else (None, "All respondents"))
            df[c] = src[c].astype(float)
            vs.append(var(c, lab, "scale", role, question_id=qid, question_text=q, text_source="questionnaire", values=values,
                          scale=scale_meta(range(1, 6), values[0][1], values[-1][1]), universe=uni, universe_text=utext, set_id=set_id))
            continue
        if c in LIKES or c in DISLIKES:
            first = c.startswith("like_")
            df[c] = src[c].astype(float)
            vs.append(var(c, (LIKES if first else DISLIKES)[c], "binary", "core", question_id="Q9" if first else "Q10",
                          question_text=("Which aspects, if any, particularly appeal to you?" if first else "Which aspects, if any, concern you?"),
                          text_source="questionnaire", values=binary_values("Not selected", "Selected"), set_id="likes" if first else "dislikes"))
            continue
        if c == "food_explorer":
            df[c] = src[c].astype(float)
            vs.append(var(c, "Food explorer (mean of P1-P3 >= 4)", "binary", "derived", values=binary_values(),
                          derivation="1 when mean(food_p1, food_p2, food_p3) >= 4.0; pre-specified strategic subgroup")); continue
        raise ValueError(f"unmapped column {c}")
    sets = [
        {"id": "food_exploration", "type": "battery", "label": "Food exploration orientation", "question_id": "P1-P3",
         "question_text": "Please indicate how much you agree or disagree with each statement.", "members": ["food_p1", "food_p2", "food_p3"]},
        {"id": "concept_evaluation", "type": "battery", "label": "Concept evaluation", "question_id": "Q1-Q7",
         "question_text": "All questions refer to the assigned concept.", "members": [k for k, v in SCALES.items() if v[7] == "concept_evaluation"]},
        {"id": "likes", "type": "multi_response", "label": "What appeals", "question_id": "Q9",
         "question_text": "Which aspects, if any, particularly appeal to you? Select all that apply.", "members": list(LIKES), "exclusive": ["like_none"]},
        {"id": "dislikes", "type": "multi_response", "label": "What concerns", "question_id": "Q10",
         "question_text": "Which aspects, if any, concern you? Select all that apply.", "members": list(DISLIKES), "exclusive": ["dislike_none"]},
    ]
    study = study_record(
        study_id=SID, title=sm["title"], archetype="concept_test",
        design={"type": "randomised_monadic", "n": len(df), "cells": ["Flex", "Plus", "Simple"], "cell_variable": "concept"},
        brief=None, decision_question=sm.get("decision_question"), population="UK adults aged 18-64 open to using a meal-kit delivery service in the next 12 months",
        waves=None, weight="wt_final", id_variable="respondent_id", wave_variable=None, variables=vs, sets=sets,
        banner_candidates=["concept", "food_explorer", "age", "gender", "mealkit_usage"],
        provenance={"adapter": "sbt002", "sources": sources(root, SID, ["model_inputs/codebook.json", "model_inputs/respondents.csv",
                                                                          "model_inputs/study_materials.json", "questionnaire.md"])},
        conversion_notes=["Text answers recoded to integers in questionnaire order; the mapping is stored in each variable's 'recode'.",
                          "Gender 'Prefer not' recoded to 98 (prefer not to say), so it is excluded from valid bases.",
                          "Scale end-point labels and question wording taken from questionnaire.md; intermediate points are numbered."],
    )
    return df, study
