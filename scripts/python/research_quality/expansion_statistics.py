"""Offline expansion estimators. Public study policies must name these methods.

All functions exclude invalid codes explicitly. These do not change Velocity's
product statistical engine or the frozen SBT-002/003 reference implementation.
"""

import math
import numpy as np
import pandas as pd


def _valid(x, w, codes=None):
    x, w = pd.Series(x, dtype=float), pd.Series(w, dtype=float)
    if len(x) != len(w) or not x.index.equals(w.index):
        raise ValueError("Values and weights must have matching indexes")
    if (w.dropna() < 0).any() or not np.isfinite(w.dropna()).all():
        raise ValueError("Analysis weights must be finite and nonnegative")
    valid = x.notna() & np.isfinite(x) & w.notna()
    if codes is not None:
        valid &= x.isin(codes)
    return x[valid], w[valid], int((~valid).sum())


def mean(x, w, codes=None):
    x, w, missing = _valid(x, w, codes)
    total = float(w.sum())
    ess = total**2 / float(w.pow(2).sum()) if total else 0.0
    value = float((x * w).sum() / total) if total else None
    variance = float((w * (x - value) ** 2).sum() / total) if total else None
    return dict(
        n_unweighted=len(x),
        n_weighted=total,
        n_eff=ess,
        missing_n=missing,
        mean=value,
        se=math.sqrt(variance / (ess - 1)) if ess > 1 else None,
    )


def proportion(x, w, selected=1, codes=(0, 1)):
    valid_x, valid_w, missing = _valid(x, w, codes)
    r = mean((valid_x == selected).astype(float), valid_w)
    r.update(missing_n=missing, pct=100 * r["mean"] if r["mean"] is not None else None)
    return r


def distribution(x, w, codes=(1, 2, 3, 4, 5)):
    r = mean(x, w, codes)
    values, weights, _ = _valid(x, w, codes)
    r["distribution_pct"] = {
        str(k): (
            100 * float(weights[values == k].sum()) / r["n_weighted"]
            if r["n_weighted"]
            else None
        )
        for k in codes
    }
    r["top2_pct"] = (
        sum(r["distribution_pct"][str(k)] for k in codes[-2:])
        if r["n_weighted"]
        else None
    )
    r["bottom2_pct"] = (
        sum(r["distribution_pct"][str(k)] for k in codes[:2])
        if r["n_weighted"]
        else None
    )
    return r


def multiresponse(frame, w, columns):
    # Block-complete valid binary responses are the common respondent base.
    valid = frame[columns].isin([0, 1]).all(axis=1)
    return {c: proportion(frame.loc[valid, c], w.loc[valid]) for c in columns}


def reverse_five(x):
    return 6 - x.where(x.isin([1, 2, 3, 4, 5]))


def paired_change(pre, post, w, codes=(0, 1)):
    valid = pre.isin(codes) & post.isin(codes)
    return mean((post - pre).where(valid), w)


def correlation(x, y, w, x_codes=None, y_codes=None):
    a = x.where(x.isin(x_codes)) if x_codes is not None else x
    b = y.where(y.isin(y_codes)) if y_codes is not None else y
    valid = a.notna() & b.notna()
    a, weights, _ = _valid(a.where(valid), w)
    b = b.loc[a.index]
    base = mean(a, weights)
    if not base["n_weighted"]:
        return dict(base, correlation=None)
    aa = a - base["mean"]
    bb = b - float((b * weights).sum() / weights.sum())
    denominator = math.sqrt(float((weights * aa**2).sum() * (weights * bb**2).sum()))
    return dict(
        base,
        correlation=(
            float((weights * aa * bb).sum() / denominator) if denominator else None
        ),
    )
