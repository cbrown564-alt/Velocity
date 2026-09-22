"""Deterministic synthetic generator for SBT-002.

Ground-truth generator: never expose this implementation/truth parameters to evaluated models.
Tuning is constrained solely by the pre-declared trap contract and occurred before any model
exposure. Writes respondent CSV plus generation audit when run locally.
"""

from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import pandas as pd

SEED = 20260917
N = 2100
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "synthetic_data"
OUT.mkdir(exist_ok=True)
rng = np.random.default_rng(SEED)
age = rng.choice(
    ["18-24", "25-34", "35-44", "45-54", "55-64"], N, p=[0.17, 0.27, 0.22, 0.19, 0.15]
)
gender = rng.choice(
    ["Woman", "Man", "Non-binary/other", "Prefer not"], N, p=[0.50, 0.47, 0.02, 0.01]
)
region = rng.choice(
    [
        "London",
        "South East",
        "South West",
        "East",
        "Midlands",
        "North",
        "Scotland",
        "Wales",
        "Northern Ireland",
    ],
    N,
    p=[0.15, 0.15, 0.09, 0.09, 0.15, 0.20, 0.08, 0.06, 0.03],
)
latent_explore = rng.normal(0, 1, N) + np.where(
    np.isin(age, ["18-24", "25-34"]), 0.28, 0
)


def likert(x, cuts=(-1.25, -0.45, 0.25, 1.05)):
    return np.digitize(x, cuts) + 1


p1 = likert(latent_explore + rng.normal(0, 0.65, N))
p2 = likert(latent_explore + rng.normal(0, 0.65, N))
p3 = likert(0.75 * latent_explore + rng.normal(0, 0.8, N))
food_explorer = ((p1 + p2 + p3) / 3 >= 4).astype(int)
mealkit_open = np.maximum(likert(rng.normal(0.45, 0.95, N) + 0.18 * latent_explore), 3)
usage = rng.choice(
    ["Never", "Previous", "Occasional", "Regular"], N, p=[0.30, 0.29, 0.27, 0.14]
)
concept = np.array(["Flex", "Plus", "Simple"] * (N // 3) + ["Flex"] * (N % 3))
rng.shuffle(concept)
base = rng.normal(0, 1, N)
eff = np.select(
    [concept == "Flex", concept == "Plus", concept == "Simple"], [0.48, 0.25, 0.08]
)
interaction = np.where((concept == "Plus") & (food_explorer == 1), 0.70, 0)
# T4: symmetric extra Plus variance creates a genuinely more polarised distribution.
overall = (
    0.48 * base
    + eff
    + interaction
    + rng.normal(0, 0.72 * np.where(concept == "Plus", 1.65, 1.0), N)
)
appeal = likert(overall)
purchase = likert(0.78 * overall + rng.normal(0, 0.62, N))
uniqueness = likert(
    0.42 * overall
    + np.select(
        [concept == "Flex", concept == "Plus", concept == "Simple"], [0.02, 0.82, -0.15]
    )
    + rng.normal(0, 0.72, N)
)
relevance = likert(
    0.62 * overall
    + np.select(
        [concept == "Flex", concept == "Plus", concept == "Simple"], [0.25, 0.02, 0.08]
    )
    + rng.normal(0, 0.72, N)
)
credibility = likert(
    0.45 * overall
    + np.select(
        [concept == "Flex", concept == "Plus", concept == "Simple"], [0.25, -0.08, 0.38]
    )
    + rng.normal(0, 0.72, N)
)
value = likert(
    0.48 * overall
    + np.select(
        [concept == "Flex", concept == "Plus", concept == "Simple"], [0.15, 0.25, 0.12]
    )
    + rng.normal(0, 0.76, N)
)
# T1 uses a dedicated deterministic noise stream so the small diagnostic difference is stable
# without perturbing the rest of the study. Both concepts score very highly on understanding;
# Flex–Simple is deliberately <5pp yet detectable, illustrating significance != materiality.
under_rng = np.random.default_rng(SEED + 71)
understanding = likert(
    0.30 * overall
    + np.select(
        [concept == "Flex", concept == "Plus", concept == "Simple"], [1.40, -0.20, 1.05]
    )
    + under_rng.normal(0, np.where(concept == "Simple", 0.50, 0.72), N)
)
premium = likert(
    0.40 * overall
    + np.select(
        [concept == "Flex", concept == "Plus", concept == "Simple"], [0.10, 0.68, 0.00]
    )
    + rng.normal(0, 0.72, N)
).astype(float)
premium[understanding < 3] = np.nan


def bern(logit):
    return rng.binomial(1, 1 / (1 + np.exp(-logit)))


likes = {
    "like_flexibility": bern(-1.2 + 1.5 * (concept == "Flex") + 0.20 * overall),
    "like_ease": bern(
        -0.8 + 0.75 * (concept == "Flex") + 1.0 * (concept == "Simple") + 0.18 * overall
    ),
    "like_broad_choice": bern(-1.0 + 1.05 * (concept == "Flex") + 0.15 * overall),
    "like_familiar": bern(-1.0 + 1.15 * (concept == "Simple") + 0.12 * overall),
    "like_new_flavours": bern(
        -1.25 + 1.55 * (concept == "Plus") + 0.42 * food_explorer + 0.15 * overall
    ),
    "like_chef": bern(-1.35 + 1.45 * (concept == "Plus") + 0.15 * overall),
    "like_quality": bern(-0.65 + 0.25 * (concept != "Simple") + 0.22 * overall),
    "like_provenance": bern(-1.45 + 1.35 * (concept == "Plus") + 0.20 * overall),
    "like_premium": bern(-0.95 + 0.35 * (concept == "Plus") + 0.20 * overall),
}
dislikes = {
    "dislike_expensive": bern(-0.55 + 0.25 * (concept == "Plus") - 0.12 * overall),
    "dislike_complicated": bern(-1.55 + 1.15 * (concept == "Plus") - 0.18 * overall),
    "dislike_not_different": bern(
        -1.30
        + 0.95 * (concept == "Simple")
        + 0.25 * (concept == "Flex")
        - 0.15 * overall
    ),
    "dislike_too_adventurous": bern(
        -1.75 + 1.45 * (concept == "Plus") - 0.35 * food_explorer - 0.12 * overall
    ),
    "dislike_limited_choice": bern(
        -1.65 + 0.90 * (concept == "Simple") - 0.12 * overall
    ),
    "dislike_unclear_benefit": bern(
        -1.55 + 0.55 * (concept == "Simple") - 0.20 * overall
    ),
    "dislike_low_frequency": bern(-1.25 - 0.12 * overall),
}
# T6: calibration correction for intentionally over-represented young/explorer respondents.
age_factor = np.select(
    [age == "18-24", age == "25-34", age == "35-44", age == "45-54", age == "55-64"],
    [0.74, 0.82, 1.04, 1.18, 1.26],
)
explore_factor = np.where(food_explorer == 1, 0.72, 1.10)
wt = age_factor * explore_factor * rng.lognormal(0, 0.06, N)
wt = wt / wt.mean()
likes["like_none"] = (np.stack(list(likes.values())).sum(axis=0) == 0).astype(int)
dislikes["dislike_none"] = (np.stack(list(dislikes.values())).sum(axis=0) == 0).astype(
    int
)
df = pd.DataFrame(
    {
        "respondent_id": [f"SBT002_{i+1:04d}" for i in range(N)],
        "age": age,
        "gender": gender,
        "region": region,
        "mealkit_open_5": mealkit_open,
        "food_p1": p1,
        "food_p2": p2,
        "food_p3": p3,
        "food_explorer": food_explorer,
        "mealkit_usage": usage,
        "concept": concept,
        "appeal_5": appeal,
        "purchase_intent_5": purchase,
        "uniqueness_5": uniqueness,
        "relevance_5": relevance,
        "credibility_5": credibility,
        "value_5": value,
        "understanding_5": understanding,
        "premium_value_5": premium,
        "wt_final": wt,
        **likes,
        **dislikes,
    }
)
df.to_csv(OUT / "respondents.csv", index=False)
audit = {
    "generator_version": "0.4-freeze-candidate",
    "seed": SEED,
    "n": len(df),
    "cell_n": df.concept.value_counts().sort_index().to_dict(),
    "food_explorer_unweighted": float(df.food_explorer.mean()),
    "weight_min": float(wt.min()),
    "weight_max": float(wt.max()),
    "weight_mean": float(wt.mean()),
    "routed_premium_n": int(df.premium_value_5.notna().sum()),
}
(OUT / "generation_audit.json").write_text(json.dumps(audit, indent=2))
print(json.dumps(audit, indent=2))
