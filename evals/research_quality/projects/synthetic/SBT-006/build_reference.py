"""Independent pricing reference from public rows and prespecified estimands."""

import hashlib
import itertools
import json
import math
from pathlib import Path
import sys
import numpy as np
import pandas as pd

P = Path(__file__).resolve().parent
ROOT = P.parents[4]
sys.path.insert(0, str(ROOT / "scripts/python/research_quality"))
from expansion_inference import holm

PRICES = [4, 7, 10, 13]
COSTS = [0.5, 2.0, 3.0]


def read(p):
    return json.loads(p.read_text())


def write(p, v):
    p.write_text(json.dumps(v, indent=2, allow_nan=False) + "\n")


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def base(w):
    s = float(w.sum())
    sq = float(w.pow(2).sum())
    return dict(n_unweighted=len(w), n_weighted=s, n_eff=s * s / sq if sq else 0.0)


def avg(x, w):
    return float((x * w).sum() / w.sum())


def var(x, w):
    return (
        float(len(w) / (len(w) - 1) * ((w * (x - avg(x, w))) ** 2).sum() / w.sum() ** 2)
        if len(w) > 1
        else None
    )


def status(n, ess):
    return (
        "suppressed" if n < 40 else "small_base" if n < 75 or ess < 40 else "reportable"
    )


def eligible(d, r):
    if r["type"] == "all_assigned":
        return pd.Series(True, index=d.index)
    if r["type"] == "equals":
        return d[r["field"]].eq(r["value"])
    if r["type"] == "in":
        return d[r["field"]].isin(r["values"])
    if r["type"] == "all_of":
        return pd.concat([eligible(d, c) for c in r["conditions"]], axis=1).all(axis=1)
    raise ValueError("Unknown route")


def describe(d, v, codes, route, suppress=True):
    e = d[eligible(d, route)]
    q = e[e[v].isin(codes)]
    r = base(q.wt_design)
    eb = base(e.wt_design)
    r.update(
        eligible_n=eb["n_unweighted"],
        eligible_weighted_n=eb["n_weighted"],
        eligible_n_eff=eb["n_eff"],
        structural_excluded_n=len(d) - len(e),
        missing_counts={str(k): int(e[v].eq(k).sum()) for k in [97, 98, 99]}
        | {"unexpected_blank": int(e[v].isna().sum())},
        status=status(len(q), r["n_eff"]),
    )
    if len(q) and (not suppress or r["status"] != "suppressed"):
        r.update(
            mean=avg(q[v], q.wt_design),
            distribution_pct={
                str(k): 100
                * float(q.loc[q[v].eq(k), "wt_design"].sum() / q.wt_design.sum())
                for k in codes
            },
        )
        if codes == [1, 2, 3, 4, 5]:
            r.update(
                top2_pct=sum(r["distribution_pct"][str(k)] for k in [4, 5]),
                bottom2_pct=sum(r["distribution_pct"][str(k)] for k in [1, 2]),
            )
    return r


def intent(d, all_assigned=False, suppress=True):
    valid = d.intent_5.isin([1, 2, 3, 4, 5])
    q = d if all_assigned else d[valid]
    w = q.wt_design
    eb = base(d.wt_design)
    vb = base(d.loc[valid, "wt_design"])
    r = base(w)
    r.update(
        eligible_n=eb["n_unweighted"],
        eligible_weighted_n=eb["n_weighted"],
        eligible_n_eff=eb["n_eff"],
        observed_valid_base=vb,
        module_eligible_base=base(d.loc[d.postprice_responded.eq(1), "wt_design"]),
        missing_counts={str(k): int(d.intent_5.eq(k).sum()) for k in [97, 98, 99]}
        | {"structural_blank": int(d.intent_5.isna().sum())},
        nonvalid_weighted_share=(
            float(d.loc[~valid, "wt_design"].sum() / d.wt_design.sum())
            if len(d)
            else None
        ),
        status=status(len(q), r["n_eff"]),
        estimand=(
            "all_assigned_recorded_positive_sensitivity"
            if all_assigned
            else "valid_case_stated_intent"
        ),
    )
    if len(q) and (not suppress or r["status"] != "suppressed"):
        y = q.intent_5.isin([4, 5]).astype(int)
        mu = avg(y, w)
        variance = var(y, w)
        r.update(
            mean=mu,
            pct=100 * mu,
            variance=variance,
            se=math.sqrt(variance),
            ci95_pct=[
                100 * (mu - 1.959963984540054 * math.sqrt(variance)),
                100 * (mu + 1.959963984540054 * math.sqrt(variance)),
            ],
        )
        if all_assigned:
            r.update(
                completion_bounds=[mu, mu + r["nonvalid_weighted_share"]],
                completion_bounds_pct=[
                    100 * mu,
                    100 * (mu + r["nonvalid_weighted_share"]),
                ],
            )
        else:
            r.update(
                distribution_pct={
                    str(k): 100 * float(w[q.intent_5.eq(k)].sum() / w.sum())
                    for k in range(1, 6)
                }
            )
    return r


def proxy(r, price, cost=0):
    k = price - cost
    variance = k * k * r["variance"]
    value = k * r["mean"]
    se = math.sqrt(variance)
    return dict(
        price_gbp=price,
        assumed_variable_cost_gbp=cost,
        estimate_gbp=value,
        variance=variance,
        se_gbp=se,
        ci95_gbp=[value - 1.959963984540054 * se, value + 1.959963984540054 * se],
        n_unweighted=r["n_unweighted"],
        n_weighted=r["n_weighted"],
        n_eff=r["n_eff"],
        unit="GBP per hypothetical household-month; scenario proxy, not observed economics",
    )


def contrast(a, b, ka=1, kb=1, scale=100):
    if a["status"] == "suppressed" or b["status"] == "suppressed":
        return dict(status="suppressed", group_a=a, group_b=b)
    delta = scale * (ka * a["mean"] - kb * b["mean"])
    se = scale * math.sqrt(ka * ka * a["variance"] + kb * kb * b["variance"])
    return dict(
        status=(
            "small_base" if "small_base" in [a["status"], b["status"]] else "reportable"
        ),
        estimate=delta,
        se=se,
        ci95=[delta - 1.959963984540054 * se, delta + 1.959963984540054 * se],
        p_raw=math.erfc(abs(delta / se) / math.sqrt(2)) if se else None,
        group_a_base={k: a[k] for k in ["n_unweighted", "n_weighted", "n_eff"]},
        group_b_base={k: b[k] for k in ["n_unweighted", "n_weighted", "n_eff"]},
    )


def correlation(d, a, b):
    q = d[d[a].isin(range(1, 6)) & d[b].isin(range(1, 6))]
    w = q.wt_design
    r = base(w)
    x = q[a] - avg(q[a], w)
    y = q[b] - avg(q[b], w)
    r.update(
        status=status(len(q), r["n_eff"]),
        correlation=(
            float((w * x * y).sum() / math.sqrt((w * x * x).sum() * (w * y * y).sum()))
            if len(q) >= 40
            else None
        ),
    )
    return r


def build():
    if (P / "freeze.json").exists():
        raise ValueError("Frozen study must not be rebuilt")
    d = pd.read_csv(P / "synthetic_data/respondents.csv")
    book = read(P / "codebook.json")
    materials = read(P / "study_materials.json")
    hidden = read(P / "hidden/hidden_design.json")
    variables = {v["name"]: v for v in book["variables"]}
    tables = {}
    recipes = []

    def chart(labels, values, unit="percent", bases=None):
        return dict(labels=labels, values=values, unit=unit, bases=bases or [])

    def add(name, title, sources, universe, values, recipe, ch=None):
        t = dict(
            analysis_id=name,
            title=title,
            source_variables=sources,
            universe=universe,
            weighting="wt_design; fixed baseline profile weights; no nonresponse correction",
            values=values,
        )
        if ch:
            t["chart"] = ch
        tables[name] = t
        recipes.append(dict(table=name, recipe=recipe))

    arms = {
        str(p): dict(
            valid_case=intent(d[d.assigned_price_gbp.eq(p)]),
            all_assigned=intent(d[d.assigned_price_gbp.eq(p)], True),
        )
        for p in PRICES
    }
    add(
        "intent_by_price",
        "Stated subscription interest by assigned monthly price",
        ["assigned_price_gbp", "intent_5", "postprice_responded"],
        "One randomly assigned price per household; valid-case and all-assigned denominators explicitly separate",
        arms,
        dict(kind="intent"),
        chart(
            ["£" + str(p) for p in PRICES],
            [arms[str(p)]["valid_case"]["pct"] for p in PRICES],
            bases=[arms[str(p)]["valid_case"]["n_unweighted"] for p in PRICES],
        ),
    )
    gross = {
        mode: {str(p): proxy(arms[str(p)][mode], p) for p in PRICES}
        for mode in ["valid_case", "all_assigned"]
    }
    add(
        "gross_proxy",
        "Price-times-stated-interest proxy",
        ["assigned_price_gbp", "intent_5"],
        "Separate valid-case and conservative all-assigned scenarios; not revenue forecast",
        gross,
        dict(kind="proxy", cost=0),
        chart(
            ["£" + str(p) for p in PRICES],
            [gross["valid_case"][str(p)]["estimate_gbp"] for p in PRICES],
            "GBP_proxy",
            [arms[str(p)]["valid_case"]["n_unweighted"] for p in PRICES],
        ),
    )
    costs = {}
    for c in COSTS:
        values = {
            mode: {str(p): proxy(arms[str(p)][mode], p, c) for p in PRICES}
            for mode in ["valid_case", "all_assigned"]
        }
        costs[str(c)] = values
        add(
            "contribution_cost_" + str(c).replace(".", "_"),
            "Contribution proxy at assumed £" + str(c) + " variable cost",
            ["assigned_price_gbp", "intent_5"],
            "Assumed variable cost per proxy-positive subscriber-month, constant across prices; not actual costs or profit",
            values,
            dict(kind="proxy", cost=c),
            chart(
                ["£" + str(p) for p in PRICES],
                [values["valid_case"][str(p)]["estimate_gbp"] for p in PRICES],
                "GBP_proxy",
                [arms[str(p)]["valid_case"]["n_unweighted"] for p in PRICES],
            ),
        )
    families = {}
    for name, mode, c in [
        ("P1_VALID_INTENT", "valid_case", None),
        ("P2_ALL_ASSIGNED_INTENT", "all_assigned", None),
        ("P3_GROSS_PROXY", "valid_case", 0),
        ("P4_CONTRIBUTION_SCENARIOS", "valid_case", "scenarios"),
    ]:
        tests = {}
        for cost in (COSTS if c == "scenarios" else [c]):
            for a, b in itertools.combinations(PRICES, 2):
                key = f"{a}_minus_{b}" + (
                    "_cost_" + str(cost).replace(".", "_") if c == "scenarios" else ""
                )
                r = contrast(
                    arms[str(a)][mode],
                    arms[str(b)][mode],
                    1 if cost is None else a - cost,
                    1 if cost is None else b - cost,
                    100 if cost is None else 1,
                )
                r.update(
                    price_a=a,
                    price_b=b,
                    unit="percentage_points" if cost is None else "GBP_proxy",
                    assumed_cost_gbp=cost,
                )
                tests[key] = r
        adjusted = holm([v.get("p_raw") for v in tests.values()])
        for r, padj in zip(tests.values(), adjusted):
            r.update(p_holm=padj, family=name, family_size=len(tests))
        families[name] = tests
        add(
            name,
            "Prespecified " + name + " contrasts",
            ["assigned_price_gbp", "intent_5"],
            "Disjoint price assignments; cheaper minus dearer; pointwise normal intervals with fixed-family Holm p-values",
            tests,
            dict(kind="family", name=name),
        )
    audience = {}
    audtests = {}
    for p in [7, 10]:
        q = d[d.assigned_price_gbp.eq(p)]
        g = {str(k): intent(q[q.time_pressed_family.eq(k)]) for k in [0, 1]}
        audience[str(p)] = g
        audtests[str(p)] = contrast(g["1"], g["0"])
    for r, padj in zip(
        audtests.values(), holm([r["p_raw"] for r in audtests.values()])
    ):
        r.update(p_holm=padj, family="P5_BASELINE_AUDIENCE", family_size=2)
    add(
        "audience_intent",
        "Intent in the prespecified time-pressed-family audience",
        ["assigned_price_gbp", "time_pressed_family", "intent_5"],
        "Valid baseline audience and intent at the same assigned mid-price; audience 1 minus 0 is observational",
        dict(
            groups=audience,
            contrasts=audtests,
            unknown_audience_n=int(d.time_pressed_family.eq(97).sum()),
        ),
        dict(kind="audience"),
        chart(
            ["£7: audience", "£7: other", "£10: audience", "£10: other"],
            [audience[str(p)][str(g)]["pct"] for p in [7, 10] for g in [1, 0]],
            bases=[
                audience[str(p)][str(g)]["n_unweighted"]
                for p in [7, 10]
                for g in [1, 0]
            ],
        ),
    )
    profile = [
        "age_band",
        "household_children",
        "budget_band",
        "current_planning_method",
        "weekday_time_pressure_5",
        "digital_confidence_5",
        "subscription_spend_band",
    ]
    balance = {
        str(p): dict(
            assigned_base=base(d.loc[d.assigned_price_gbp.eq(p), "wt_design"]),
            profiles={
                v: describe(
                    d[d.assigned_price_gbp.eq(p)],
                    v,
                    variables[v]["valid_values"],
                    variables[v]["route"],
                )
                for v in profile
            },
        )
        for p in PRICES
    }
    add(
        "assignment_balance",
        "Assigned bases and baseline profile balance",
        profile + ["assigned_price_gbp"],
        "All randomly assigned households, before conditioning on post-price response",
        balance,
        dict(kind="balance", variables=profile),
    )
    # Complete diagnostic distributions and routed bases remain available by price and pooled.
    descriptive = [
        v
        for v, b in variables.items()
        if b.get("valid_values")
        and (
            v.endswith("_5")
            or v
            in [
                "primary_use_goal",
                "anticipated_use_days_7",
                "reason_not_commit",
                "time_pressed_family",
                "postprice_responded",
            ]
        )
    ]
    for v in descriptive:
        b = variables[v]
        r = dict(
            overall=describe(d, v, b["valid_values"], b["route"]),
            by_price={
                str(p): describe(
                    d[d.assigned_price_gbp.eq(p)], v, b["valid_values"], b["route"]
                )
                for p in PRICES
            },
        )
        ch = (
            chart(
                list(b["codes"].values()),
                list(r["overall"]["distribution_pct"].values()),
                bases=[r["overall"]["n_unweighted"]],
            )
            if "distribution_pct" in r["overall"]
            else None
        )
        add(
            v,
            b["label"],
            [v, "assigned_price_gbp"],
            b["route"]["text"],
            r,
            dict(kind="describe", variable=v),
            ch,
        )
    pairs = [
        ("intent_5", v)
        for v in [
            "value_5",
            "fit_5",
            "affordability_5",
            "ease_5",
            "trust_5",
            "differentiation_5",
        ]
    ] + [("value_5", "affordability_5")]
    correlations = {a + "__" + b: correlation(d, a, b) for a, b in pairs}
    add(
        "diagnostic_correlations",
        "Descriptive ordinal-score correlations",
        sorted(set(sum(([a, b] for a, b in pairs), []))),
        "Pairwise valid 1–5 scores; pooled across prices; no causal mechanism or independent-driver interpretation",
        correlations,
        dict(kind="correlations", pairs=pairs),
    )
    niche = (
        d.age_band.isin([3, 4]) & d.budget_band.eq(3) & d.current_planning_method.eq(4)
    )
    tiny = {str(p): intent(d[niche & d.assigned_price_gbp.eq(p)]) for p in PRICES}
    for cell in tiny.values():
        if cell["status"] == "suppressed":
            cell.pop("nonvalid_weighted_share", None)
    add(
        "premium_niche",
        "Exploratory older comfortable paid-planning niche",
        [
            "age_band",
            "budget_band",
            "current_planning_method",
            "assigned_price_gbp",
            "intent_5",
        ],
        "Price-specific valid intent bases; suppress every n<40 cell regardless of pooled size",
        tiny,
        dict(kind="tiny"),
    )
    qv = {p: arms[str(p)]["valid_case"]["mean"] for p in PRICES}
    qa = {p: arms[str(p)]["all_assigned"]["mean"] for p in PRICES}
    g = {p: p * qv[p] for p in PRICES}
    c2 = {p: (p - 2) * qv[p] for p in PRICES}
    grossmid = families["P3_GROSS_PROXY"]["7_minus_10"]
    cmid = families["P4_CONTRIBUTION_SCENARIOS"]["7_minus_10_cost_2_0"]
    valid = d.intent_5.isin(range(1, 6))
    use = variables["anticipated_use_days_7"]
    us = describe(d, "anticipated_use_days_7", use["valid_values"], use["route"])
    known = d.time_pressed_family.isin([0, 1])
    metrics = {
        **{"valid_intent_" + str(p): qv[p] for p in PRICES},
        "interest_gap_4_minus_13": qv[4] - qv[13],
        "interest_4_13_holm_p": families["P1_VALID_INTENT"]["4_minus_13"]["p_holm"],
        "interest_nonincreasing": int(
            all(qv[a] >= qv[b] for a, b in zip(PRICES, PRICES[1:]))
        ),
        "gross_mid_best_minus_extremes_best": max(g[7], g[10]) - max(g[4], g[13]),
        "gross_7_minus_10": g[7] - g[10],
        "contribution_base_10_minus_7": c2[10] - c2[7],
        "gross_point_leader_is_7": int(max(g, key=g.get) == 7),
        "base_contribution_point_leader_is_10": int(max(c2, key=c2.get) == 10),
        "gross_mid_ci_includes_zero": int(
            grossmid["ci95"][0] <= 0 <= grossmid["ci95"][1]
        ),
        "base_contribution_mid_ci_includes_zero": int(
            cmid["ci95"][0] <= 0 <= cmid["ci95"][1]
        ),
        "contribution_cost_0_5_7_minus_10": 6.5 * qv[7] - 9.5 * qv[10],
        "contribution_cost_3_0_10_minus_7": 7 * qv[10] - 4 * qv[7],
        "mid_price_cost_crossing": (g[7] - g[10]) / (qv[7] - qv[10]),
        "intent_valid_fraction_all": float(valid.mean()),
        "nonvalid_share_13_minus_4": arms["13"]["valid_case"]["nonvalid_weighted_share"]
        - arms["4"]["valid_case"]["nonvalid_weighted_share"],
        "largest_valid_minus_all_assigned_intent": max(qv[p] - qa[p] for p in PRICES),
        "module_exit_fraction": float(d.postprice_responded.eq(0).mean()),
        "baseline_audience_share": avg(
            d.loc[known, "time_pressed_family"], d.loc[known, "wt_design"]
        ),
        "audience_intent_gap_at_7": audtests["7"]["estimate"] / 100,
        "audience_intent_gap_at_10": audtests["10"]["estimate"] / 100,
        "corr_intent_value_weighted": correlations["intent_5__value_5"]["correlation"],
        "corr_value_affordability_weighted": correlations["value_5__affordability_5"][
            "correlation"
        ],
        "anticipated_use_eligible_fraction": float(eligible(d, use["route"]).mean()),
        "anticipated_use_ge3_conditional": sum(
            us["distribution_pct"][str(i)] for i in range(3, 8)
        )
        / 100,
        "premium_niche_assigned_n": int(niche.sum()),
        "premium_niche_min_valid_cell_n": min(r["n_unweighted"] for r in tiny.values()),
        "premium_niche_max_valid_cell_n": max(r["n_unweighted"] for r in tiny.values()),
        "premium_niche_pooled_interest_gap_private": intent(d[niche], False, False)[
            "mean"
        ]
        - intent(d[~niche], False, False)["mean"],
    }
    checks = []

    def check(name, ok, **extra):
        checks.append(dict(check=name, **extra, **{"pass": bool(ok)}))

    for b in hidden["prospective_checks"]:
        v = float(metrics[b["metric"]])
        check(
            b["id"],
            b["lower_inclusive"] - 1e-10 <= v <= b["upper_inclusive"] + 1e-10,
            metric=b["metric"],
            value=v,
            bounds=[b["lower_inclusive"], b["upper_inclusive"]],
        )
    check(
        "rows_columns_ids",
        len(d) == 3000
        and len(d.columns) == 28
        and d.respondent_id.is_unique
        and set(d) == set(variables),
    )
    check(
        "balanced_assignment",
        all(d.assigned_price_gbp.eq(p).sum() == 750 for p in PRICES),
    )
    check(
        "price_code_values",
        all(
            d.loc[d.assigned_price_arm.eq(i + 1), "assigned_price_gbp"].eq(p).all()
            for i, p in enumerate(PRICES)
        ),
    )
    check(
        "weights_positive_finite",
        np.isfinite(d.wt_design).all() and d.wt_design.gt(0).all(),
    )
    cells = materials["sampling"]["joint_cells"]
    raw = np.array(
        [
            cells[int(h) - 1]["target_share"] / cells[int(h) - 1]["sample_share"]
            for h in d.design_stratum
        ]
    )
    check(
        "weights_baseline_only",
        np.allclose(d.wt_design, raw * len(d) / raw.sum(), atol=1e-13, rtol=0),
    )
    for v, b in variables.items():
        if not b.get("valid_values"):
            continue
        check(
            "codes_" + v,
            d[v]
            .dropna()
            .isin(b["valid_values"] + [int(k) for k in b["missing_values"]])
            .all(),
        )
        check("route_" + v, d[v].isna().equals(~eligible(d, b["route"])))
    expected = np.where(
        d.household_children.eq(0),
        0,
        np.where(
            d.weekday_time_pressure_5.isin([4, 5]),
            1,
            np.where(d.weekday_time_pressure_5.isin([1, 2, 3]), 0, 97),
        ),
    )
    check(
        "audience_observed_baseline_derivation",
        (d.time_pressed_family == expected).all(),
    )
    check(
        "pre_execution_design_unchanged",
        read(P / "hidden/pre_execution_design.json")
        == {k: v for k, v in hidden.items() if k not in ["executed_seed", "seed_note"]},
    )
    analysis = dict(
        project_id="SBT-006",
        study_id="SBT-006",
        source_sha256=sha(P / "synthetic_data/respondents.csv"),
        analysis_version="1.0.0",
        estimands=materials["estimands"],
        inference=materials["inference"],
        financial_scenario_assumptions=materials["financial_scenario_assumptions"],
        tables=tables,
    )
    write(P / "reference/analysis_results.json", analysis)
    write(P / "hidden/audit_recipes.json", recipes)
    write(P / "hidden/realised_metrics.json", metrics)
    write(
        P / "hidden/freeze_validation.json",
        dict(
            study_id="SBT-006",
            status="PASS" if all(c["pass"] for c in checks) else "FAIL",
            threshold_roundoff_tolerance=1e-10,
            checks=checks,
        ),
    )
    bindings = {
        "M1": ["intent_by_price", "P1_VALID_INTENT", "P2_ALL_ASSIGNED_INTENT"],
        "M2": [
            "gross_proxy",
            "contribution_cost_2_0",
            "P3_GROSS_PROXY",
            "P4_CONTRIBUTION_SCENARIOS",
        ],
        "M3": [
            "P3_GROSS_PROXY",
            "P4_CONTRIBUTION_SCENARIOS",
            "contribution_cost_0_5",
            "contribution_cost_2_0",
            "contribution_cost_3_0",
        ],
        "M4": ["intent_by_price", "assignment_balance", "postprice_responded"],
        "S1": ["audience_intent"],
        "S2": ["diagnostic_correlations", "value_5", "affordability_5"],
        "S3": ["certainty_5", "anticipated_use_days_7"],
        "R1": ["P3_GROSS_PROXY", "P4_CONTRIBUTION_SCENARIOS"],
        "R2": ["premium_niche"],
        "R3": ["intent_by_price", "gross_proxy", "contribution_cost_2_0"],
    }
    evidence = [
        dict(
            evidence_id="E-" + n,
            analysis_id="tables." + n + ".values",
            values=t["values"],
            universe=t["universe"],
            weighting=t["weighting"],
            source_variables=t["source_variables"],
            interpretation=dict(
                permitted="Declared stated-intent and scenario proxy comparisons with the published bases and limitations.",
                unsupported_extensions=[
                    "Actual demand, sales, profit, elasticity or ROI",
                    "Certain optimal price",
                    "Suppressed subgroup targeting",
                    "Causal diagnostic drivers",
                ],
            ),
            fingerprint=hashlib.sha256(
                json.dumps(t, sort_keys=True).encode()
            ).hexdigest(),
        )
        for n, t in tables.items()
    ]
    findings = [
        dict(
            finding_id=f["id"],
            proposition=f["proposition"],
            tier=f["tier"],
            evidence_ids=["E-" + n for n in bindings[f["id"]]],
            claim_strength="stated_intent_and_scenario_proxy_or_restraint",
            analytical_relationship="comparison",
            topic_cluster=f["id"],
            qualification=f.get("claim_boundary", f.get("required_restraint")),
        )
        for f in hidden["reference_propositions"]
    ]
    write(
        P / "reference/evidence_inventory.json",
        dict(study_id="SBT-006", evidence=evidence),
    )
    write(
        P / "reference/reference_findings.json",
        dict(project_id="SBT-006", version="1.0.0", findings=findings),
    )
    print(
        json.dumps(
            dict(
                status="PASS" if all(c["pass"] for c in checks) else "FAIL",
                checks=len(checks),
                tables=len(tables),
                failed=[c for c in checks if not c["pass"]],
            )
        )
    )


if __name__ == "__main__":
    build()
