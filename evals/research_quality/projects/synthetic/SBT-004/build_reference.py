"""Local reference derivation from the unchanged GPT-6 Pro respondent file.

Run before freeze. The independent audit uses a separate stdlib CSV/summation
implementation; generator author checks are never imported as reference data.
"""

import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from jsonschema import validate

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parents[4]
sys.path.insert(0, str(ROOT / "scripts/python/research_quality"))
from expansion_statistics import mean, distribution, correlation
from expansion_inference import stratified_contrast, holm


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def describe(frame, variable, codes, ordinal=False, suppress=True):
    x, w = frame[variable], frame.wt_final
    r = distribution(x, w, codes) if ordinal else mean(x, w, codes)
    r.update(
        eligible_n=len(frame),
        eligible_weighted_n=float(w.sum()),
        missing_counts={str(c): int((x == c).sum()) for c in [97, 98, 99]}
        | {"blank": int(x.isna().sum())},
    )
    r["se_method"] = (
        "Approximate weighted population variance / (Kish ESS - 1); formal contrasts use declared stratified linearisation"
    )
    r["status"] = (
        "suppressed"
        if r["n_unweighted"] < 40
        else (
            "small_base" if r["n_unweighted"] < 75 or r["n_eff"] < 50 else "reportable"
        )
    )
    if suppress and r["status"] == "suppressed":
        r = {
            k: v
            for k, v in r.items()
            if k not in ["mean", "se", "top2_pct", "bottom2_pct", "distribution_pct"]
        }
        r["suppression_reason"] = (
            "Valid unweighted n below 40; no estimate or rank published."
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

    def add(name, title, sources, universe, values, chart=None):
        t = dict(
            analysis_id=name,
            title=title,
            source_variables=sources,
            universe=universe,
            weighting="wt_final; fixed synthetic target profile; valid cases",
            values=values,
        )
        if chart:
            t["chart"] = chart
        tables[name] = t

    def chart(labels, numbers, unit, bases=None):
        return dict(labels=labels, values=numbers, unit=unit, bases=bases or [])

    for name, v in variables.items():
        if name.startswith("att_"):
            r = describe(d, name, [1, 2, 3, 4, 5], True)
            add(
                name,
                v["label"],
                [name],
                "All households; valid 1–5 responses",
                r,
                chart(
                    list(v["codes"].values()),
                    list(r["distribution_pct"].values()),
                    "percent",
                    [r["n_unweighted"]],
                ),
            )
    need = ["need_budget", "need_effort", "need_waste"]
    for name in need:
        r = describe(d, name, [0, 1])
        r["pct"] = r["mean"] * 100
        add(
            name,
            variables[name]["label"],
            [name],
            "All households; derivable state only",
            r,
        )
    overlap = {}
    for i, a in enumerate(need):
        for b in need[i + 1 :]:
            q = d[d[a].isin([0, 1]) & d[b].isin([0, 1])].copy()
            q["joint"] = ((q[a] == 1) & (q[b] == 1)).astype(int)
            r = describe(q, "joint", [0, 1])
            r["pct"] = r["mean"] * 100
            smaller = min(
                float(q.loc[q[a] == 1, "wt_final"].sum()),
                float(q.loc[q[b] == 1, "wt_final"].sum()),
            )
            r["fraction_of_smaller_state"] = (
                float(q.loc[q["joint"] == 1, "wt_final"].sum()) / smaller
            )
            overlap[a + "__" + b] = r
    add(
        "need_overlap",
        "Need-state overlap",
        [*need],
        "Both involved flags valid; flags overlap",
        overlap,
    )
    q = d[d[need].isin([0, 1]).all(axis=1)].copy()
    combos = {}
    for code in range(8):
        key = format(code, "03b")
        q["joint"] = np.logical_and.reduce(
            [q[n] == int(b) for n, b in zip(need, key)]
        ).astype(int)
        r = describe(q, "joint", [0, 1])
        r["pct"] = r["mean"] * 100
        combos[key] = r
    add(
        "need_combinations",
        "Joint membership, budget / effort / waste",
        need,
        "All three flags valid",
        combos,
    )
    for block, definition in book["multiple_response"].items():
        if not isinstance(definition, dict):
            continue
        status = definition["status"]
        q = d[d[status] == 1]
        items = {}
        for name in definition["items"]:
            r = describe(q, name, [0, 1])
            r["pct"] = r["mean"] * 100
            items[name] = r
        values = {
            "items": items,
            "eligible_n": len(d),
            "answered_n": len(q),
            "block_dk_n": int((d[status] == 97).sum()),
            "block_refused_n": int((d[status] == 98).sum()),
            "none_n": int((q[definition["items"]].sum(axis=1) == 0).sum()),
            "respondent_percent_sum": sum(v["pct"] for v in items.values()),
        }
        add(
            block,
            block.capitalize() + " (multiple response)",
            definition["items"] + [status],
            "All eligible households answering block; includes all-zero None rows",
            values,
            chart(
                [variables[n]["label"] for n in items],
                [v["pct"] for v in items.values()],
                "percent",
                [len(q)],
            ),
        )
    for name in [
        "meal_plan_days_7d",
        "unplanned_topups_7d",
        "waste_days_7d",
        "over_budget_4w",
    ]:
        r = describe(d, name, variables[name]["valid_codes"])
        add(
            name,
            variables[name]["label"],
            [name],
            "All households; valid response codes",
            r,
        )
    estimates = materials["required_inference"]["estimands"]
    for e in estimates:
        g, y = e["group_variable"], e["outcome"]
        r = stratified_contrast(
            d,
            y,
            g,
            "wt_final",
            ["age_band", "children_u16"],
            variables[y]["valid_codes"],
            100 if e["unit"] == "percentage_points" else 1,
        )
        r.update(
            unit=e["unit"],
            family=e["family"],
            groups={
                str(c): describe(d[d[g] == c], y, variables[y]["valid_codes"])
                for c in [1, 0]
            },
            intervals="Unadjusted 95%; Holm applies to p-values, not simultaneous intervals",
        )
        add(
            e["id"],
            variables[y]["label"] + " by " + g,
            [y, g, "age_band", "children_u16"],
            "Valid group 1 versus group 0, valid outcome; all rows retained for variance strata",
            r,
            chart(
                ["Criteria met / group 1", "Criteria not met / group 0"],
                [
                    r["group_1"]["mean"]
                    * (100 if e["unit"] == "percentage_points" else 1),
                    r["group_0"]["mean"]
                    * (100 if e["unit"] == "percentage_points" else 1),
                ],
                "percent" if e["unit"] == "percentage_points" else "days",
                [r["group_1"]["n_unweighted"], r["group_0"]["n_unweighted"]],
            ),
        )
    for family in materials["required_inference"]["families"]:
        members = [e["id"] for e in estimates if e["family"] == family]
        for name, p in zip(
            members, holm([tables[n]["values"]["p_raw"] for n in members])
        ):
            tables[name]["values"]["p_holm"] = p
    for state, outcome in [
        ("need_budget", "support_budget"),
        ("need_waste", "support_use_up"),
    ]:
        rows = {
            str(c): describe(
                d[(d[state] == c) & (d.needs_block_status == 1)], outcome, [0, 1]
            )
            for c in [1, 0]
        }
        add(
            outcome + "_by_" + state,
            variables[outcome]["label"] + " by " + state,
            [state, outcome, "needs_block_status"],
            "Valid state and answered support block; descriptive contrast",
            dict(
                groups=rows, difference_pp=100 * (rows["1"]["mean"] - rows["0"]["mean"])
            ),
        )
    valid = d.att_plan_ahead_5.isin(range(1, 6)) & d.att_spontaneous_5.isin(range(1, 6))
    index = ((d.att_plan_ahead_5 + 6 - d.att_spontaneous_5) / 2).where(valid)
    r = correlation(
        index, d.meal_plan_days_7d.where(d.meal_plan_days_7d.isin(range(8))), d.wt_final
    )
    add(
        "planning_index_association",
        "Planning orientation and reported planned days",
        ["att_plan_ahead_5", "att_spontaneous_5", "meal_plan_days_7d"],
        "All three source items valid; reverse A2 only",
        r,
    )
    q = d[d.planning_tool_28d.isin(range(4))].copy()
    q["current_tool_user"] = q.planning_tool_28d.isin([1, 2, 3]).astype(int)
    r = describe(q, "current_tool_user", [0, 1])
    r["pct"] = r["mean"] * 100
    add(
        "current_tool_use",
        "Current digital planning-tool use",
        ["planning_tool_28d"],
        "All valid U1 households",
        r,
    )
    q = d[d.planning_tool_28d.isin([1, 2, 3])]
    for name in ["tool_satisfaction_5", "shared_list_use_28d"]:
        r = describe(
            q, name, variables[name]["valid_codes"], name == "tool_satisfaction_5"
        )
        add(
            name,
            variables[name]["label"],
            [name, "planning_tool_28d"],
            "Recorded current users only; valid follow-up answers",
            r,
        )
    q = d[(d.age_band == 4) & (d.planning_tool_28d == 3)]
    private = describe(q, "tool_satisfaction_5", [1, 2, 3, 4, 5], True, False)
    add(
        "older_paid_users",
        "Older paid-tool users",
        ["age_band", "planning_tool_28d", "tool_satisfaction_5"],
        "Age 65+ and paid-tool users; valid satisfaction",
        describe(q, "tool_satisfaction_5", [1, 2, 3, 4, 5], True),
    )
    # Other profile summaries remain available without inventing confirmatory tests.
    for cut in ["age_band", "work_hours_band", "planning_tool_28d"]:
        rows = {}
        for value in variables[cut]["valid_codes"]:
            q = d[d[cut] == value]
            rows[str(value)] = {
                name: describe(
                    q,
                    name,
                    variables[name]["valid_codes"],
                    name == "att_digital_help_5",
                )
                for name in [
                    "att_digital_help_5",
                    "unplanned_topups_7d",
                    "meal_plan_days_7d",
                ]
            }
        add(
            "profile_" + cut,
            "Descriptive profile comparisons: " + variables[cut]["label"],
            [cut, "att_digital_help_5", "unplanned_topups_7d", "meal_plan_days_7d"],
            "Valid profile and outcome; descriptive, no confirmatory p-values",
            rows,
        )
    metrics = {
        "budget_need_pct": tables["need_budget"]["values"]["pct"],
        "effort_need_pct": tables["need_effort"]["values"]["pct"],
        "budget_effort_joint_pct": overlap["need_budget__need_effort"]["pct"],
        "overlap_fraction_of_smaller_state": overlap["need_budget__need_effort"][
            "fraction_of_smaller_state"
        ],
        "needs_respondent_percent_sum": tables["needs"]["values"][
            "respondent_percent_sum"
        ],
        "effort_topup_difference_days": tables["NEED_EFFORT_TOPUPS"]["values"][
            "difference"
        ],
        "effort_planning_difference_days": tables["NEED_EFFORT_PLANNING"]["values"][
            "difference"
        ],
        "children_topup_difference_days": tables["CHILDREN_TOPUPS"]["values"][
            "difference"
        ],
        "children_planning_difference_days": tables["CHILDREN_PLANNING"]["values"][
            "difference"
        ],
        "budget_overspend_difference_pp": tables["NEED_BUDGET_OVERSPEND"]["values"][
            "difference"
        ],
        "budget_support_difference_pp": tables["support_budget_by_need_budget"][
            "values"
        ]["difference_pp"],
        "digital_agree_pct": tables["att_digital_help_5"]["values"]["top2_pct"],
        "digital_disagree_pct": tables["att_digital_help_5"]["values"]["bottom2_pct"],
        "digital_neutral_pct": tables["att_digital_help_5"]["values"][
            "distribution_pct"
        ]["3"],
        "digital_mean": tables["att_digital_help_5"]["values"]["mean"],
        "waste_need_pct": tables["need_waste"]["values"]["pct"],
        "waste_days_difference": tables["NEED_WASTE_DISCARD"]["values"]["difference"],
        "waste_useup_support_difference_pp": tables["support_use_up_by_need_waste"][
            "values"
        ]["difference_pp"],
        "planning_index_behaviour_weighted_r": tables["planning_index_association"][
            "values"
        ]["correlation"],
        "current_tool_user_pct": tables["current_tool_use"]["values"]["pct"],
        "tool_satisfaction_top2_pct": tables["tool_satisfaction_5"]["values"][
            "top2_pct"
        ],
        "older_paid_user_valid_sat_n": private["n_unweighted"],
        "older_paid_user_top2_private_pct": private["top2_pct"],
        "barriers_respondent_percent_sum": tables["barriers"]["values"][
            "respondent_percent_sum"
        ],
        "needs_none_valid_n": tables["needs"]["values"]["none_n"],
        "unknown_need_state_any_n": int((d[need] == 99).any(axis=1).sum()),
        "full_sample_kish_ess_fraction": float(
            d.wt_final.sum() ** 2 / (d.wt_final**2).sum() / len(d)
        ),
    }
    checks = [
        dict(
            c,
            actual=metrics[c["metric"]],
            **{
                "pass": bool(
                    c["lower"] - 1e-10 <= metrics[c["metric"]] <= c["upper"] + 1e-10
                )
            }
        )
        for c in hidden["prospective_validation"]["checks"]
    ]

    def check(name, result):
        checks.append({"id": name, "pass": bool(result)})

    check(
        "unique_records_columns",
        len(d) == 2700
        and d.respondent_id.is_unique
        and set(d) == set(variables)
        and len(d.columns) == 34,
    )
    check("positive_weights", np.isfinite(d.wt_final).all() and (d.wt_final > 0).all())
    for name, v in variables.items():
        if v["storage"] == "integer_code":
            check(
                "codes_" + name,
                d[name]
                .dropna()
                .isin(v["valid_codes"] + [int(c) for c in v["missing_codes"]])
                .all(),
            )
    for name, inputs in materials["need_state_policy"]["derivation"].items():
        valid = d[inputs].isin(range(1, 6)).all(axis=1)
        expected = np.where(valid, (d[inputs] >= 4).all(axis=1).astype(int), 99)
        check("derivation_" + name, (d[name] == expected).all())
    for name in ["tool_satisfaction_5", "shared_list_use_28d"]:
        check(
            "route_" + name, d[name].isna().equals(~d.planning_tool_28d.isin([1, 2, 3]))
        )
    for block in ["needs", "barriers"]:
        b = book["multiple_response"][block]
        check(
            "block_" + block,
            all(
                (
                    (
                        d.loc[d[b["status"]] == c, b["items"]].isin([0, 1])
                        if c == 1
                        else d.loc[d[b["status"]] == c, b["items"]].eq(c)
                    )
                )
                .all()
                .all()
                for c in [1, 97, 98]
            ),
        )
    for cell in materials["sampling"]["quota_cells"]:
        q = d[
            (d.age_band == cell["age_band"]) & (d.children_u16 == cell["children_u16"])
        ]
        check(
            "quota_" + str(cell["age_band"]) + "_" + str(cell["children_u16"]),
            len(q) == cell["allocated_n"]
            and abs(q.wt_final.sum() / len(d) - cell["target_share"]) < 1e-12,
        )
    analysis = dict(
        project_id="SBT-004",
        study_id="SBT-004",
        source_sha256=sha(PROJECT / "synthetic_data/respondents.csv"),
        analysis_version="1.0.0",
        analysis_policy=materials["analysis_policy"],
        inference_policy=materials["required_inference"],
        tables=tables,
    )
    write(PROJECT / "reference/analysis_results.json", analysis)
    write(
        PROJECT / "hidden/freeze_validation.json",
        dict(
            study_id="SBT-004",
            threshold_roundoff_tolerance=1e-10,
            status="PASS" if all(c["pass"] for c in checks) else "FAIL",
            checks=checks,
        ),
    )
    # Reference propositions and importance came from Pro's pre-execution design.
    bindings = {
        "M1": ["need_budget", "need_effort", "need_waste", "need_overlap", "needs"],
        "M2": [
            "NEED_EFFORT_TOPUPS",
            "NEED_EFFORT_PLANNING",
            "CHILDREN_TOPUPS",
            "CHILDREN_PLANNING",
        ],
        "M3": ["NEED_BUDGET_OVERSPEND", "support_budget_by_need_budget"],
        "M4": ["att_digital_help_5"],
        "S1": ["NEED_WASTE_DISCARD", "support_use_up_by_need_waste"],
        "S2": ["planning_index_association"],
        "S3": ["current_tool_use", "tool_satisfaction_5", "shared_list_use_28d"],
        "C1": ["need_budget", "need_effort", "need_waste"],
        "C2": ["needs", "barriers", "current_tool_use"],
        "R1": ["need_overlap"],
        "R2": ["att_digital_help_5", "tool_satisfaction_5"],
        "R3": ["older_paid_users"],
    }
    evidence = []
    for name, t in tables.items():
        e = dict(
            evidence_id="E-" + name,
            analysis_id="tables." + name + ".values",
            values=t["values"],
            universe=t["universe"],
            weighting=t["weighting"],
            source_variables=t["source_variables"],
            interpretation={
                "permitted": "Descriptive association or declared design-based contrast with its valid base and qualifications.",
                "unsupported_extensions": [
                    "Causality",
                    "Exclusive personas",
                    "Actual uptake, savings or sales",
                    "Suppressed-cell ranking",
                ],
            },
            fingerprint=hashlib.sha256(
                json.dumps(t, sort_keys=True).encode()
            ).hexdigest(),
        )
        validate(
            e,
            read(
                ROOT
                / "evals/research_quality/schemas/prepresentation_evidence.schema.json"
            ),
        )
        evidence.append(e)
    findings = []
    for f in hidden["reference_findings"]:
        out = dict(
            finding_id=f["finding_id"],
            proposition=f["proposition"],
            tier=f["tier"],
            evidence_ids=["E-" + n for n in bindings[f["finding_id"]]],
            claim_strength="descriptive_association_or_restraint",
            analytical_relationship="comparison",
            topic_cluster=f["finding_id"],
            qualification=f.get(
                "narrative_credit",
                f.get(
                    "failure",
                    "Cross-sectional self-report; synthetic target profile only.",
                ),
            ),
        )
        validate(
            out,
            read(
                ROOT
                / "evals/research_quality/schemas/prepresentation_finding.schema.json"
            ),
        )
        findings.append(out)
    write(
        PROJECT / "reference/evidence_inventory.json",
        dict(study_id="SBT-004", evidence=evidence),
    )
    write(
        PROJECT / "reference/reference_findings.json",
        dict(project_id="SBT-004", version="1.0.0", findings=findings),
    )
    print(
        json.dumps(
            {
                "status": "PASS" if all(c["pass"] for c in checks) else "FAIL",
                "checks": len(checks),
                "failed": [c for c in checks if not c["pass"]],
                "tables": len(tables),
            }
        )
    )


if __name__ == "__main__":
    build()
