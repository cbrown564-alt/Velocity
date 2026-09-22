"""SBT-003 deterministic freeze-candidate generator. Hidden from evaluated models."""

from pathlib import Path
import json, hashlib
import numpy as np, pandas as pd

SEED = 20260918
N = 2400
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "synthetic_data"
OUT.mkdir(exist_ok=True)
rng = np.random.default_rng(SEED)
tenure = rng.choice(["<1y", "1-2y", "3-5y", "6+y"], N, p=[0.16, 0.24, 0.31, 0.29])
plan = rng.choice(["Essential", "Standard", "Premium"], N, p=[0.30, 0.50, 0.20])
legacy = rng.binomial(
    1,
    np.select(
        [tenure == "<1y", tenure == "1-2y", tenure == "3-5y", tenure == "6+y"],
        [0.04, 0.10, 0.28, 0.52],
    ),
)
latent = rng.normal(0, 1, N) - 0.48 * legacy
outage = rng.binomial(
    1, 1 / (1 + np.exp(-(-1.15 + 0.75 * legacy + 0.15 * (plan == "Premium"))))
)
contact = rng.binomial(
    1,
    1
    / (
        1
        + np.exp(-(-1.35 + 1.05 * outage + 0.55 * legacy + 0.25 * (plan == "Premium")))
    ),
)
rp = 1 / (1 + np.exp(-(0.65 - 0.85 * legacy - 0.55 * outage + 0.18 * latent)))
resolved = np.where(contact == 1, rng.binomial(1, rp), np.nan)
unresolved = ((contact == 1) & (np.nan_to_num(resolved) == 0)).astype(int)
experience = latent - 1.05 * unresolved - 0.48 * outage + rng.normal(0, 0.55, N)


def lk(x):
    return np.digitize(x, (-1.25, -0.45, 0.25, 1.05)) + 1


reliability = lk(experience + 0.2 + rng.normal(0, 0.45, N))
value = lk(0.55 * experience + rng.normal(0, 0.75, N))
ease = lk(0.58 * experience + rng.normal(0, 0.70, N))
trust = lk(0.82 * experience + rng.normal(0, 0.52, N))
sat = lk(0.90 * experience + rng.normal(0, 0.48, N))
renew = lk(0.72 * experience + rng.normal(0, 0.68, N))
support = np.where(
    contact == 1,
    lk(0.75 * experience + 0.65 * np.nan_to_num(resolved) + rng.normal(0, 0.65, N)),
    np.nan,
)
nps = np.clip(np.rint(5.9 + 1.55 * experience + rng.normal(0, 1.65, N)), 0, 10).astype(
    int
)
wt = (
    np.select(
        [plan == "Essential", plan == "Standard", plan == "Premium"], [1.08, 1.03, 0.72]
    )
    * np.where(contact == 1, 0.60, 1.07)
    * rng.lognormal(0, 0.06, N)
)
wt /= wt.mean()
extra = np.random.default_rng(SEED + 101)
region = extra.choice(
    ["England", "Scotland", "Wales", "Northern Ireland"], N, p=[0.84, 0.08, 0.05, 0.03]
)
household = extra.choice(
    ["Single adult", "Adults only", "With children"], N, p=[0.24, 0.42, 0.34]
)
severity = np.where(
    outage == 1, lk(-0.55 * experience + extra.normal(0.3, 0.6, N)), np.nan
)
channel = np.where(
    contact == 1,
    extra.choice(["Phone", "Chat", "Email"], N, p=[0.55, 0.35, 0.10]),
    "Not asked",
)
complaint = extra.binomial(
    1, 1 / (1 + np.exp(-(-2.8 + 0.9 * unresolved + 0.5 * outage)))
)
df = pd.DataFrame(
    {
        "respondent_id": [f"SBT003_{i+1:04d}" for i in range(N)],
        "tenure_band": tenure,
        "plan_tier": plan,
        "legacy_plan": legacy,
        "nps_0_10": nps,
        "overall_satisfaction_5": sat,
        "renewal_intent_5": renew,
        "reliability_5": reliability,
        "value_5": value,
        "ease_5": ease,
        "trust_5": trust,
        "outage_90d": outage,
        "support_contact_90d": contact,
        "support_quality_5": support,
        "resolved_first_contact": resolved,
        "wt_final": wt,
        "region": region,
        "household_type": household,
        "outage_severity_5": severity,
        "support_channel": channel,
        "formal_complaint_90d": complaint,
    }
)
df.to_csv(OUT / "respondents.csv", index=False)
p = OUT / "respondents.csv"
audit = {
    "version": "0.2-freeze-candidate",
    "seed": SEED,
    "n": N,
    "premium_unresolved_n": int(
        ((plan == "Premium") & (contact == 1) & (np.nan_to_num(resolved) == 0)).sum()
    ),
    "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
}
(OUT / "generation_audit.json").write_text(json.dumps(audit, indent=2))
