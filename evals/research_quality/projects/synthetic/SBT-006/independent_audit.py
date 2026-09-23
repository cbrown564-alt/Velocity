"""Separate stdlib CSV/math.fsum pricing audit; no builder/author-estimator imports."""

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
PRICES = [4, 7, 10, 13]
COSTS = [0.5, 2.0, 3.0]


def read(p):
    return json.loads(p.read_text())


def base(rows):
    w = [r["wt_design"] for r in rows]
    s = math.fsum(w)
    return dict(
        n_unweighted=len(w),
        n_weighted=s,
        n_eff=s * s / math.fsum(v * v for v in w) if w else 0.0,
    )


def mean(rows, f):
    return math.fsum(r["wt_design"] * f(r) for r in rows) / base(rows)["n_weighted"]


def variance(rows, f):
    mu = mean(rows, f)
    return (
        len(rows)
        / (len(rows) - 1)
        * math.fsum(r["wt_design"] ** 2 * (f(r) - mu) ** 2 for r in rows)
        / base(rows)["n_weighted"] ** 2
    )


def state(b):
    return (
        "suppressed"
        if b["n_unweighted"] < 40
        else "small_base" if b["n_unweighted"] < 75 or b["n_eff"] < 40 else "reportable"
    )


def route(row, r):
    if r["type"] == "all_assigned":
        return True
    if r["type"] == "equals":
        return row[r["field"]] == r["value"]
    if r["type"] == "in":
        return row[r["field"]] in r["values"]
    if r["type"] == "all_of":
        return all(route(row, c) for c in r["conditions"])
    raise ValueError(r)


def describe(rows, v, book):
    b = book[v]
    e = [r for r in rows if route(r, b["route"])]
    q = [r for r in e if r[v] in b["valid_values"]]
    out = base(q)
    eb = base(e)
    out.update(
        eligible_n=len(e),
        eligible_weighted_n=eb["n_weighted"],
        eligible_n_eff=eb["n_eff"],
        structural_excluded_n=len(rows) - len(e),
        missing_counts={str(k): sum(r[v] == k for r in e) for k in [97, 98, 99]}
        | {"unexpected_blank": sum(r[v] is None for r in e)},
        status=state(out),
    )
    if q and out["status"] != "suppressed":
        out.update(
            mean=mean(q, lambda r: r[v]),
            distribution_pct={
                str(k): 100 * mean(q, lambda r: r[v] == k) for k in b["valid_values"]
            },
        )
        if b["valid_values"] == [1, 2, 3, 4, 5]:
            out.update(
                top2_pct=100 * mean(q, lambda r: r[v] >= 4),
                bottom2_pct=100 * mean(q, lambda r: r[v] <= 2),
            )
    return out


def intent(rows, all_assigned=False, suppress=True):
    valid = [r for r in rows if r["intent_5"] in [1, 2, 3, 4, 5]]
    q = rows if all_assigned else valid
    out = base(q)
    eb = base(rows)
    nonvalid = (eb["n_weighted"] - base(valid)["n_weighted"]) / eb["n_weighted"]
    out.update(
        eligible_n=len(rows),
        eligible_weighted_n=eb["n_weighted"],
        eligible_n_eff=eb["n_eff"],
        observed_valid_base=base(valid),
        module_eligible_base=base([r for r in rows if r["postprice_responded"] == 1]),
        missing_counts={
            str(k): sum(r["intent_5"] == k for r in rows) for k in [97, 98, 99]
        }
        | {"structural_blank": sum(r["intent_5"] is None for r in rows)},
        nonvalid_weighted_share=nonvalid,
        status=state(out),
    )
    if q and (not suppress or out["status"] != "suppressed"):
        fn = lambda r: r["intent_5"] in [4, 5]
        mu = mean(q, fn)
        var = variance(q, fn)
        out.update(
            mean=mu,
            pct=100 * mu,
            variance=var,
            se=math.sqrt(var),
            ci95_pct=[
                100 * (mu - 1.959963984540054 * math.sqrt(var)),
                100 * (mu + 1.959963984540054 * math.sqrt(var)),
            ],
        )
        if all_assigned:
            out.update(
                completion_bounds=[mu, mu + nonvalid],
                completion_bounds_pct=[100 * mu, 100 * (mu + nonvalid)],
            )
        else:
            out["distribution_pct"] = {
                str(k): 100 * mean(q, lambda r: r["intent_5"] == k) for k in range(1, 6)
            }
    return out


def proxy(r, p, c):
    factor = p - c
    v = factor * r["mean"]
    var = factor**2 * r["variance"]
    se = math.sqrt(var)
    return dict(
        price_gbp=p,
        assumed_variable_cost_gbp=c,
        estimate_gbp=v,
        variance=var,
        se_gbp=se,
        ci95_gbp=[v - 1.959963984540054 * se, v + 1.959963984540054 * se],
        **{k: r[k] for k in ["n_unweighted", "n_weighted", "n_eff"]},
    )


def contrast(a, b, ka=1, kb=1, scale=100):
    delta = scale * (ka * a["mean"] - kb * b["mean"])
    se = scale * math.sqrt(ka**2 * a["variance"] + kb**2 * b["variance"])
    return dict(
        estimate=delta,
        se=se,
        ci95=[delta - 1.959963984540054 * se, delta + 1.959963984540054 * se],
        p_raw=math.erfc(abs(delta / se) / math.sqrt(2)) if se else None,
        group_a_base={k: a[k] for k in ["n_unweighted", "n_weighted", "n_eff"]},
        group_b_base={k: b[k] for k in ["n_unweighted", "n_weighted", "n_eff"]},
    )


def adjust(results):
    names = sorted(
        results,
        key=lambda k: results[k]["p_raw"] if results[k]["p_raw"] is not None else 1,
    )
    running = 0
    for i, k in enumerate(names):
        running = max(
            running,
            min(
                1,
                (len(names) - i)
                * (results[k]["p_raw"] if results[k]["p_raw"] is not None else 1),
            ),
        )
        results[k]["p_holm"] = running


def corr(rows, a, b):
    q = [r for r in rows if r[a] in [1, 2, 3, 4, 5] and r[b] in [1, 2, 3, 4, 5]]
    out = base(q)
    ma = mean(q, lambda r: r[a])
    mb = mean(q, lambda r: r[b])
    cov = math.fsum(r["wt_design"] * (r[a] - ma) * (r[b] - mb) for r in q)
    va = math.fsum(r["wt_design"] * (r[a] - ma) ** 2 for r in q)
    vb = math.fsum(r["wt_design"] * (r[b] - mb) ** 2 for r in q)
    out.update(
        status=state(out),
        correlation=cov / math.sqrt(va * vb) if len(q) >= 40 else None,
    )
    return out


def audit():
    with (P / "synthetic_data/respondents.csv").open() as f:
        rows = [
            {
                k: v if k == "respondent_id" else float(v) if v else None
                for k, v in r.items()
            }
            for r in csv.DictReader(f)
        ]
    tables = read(P / "reference/analysis_results.json")["tables"]
    recipes = read(P / "hidden/audit_recipes.json")
    book = {v["name"]: v for v in read(P / "codebook.json")["variables"]}
    checks = []
    expected = {}

    def check(path, actual, value):
        if isinstance(value, dict):
            for k, v in value.items():
                check(path + "/" + k, actual.get(k, "MISSING"), v)
        elif isinstance(value, list):
            checks.append(
                dict(
                    check=path + "/length",
                    **{"pass": isinstance(actual, list) and len(actual) == len(value)},
                )
            )
            for i, v in enumerate(value):
                check(path + "/" + str(i), actual[i], v)
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
                    **({} if ok else dict(actual=actual, expected=value)),
                )
            )

    arms = {
        str(p): {
            mode: intent(
                [r for r in rows if r["assigned_price_gbp"] == p],
                mode == "all_assigned",
            )
            for mode in ["valid_case", "all_assigned"]
        }
        for p in PRICES
    }
    for entry in recipes:
        n = entry["table"]
        r = entry["recipe"]
        kind = r["kind"]
        if kind == "intent":
            v = arms
        elif kind == "proxy":
            v = {
                mode: {str(p): proxy(arms[str(p)][mode], p, r["cost"]) for p in PRICES}
                for mode in ["valid_case", "all_assigned"]
            }
        elif kind == "family":
            name = r["name"]
            mode = "all_assigned" if name == "P2_ALL_ASSIGNED_INTENT" else "valid_case"
            cs = (
                COSTS
                if name == "P4_CONTRIBUTION_SCENARIOS"
                else [0] if name == "P3_GROSS_PROXY" else [None]
            )
            v = {}
            for c in cs:
                for a, b in itertools.combinations(PRICES, 2):
                    key = f"{a}_minus_{b}" + (
                        "_cost_" + str(c).replace(".", "_")
                        if name == "P4_CONTRIBUTION_SCENARIOS"
                        else ""
                    )
                    v[key] = contrast(
                        arms[str(a)][mode],
                        arms[str(b)][mode],
                        1 if c is None else a - c,
                        1 if c is None else b - c,
                        100 if c is None else 1,
                    )
                    v[key].update(
                        price_a=a,
                        price_b=b,
                        assumed_cost_gbp=c,
                        family_size=18 if name == "P4_CONTRIBUTION_SCENARIOS" else 6,
                    )
            adjust(v)
        elif kind == "audience":
            groups = {
                str(p): {
                    str(g): intent(
                        [
                            x
                            for x in rows
                            if x["assigned_price_gbp"] == p
                            and x["time_pressed_family"] == g
                        ]
                    )
                    for g in [0, 1]
                }
                for p in [7, 10]
            }
            tests = {
                str(p): contrast(groups[str(p)]["1"], groups[str(p)]["0"])
                for p in [7, 10]
            }
            adjust(tests)
            v = dict(
                groups=groups,
                contrasts=tests,
                unknown_audience_n=sum(x["time_pressed_family"] == 97 for x in rows),
            )
        elif kind == "balance":
            v = {
                str(p): dict(
                    assigned_base=base(
                        [x for x in rows if x["assigned_price_gbp"] == p]
                    ),
                    profiles={
                        a: describe(
                            [x for x in rows if x["assigned_price_gbp"] == p], a, book
                        )
                        for a in r["variables"]
                    },
                )
                for p in PRICES
            }
        elif kind == "describe":
            v = dict(
                overall=describe(rows, r["variable"], book),
                by_price={
                    str(p): describe(
                        [x for x in rows if x["assigned_price_gbp"] == p],
                        r["variable"],
                        book,
                    )
                    for p in PRICES
                },
            )
        elif kind == "correlations":
            v = {a + "__" + b: corr(rows, a, b) for a, b in r["pairs"]}
        elif kind == "tiny":
            niche = [
                x
                for x in rows
                if x["age_band"] in [3, 4]
                and x["budget_band"] == 3
                and x["current_planning_method"] == 4
            ]
            v = {
                str(p): intent([x for x in niche if x["assigned_price_gbp"] == p])
                for p in PRICES
            }
            for cell in v.values():
                if cell["status"] == "suppressed":
                    cell.pop("nonvalid_weighted_share", None)
        else:
            raise ValueError(kind)
        expected[n] = v
        check(n, tables[n]["values"], v)
        if "chart" in tables[n]:
            if kind == "intent":
                numbers = [arms[str(p)]["valid_case"]["pct"] for p in PRICES]
            elif kind == "proxy":
                numbers = [v["valid_case"][str(p)]["estimate_gbp"] for p in PRICES]
            elif kind == "audience":
                numbers = [
                    v["groups"][str(p)][str(g)]["pct"] for p in [7, 10] for g in [1, 0]
                ]
            elif kind == "describe":
                numbers = list(v["overall"]["distribution_pct"].values())
            else:
                raise ValueError("Unmapped chart")
            check(n + "/chart_values", tables[n]["chart"]["values"], numbers)
    for p in PRICES:
        cell = tables["premium_niche"]["values"][str(p)]
        check(
            "tiny_" + str(p) + "_no_estimates",
            not any(
                k in cell
                for k in [
                    "mean",
                    "pct",
                    "variance",
                    "distribution_pct",
                    "se",
                    "ci95_pct",
                    "nonvalid_weighted_share",
                ]
            ),
            True,
        )
    niche = [
        x
        for x in rows
        if x["age_band"] in [3, 4]
        and x["budget_band"] == 3
        and x["current_planning_method"] == 4
    ]
    other = [x for x in rows if x not in niche]
    gap = intent(niche, False, False)["mean"] - intent(other, False, False)["mean"]
    check(
        "private_niche_trap",
        read(P / "hidden/realised_metrics.json")[
            "premium_niche_pooled_interest_gap_private"
        ],
        gap,
    )
    with tempfile.TemporaryDirectory(prefix="sbt006-replay-") as tmp:
        subprocess.run(
            [
                sys.executable,
                str(P / "hidden/gpt6_pro_source/generate_sbt006.py"),
                "--out",
                tmp,
                "--seed",
                "2026092206",
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
        study_id="SBT-006",
        method="Independent CSV/math.fsum implementation recomputes every public table and chart value, all five Holm families, scenario variances, missingness/bounds and private tiny-group trap; exact source replay.",
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
