"""Offline reference estimators, independent of Velocity's product engine.

Weights are supplied, not fitted. Nonmissing codes define the valid base. Tests
use approximate Kish-ESS independent-cell Wald inference, not complex survey SEs.
"""

import math
import numpy as np
from scipy.stats import norm


def distribution(x, w):
    valid = x.notna() & w.notna()
    x, w = x[valid], w[valid]
    if (w < 0).any() or not np.isfinite(w).all():
        raise ValueError("Weights must be finite and nonnegative")
    total = float(w.sum())
    ess = total**2 / float(w.pow(2).sum()) if total else 0.0
    result = dict(n_unweighted=len(x), n_weighted=total, n_eff=ess)
    if not total:
        return dict(
            result,
            top2_pct=None,
            bottom2_pct=None,
            mean=None,
            distribution_pct={},
            se_prop=None,
        )
    dist = {str(i): 100 * float(w[x == i].sum()) / total for i in range(1, 6)}
    p = (dist["4"] + dist["5"]) / 100
    return dict(
        result,
        top2_pct=100 * p,
        bottom2_pct=dist["1"] + dist["2"],
        mean=float((x * w).sum() / total),
        distribution_pct=dist,
        se_prop=math.sqrt(p * (1 - p) / ess),
    )


def holm(pvals):
    result = [0.0] * len(pvals)
    running = 0.0
    for rank, index in enumerate(np.argsort(pvals)):
        running = max(running, (len(pvals) - rank) * float(pvals[index]))
        result[index] = min(1.0, running)
    return result


def pairwise(cells):
    results = []
    for a, b in [("Flex", "Plus"), ("Flex", "Simple"), ("Plus", "Simple")]:
        aa, bb = cells[a], cells[b]
        diff = aa["top2_pct"] - bb["top2_pct"]
        se = math.hypot(aa["se_prop"], bb["se_prop"])
        p = (
            float(2 * norm.sf(abs(diff / 100) / se))
            if se
            else (1.0 if diff == 0 else 0.0)
        )
        results.append(
            dict(
                a=a,
                b=b,
                top2_diff_pp=diff,
                p_raw=p,
                commercially_material=abs(diff) >= 5,
            )
        )
    for row, adjusted in zip(results, holm([r["p_raw"] for r in results])):
        row.update(p_holm=adjusted, significant_holm=adjusted < 0.05)
    return results


def correlation(x, y, w):
    valid = x.notna() & y.notna() & w.notna()
    x, y, w = x[valid], y[valid], w[valid]
    if not w.sum():
        return None
    xx, yy = x - np.average(x, weights=w), y - np.average(y, weights=w)
    den = math.sqrt(float((w * xx * xx).sum() * (w * yy * yy).sum()))
    return float((w * xx * yy).sum() / den) if den else None


def nps(d):
    valid = d.nps_0_10.notna()
    w, x = d.loc[valid, "wt_final"], d.loc[valid, "nps_0_10"]
    total = float(w.sum())
    p, q = 100 * float(w[x >= 9].sum()) / total, 100 * float(w[x <= 6].sum()) / total
    return dict(
        nps=p - q,
        promoter_pct=p,
        passive_pct=100 - p - q,
        detractor_pct=q,
        n=len(x),
        n_weighted=total,
        n_eff=total**2 / float(w.pow(2).sum()),
    )
