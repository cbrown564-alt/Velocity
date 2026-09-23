"""Formatting and wording helpers shared by archetypes. Titles only state what a test supports."""
from __future__ import annotations


def fmt_value(v, kind):
    if v != v: return "n/a"
    if kind == "share": return f"{v * 100:.0f}%"
    if kind == "nps": return f"{'+' if v > 0 else '−' if v < 0 else ''}{abs(v):.0f}"
    return f"{v:.1f}"


def fmt_change(d, kind, dp=1):
    if kind == "share": d, unit = d * 100, " pts"
    elif kind == "nps": unit = " pts"
    else: unit = ""
    s = "+" if d > 0 else "−" if d < 0 else "±"
    return f"{s}{abs(d):.{dp}f}{unit}"


def unit_of(kind): return {"share": "proportion", "nps": "NPS points", "mean": "mean"}[kind]


def plot_value(v, kind):
    """Value as plotted: percentages as 0-100, NPS as points, means as-is."""
    if v != v: return None
    return round(v * 100, 1) if kind == "share" else round(v, 1)


def sig_word(sig): return "significant" if sig else "not significant"
