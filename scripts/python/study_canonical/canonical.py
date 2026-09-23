"""Canonical study format for Velocity synthetic studies (velocity.study.v1).

One codebook shape and one missing-value convention for every study, so that
tablebook and deck generators can run over any of them. Adapters in
``adapters/`` translate each source study; this module validates and writes.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

SCHEMA_VERSION = "velocity.study.v1"

# The single missing-value convention used by every canonical study.
# System-missing (blank) always means "not asked": the respondent was outside
# the question's universe. It is never a zero, a "No" or a don't know.
MISSING = {
    97: "Don't know / can't judge",
    98: "Prefer not to say",
    99: "Not answered / cannot be derived",
}
SYSMIS_MEANING = "Not asked (outside the question's universe)"

TYPES = {
    "identifier": "String or numeric respondent key",
    "weight": "Analysis weight (positive float)",
    "single": "Single-coded nominal answer",
    "ordinal": "Ordered categories that are not a rating scale (bands, frequency)",
    "scale": "Rating scale with labelled end points (agreement, likelihood, 0-10)",
    "binary": "0/1 flag, including members of a multi-response set",
    "count": "Integer count (days, occasions); labelled values optional",
    "numeric": "Continuous number",
}
ROLES = ["admin", "screener", "profile", "design", "core", "diagnostic", "derived", "weight"]
ARCHETYPES = ["tracker", "concept_test", "cx_diagnostic", "usage_attitudes", "campaign_evaluation", "pricing"]
MEASURE = {"identifier": "nominal", "weight": "scale", "single": "nominal", "ordinal": "ordinal",
           "scale": "ordinal", "binary": "nominal", "count": "scale", "numeric": "scale"}


def sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def var(name, label, vtype, role, *, question_id=None, question_text=None, text_source="codebook",
        values=None, missing=(), universe=None, universe_text="All respondents", set_id=None,
        scale=None, source_name=None, recode=None, derivation=None, notes=None, waves=None):
    """Build one canonical variable record. ``values`` is an ordered list of (code, label)."""
    return {
        "name": name, "source_name": source_name or name, "label": label, "type": vtype, "role": role,
        "measure": MEASURE[vtype], "question_id": question_id, "question_text": question_text,
        "text_source": text_source,
        "values": [{"code": int(c), "label": str(l)} for c, l in (values or [])],
        "missing": [int(m) for m in missing],
        "universe": {"text": universe_text, "expr": universe},
        "set": set_id, "scale": scale, "waves": waves,
        "recode": recode, "derivation": derivation, "notes": notes,
    }


def scale_meta(points, low, high, top=None, bottom=None):
    pts = list(points)
    return {"points": pts, "low_label": low, "high_label": high,
            "top_box": top if top is not None else pts[-2:], "bottom_box": bottom if bottom is not None else pts[:2]}


def study_record(**kw):
    rec = {"schema_version": SCHEMA_VERSION, "missing_policy": {
        "sysmis": SYSMIS_MEANING, **{str(k): v for k, v in MISSING.items()}}}
    rec.update(kw)
    assert rec["archetype"] in ARCHETYPES, rec["archetype"]
    return rec


# ----------------------------------------------------------------------------- validation

def validate(df: pd.DataFrame, study: dict) -> dict:
    """Structural checks. Returns a report; ``passed`` is False on any hard error."""
    errors, warnings, checks = [], [], {}
    vars_ = {v["name"]: v for v in study["variables"]}
    cols = list(df.columns)
    missing_in_cb = [c for c in cols if c not in vars_]
    missing_in_data = [v for v in vars_ if v not in cols]
    if missing_in_cb: errors.append(f"columns without codebook entry: {missing_in_cb}")
    if missing_in_data: errors.append(f"codebook variables not in data: {missing_in_data}")
    if [v["name"] for v in study["variables"]] != cols: errors.append("codebook order differs from column order")
    idv = study["id_variable"]
    if df[idv].duplicated().any() and not study.get("wave_variable"):
        errors.append("duplicate respondent ids")
    if study.get("wave_variable"):
        if df.duplicated([idv, study["wave_variable"]]).any(): errors.append("duplicate id within wave")
    w = df[study["weight"]]
    if w.isna().any() or (w <= 0).any(): errors.append("weight has missing or non-positive values")
    checks["rows"] = int(len(df))
    universe_report = {}
    for name, v in vars_.items():
        if v["type"] in ("identifier", "weight") or name not in df: continue
        s = df[name]
        if s.dtype == object:
            errors.append(f"{name}: non-numeric values remain"); continue
        valid = {x["code"] for x in v["values"]}
        allowed = valid | set(v["missing"])
        nonnull = s.dropna()
        if v["type"] in ("count", "numeric") and not v["values"]:
            bad = nonnull[(nonnull >= 97) & ~nonnull.isin(v["missing"])] if v["missing"] else nonnull[nonnull < 0]
        else:
            bad = nonnull[~nonnull.isin(allowed)]
        if len(bad): errors.append(f"{name}: {len(bad)} values outside codebook, e.g. {sorted(bad.unique())[:5]}")
        clash = valid & set(MISSING)
        if clash: errors.append(f"{name}: valid codes collide with missing codes {sorted(clash)}")
        # Universe: blank exactly when outside the universe.
        expr = v["universe"]["expr"]
        inside = df.eval(expr).astype(bool) if expr else pd.Series(True, index=df.index)
        blank_inside = int((s.isna() & inside).sum())
        filled_outside = int((s.notna() & ~inside).sum())
        if blank_inside or filled_outside:
            universe_report[name] = {"blank_inside_universe": blank_inside, "answered_outside_universe": filled_outside}
            (errors if filled_outside else warnings).append(
                f"{name}: {blank_inside} blank inside universe, {filled_outside} answered outside universe")
    checks["universe_mismatches"] = universe_report
    for st in study.get("sets", []):
        for m in st["members"]:
            if m not in vars_: errors.append(f"set {st['id']} member {m} missing")
    return {"passed": not errors, "errors": errors, "warnings": warnings, "checks": checks}


# ----------------------------------------------------------------------------- writers

def _value_labels(v):
    labels = {float(x["code"]): x["label"] for x in v["values"]}
    for m in v["missing"]:
        labels[float(m)] = MISSING[m]
    return labels


def write_outputs(df: pd.DataFrame, study: dict, outdir: Path, stem: str) -> dict:
    import pyreadstat
    outdir.mkdir(parents=True, exist_ok=True)
    vars_ = study["variables"]
    csv_path, sav_path, cb_path = outdir / f"{stem}.csv", outdir / f"{stem}.sav", outdir / "codebook.json"
    df.to_csv(csv_path, index=False, lineterminator="\n")
    labels = {v["name"]: v["label"][:256] for v in vars_}
    vlabels = {v["name"]: _value_labels(v) for v in vars_ if v["values"] or v["missing"]}
    miss = {v["name"]: [float(m) for m in v["missing"]] for v in vars_ if v["missing"]}
    measure = {v["name"]: v["measure"] for v in vars_}
    fmt = {}
    for v in vars_:
        if v["type"] == "weight": fmt[v["name"]] = "F12.8"
        elif v["type"] == "identifier": continue
        else: fmt[v["name"]] = "F8.0"
    pyreadstat.write_sav(df, sav_path, column_labels=labels, variable_value_labels=vlabels,
                         missing_ranges=miss, variable_measure=measure, variable_format=fmt,
                         file_label=study["title"][:64], row_compress=True)
    cb_path.write_text(json.dumps(study, indent=2, ensure_ascii=False) + "\n")
    return {"csv": csv_path, "sav": sav_path, "codebook": cb_path}


def check_sav_roundtrip(df: pd.DataFrame, study: dict, sav_path: Path) -> dict:
    """Reread the SAV with user-missing preserved and compare with the canonical frame."""
    import pyreadstat
    back, meta = pyreadstat.read_sav(sav_path, user_missing=True)
    problems = []
    if list(back.columns) != list(df.columns): problems.append("column order")
    if len(back) != len(df): problems.append("row count")
    for v in study["variables"]:
        n = v["name"]
        a, b = df[n], back[n]
        if v["type"] == "identifier":
            if not (a.astype(str).values == b.astype(str).values).all(): problems.append(f"{n}: ids differ")
            continue
        if not np.allclose(a.fillna(-1e9).astype(float), b.fillna(-1e9).astype(float), rtol=0, atol=1e-9 if v["type"] == "weight" else 0):
            problems.append(f"{n}: values differ")
        if meta.column_names_to_labels.get(n) != v["label"][:256]: problems.append(f"{n}: variable label differs")
        want = _value_labels(v)
        got = meta.variable_value_labels.get(n, {})
        if {float(k): l for k, l in got.items()} != want: problems.append(f"{n}: value labels differ")
        if v["missing"]:
            got_m = sorted(float(x) for r in meta.missing_ranges.get(n, []) for x in {r["lo"], r["hi"]})
            if got_m != sorted(float(m) for m in v["missing"]): problems.append(f"{n}: user-missing differs {got_m}")
    return {"passed": not problems, "problems": problems}
