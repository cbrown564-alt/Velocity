"""Explicit numerical mappings for inspected expansion outputs; no semantic grading.

Add mappings only after inspecting each output shape. Unrecognised output formats
fail, so a new model response cannot silently receive an empty numerical PASS.
"""

import argparse
import hashlib
import json
import math
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "evals/research_quality"


def lookup(value, path):
    if not path.startswith("/"):
        raise ValueError("Expected an exact JSON pointer")
    for part in path[1:].split("/"):
        key = part.replace("~1", "/").replace("~0", "~")
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value


def pointer(value, path):
    value = lookup(value, path)
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
    ):
        raise ValueError("Mapped value must be a finite number")
    return value


def reported_value(output, entry):
    """Read an exact original numeric field or an explicitly inspected prose span."""
    tolerance = None
    if "numeric_span" in entry:
        source = lookup(output, entry["output_pointer"])
        start, end = entry["numeric_span"]
        if not isinstance(source, str) or source[start:end] != entry["numeric_text"]:
            raise ValueError("Mapped prose span changed")
        decimal = Decimal(source[start:end].replace("−", "-"))
        if not decimal.is_finite():
            raise ValueError("Mapped prose number must be finite")
        value = float(decimal)
        tolerance = float(Decimal(10) ** decimal.as_tuple().exponent) / 2
    else:
        value = pointer(output, entry["output_pointer"])
        if entry.get("printed_precision"):
            tolerance = (
                0
                if value in (0, 1)
                else float(Decimal(10) ** Decimal(str(value)).as_tuple().exponent) / 2
            )
    scale = entry.get("output_scale", 1)
    if not isinstance(scale, (int, float)) or not math.isfinite(scale) or scale == 0:
        raise ValueError("Invalid unit conversion")
    return value * scale, None if tolerance is None else tolerance * abs(scale)


def validate_mapping(mapping, output_sha):
    if mapping["output_sha256"] != output_sha:
        raise ValueError("Mapped output changed")
    if not mapping.get("entries"):
        raise ValueError("Numeric mapping is empty")


def audit(run):
    m = json.loads((run / "manifest.json").read_text())
    o = json.loads((run / "output.json").read_text())
    project = BASE / "projects/synthetic" / m["study_id"]
    t = json.loads((project / "reference/analysis_results.json").read_text())["tables"]
    claims = {c["analysis_id"]: c["values"] for c in o["analysis_claims"]}
    checks = []

    def check(label, a, b, probability=False, tolerance=None):
        ok = math.isclose(
            a,
            b,
            abs_tol=(
                tolerance if tolerance is not None else (0 if probability else 0.006)
            ),
            rel_tol=1e-4 if probability else 1e-8,
        )
        checks.append({"id": label, "reported": a, "reference": b, "pass": ok})

    def base(label, reported, ref):
        for i, k in enumerate(["n_unweighted", "n_weighted", "n_eff"]):
            check(label + "." + k, reported[i], ref[k])

    if (run / "numerical_mapping.json").exists():
        mapping = json.loads((run / "numerical_mapping.json").read_text())
        validate_mapping(
            mapping, hashlib.sha256((run / "output.json").read_bytes()).hexdigest()
        )
        for entry in mapping["entries"]:
            reported, tolerance = reported_value(o, entry)
            reference = pointer({"tables": t}, entry["reference_pointer"])
            check(
                entry["output_pointer"],
                reported,
                reference,
                entry.get("probability", False),
                tolerance,
            )
    elif m["study_id"] == "SBT-004" and (
        "PRESPECIFIED_CONTRASTS" in claims
        or (
            "ordinal_distributions" in claims
            and "row_definition" in claims["ordinal_distributions"]
        )
    ):
        staged_raw = "PRESPECIFIED_CONTRASTS" in claims
        dist = (
            claims["ATTITUDE_DISTRIBUTIONS"]["items"]
            if staged_raw
            else claims["ordinal_distributions"]
        )
        for n in [
            k for k in dist if k.startswith("att_") or k == "tool_satisfaction_5"
        ]:
            c = dist[n]
            r = t[n]["values"]
            numbers = c["pct"] if staged_raw else c[0]
            base(
                n,
                (
                    [c["valid_n"], c["valid_weighted_n"], c["kish_ess"]]
                    if staged_raw
                    else c[3:6]
                ),
                r,
            )
            for i, v in enumerate(numbers, 1):
                check(n + ".pct." + str(i), v, r["distribution_pct"][str(i)])
            check(
                n + ".DK",
                c["dont_know_n"] if staged_raw else c[6],
                r["missing_counts"]["97"],
            )
            check(
                n + ".refusal",
                c["refusal_n"] if staged_raw else c[7],
                r["missing_counts"]["98"],
            )
        contrasts = claims[
            (
                "PRESPECIFIED_CONTRASTS"
                if staged_raw
                else "prespecified_external_contrasts"
            )
        ]
        for n in [
            "NEED_EFFORT_TOPUPS",
            "NEED_EFFORT_PLANNING",
            "NEED_BUDGET_OVERSPEND",
            "NEED_WASTE_DISCARD",
            "CHILDREN_TOPUPS",
            "CHILDREN_PLANNING",
        ]:
            c = contrasts[n]
            r = t[n]["values"]
            for g in ["1", "0"]:
                base(n + "." + g, c["group_" + g + "_base"][2:5], r["group_" + g])
                key = (
                    "group_" + g + ("_pct" if n == "NEED_BUDGET_OVERSPEND" else "_mean")
                )
                check(
                    n + "." + key,
                    c[key],
                    r["group_" + g]["mean"]
                    * (100 if n == "NEED_BUDGET_OVERSPEND" else 1),
                )
            for k in ["difference", "se"]:
                check(n + "." + k, c[k], r[k])
            for i, v in enumerate(c["unadjusted_95_ci" if staged_raw else "ci95"]):
                check(n + ".ci." + str(i), v, r["ci95"][i])
            check(
                n + ".p_holm",
                c["holm_p" if staged_raw else "p_holm"],
                r["p_holm"],
                True,
            )
        maps = {
            "needs": {
                "quick_meals_and_replanning": "support_quick_meals",
                "use_up_food": "support_use_up",
                "budget": "support_budget",
                "shared_plan": "support_shared_plan",
            },
            "barriers": {
                "setup_and_upkeep": "barrier_setup_time",
                "rigidity": "barrier_rigid",
                "cost": "barrier_cost",
                "privacy": "barrier_privacy",
                "sharing_information": "barrier_privacy",
            },
        }
        for name in ["needs", "barriers"]:
            c = (
                claims["SUPPORT_TASKS" if name == "needs" else "DIGITAL_BARRIERS"]
                if staged_raw
                else claims["support_and_barriers"][name]
            )
            for k, v in c["selected_pct" if staged_raw else "pct"].items():
                r = t[name]["values"]["items"][maps[name][k]]
                base(name, [c["valid_n"], c["valid_weighted_n"], c["kish_ess"]], r)
                check(name + "." + k, v, r["pct"])
    elif m["study_id"] == "SBT-004" and "ATTITUDE_DISTRIBUTIONS" in claims:
        for n, r in claims["ATTITUDE_DISTRIBUTIONS"]["items"].items():
            ref = t[n]["values"]
            base(n, r["valid_base"], ref)
            for i, v in enumerate(r["percent"], 1):
                check(n + ".pct." + str(i), v, ref["distribution_pct"][str(i)])
        for claim, table in [
            ("SUPPORT_TASKS", "needs"),
            ("DIGITAL_BARRIERS", "barriers"),
        ]:
            c = claims[claim]
            for n, v in c["respondent_percent"].items():
                if n == "none":
                    continue
                ref = t[table]["values"]["items"][n]
                base(claim, c["valid_base"], ref)
                check(n, v, ref["pct"])
        contrasts = [
            ("EFFORT_EXTERNAL", "NEED_EFFORT_TOPUPS"),
            ("EFFORT_EXTERNAL", "NEED_EFFORT_PLANNING"),
            ("CHILDREN_CONTEXT", "CHILDREN_TOPUPS"),
            ("CHILDREN_CONTEXT", "CHILDREN_PLANNING"),
            ("BUDGET_EXTERNAL", "NEED_BUDGET_OVERSPEND"),
            ("WASTE_EXTERNAL", "NEED_WASTE_DISCARD"),
        ]
        for cid, tid in contrasts:
            c = claims[cid].get(tid, claims[cid])
            r = t[tid]["values"]
            percent = cid == "BUDGET_EXTERNAL"
            for i, g in enumerate(["1", "0"]):
                base(tid + "." + g, c["valid_bases"][i], r["group_" + g])
                means = c.get(
                    "means_days",
                    c.get("means_discard_days", c.get("overspent_percent")),
                )
                check(
                    tid + ".mean." + g,
                    means[i],
                    r["group_" + g]["mean"] * (100 if percent else 1),
                )
            check(
                tid + ".difference",
                c["difference_percentage_points" if percent else "difference_days"],
                r["difference"],
            )
            check(tid + ".se", c["se_percentage_points" if percent else "se"], r["se"])
            for i, v in enumerate(c["ci95_percentage_points" if percent else "ci95"]):
                check(tid + ".ci." + str(i), v, r["ci95"][i])
            for k in ["p_raw", "p_holm"]:
                check(tid + "." + k, c[k], r[k], True)
        c = claims["NEED_PREVALENCE_OVERLAP"]
        for n in ["need_budget", "need_effort", "need_waste"]:
            base(n, c[n]["valid_base"], t[n]["values"])
            check(n + ".pct", c[n]["percent"], t[n]["values"]["pct"])
        for k, v in c["joint"]["combination_percent"].items():
            check("combination." + k, v, t["need_combinations"]["values"][k]["pct"])
        c = claims["CURRENT_TOOLS"]
        check(
            "current_use",
            c["planning_tool_28d"]["percent"]["any_current_tool"],
            t["current_tool_use"]["values"]["pct"],
        )
        for n in ["tool_satisfaction_5", "shared_list_use_28d"]:
            base(n, c[n]["valid_base"], t[n]["values"])
        for i, v in enumerate(c["tool_satisfaction_5"]["percent"], 1):
            check(
                "satisfaction." + str(i),
                v,
                t["tool_satisfaction_5"]["values"]["distribution_pct"][str(i)],
            )
        check(
            "sharing",
            c["shared_list_use_28d"]["yes_percent"],
            100 * t["shared_list_use_28d"]["values"]["mean"],
        )
    elif m["study_id"] == "SBT-004" and "ordinal_distributions" in claims:
        for n, c in claims["ordinal_distributions"]["items"].items():
            r = t[n]["values"]
            base(n, c["base"], r)
            for i, v in enumerate(c["distribution_pct"], 1):
                check(n + ".pct." + str(i), v, r["distribution_pct"][str(i)])
        c = claims["need_state_sizes_and_joint_membership"]
        for n, r in c["states"].items():
            ref = t["need_" + n]["values"]
            base(n, [r["valid_n"], r["valid_weighted_n"], r["Kish_ESS"]], ref)
            check(n + ".pct", r["pct"], ref["pct"])
        for k, v in c["joint"]["distribution_pct"].items():
            check("joint." + k, v, t["need_combinations"]["values"][k]["pct"])
        c = claims["tool_routing_and_satisfaction"]
        check(
            "current_use",
            c["current_use"]["pct"],
            t["current_tool_use"]["values"]["pct"],
        )
        for name, table in [
            ("satisfaction", "tool_satisfaction_5"),
            ("sharing", "shared_list_use_28d"),
        ]:
            r = c[name]
            base(
                name,
                [r["valid_n"], r["valid_weighted_n"], r["Kish_ESS"]],
                t[table]["values"],
            )
        for i, v in enumerate(c["satisfaction"]["distribution_pct"], 1):
            check(
                "sat." + str(i),
                v,
                t["tool_satisfaction_5"]["values"]["distribution_pct"][str(i)],
            )
    else:
        raise ValueError(
            "Unmapped output shape; inspect before adding explicit numeric mappings"
        )
    if not checks:
        raise ValueError("No numerical checks")
    report = {
        "status": "PASS" if all(c["pass"] for c in checks) else "FAIL",
        "scope": "Mapped structured estimates, bases, distributions and declared contrasts where present; selected prose checked separately in adjudication. This is not exhaustive verification of every output number.",
        "output_sha256": hashlib.sha256((run / "output.json").read_bytes()).hexdigest(),
        "checks": checks,
    }
    (run / "numerical_audit.json").write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                "run": run.name,
                "status": report["status"],
                "checks": len(checks),
                "failed": [c for c in checks if not c["pass"]],
            }
        )
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("run")
    a = ap.parse_args()
    audit(BASE / "runs" / a.run)
