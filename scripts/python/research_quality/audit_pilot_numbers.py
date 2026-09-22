"""Independent direct-sum audit of numeric arrays in the two raw-data pilot outputs.

No matching of narrative wording; p-values deliberately excluded because the raw
brief did not specify the reference's exact variance/family convention.
"""

import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "evals/research_quality"


def main():
    df = pd.read_csv(BASE / "projects/synthetic/SBT-002/synthetic_data/respondents.csv")
    for run in sorted((BASE / "runs").glob("*sbt002-raw-*")):
        output = json.loads((run / "output.json").read_text())
        checks = []

        def add(path, actual, expected):
            checks.append(
                dict(
                    path=path,
                    reported=actual,
                    reference=float(expected),
                    error_pp=float(abs(actual - expected)),
                    pass_=bool(abs(actual - expected) <= 0.011),
                )
            )

        def walk(value, path, var=None):
            if not isinstance(value, dict):
                return
            group = 0 if "non_explorers" in path else 1 if "explorers" in path else None
            d = df if group is None else df[df.food_explorer == group]
            for key, item in value.items():
                v = key if key in df.columns and key.endswith("_5") else var
                if isinstance(item, dict):
                    if key == "selected_pct":
                        for name, vector in item.items():
                            for c, p in zip(["Flex", "Plus", "Simple"], vector):
                                cell = d[d.concept == c]
                                add(
                                    ".".join(path + [key, name, c]),
                                    p,
                                    100
                                    * cell.loc[cell[name] == 1, "wt_final"].sum()
                                    / cell.wt_final.sum(),
                                )
                    else:
                        walk(item, path + [key], v)
                elif isinstance(item, list) and len(item) == 3:
                    metric = var
                    if key.startswith("appeal_"):
                        metric = "appeal_5"
                    if key.startswith("purchase_"):
                        metric = "purchase_intent_5"
                    if "premium_value_top2" in key:
                        metric = "premium_value_5"
                    if not metric:
                        continue
                    for c, reported in zip(["Flex", "Plus", "Simple"], item):
                        cell = d[(d.concept == c) & d[metric].notna()]
                        if "distribution_pct" in key:
                            for code, p in enumerate(reported, 1):
                                add(
                                    ".".join(path + [key, c, str(code)]),
                                    p,
                                    100
                                    * cell.loc[cell[metric] == code, "wt_final"].sum()
                                    / cell.wt_final.sum(),
                                )
                        elif "top2_pct" in key:
                            add(
                                ".".join(path + [key, c]),
                                reported,
                                100
                                * cell.loc[cell[metric] >= 4, "wt_final"].sum()
                                / cell.wt_final.sum(),
                            )

        for claim in output["analysis_claims"]:
            walk(claim["values"], [claim["analysis_id"]])
        checks = [
            {("pass" if k == "pass_" else k): v for k, v in x.items()} for x in checks
        ]
        report = dict(
            status=(
                "PASS"
                if all(x["pass"] for x in checks) and len(checks) > 100
                else "FAIL"
            ),
            scope="Reported top-two proportions, five-point distributions and binary diagnostics; raw CSV direct weighted sums. Narrative semantics and inferential p-values are separate reviews.",
            tolerance_pp=0.011,
            checks=checks,
        )
        (run / "numeric_audit.json").write_text(json.dumps(report, indent=2) + "\n")
        print(run.name, report["status"], len(checks))
        if report["status"] != "PASS":
            raise SystemExit(1)


if __name__ == "__main__":
    main()
