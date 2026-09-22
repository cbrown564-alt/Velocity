"""Independent CSV/stdlib audit; does not import generator or reference builder."""

import csv
import hashlib
import json
import math
from pathlib import Path

P = Path(__file__).resolve().parent


def main():
    if (P / "freeze.json").exists():
        raise ValueError("Frozen audit must not be overwritten")
    raw = list(csv.DictReader((P / "synthetic_data/respondents.csv").open()))
    rows = [
        {
            k: (None if v == "" else v if k == "respondent_id" else float(v))
            for k, v in r.items()
        }
        for r in raw
    ]
    tables = json.loads((P / "reference/analysis_results.json").read_text())["tables"]
    book = json.loads((P / "codebook.json").read_text())
    materials = json.loads((P / "study_materials.json").read_text())
    variables = {v["name"]: v for v in book["variables"]}
    checks = []

    def check(name, actual, expected):
        ok = (
            math.isclose(actual, expected, abs_tol=1e-9, rel_tol=1e-10)
            if isinstance(actual, (int, float)) and isinstance(expected, (int, float))
            else actual == expected
        )
        checks.append(dict(id=name, actual=actual, expected=expected, **{"pass": ok}))

    def compare(name, a, b):
        for k, v in a.items():
            if isinstance(v, dict):
                compare(name + "." + k, v, b[k])
            elif isinstance(v, list):
                for i, x in enumerate(v):
                    check(name + "." + k + "." + str(i), x, b[k][i])
            else:
                check(name + "." + k, v, b.get(k))

    def summary(group, name, codes, ordinal=False, private=False):
        v = [r for r in group if r[name] in codes]
        w = math.fsum(r["wt_final"] for r in v)
        ess = w * w / math.fsum(r["wt_final"] ** 2 for r in v) if w else 0
        out = dict(
            n_unweighted=len(v),
            n_weighted=w,
            n_eff=ess,
            missing_n=len(group) - len(v),
            eligible_n=len(group),
            eligible_weighted_n=math.fsum(r["wt_final"] for r in group),
            missing_counts={
                str(c): sum(r[name] == c for r in group) for c in [97, 98, 99]
            }
            | {"blank": sum(r[name] is None for r in group)},
        )
        if len(v) < 40 and not private:
            out["status"] = "suppressed"
            return out
        mu = math.fsum(r["wt_final"] * r[name] for r in v) / w
        var = math.fsum(r["wt_final"] * (r[name] - mu) ** 2 for r in v) / w
        out.update(mean=mu, se=math.sqrt(var / (ess - 1)) if ess > 1 else None)
        if ordinal:
            dist = {
                str(c): 100 * math.fsum(r["wt_final"] for r in v if r[name] == c) / w
                for c in codes
            }
            out.update(
                distribution_pct=dist,
                top2_pct=dist["4"] + dist["5"],
                bottom2_pct=dist["1"] + dist["2"],
            )
        return out

    def verify(name, group, variable, codes, ordinal=False):
        a = summary(group, variable, codes, ordinal)
        compare(name, a, tables[name]["values"])
        return a

    for name in variables:
        if name.startswith("att_"):
            verify(name, rows, name, range(1, 6), True)
    states = ["need_budget", "need_effort", "need_waste"]
    for name in states:
        verify(name, rows, name, [0, 1])
    for i, a in enumerate(states):
        for b in states[i + 1 :]:
            q = [
                dict(r, joint=int(r[a] == 1 and r[b] == 1))
                for r in rows
                if r[a] in [0, 1] and r[b] in [0, 1]
            ]
            r = summary(q, "joint", [0, 1])
            r["pct"] = 100 * r["mean"]
            r["fraction_of_smaller_state"] = math.fsum(
                x["wt_final"] for x in q if x["joint"] == 1
            ) / min(
                math.fsum(x["wt_final"] for x in q if x[a] == 1),
                math.fsum(x["wt_final"] for x in q if x[b] == 1),
            )
            compare(
                "overlap." + a + "." + b,
                r,
                tables["need_overlap"]["values"][a + "__" + b],
            )
    for c in range(8):
        key = format(c, "03b")
        q = [
            dict(r, joint=int(all(r[n] == int(b) for n, b in zip(states, key))))
            for r in rows
            if all(r[n] in [0, 1] for n in states)
        ]
        compare(
            "combinations." + key,
            summary(q, "joint", [0, 1]),
            tables["need_combinations"]["values"][key],
        )
    for block in ["needs", "barriers"]:
        b = book["multiple_response"][block]
        q = [r for r in rows if r[b["status"]] == 1]
        for name in b["items"]:
            compare(
                block + "." + name,
                summary(q, name, [0, 1]),
                tables[block]["values"]["items"][name],
            )
        check(
            block + ".none",
            sum(all(r[n] == 0 for n in b["items"]) for r in q),
            tables[block]["values"]["none_n"],
        )
        check(
            block + ".sum",
            sum(100 * summary(q, n, [0, 1])["mean"] for n in b["items"]),
            tables[block]["values"]["respondent_percent_sum"],
        )
    for name in [
        "meal_plan_days_7d",
        "unplanned_topups_7d",
        "waste_days_7d",
        "over_budget_4w",
    ]:
        verify(name, rows, name, variables[name]["valid_codes"])
    raw_p = {}
    for e in materials["required_inference"]["estimands"]:
        y, g = e["outcome"], e["group_variable"]
        valid = variables[y]["valid_codes"]
        scale = 100 if e["unit"] == "percentage_points" else 1
        a = {c: summary([r for r in rows if r[g] == c], y, valid) for c in [1, 0]}
        for c in [1, 0]:
            compare(
                e["id"] + ".group" + str(c),
                a[c],
                tables[e["id"]]["values"]["groups"][str(c)],
            )
        influences = {}
        for r in rows:
            h = (r["age_band"], r["children_u16"])
            influences.setdefault(h, [])
            value = 0
            if r[g] in [0, 1] and r[y] in valid:
                group = a[int(r[g])]
                value = (
                    (1 if r[g] == 1 else -1)
                    * r["wt_final"]
                    * (r[y] - group["mean"])
                    / group["n_weighted"]
                )
            influences[h].append(value)
        variance = 0
        for numbers in influences.values():
            center = math.fsum(numbers) / len(numbers)
            variance += (
                len(numbers)
                / (len(numbers) - 1)
                * math.fsum((x - center) ** 2 for x in numbers)
            )
        se = math.sqrt(variance) * scale
        delta = (a[1]["mean"] - a[0]["mean"]) * scale
        p = math.erfc(abs(delta / se) / math.sqrt(2))
        raw_p[e["id"]] = p
        compare(
            e["id"],
            dict(
                difference=delta,
                se=se,
                p_raw=p,
                ci95=[delta - 1.959963984540054 * se, delta + 1.959963984540054 * se],
            ),
            tables[e["id"]]["values"],
        )
    for family in materials["required_inference"]["families"]:
        names = sorted(
            [
                e["id"]
                for e in materials["required_inference"]["estimands"]
                if e["family"] == family
            ],
            key=lambda n: raw_p[n],
        )
        running = 0
        for rank, name in enumerate(names):
            running = max(running, min(1, raw_p[name] * (len(names) - rank)))
            check(name + ".holm", running, tables[name]["values"]["p_holm"])
    for state, outcome in [
        ("need_budget", "support_budget"),
        ("need_waste", "support_use_up"),
    ]:
        for c in [1, 0]:
            compare(
                outcome + str(c),
                summary(
                    [r for r in rows if r[state] == c and r["needs_block_status"] == 1],
                    outcome,
                    [0, 1],
                ),
                tables[outcome + "_by_" + state]["values"]["groups"][str(c)],
            )
    triples = [
        (
            r["wt_final"],
            (r["att_plan_ahead_5"] + 6 - r["att_spontaneous_5"]) / 2,
            r["meal_plan_days_7d"],
        )
        for r in rows
        if r["att_plan_ahead_5"] in range(1, 6)
        and r["att_spontaneous_5"] in range(1, 6)
        and r["meal_plan_days_7d"] in range(8)
    ]
    w = math.fsum(t[0] for t in triples)
    mx = math.fsum(t[0] * t[1] for t in triples) / w
    my = math.fsum(t[0] * t[2] for t in triples) / w
    cov = math.fsum(a * (b - mx) * (c - my) for a, b, c in triples)
    corr = cov / math.sqrt(
        math.fsum(a * (b - mx) ** 2 for a, b, c in triples)
        * math.fsum(a * (c - my) ** 2 for a, b, c in triples)
    )
    compare(
        "planning_index",
        dict(
            correlation=corr,
            n_unweighted=len(triples),
            n_weighted=w,
            n_eff=w * w / math.fsum(t[0] ** 2 for t in triples),
        ),
        tables["planning_index_association"]["values"],
    )
    q = [
        dict(r, current_tool_user=int(r["planning_tool_28d"] in [1, 2, 3]))
        for r in rows
        if r["planning_tool_28d"] in [0, 1, 2, 3]
    ]
    verify("current_tool_use", q, "current_tool_user", [0, 1])
    q = [r for r in rows if r["planning_tool_28d"] in [1, 2, 3]]
    for n in ["tool_satisfaction_5", "shared_list_use_28d"]:
        verify(n, q, n, variables[n]["valid_codes"], n == "tool_satisfaction_5")
    q = [r for r in rows if r["age_band"] == 4 and r["planning_tool_28d"] == 3]
    verify("older_paid_users", q, "tool_satisfaction_5", range(1, 6), True)
    check(
        "tiny_cell_rate_absent",
        all(
            k not in tables["older_paid_users"]["values"]
            for k in ["mean", "se", "top2_pct", "distribution_pct"]
        ),
        True,
    )
    for cut in ["age_band", "work_hours_band", "planning_tool_28d"]:
        for value in variables[cut]["valid_codes"]:
            q = [r for r in rows if r[cut] == value]
            for name in [
                "att_digital_help_5",
                "unplanned_topups_7d",
                "meal_plan_days_7d",
            ]:
                compare(
                    "profile." + cut + str(value) + "." + name,
                    summary(
                        q,
                        name,
                        variables[name]["valid_codes"],
                        name == "att_digital_help_5",
                    ),
                    tables["profile_" + cut]["values"][str(value)][name],
                )
    check(
        "source_hash",
        hashlib.sha256((P / "synthetic_data/respondents.csv").read_bytes()).hexdigest(),
        json.loads((P / "reference/analysis_results.json").read_text())[
            "source_sha256"
        ],
    )
    report = dict(
        study_id="SBT-004",
        status="PASS" if all(c["pass"] for c in checks) else "FAIL",
        method="Independent stdlib CSV, math.fsum, explicit domains and stratum influence arrays; no generator/reference-builder imports",
        checks=checks,
    )
    (P / "hidden/independent_audit.json").write_text(
        json.dumps(report, indent=2, allow_nan=False) + "\n"
    )
    print(
        json.dumps(
            {
                "status": report["status"],
                "checks": len(checks),
                "failed": [c for c in checks if not c["pass"]],
            }
        )
    )


if __name__ == "__main__":
    main()
