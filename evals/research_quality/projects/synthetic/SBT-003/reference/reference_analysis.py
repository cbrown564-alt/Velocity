"""SBT-003 weighted reference tables; contact-only diagnostics retain their base."""

import hashlib
import json
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parents[4] / "scripts/python/research_quality"))
from analysis import distribution, correlation, nps


def main():
    path = ROOT / "synthetic_data/respondents.csv"
    df = pd.read_csv(path)

    def dist(d, v):
        return distribution(d[v], d.wt_final)

    def summary(d):
        return dict(nps=nps(d), renewal=dist(d, "renewal_intent_5"))

    masks = dict(
        unresolved_contact=(df.support_contact_90d == 1)
        & (df.resolved_first_contact == 0),
        resolved_contact=(df.support_contact_90d == 1)
        & (df.resolved_first_contact == 1),
        legacy_contact=(df.legacy_plan == 1) & (df.support_contact_90d == 1),
        long_tenure=df.tenure_band.eq("6+y"),
        premium_unresolved=(df.plan_tier == "Premium")
        & (df.support_contact_90d == 1)
        & (df.resolved_first_contact == 0),
    )
    res = dict(
        project_id="SBT-003",
        weighting="wt_final",
        source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        company=nps(df),
        renewal=dist(df, "renewal_intent_5"),
        satisfaction=dist(df, "overall_satisfaction_5"),
        groups={},
    )
    for key, mask in masks.items():
        d = df[mask]
        res["groups"][key] = dict(
            summary(d),
            prevalence_weighted_pct=100 * float(d.wt_final.sum() / df.wt_final.sum()),
            share_of_company_detractors_pct=100
            * float(
                d.loc[d.nps_0_10 <= 6, "wt_final"].sum()
                / df.loc[df.nps_0_10 <= 6, "wt_final"].sum()
            ),
        )
    res["weighting_audit"] = dict(
        nps_weighted=res["company"]["nps"],
        nps_unweighted=100 * (df.nps_0_10.ge(9).mean() - df.nps_0_10.le(6).mean()),
    )
    res["diagnostic_correlations"] = {
        v: correlation(df[v], df.nps_0_10, df.wt_final)
        for v in [
            "reliability_5",
            "value_5",
            "ease_5",
            "trust_5",
            "resolved_first_contact",
        ]
    }
    res["correlation_universes"] = dict(
        resolved_first_contact="support_contact_90d = 1",
        other="all valid current customers",
    )
    res["support"] = dict(
        universe="support_contact_90d = 1",
        contact_n=int(df.support_contact_90d.sum()),
        quality=dist(df, "support_quality_5"),
        resolved_pct=100
        * float(
            df.loc[df.resolved_first_contact == 1, "wt_final"].sum()
            / df.loc[df.support_contact_90d == 1, "wt_final"].sum()
        ),
    )
    res["tenure"] = {
        key: dict(
            summary(d),
            legacy_pct=100
            * float(d.loc[d.legacy_plan == 1, "wt_final"].sum() / d.wt_final.sum()),
            legacy_strata={
                str(legacy): summary(g) for legacy, g in d.groupby("legacy_plan")
            },
        )
        for key, d in df.groupby("tenure_band")
    }
    (ROOT / "reference/analysis_results.json").write_text(
        json.dumps(res, indent=2, allow_nan=False) + "\n"
    )


if __name__ == "__main__":
    main()
