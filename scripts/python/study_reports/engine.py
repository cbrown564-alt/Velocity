"""Shared engine: load a canonical study, weighted estimates, tests and banners.

Estimation follows the reference analyses in evals/: weighted proportions and means,
Kish effective base (sum w)^2 / sum w^2, standard error sqrt(p(1-p)/ess), and Wald
tests on independent groups. Valid base excludes system-missing (not asked) and the
canonical missing codes 97/98/99.
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field
from math import sqrt
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import norm

SYN = "evals/research_quality/projects/synthetic"
MISSING_CODES = (97, 98, 99)


# ----------------------------------------------------------------------------- study

class Study:
    def __init__(self, root: Path, sid: str):
        self.root, self.sid = Path(root), sid
        cdir = self.root / SYN / sid / "canonical"
        self.cb = json.loads((cdir / "codebook.json").read_text())
        self.df = pd.read_csv(cdir / f"{sid.lower().replace('-', '_')}.csv")
        self.vars = {v["name"]: v for v in self.cb["variables"]}
        self.sets = {s["id"]: s for s in self.cb.get("sets", [])}
        self.w = self.df[self.cb["weight"]]
        self.all = pd.Series(True, index=self.df.index)

    def col(self, name): return self.df[name]

    def valid(self, name):
        s = self.df[name]
        return s.notna() & ~s.isin(MISSING_CODES)

    def asked(self, name):
        return self.df[name].notna()

    def universe(self, name):
        e = self.vars[name]["universe"]["expr"]
        return self.df.eval(e).astype(bool) if e else self.all

    def values(self, name):
        return [(x["code"], x["label"]) for x in self.vars[name]["values"]]

    def vlabel(self, name, code):
        return dict(self.values(name)).get(int(code), str(code))

    def mask(self, expr):
        return self.df.eval(expr).astype(bool) if expr else self.all


# ----------------------------------------------------------------------------- estimates

@dataclass
class Est:
    value: float            # proportion (0-1), mean, or NPS points
    n: int                  # unweighted base
    nw: float               # weighted base
    ess: float              # Kish effective base
    se: float
    kind: str = "share"

    @property
    def ok(self): return self.n > 0 and self.value == self.value


def _base(w, base):
    wb = w[base]; s = wb.sum()
    ess = s * s / (wb * wb).sum() if len(wb) else 0.0
    return int(base.sum()), float(s), float(ess)


def share(num, base, w) -> Est:
    base = base.astype(bool); num = num.fillna(False).astype(bool)
    n, nw, ess = _base(w, base)
    if n == 0: return Est(float("nan"), 0, 0.0, 0.0, float("nan"))
    p = float(w[base & num].sum() / nw)
    return Est(p, n, nw, ess, sqrt(max(p * (1 - p), 0) / ess) if ess else float("nan"))


def mean(x, base, w) -> Est:
    base = base.astype(bool) & x.notna()
    n, nw, ess = _base(w, base)
    if n == 0: return Est(float("nan"), 0, 0.0, 0.0, float("nan"), "mean")
    xv, wv = x[base].astype(float), w[base]
    m = float((xv * wv).sum() / nw); var = float((wv * (xv - m) ** 2).sum() / nw)
    return Est(m, n, nw, ess, sqrt(var / ess), "mean")


def nps(x, base, w) -> Est:
    """Promoters (9-10) minus detractors (0-6), in points, with SE from the {-1,0,1} score."""
    base = base.astype(bool) & x.notna()
    n, nw, ess = _base(w, base)
    if n == 0: return Est(float("nan"), 0, 0.0, 0.0, float("nan"), "nps")
    s = np.where(x[base] >= 9, 1.0, np.where(x[base] <= 6, -1.0, 0.0)); wv = w[base].values
    m = float((s * wv).sum() / nw); var = float((wv * (s - m) ** 2).sum() / nw)
    return Est(100 * m, n, nw, ess, 100 * sqrt(var / ess), "nps")


@dataclass
class Test:
    diff: float
    se: float
    z: float
    p: float
    p_adj: float | None = None

    def sig(self, alpha=0.05):
        return (self.p_adj if self.p_adj is not None else self.p) < alpha


def wald(a: Est, b: Est) -> Test:
    """b - a for independent groups."""
    if not (a.ok and b.ok) or not (a.se == a.se and b.se == b.se):
        return Test(float("nan"), float("nan"), float("nan"), 1.0)
    d = b.value - a.value; se = sqrt(a.se ** 2 + b.se ** 2)
    z = d / se if se else 0.0
    return Test(d, se, z, float(2 * (1 - norm.cdf(abs(z)))))


def holm(tests: list[Test]) -> list[Test]:
    order = sorted(range(len(tests)), key=lambda i: tests[i].p)
    m, running = len(tests), 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (m - rank) * tests[i].p))
        tests[i].p_adj = running
    return tests


# ----------------------------------------------------------------------------- banner

@dataclass
class Column:
    group: str
    label: str
    mask: pd.Series
    letter: str = ""
    compare_prev_only: bool = False


@dataclass
class Banner:
    columns: list[Column] = field(default_factory=list)
    adjust: dict = field(default_factory=dict)   # group -> "holm"

    def groups(self):
        return list(dict.fromkeys(c.group for c in self.columns))


LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def build_banner(study: Study, spec: list[dict], scope: str | None = None) -> Banner:
    """Spec entries: {"group", "var"| "expr", "cols": [{"label", "codes"|"expr"}], "adjust": "holm", "all_rows": bool}.
    ``scope`` (a query expression) restricts non-"all_rows" groups, e.g. to the current wave."""
    sc = study.mask(scope) if scope else study.all
    b = Banner(); i = 0
    for g in spec:
        restrict = study.all if g.get("all_rows") else sc
        if g.get("total"):
            cols = [{"label": g["group"], "expr": None}]
        elif "cols" in g:
            cols = g["cols"]
        else:
            cols = [{"label": l, "codes": [c]} for c, l in study.values(g["var"])]
        for c in cols:
            if "codes" in c: m = study.col(g["var"]).isin(c["codes"])
            elif c.get("expr"): m = study.mask(c["expr"])
            else: m = study.all
            b.columns.append(Column(g["group"], c["label"], (m & restrict).fillna(False), LETTERS[i], g.get("compare_prev_only", False)))
            i += 1
        if g.get("adjust"): b.adjust[g["group"]] = g["adjust"]
    return b


def column_tests(ests: list[Est], banner: Banner, min_test: int, alpha=0.05) -> list[str]:
    """Letters: column is significantly higher than the lettered column(s) in its group."""
    out = ["" for _ in ests]
    for g in banner.groups():
        idx = [i for i, c in enumerate(banner.columns) if c.group == g]
        pairs = []
        if banner.columns[idx[0]].compare_prev_only:
            pairs = list(zip(idx[:-1], idx[1:]))
        else:
            pairs = [(a, b) for k, a in enumerate(idx) for b in idx[k + 1:]]
        tests = []
        for a, b in pairs:
            if ests[a].n < min_test or ests[b].n < min_test: tests.append(None); continue
            tests.append(wald(ests[a], ests[b]))
        real = [t for t in tests if t is not None]
        if banner.adjust.get(g) == "holm" and real: holm(real)
        for (a, b), t in zip(pairs, tests):
            if t is None or not t.sig(alpha): continue
            if t.diff > 0: out[b] += banner.columns[a].letter
            else: out[a] += banner.columns[b].letter
    return out


# ----------------------------------------------------------------------------- formatting helpers for titles

def pct(p, dp=0): return f"{p * 100:.{dp}f}%"


def pts(d, dp=1, unit=" pts"):
    s = "+" if d > 0 else "−" if d < 0 else "±"
    return f"{s}{abs(d):.{dp}f}{unit}"
