"""Declared survey-design calculations for the expansion; no outcome tuning."""

import math
import numpy as np
import pandas as pd
from expansion_statistics import mean


def holm(p_values):
    p = [1.0 if v is None else float(v) for v in p_values]
    order = sorted(range(len(p)), key=lambda i: p[i])
    result, maximum = [1.0] * len(p), 0.0
    for rank, index in enumerate(order):
        maximum = max(maximum, min(1.0, p[index] * (len(p) - rank)))
        result[index] = maximum
    return result


def stratified_contrast(frame, outcome, group, weight, strata, valid_codes, scale=1):
    """Fixed-weight domain ratio contrast; all sampled rows remain in strata.

    Each group must be disjoint (codes 1 versus 0). Kish ESS is reported, but
    does not replace the actual stratum sample counts in the variance formula.
    """
    y, w, g = frame[outcome], frame[weight], frame[group]
    if w.isna().any() or (~np.isfinite(w)).any() or (w <= 0).any():
        raise ValueError("Contrast requires positive finite design weights")
    influence = pd.Series(0.0, index=frame.index)
    result = {}
    for code in [1, 0]:
        mask = (g == code) & y.isin(valid_codes)
        summary = mean(y[mask], w[mask], valid_codes)
        result[f"group_{code}"] = summary
        if not mask.any():
            raise ValueError("Empty contrast domain")
        sign = 1 if code else -1
        influence.loc[mask] += (
            sign * w[mask] * (y[mask] - summary["mean"]) / summary["n_weighted"]
        )
    variance = 0.0
    for _, positions in frame.groupby(strata, dropna=False).groups.items():
        a = influence.loc[positions]
        if len(a) < 2:
            raise ValueError("Singleton variance stratum")
        variance += len(a) / (len(a) - 1) * float(((a - a.mean()) ** 2).sum())
    delta = (result["group_1"]["mean"] - result["group_0"]["mean"]) * scale
    se = math.sqrt(variance) * scale
    result.update(
        difference=delta,
        se=se,
        ci95=[delta - 1.959963984540054 * se, delta + 1.959963984540054 * se],
        p_raw=(
            math.erfc(abs(delta / se) / math.sqrt(2))
            if se
            else (1.0 if delta == 0 else 0.0)
        ),
        variance_method="Fixed-weight stratified domain-ratio linearisation; no FPC",
    )
    return result
