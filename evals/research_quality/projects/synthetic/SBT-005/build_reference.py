"""Independent public-data reference; never imports the Pro generator calculations."""

import hashlib
import json
import math
from pathlib import Path
import sys
import numpy as np
import pandas as pd

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parents[4]
sys.path.insert(0, str(ROOT / "scripts/python/research_quality"))
from expansion_inference import holm

ENDPOINTS = ["awareness", "consideration", "usage"]
DIAGNOSTICS = ["campaign_clear_post", "campaign_relevant_post", "campaign_trust_post"]


def read(p):
    return json.loads(p.read_text())


def write(p, v):
    p.write_text(json.dumps(v, indent=2, allow_nan=False) + "\n")


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def base(w):
    total = float(w.sum())
    squares = float((w * w).sum())
    return dict(
        n_unweighted=len(w),
        n_weighted=total,
        n_eff=total * total / squares if squares else 0.0,
    )


def weighted(x, w):
    return float((x * w).sum() / w.sum())


def variance(x, w):
    if len(w) < 2:
        return None
    return float(
        len(w) / (len(w) - 1) * ((w * (x - weighted(x, w))) ** 2).sum() / w.sum() ** 2
    )


def status(n, ess):
    return (
        "suppressed"
        if n < 40
        else ("small_base" if n < 75 or ess < 50 else "reportable")
    )


def describe(d, var, codes, eligible=None, suppress=True):
    if eligible is None:
        eligible = pd.Series(True, index=d.index)
    e = d.loc[eligible]
    q = e[e[var].isin(codes)]
    r = base(q.weight_base)
    r.update(
        eligible_n=len(e),
        eligible_weighted_n=float(e.weight_base.sum()),
        eligible_n_eff=base(e.weight_base)["n_eff"],
        structural_excluded_n=len(d) - len(e),
        missing_counts={str(k): int((e[var] == k).sum()) for k in [97, 98, 99]}
        | {"unexpected_blank": int(e[var].isna().sum())},
        status=status(r["n_unweighted"], r["n_eff"]),
    )
    if len(q) and (not suppress or r["status"] != "suppressed"):
        r.update(
            mean=weighted(q[var], q.weight_base),
            distribution_pct={
                str(k): 100
                * float(q.loc[q[var] == k, "weight_base"].sum() / q.weight_base.sum())
                for k in codes
            },
        )
        if list(codes) == [1, 2, 3, 4, 5]:
            r["top2_pct"] = sum(r["distribution_pct"][str(k)] for k in [4, 5])
        if list(codes) == [0, 1]:
            r["pct"] = r["distribution_pct"]["1"]
    return r


def pair_mask(d, endpoint):
    codes = range(1, 6) if endpoint == "consideration" else [0, 1]
    return (
        d.followup_status.eq(1)
        & d[endpoint + "_pre"].isin(codes)
        & d[endpoint + "_post"].isin(codes)
    )


def pair_cell(d, endpoint, suppress=True):
    mask = pair_mask(d, endpoint)
    q = d[mask]
    w = q.weight_base
    r = base(w)
    r.update(
        eligible_n=len(d),
        eligible_weighted_n=float(d.weight_base.sum()),
        eligible_n_eff=base(d.weight_base)["n_eff"],
        returned_n=int(d.followup_status.eq(1).sum()),
        pair_n=len(q),
        excluded_pair_n=int((~mask).sum()),
        status=status(len(q), r["n_eff"]),
    )
    for wave in ["pre", "post"]:
        x = d[endpoint + "_" + wave]
        r[wave + "_missing_counts"] = {
            str(k): int(x.eq(k).sum()) for k in [97, 98, 99]
        } | {"structural_blank": int(x.isna().sum())}
    if len(q) and (not suppress or r["status"] != "suppressed"):
        pre = q[endpoint + "_pre"]
        post = q[endpoint + "_post"]
        codes = range(1, 6) if endpoint == "consideration" else [0, 1]
        for wave in ["pre", "post"]:
            r[wave + "_distribution_pct"] = {
                str(k): 100 * float(w[q[endpoint + "_" + wave].eq(k)].sum() / w.sum())
                for k in codes
            }
        if endpoint == "consideration":
            pre = pre.ge(4).astype(int)
            post = post.ge(4).astype(int)
        change = post - pre
        r.update(
            pre_pct=100 * weighted(pre, w),
            post_pct=100 * weighted(post, w),
            change_pp=100 * weighted(change, w),
            variance_change=variance(change, w),
        )
    return r


def infer(estimate, variance_sum):
    se = math.sqrt(variance_sum)
    return dict(
        estimate_pp=estimate,
        se_pp=se,
        ci95_pp=[estimate - 1.959963984540054 * se, estimate + 1.959963984540054 * se],
        p_raw=math.erfc(abs(estimate / se) / math.sqrt(2)) if se else None,
        interval_scope="Pointwise, not simultaneous; fixed-weight normal approximation",
    )


def pair_contrast(d, endpoint, suppress=True):
    arms = {
        str(z): pair_cell(d[d.assignment.eq(z)], endpoint, suppress) for z in [0, 1]
    }
    r = dict(
        arms=arms,
        status=(
            "suppressed"
            if any(a["status"] == "suppressed" for a in arms.values())
            else (
                "small_base"
                if any(a["status"] == "small_base" for a in arms.values())
                else "reportable"
            )
        ),
    )
    if not suppress or r["status"] != "suppressed":
        r.update(
            infer(
                arms["1"]["change_pp"] - arms["0"]["change_pp"],
                10000 * sum(a["variance_change"] for a in arms.values()),
            )
        )
    return r


def correlation(d, a, b):
    q = d[d[a].isin(range(1, 6)) & d[b].isin(range(1, 6))]
    w = q.weight_base
    r = base(w)
    x = q[a] - weighted(q[a], w)
    y = q[b] - weighted(q[b], w)
    r["correlation"] = (
        float((w * x * y).sum() / math.sqrt((w * x * x).sum() * (w * y * y).sum()))
        if len(q) >= 40
        else None
    )
    return r


def build():
    if (PROJECT / "freeze.json").exists():
        raise ValueError("Frozen study must not be rebuilt")
    d = pd.read_csv(PROJECT / "synthetic_data/respondents.csv")
    book = read(PROJECT / "codebook.json")
    materials = read(PROJECT / "study_materials.json")
    hidden = read(PROJECT / "hidden/hidden_design.json")
    variables = {v["name"]: v for v in book["variables"]}
    tables = {}
    audit = []

    def add(name, title, sources, universe, values, recipe, chart=None):
        t = dict(
            analysis_id=name,
            title=title,
            source_variables=sources,
            universe=universe,
            weighting="weight_base; fixed baseline profile weights, not attrition correction",
            values=values,
        )
        if chart:
            t["chart"] = chart
        tables[name] = t
        audit.append(dict(table=name, recipe=recipe))

    def chart(labels, values, unit="percent", bases=None):
        return dict(labels=labels, values=values, unit=unit, bases=bases or [])

    def route(name):
        if name in DIAGNOSTICS + ["campaign_channel_post"]:
            return d.followup_status.eq(1) & d.recall_post.eq(1)
        if name in ["usage_days_post", "satisfaction_post"]:
            return d.followup_status.eq(1) & d.usage_post.eq(1)
        if name.endswith("_post"):
            return d.followup_status.eq(1)
        return pd.Series(True, index=d.index)

    for name, v in variables.items():
        if not v.get("valid_values"):
            continue
        r = describe(d, name, v["valid_values"], route(name))
        ch = (
            chart(
                [v["value_labels"][str(k)] for k in v["valid_values"]],
                list(r["distribution_pct"].values()),
                bases=[r["n_unweighted"]],
            )
            if "distribution_pct" in r
            else None
        )
        add(
            name,
            v["label"],
            [name],
            v["route"],
            r,
            dict(kind="describe", variable=name, codes=v["valid_values"], route=name),
            ch,
        )
    primary = {}
    for endpoint in ENDPOINTS:
        r = pair_contrast(d, endpoint)
        primary[endpoint] = r
    adj = dict(zip(primary, holm([r["p_raw"] for r in primary.values()])))
    for endpoint, r in primary.items():
        r.update(p_holm=adj[endpoint], family="PRIMARY_ASSIGNMENT", family_size=3)
        add(
            "ITT_" + endpoint,
            "Assignment difference in paired " + endpoint + " change",
            [endpoint + "_pre", endpoint + "_post", "assignment", "followup_status"],
            "Endpoint-specific valid pairs; assigned grouping retained; observed pairs only",
            r,
            dict(kind="paired", endpoint=endpoint),
            chart(
                ["Control change", "Assigned change"],
                [r["arms"][str(z)]["change_pp"] for z in [0, 1]],
                "percentage_points",
                [r["arms"][str(z)]["pair_n"] for z in [0, 1]],
            ),
        )
    het = {}
    for e in ENDPOINTS:
        groups = {str(c): pair_contrast(d[d.children_under18.eq(c)], e) for c in [0, 1]}
        r = dict(
            groups=groups,
            **infer(
                groups["1"]["estimate_pp"] - groups["0"]["estimate_pp"],
                sum(g["se_pp"] ** 2 for g in groups.values()),
            )
        )
        het[e] = r
    adj = dict(zip(het, holm([r["p_raw"] for r in het.values()])))
    for e, r in het.items():
        r.update(
            p_holm=adj[e], family="SECONDARY_CHILDREN_HETEROGENEITY", family_size=3
        )
        add(
            "HET_" + e,
            "Children interaction in assignment change for " + e,
            [e + "_pre", e + "_post", "children_under18", "assignment"],
            "Endpoint-specific pairs; four disjoint assignment × children cells",
            r,
            dict(kind="heterogeneity", endpoint=e),
            chart(
                ["No children under 18", "Children under 18"],
                [r["groups"][str(c)]["estimate_pp"] for c in [0, 1]],
                "percentage_points",
            ),
        )
    for g in ["receipt_log", "recall_post"]:
        q = d[pair_mask(d, "consideration") & d[g].isin([0, 1])]
        groups = {str(k): pair_cell(q[q[g].eq(k)], "consideration") for k in [0, 1]}
        r = dict(
            groups=groups,
            pre_gap_pp=groups["1"]["pre_pct"] - groups["0"]["pre_pct"],
            post_gap_pp=groups["1"]["post_pct"] - groups["0"]["post_pct"],
            eligible_pair_n=int(pair_mask(d, "consideration").sum()),
            valid_group_pair_n=len(q),
            excluded_group_n=int(pair_mask(d, "consideration").sum()) - len(q),
            claim_limit="Observational grouping on the same consideration pairs. Not a random-assignment effect.",
        )
        add(
            "OBS_" + g,
            "Consideration by " + g + " on the same pairs",
            [g, "consideration_pre", "consideration_post"],
            "Valid consideration pairs; additionally valid recall for recall grouping",
            r,
            dict(kind="observational", group=g),
            chart(
                ["Baseline group gap", "Follow-up group gap"],
                [r["pre_gap_pp"], r["post_gap_pp"]],
                "percentage_points",
            ),
        )
    for name in ["followup_status", "receipt_log", "recall_post"]:
        r = {
            str(z): describe(
                d[d.assignment.eq(z)], name, [0, 1], route(name)[d.assignment.eq(z)]
            )
            for z in [0, 1]
        }
        add(
            name + "_by_assignment",
            name + " by assigned arm",
            [name, "assignment"],
            "All enrolled within assignment; recall additionally requires returned survey with valid recall",
            r,
            dict(
                kind="by_group",
                variable=name,
                codes=[0, 1],
                group="assignment",
                route=name,
            ),
            chart(
                ["Control", "Assigned"],
                [r[str(z)]["pct"] for z in [0, 1]],
                bases=[r[str(z)]["n_unweighted"] for z in [0, 1]],
            ),
        )
    q = d[d.followup_status.eq(1) & d.recall_post.isin([0, 1])]
    concordance = {
        str(g): describe(q[q.receipt_log.eq(g)], "recall_post", [0, 1]) for g in [0, 1]
    }
    r = dict(
        recall_by_receipt=concordance,
        receipt_among_recallers=describe(q[q.recall_post.eq(1)], "receipt_log", [0, 1]),
    )
    add(
        "log_recall_concordance",
        "Receipt and recall disagree",
        ["receipt_log", "recall_post"],
        "Returned households with valid recall; separate conditional bases",
        r,
        dict(kind="concordance"),
    )
    profile = [
        "awareness_pre",
        "consideration_pre",
        "usage_pre",
        "children_under18",
        "digital_confidence_pre",
        "budget_pressure_pre",
    ]
    for g in ["followup_status", "assignment"]:
        for returned_only in ([False] if g == "followup_status" else [False, True]):
            q = d[d.followup_status.eq(1)] if returned_only else d
            r = {
                v: {
                    str(k): describe(q[q[g].eq(k)], v, variables[v]["valid_values"])
                    for k in [0, 1]
                }
                for v in profile
            }
            suffix = "_returners" if returned_only else "_baseline"
            add(
                "profile_" + g + suffix,
                "Baseline profile by " + g + suffix,
                profile + [g],
                "Valid baseline responses in stated groups; returned subset only where named",
                r,
                dict(
                    kind="profile",
                    group=g,
                    returned_only=returned_only,
                    variables=profile,
                ),
            )
    stress = {
        str(c): describe(d[d.children_under18.eq(c)], "meal_stress_pre", range(1, 6))
        for c in [0, 1]
    }
    add(
        "children_stress",
        "Baseline meal-planning stress by children",
        ["meal_stress_pre", "children_under18"],
        "All enrolled; valid baseline stress",
        stress,
        dict(
            kind="by_group",
            variable="meal_stress_pre",
            codes=list(range(1, 6)),
            group="children_under18",
            route="meal_stress_pre",
        ),
        chart(
            ["No children under 18", "Children under 18"],
            [stress[str(c)]["mean"] for c in [0, 1]],
            "mean",
        ),
    )
    corrs = {
        a + "__" + b: correlation(d, a, b)
        for i, a in enumerate(DIAGNOSTICS)
        for b in DIAGNOSTICS[i + 1 :]
    }
    add(
        "message_correlations",
        "Correlated selected-recaller diagnostics",
        DIAGNOSTICS,
        "Returned recorded recallers; pairwise valid 1–5; descriptive correlations",
        corrs,
        dict(kind="correlations", variables=DIAGNOSTICS),
    )
    niche = (
        d.age_band.eq(4)
        & d.online_grocery_pre.eq(1)
        & d.digital_confidence_pre.isin([4, 5])
    )
    tiny = pair_contrast(d[niche], "awareness")
    add(
        "older_digital_online",
        "Exploratory older digital online-grocery subgroup",
        [
            "age_band",
            "online_grocery_pre",
            "digital_confidence_pre",
            "awareness_pre",
            "awareness_post",
            "assignment",
        ],
        "Age 65+, baseline online grocery, valid digital confidence 4/5; endpoint pairs by assignment",
        tiny,
        dict(kind="tiny"),
    )
    # The following values stay coordinator-only to check the original prospective design.
    pv = pair_contrast(d[niche], "awareness", False)
    rt = tables["followup_status_by_assignment"]["values"]
    rc = tables["receipt_log_by_assignment"]["values"]
    obs = tables["OBS_recall_post"]["values"]
    re = tables["OBS_receipt_log"]["values"]
    ret = tables["profile_followup_status_baseline"]["values"]
    metrics = {
        "followup_rate_pct": tables["followup_status"]["values"]["pct"],
        "return_assignment_difference_pp": rt["1"]["pct"] - rt["0"]["pct"],
        "baseline_awareness_returner_gap_pp": ret["awareness_pre"]["1"]["pct"]
        - ret["awareness_pre"]["0"]["pct"],
        "awareness_pair_pct": 100 * pair_mask(d, "awareness").mean(),
        "consideration_pair_pct": 100 * pair_mask(d, "consideration").mean(),
        "usage_pair_pct": 100 * pair_mask(d, "usage").mean(),
        "control_awareness_change_pp": primary["awareness"]["arms"]["0"]["change_pp"],
        "control_consideration_change_pp": primary["consideration"]["arms"]["0"][
            "change_pp"
        ],
        "control_usage_change_pp": primary["usage"]["arms"]["0"]["change_pp"],
        "awareness_itt_pp": primary["awareness"]["estimate_pp"],
        "consideration_itt_pp": primary["consideration"]["estimate_pp"],
        "usage_itt_pp": primary["usage"]["estimate_pp"],
        "awareness_minus_consideration_itt_pp": primary["awareness"]["estimate_pp"]
        - primary["consideration"]["estimate_pp"],
        "awareness_minus_usage_itt_pp": primary["awareness"]["estimate_pp"]
        - primary["usage"]["estimate_pp"],
        "awareness_p_holm": primary["awareness"]["p_holm"],
        "receipt_assignment1_pct": rc["1"]["pct"],
        "receipt_assignment0_pct": rc["0"]["pct"],
        "receipt_assignment_gap_pp": rc["1"]["pct"] - rc["0"]["pct"],
        "receipt_post_consideration_gap_pp": re["post_gap_pp"],
        "recall_post_consideration_gap_pp": obs["post_gap_pp"],
        "recall_gap_minus_consideration_itt_pp": obs["post_gap_pp"]
        - primary["consideration"]["estimate_pp"],
        "recall_baseline_consideration_gap_pp": obs["pre_gap_pp"],
        "recallers_without_receipt_pct": 100
        - tables["log_recall_concordance"]["values"]["receipt_among_recallers"]["pct"],
        "recipients_without_recall_pct": 100 - concordance["1"]["pct"],
        "minimum_message_diagnostic_correlation": min(
            v["correlation"] for v in corrs.values()
        ),
        "children_baseline_stress_difference": stress["1"]["mean"]
        - stress["0"]["mean"],
        "older_digital_online_awareness_pair_n": sum(
            a["pair_n"] for a in pv["arms"].values()
        ),
        "older_digital_online_min_arm_n": min(a["pair_n"] for a in pv["arms"].values()),
        "older_digital_online_awareness_itt_pp": pv["estimate_pp"],
        "baseline_kish_fraction": base(d.weight_base)["n_eff"] / len(d),
        "weight_max_min_ratio": float(d.weight_base.max() / d.weight_base.min()),
        "baseline_awareness_numeric_missing_pct": 100
        * d.awareness_pre.isin([97, 98, 99]).mean(),
        "post_consideration_numeric_missing_returner_pct": 100
        * d.loc[d.followup_status.eq(1), "consideration_post"]
        .isin([97, 98, 99])
        .mean(),
    }
    checks = []

    def check(name, passed, **extra):
        checks.append(dict(check=name, **extra, **{"pass": bool(passed)}))

    for b in hidden["realised_acceptance_intervals"]:
        value = float(metrics[b["metric"]])
        check(
            b["id"],
            b["lower_inclusive"] - 1e-10 <= value <= b["upper_inclusive"] + 1e-10,
            metric=b["metric"],
            value=value,
            bounds=[b["lower_inclusive"], b["upper_inclusive"]],
        )
    check(
        "rows_columns_ids",
        len(d) == 2800
        and len(d.columns) == 31
        and d.respondent_id.is_unique
        and set(d) == set(variables),
    )
    check(
        "assignment_exact", all(d.assignment.value_counts()[z] == 1400 for z in [0, 1])
    )
    check(
        "weights_positive_finite",
        np.isfinite(d.weight_base).all() and d.weight_base.gt(0).all(),
    )
    check("baseline_mean_weight_one", abs(d.weight_base.mean() - 1) < 1e-9)
    raw = []
    cells = materials["sampling"]["strata"]
    # Reconstruct target/sample profile weights using the public cell probabilities.
    for row in d.itertuples():
        cell = next(
            c
            for c in cells
            if c["age_band"] == row.age_band
            and c["online_grocery_pre"] == row.online_grocery_pre
        )
        raw.append(cell["target_joint_probability"] / cell["sample_joint_probability"])
    expected = np.array(raw) / np.mean(raw)
    check(
        "weights_only_baseline_cell",
        np.allclose(d.weight_base, expected, atol=6e-11, rtol=0),
    )
    for name, v in variables.items():
        if not v.get("valid_values"):
            continue
        check(
            "codes_" + name,
            d[name]
            .dropna()
            .isin(v["valid_values"] + v.get("missing_values", []))
            .all(),
        )
        check("route_" + name, d[name].isna().equals(~route(name)))
    check("receipt_count_agrees", d.receipt_count.eq(0).equals(d.receipt_log.eq(0)))
    pre = read(PROJECT / "hidden/pre_execution_design.json")
    check(
        "pre_execution_design_unchanged",
        pre == {k: v for k, v in hidden.items() if k != "execution_identity"},
    )
    analysis = dict(
        project_id="SBT-005",
        study_id="SBT-005",
        source_sha256=sha(PROJECT / "synthetic_data/respondents.csv"),
        analysis_version="1.0.0",
        analysis_policy=materials["analysis_policy"],
        tables=tables,
    )
    write(PROJECT / "reference/analysis_results.json", analysis)
    write(PROJECT / "hidden/audit_recipes.json", audit)
    write(PROJECT / "hidden/realised_metrics.json", metrics)
    write(
        PROJECT / "hidden/freeze_validation.json",
        dict(
            study_id="SBT-005",
            status="PASS" if all(c["pass"] for c in checks) else "FAIL",
            threshold_roundoff_tolerance=1e-10,
            checks=checks,
        ),
    )
    bindings = [
        ["ITT_awareness"],
        [
            "ITT_awareness",
            "ITT_consideration",
            "ITT_usage",
            "consideration_pre",
            "consideration_post",
        ],
        ["OBS_receipt_log", "OBS_recall_post", "ITT_consideration"],
        [
            "followup_status_by_assignment",
            "profile_followup_status_baseline",
            "profile_assignment_baseline",
            "profile_assignment_returners",
            "ITT_awareness",
            "ITT_consideration",
            "ITT_usage",
        ],
        [
            "receipt_log_by_assignment",
            "recall_post_by_assignment",
            "log_recall_concordance",
        ],
        DIAGNOSTICS + ["message_correlations", "satisfaction_post", "usage_days_post"],
        ["children_stress", "HET_awareness", "HET_consideration", "HET_usage"],
        ["OBS_receipt_log", "OBS_recall_post", "ITT_consideration"],
        [
            "ITT_awareness",
            "ITT_consideration",
            "ITT_usage",
            "followup_status_by_assignment",
        ],
        ["older_digital_online"],
    ]
    evidence = [
        dict(
            evidence_id="E-" + name,
            analysis_id="tables." + name + ".values",
            values=t["values"],
            universe=t["universe"],
            weighting=t["weighting"],
            source_variables=t["source_variables"],
            interpretation=dict(
                permitted="Declared observed-pair assignment contrast or labelled descriptive comparison with stated uncertainty and bases.",
                unsupported_extensions=[
                    "Full-cohort population effect despite attrition",
                    "Recall or receipt as random treatment",
                    "Actual sales or ROI",
                    "Suppressed subgroup effect/targeting",
                ],
            ),
            fingerprint=hashlib.sha256(
                json.dumps(t, sort_keys=True).encode()
            ).hexdigest(),
        )
        for name, t in tables.items()
    ]
    findings = [
        dict(
            finding_id=f["finding_id"],
            proposition=f["proposition"],
            tier=f["tier"],
            evidence_ids=["E-" + n for n in names],
            claim_strength="observed_pair_assignment_contrast_or_descriptive_restraint",
            analytical_relationship="comparison",
            topic_cluster=f["topic_cluster"],
            qualification=f.get(
                "narrative_requirement", f.get("claim_boundary", f.get("failure", ""))
            ),
        )
        for f, names in zip(
            hidden["reference_finding_propositions"], bindings, strict=True
        )
    ]
    write(
        PROJECT / "reference/evidence_inventory.json",
        dict(study_id="SBT-005", evidence=evidence),
    )
    write(
        PROJECT / "reference/reference_findings.json",
        dict(project_id="SBT-005", version="1.0.0", findings=findings),
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
