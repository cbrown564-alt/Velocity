"""CSV/math.fsum audit, independent of NumPy/pandas reference implementation."""

import csv
import hashlib
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile

P = Path(__file__).resolve().parent


def read(p):
    return json.loads(p.read_text())


def base(rows):
    w = [r["weight_base"] for r in rows]
    s = math.fsum(w)
    return dict(
        n_unweighted=len(w),
        n_weighted=s,
        n_eff=s * s / math.fsum(v * v for v in w) if w else 0.0,
    )


def avg(rows, fn):
    return math.fsum(r["weight_base"] * fn(r) for r in rows) / math.fsum(
        r["weight_base"] for r in rows
    )


def state(b):
    return (
        "suppressed"
        if b["n_unweighted"] < 40
        else (
            "small_base" if b["n_unweighted"] < 75 or b["n_eff"] < 50 else "reportable"
        )
    )


def route(r, v):
    if v.startswith("campaign_"):
        return r["followup_status"] == 1 and r["recall_post"] == 1
    if v in ["usage_days_post", "satisfaction_post"]:
        return r["followup_status"] == 1 and r["usage_post"] == 1
    return r["followup_status"] == 1 if v.endswith("_post") else True


def describe(rows, v, codes):
    e = [r for r in rows if route(r, v)]
    q = [r for r in e if r[v] in codes]
    b = base(q)
    b.update(
        eligible_n=len(e),
        eligible_weighted_n=base(e)["n_weighted"],
        eligible_n_eff=base(e)["n_eff"],
        structural_excluded_n=len(rows) - len(e),
        missing_counts={str(k): sum(r[v] == k for r in e) for k in [97, 98, 99]}
        | {"unexpected_blank": sum(r[v] is None for r in e)},
        status=state(b),
    )
    if q and b["status"] != "suppressed":
        b.update(
            mean=avg(q, lambda r: r[v]),
            distribution_pct={str(k): 100 * avg(q, lambda r: r[v] == k) for k in codes},
        )
        if codes == [1, 2, 3, 4, 5]:
            b["top2_pct"] = 100 * avg(q, lambda r: r[v] >= 4)
        if codes == [0, 1]:
            b["pct"] = 100 * avg(q, lambda r: r[v] == 1)
    return b


def valid_pair(r, e):
    return (
        r["followup_status"] == 1
        and r[e + "_pre"] in ([1, 2, 3, 4, 5] if e == "consideration" else [0, 1])
        and r[e + "_post"] in ([1, 2, 3, 4, 5] if e == "consideration" else [0, 1])
    )


def pair(rows, e, suppress=True):
    q = [r for r in rows if valid_pair(r, e)]
    b = base(q)
    b.update(
        eligible_n=len(rows),
        eligible_weighted_n=base(rows)["n_weighted"],
        eligible_n_eff=base(rows)["n_eff"],
        returned_n=sum(r["followup_status"] == 1 for r in rows),
        pair_n=len(q),
        excluded_pair_n=len(rows) - len(q),
        status=state(b),
    )
    for wave in ["pre", "post"]:
        b[wave + "_missing_counts"] = {
            str(k): sum(r[e + "_" + wave] == k for r in rows) for k in [97, 98, 99]
        } | {"structural_blank": sum(r[e + "_" + wave] is None for r in rows)}
    if q and (not suppress or b["status"] != "suppressed"):
        codes = [1, 2, 3, 4, 5] if e == "consideration" else [0, 1]
        for wave in ["pre", "post"]:
            b[wave + "_distribution_pct"] = {
                str(k): 100 * avg(q, lambda r: r[e + "_" + wave] == k) for k in codes
            }

        def y(r, w):
            return int(r[e + "_" + w] >= 4) if e == "consideration" else r[e + "_" + w]

        mu = avg(q, lambda r: y(r, "post") - y(r, "pre"))
        var = (
            len(q)
            / (len(q) - 1)
            * math.fsum(
                r["weight_base"] ** 2 * (y(r, "post") - y(r, "pre") - mu) ** 2
                for r in q
            )
            / base(q)["n_weighted"] ** 2
        )
        b.update(
            pre_pct=100 * avg(q, lambda r: y(r, "pre")),
            post_pct=100 * avg(q, lambda r: y(r, "post")),
            change_pp=100 * mu,
            variance_change=var,
        )
    return b


def inference(delta, var):
    se = math.sqrt(var)
    return dict(
        estimate_pp=delta,
        se_pp=se,
        ci95_pp=[delta - 1.959963984540054 * se, delta + 1.959963984540054 * se],
        p_raw=math.erfc(abs(delta / se) / math.sqrt(2)) if se else None,
    )


def contrast(rows, e, suppress=True):
    arms = {
        str(z): pair([r for r in rows if r["assignment"] == z], e, suppress)
        for z in [0, 1]
    }
    s = (
        "suppressed"
        if any(a["status"] == "suppressed" for a in arms.values())
        else (
            "small_base"
            if any(a["status"] == "small_base" for a in arms.values())
            else "reportable"
        )
    )
    out = dict(arms=arms, status=s)
    if not suppress or s != "suppressed":
        out.update(
            inference(
                arms["1"]["change_pp"] - arms["0"]["change_pp"],
                10000 * math.fsum(a["variance_change"] for a in arms.values()),
            )
        )
    return out


def corr(rows, a, b):
    q = [r for r in rows if r[a] in [1, 2, 3, 4, 5] and r[b] in [1, 2, 3, 4, 5]]
    out = base(q)
    ma = avg(q, lambda r: r[a])
    mb = avg(q, lambda r: r[b])
    cov = math.fsum(r["weight_base"] * (r[a] - ma) * (r[b] - mb) for r in q)
    va = math.fsum(r["weight_base"] * (r[a] - ma) ** 2 for r in q)
    vb = math.fsum(r["weight_base"] * (r[b] - mb) ** 2 for r in q)
    out["correlation"] = cov / math.sqrt(va * vb) if len(q) >= 40 else None
    return out


def audit():
    with (P / "synthetic_data/respondents.csv").open() as f:
        rows = [
            {
                k: (v if k == "respondent_id" else (float(v) if v else None))
                for k, v in r.items()
            }
            for r in csv.DictReader(f)
        ]
    tables = read(P / "reference/analysis_results.json")["tables"]
    recipes = read(P / "hidden/audit_recipes.json")
    book = {v["name"]: v for v in read(P / "codebook.json")["variables"]}
    expected = {}
    checks = []

    def check(path, actual, value):
        if isinstance(value, dict):
            for k, v in value.items():
                check(path + "." + k, actual.get(k, "MISSING"), v)
        elif isinstance(value, list):
            checks.append(
                dict(
                    check=path + ".length",
                    **{"pass": isinstance(actual, list) and len(actual) == len(value)}
                )
            )
            for i, v in enumerate(value):
                check(path + "." + str(i), actual[i], v)
        else:
            ok = (
                (
                    isinstance(actual, (int, float))
                    and math.isclose(actual, value, rel_tol=1e-10, abs_tol=1e-10)
                )
                if isinstance(value, (int, float))
                else actual == value
            )
            checks.append(
                dict(
                    check=path,
                    **{"pass": ok},
                    **({} if ok else dict(actual=actual, expected=value))
                )
            )

    for entry in recipes:
        name = entry["table"]
        r = entry["recipe"]
        kind = r["kind"]
        if kind == "describe":
            v = describe(rows, r["variable"], r["codes"])
        elif kind == "paired":
            v = contrast(rows, r["endpoint"])
        elif kind == "heterogeneity":
            groups = {
                str(c): contrast(
                    [x for x in rows if x["children_under18"] == c], r["endpoint"]
                )
                for c in [0, 1]
            }
            v = dict(
                groups=groups,
                **inference(
                    groups["1"]["estimate_pp"] - groups["0"]["estimate_pp"],
                    math.fsum(g["se_pp"] ** 2 for g in groups.values()),
                )
            )
        elif kind == "observational":
            g = r["group"]
            p = [x for x in rows if valid_pair(x, "consideration")]
            q = [x for x in p if x[g] in [0, 1]]
            groups = {
                str(k): pair([x for x in q if x[g] == k], "consideration")
                for k in [0, 1]
            }
            v = dict(
                groups=groups,
                pre_gap_pp=groups["1"]["pre_pct"] - groups["0"]["pre_pct"],
                post_gap_pp=groups["1"]["post_pct"] - groups["0"]["post_pct"],
                eligible_pair_n=len(p),
                valid_group_pair_n=len(q),
                excluded_group_n=len(p) - len(q),
            )
        elif kind == "by_group":
            v = {
                str(k): describe(
                    [x for x in rows if x[r["group"]] == k], r["variable"], r["codes"]
                )
                for k in [0, 1]
            }
        elif kind == "concordance":
            q = [
                x
                for x in rows
                if x["followup_status"] == 1 and x["recall_post"] in [0, 1]
            ]
            v = dict(
                recall_by_receipt={
                    str(k): describe(
                        [x for x in q if x["receipt_log"] == k], "recall_post", [0, 1]
                    )
                    for k in [0, 1]
                },
                receipt_among_recallers=describe(
                    [x for x in q if x["recall_post"] == 1], "receipt_log", [0, 1]
                ),
            )
        elif kind == "profile":
            q = (
                [x for x in rows if x["followup_status"] == 1]
                if r["returned_only"]
                else rows
            )
            v = {
                var: {
                    str(k): describe(
                        [x for x in q if x[r["group"]] == k],
                        var,
                        book[var]["valid_values"],
                    )
                    for k in [0, 1]
                }
                for var in r["variables"]
            }
        elif kind == "correlations":
            v = {
                a + "__" + b: corr(rows, a, b)
                for a, b in itertools.combinations(r["variables"], 2)
            }
        elif kind == "tiny":
            v = contrast(
                [
                    x
                    for x in rows
                    if x["age_band"] == 4
                    and x["online_grocery_pre"] == 1
                    and x["digital_confidence_pre"] in [4, 5]
                ],
                "awareness",
            )
        else:
            raise ValueError(kind)
        expected[name] = v
    for prefix in ["ITT_", "HET_"]:
        names = [prefix + e for e in ["awareness", "consideration", "usage"]]
        ordered = sorted(names, key=lambda n: expected[n]["p_raw"])
        running = 0
        for rank, n in enumerate(ordered):
            running = max(running, min(1, (3 - rank) * expected[n]["p_raw"]))
            expected[n]["p_holm"] = running
    for name, v in expected.items():
        check(name, tables[name]["values"], v)
    # A suppressed comparison cannot leak an estimate under an extra key.
    tiny = tables["older_digital_online"]["values"]
    check(
        "tiny.no_estimate",
        not any(k in tiny for k in ["estimate_pp", "ci95_pp", "p_raw", "se_pp"]),
        True,
    )
    for z, a in tiny["arms"].items():
        check(
            "tiny.arm." + z + ".no_estimate",
            not any(
                k in a
                for k in [
                    "pre_pct",
                    "post_pct",
                    "change_pp",
                    "pre_distribution_pct",
                    "post_distribution_pct",
                ]
            ),
            True,
        )
    q = [
        x
        for x in rows
        if x["age_band"] == 4
        and x["online_grocery_pre"] == 1
        and x["digital_confidence_pre"] in [4, 5]
    ]
    check(
        "private_tiny_trap",
        read(P / "hidden/realised_metrics.json")[
            "older_digital_online_awareness_itt_pp"
        ],
        contrast(q, "awareness", False)["estimate_pp"],
    )
    with tempfile.TemporaryDirectory(prefix="sbt005-replay-") as tmp:
        subprocess.run(
            [
                sys.executable,
                str(P / "hidden/gpt6_pro_source/generate_sbt005.py"),
                "--out",
                tmp,
                "--seed",
                "2026092205",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        for name in [
            "respondents.csv",
            "codebook.json",
            "questionnaire.md",
            "study_materials.json",
            "hidden_design.json",
        ]:
            current = (
                P
                / (
                    "synthetic_data"
                    if name == "respondents.csv"
                    else "hidden" if name == "hidden_design.json" else ""
                )
                / name
            )
            check(
                "replay_" + name,
                hashlib.sha256((Path(tmp) / name).read_bytes()).hexdigest(),
                hashlib.sha256(current.read_bytes()).hexdigest(),
            )
    result = dict(
        study_id="SBT-005",
        method="Separate stdlib csv/math.fsum implementation; no reference-builder or generator-estimator imports. Every public table numeric field recomputed; source replay byte-identical; private tiny trap verified.",
        status="PASS" if all(c["pass"] for c in checks) else "FAIL",
        checks=checks,
    )
    (P / "hidden/independent_audit.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    print(
        json.dumps(
            dict(
                status=result["status"],
                checks=len(checks),
                failed=[c for c in checks if not c["pass"]],
            )
        )
    )


if __name__ == "__main__":
    audit()
