"""Deterministic SBT-002 tables; no reference findings or trap labels in results."""

import hashlib
import json
import math
import sys
from pathlib import Path
import pandas as pd
from scipy.stats import norm

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parents[4] / "scripts/python/research_quality"))
from analysis import distribution, pairwise, holm, correlation

CORE = [
    "appeal_5",
    "purchase_intent_5",
    "uniqueness_5",
    "relevance_5",
    "credibility_5",
    "value_5",
    "understanding_5",
]
CONCEPTS = ["Flex", "Plus", "Simple"]


def main():
    path = ROOT / "synthetic_data/respondents.csv"
    df = pd.read_csv(path)

    def cells(d, var):
        return {
            c: distribution(
                d.loc[d.concept == c, var], d.loc[d.concept == c, "wt_final"]
            )
            for c in CONCEPTS
        }

    res = dict(
        project_id="SBT-002",
        weighting="wt_final",
        source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        method="Kish ESS Wald independent cells; Holm per metric across three pairs; two pre-specified Plus-minus-Flex interactions Holm-adjusted as one family",
        concept_metrics={},
        pairwise={},
        strategic_subgroup={},
        interactions={},
        routing={},
        weighting_audit={},
        exploratory={},
        diagnostic_associations={},
    )
    for var in CORE + ["premium_value_5"]:
        res["concept_metrics"][var] = cells(df, var)
        res["pairwise"][var] = pairwise(res["concept_metrics"][var])
    for group, code in [("food_explorer", 1), ("non_explorer", 0)]:
        d = df[df.food_explorer == code]
        res["strategic_subgroup"][group] = {v: cells(d, v) for v in CORE[:3]}
    for v in CORE[:2]:
        yes, no = [
            res["strategic_subgroup"][g][v] for g in ["food_explorer", "non_explorer"]
        ]
        diff = (yes["Plus"]["top2_pct"] - yes["Flex"]["top2_pct"]) - (
            no["Plus"]["top2_pct"] - no["Flex"]["top2_pct"]
        )
        se = 100 * math.sqrt(
            sum(d[c]["se_prop"] ** 2 for d in [yes, no] for c in ["Plus", "Flex"])
        )
        res["interactions"][v] = dict(
            contrast="(Plus-Flex explorers) - (Plus-Flex non-explorers)",
            diff_pp=diff,
            se_pp=se,
            p_raw=float(2 * norm.sf(abs(diff) / se)),
        )
    for v, p in zip(CORE[:2], holm([r["p_raw"] for r in res["interactions"].values()])):
        res["interactions"][v].update(p_holm=p, significant_holm=p < 0.05)
    res["routing"]["premium_value_5"] = {
        c: dict(
            eligible_n=int(((df.concept == c) & (df.understanding_5 >= 3)).sum()),
            cell_n=int((df.concept == c).sum()),
            routing_rate_pct=100
            * float(df.loc[df.concept == c, "premium_value_5"].notna().mean()),
            universe="understanding_5 >= 3",
        )
        for c in CONCEPTS
    }
    for c in CONCEPTS:
        d = df[df.concept == c]
        res["weighting_audit"][c] = {
            v: dict(
                weighted_pct=res["concept_metrics"][v][c]["top2_pct"],
                unweighted_pct=100 * float((d[v] >= 4).mean()),
            )
            for v in CORE
        }
    for dem in ["age", "gender", "region"]:
        res["exploratory"][dem] = {
            str(level): {v: cells(d, v) for v in CORE[:2]}
            for level, d in df.groupby(dem)
        }
    for c in CONCEPTS:
        d = df[df.concept == c]
        res["diagnostic_associations"][c] = {
            v: correlation(d[v], d.purchase_intent_5, d.wt_final) for v in CORE[2:]
        }
    (ROOT / "reference/analysis_results.json").write_text(
        json.dumps(res, indent=2, allow_nan=False) + "\n"
    )


if __name__ == "__main__":
    main()
