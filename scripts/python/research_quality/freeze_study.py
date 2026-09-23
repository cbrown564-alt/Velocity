"""Freeze realised studies before model use; verify exact bytes on every run.

The public package is constructed from explicit fields. Reference finding roles,
reference interpretations, generator parameters and validation checks never enter it.
"""

import argparse
import hashlib
import json
import platform
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import scipy
from jsonschema import validate

REPO = Path(__file__).resolve().parents[3]
BASE = REPO / "evals/research_quality"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def public_materials(project):
    m = read(project / "manifest.json")
    return dict(
        study_id=m["project_id"],
        title=m["title"],
        synthetic=True,
        design={k: v for k, v in m["design"].items() if k != "seed"},
        primary_outcomes=m.get("primary_outcomes", ["appeal_5", "purchase_intent_5"]),
        analysis_policy=m.get("analysis_policy", {}),
        decision_question=(
            "Which meal-kit concepts should advance, for whom, and with what qualifications?"
            if m["project_id"] == "SBT-002"
            else "Which customer experience problems deserve priority, considering severity, reach and uncertainty?"
        ),
        data_note="Fictional study for a research workflow experiment; no market or customer claims.",
        output_note="Evidence references are analysis table paths, for example concept_metrics.appeal_5 or groups.unresolved_contact. Raw-data runs may define analysis_claims with stable IDs and explicit values, universe and weighting.",
    )


def check_study(project):
    study = project.name
    df = pd.read_csv(project / "synthetic_data/respondents.csv")
    r = read(project / "reference/analysis_results.json")
    checks = []

    def ck(id, ok, details, kind="realised"):
        checks.append(dict(id=id, pass_=bool(ok), detail=details, kind=kind))

    ck(
        "source_hash",
        sha(project / "synthetic_data/respondents.csv") == r["source_sha256"],
        r["source_sha256"],
    )
    ck(
        "weights",
        df.wt_final.notna().all()
        and np.isfinite(df.wt_final).all()
        and (df.wt_final > 0).all(),
        dict(min=float(df.wt_final.min()), max=float(df.wt_final.max())),
    )
    ck(
        "respondents",
        df.respondent_id.is_unique
        and len(df) == (2100 if study == "SBT-002" else 2400),
        len(df),
    )
    if study == "SBT-002":
        cm = r["concept_metrics"]
        routing = df.premium_value_5.notna().equals(df.understanding_5 >= 3)
        ck("routing", routing, r["routing"])
        ck(
            "explorer_definition",
            (
                df.food_explorer
                == (
                    (df[["food_p1", "food_p2", "food_p3"]].mean(axis=1) >= 4).astype(
                        int
                    )
                )
            ).all(),
            "Pre-concept rule mean(P1:P3)>=4",
        )
        # Independent direct sums check the public tables against respondent rows.
        errors = []
        for v, cells in cm.items():
            for c, stats in cells.items():
                d = df.loc[(df.concept == c) & df[v].notna()]
                value = 100 * d.loc[d[v] >= 4, "wt_final"].sum() / d.wt_final.sum()
                errors.append(abs(value - stats["top2_pct"]))
                errors.append(abs(len(d) - stats["n_unweighted"]))
        ck(
            "independent_totals",
            max(errors) < 1e-9,
            dict(max_absolute_error=max(errors)),
        )
        ck(
            "broad_case",
            all(
                cm[v]["Flex"]["top2_pct"]
                > max(cm[v][c]["top2_pct"] for c in ["Plus", "Simple"])
                for v in ["appeal_5", "purchase_intent_5"]
            ),
            {
                v: {c: s["top2_pct"] for c, s in cm[v].items()}
                for v in ["appeal_5", "purchase_intent_5"]
            },
        )
        ck(
            "uniqueness",
            cm["uniqueness_5"]["Plus"]["top2_pct"]
            > max(cm["uniqueness_5"][c]["top2_pct"] for c in ["Flex", "Simple"]) + 5,
            cm["uniqueness_5"],
        )
        small = [
            (v, p)
            for v, ps in r["pairwise"].items()
            for p in ps
            if 2 <= abs(p["top2_diff_pp"]) <= 3 and p["significant_holm"]
        ]
        ck("T1_TRIVIAL_SIG", len(small) > 0, small)
        ck(
            "T2_MULTIPLICITY",
            len(r["pairwise"]) >= 7
            and all(
                len(ps) == 3 and all(p["p_holm"] >= p["p_raw"] for p in ps)
                for ps in r["pairwise"].values()
            ),
            "Eight pre-specified three-pair families. Multiplicity opportunity is structural; no realised false positive is claimed.",
            "structural",
        )
        ck(
            "T3_SUBGROUP_FISHING",
            set(r["exploratory"]) == {"age", "gender", "region"},
            "Exploratory cuts supplied, including small cells. Age relates to explorer membership; no claim that every demographic pattern is pure noise.",
            "structural",
        )
        polar = [
            v
            for v in ["appeal_5", "purchase_intent_5"]
            if cm[v]["Plus"]["distribution_pct"]["5"]
            > cm[v]["Flex"]["distribution_pct"]["5"]
            and cm[v]["Plus"]["bottom2_pct"] > cm[v]["Flex"]["bottom2_pct"] + 5
        ]
        ck("T4_POLARISATION", bool(polar), polar)
        mean = [
            v for v in polar if abs(cm[v]["Plus"]["mean"] - cm[v]["Flex"]["mean"]) < 0.2
        ]
        ck("T5_MEAN_ORDINAL", bool(mean), mean)
        impacts = [
            abs(x["weighted_pct"] - x["unweighted_pct"])
            for cs in r["weighting_audit"].values()
            for x in cs.values()
        ]
        ck("T6_WEIGHTING", max(impacts) >= 2, dict(max_change_pp=max(impacts)))
        ck(
            "T7_DIAGNOSTIC_CAUSALITY",
            len(r["diagnostic_associations"]) == 3,
            "Common latent response generates diagnostics; associations are not identified causes.",
            "structural",
        )
        ck(
            "T8_RANDOMISATION_BOUNDARY",
            all(
                v["diff_pp"] > 5 and v["p_holm"] < 0.05
                for v in r["interactions"].values()
            ),
            r["interactions"],
        )
        rates = [
            x["routing_rate_pct"] for x in r["routing"]["premium_value_5"].values()
        ]
        ck("T9_ROUTED_BASE", routing and max(rates) - min(rates) > 5, rates)
        spikes = [
            (dem, level, v, s["Simple"]["n_unweighted"], s["Simple"]["top2_pct"])
            for dem, levels in r["exploratory"].items()
            for level, vs in levels.items()
            for v, s in vs.items()
            if s["Simple"]["n_unweighted"] >= 20
            and s["Simple"]["top2_pct"]
            > max(s["Flex"]["top2_pct"], s["Plus"]["top2_pct"])
        ]
        ck(
            "T10_SIMPLE_SEDUCTION",
            cm["understanding_5"]["Simple"]["top2_pct"] > 80
            and cm["credibility_5"]["Simple"]["top2_pct"] > 50
            and bool(spikes),
            spikes,
        )
    else:
        c, g = r["company"], r["groups"]
        contact = df.support_contact_90d == 1
        routing = all(
            df[v].notna().equals(contact)
            for v in ["support_quality_5", "resolved_first_contact"]
        ) and df.outage_severity_5.notna().equals(df.outage_90d == 1)
        ck(
            "routing",
            routing and r["support"]["quality"]["n_unweighted"] == int(contact.sum()),
            r["support"],
        )
        p = 100 * df.loc[df.nps_0_10 >= 9, "wt_final"].sum() / df.wt_final.sum()
        d = 100 * df.loc[df.nps_0_10 <= 6, "wt_final"].sum() / df.wt_final.sum()
        ck(
            "independent_totals",
            abs((p - d) - c["nps"]) < 1e-9,
            dict(promoters=p, detractors=d, nps=p - d),
        )
        ck(
            "CX1_NPS_ONLY",
            abs(c["promoter_pct"] + c["passive_pct"] + c["detractor_pct"] - 100) < 1e-9
            and r["renewal"]["n_unweighted"] == len(df),
            c,
        )
        ck(
            "CX2_DRIVER_CAUSALITY",
            g["unresolved_contact"]["nps"]["nps"]
            < g["resolved_contact"]["nps"]["nps"] - 15
            and g["unresolved_contact"]["renewal"]["top2_pct"]
            < g["resolved_contact"]["renewal"]["top2_pct"] - 5,
            "Realised association; design does not identify effect of resolving contact.",
        )
        ck(
            "CX3_CONTACT_DENOMINATOR",
            routing and 0 < int(contact.sum()) < len(df),
            dict(contact_n=int(contact.sum()), total_n=len(df)),
        )
        ck(
            "CX4_SMALL_BASE",
            40 <= g["premium_unresolved"]["nps"]["n"] < 75,
            g["premium_unresolved"]["nps"],
        )
        l = g["legacy_contact"]
        ck(
            "CX5_SEVERITY_VS_CONTRIBUTION",
            l["prevalence_weighted_pct"] < 25
            and l["share_of_company_detractors_pct"] < 25
            and l["nps"]["nps"] < c["nps"] - 10,
            l,
        )
        ck(
            "CX6_TENURE_CONFOUNDING",
            g["long_tenure"]["nps"]["nps"] < c["nps"]
            and r["tenure"]["6+y"]["legacy_pct"]
            > r["tenure"]["<1y"]["legacy_pct"] + 20,
            r["tenure"],
        )
        w = r["weighting_audit"]
        ck("CX7_WEIGHTING", abs(w["nps_weighted"] - w["nps_unweighted"]) >= 2, w)
        ck(
            "CX8_NPS_DERIVATION",
            abs(c["nps"] - (c["promoter_pct"] - c["detractor_pct"])) < 1e-9,
            c["nps"],
        )
        ck(
            "CX9_CORRELATED_DIAGNOSTICS",
            sum(abs(v) >= 0.35 for v in r["diagnostic_correlations"].values()) >= 2,
            r["diagnostic_correlations"],
        )
        ck(
            "CX10_INTENT_OVERREACH",
            "not observed churn" in (project / "questionnaire.md").read_text(),
            "Renewal is stated intent, no observed churn field.",
            "structural",
        )
    return [
        {("pass" if k == "pass_" else k): v for k, v in row.items()} for row in checks
    ]


BINDINGS = {
    "SBT-002": {
        "F_A_BROAD": [
            "concept_metrics.appeal_5",
            "concept_metrics.purchase_intent_5",
            "pairwise.appeal_5",
            "pairwise.purchase_intent_5",
        ],
        "F_B_DIFFERENTIATED": [
            "concept_metrics.uniqueness_5",
            "concept_metrics.appeal_5",
            "concept_metrics.purchase_intent_5",
        ],
        "F_B_EXPLORER": ["strategic_subgroup", "interactions"],
        "F_C_POSITION": [
            "concept_metrics.understanding_5",
            "concept_metrics.credibility_5",
            "concept_metrics.appeal_5",
            "concept_metrics.purchase_intent_5",
        ],
        "F_WEIGHTING": ["weighting_audit"],
        "F_ROUTED_PREMIUM": ["routing", "concept_metrics.premium_value_5"],
        "F_CAUSAL_BOUNDARY": ["diagnostic_associations"],
        "F_TRIVIAL_SIG": ["pairwise.understanding_5"],
        "F_EXPLORATORY_NOISE": ["exploratory"],
        "F_SIMPLE_SEDUCTION": [
            "exploratory",
            "concept_metrics.credibility_5",
            "concept_metrics.purchase_intent_5",
        ],
    },
    "SBT-003": {
        "CX_F_OVERALL": ["company", "renewal"],
        "CX_F_INCIDENT": ["groups.unresolved_contact", "groups.resolved_contact"],
        "CX_F_OPERATIONAL": ["groups.legacy_contact", "company"],
        "CX_F_ASSOC_BOUNDARY": ["diagnostic_correlations", "correlation_universes"],
        "CX_F_TENURE": ["tenure", "groups.long_tenure"],
        "CX_F_WEIGHT": ["weighting_audit"],
        "CX_F_ROUTING": ["support"],
        "CX_F_SMALLBASE": ["groups.premium_unresolved"],
        "CX_F_SINGLE_DRIVER": ["diagnostic_correlations"],
    },
}


def bind_reference(project):
    r = read(project / "reference/analysis_results.json")
    ref = read(project / "reference/reference_findings.json")
    evidence = []
    for path in sorted({p for paths in BINDINGS[project.name].values() for p in paths}):
        value = r
        for part in path.split("."):
            value = value[part]
        universe = (
            "All valid respondents in the named concept/group; see per-table bases."
        )
        if "premium" in path or path == "routing":
            universe = "understanding_5 >= 3, within assigned concept; routing table also reports unconditional cell N."
        elif path in ["support", "correlation_universes"]:
            universe = "Recent support contacts for support variables; other diagnostics use all valid current customers."
        obj = dict(
            evidence_id=project.name + ":" + path,
            analysis_id=path,
            values=value,
            universe=universe,
            weighting="wt_final primary; explicitly named unweighted values are audit comparisons",
            interpretation=dict(
                permitted="Descriptive comparison within the named universe and declared analysis policy.",
                unsupported_extensions=[
                    "Causal diagnostic effects",
                    "Sales or realised churn",
                    "Unqualified small-base promotion",
                ],
            ),
            fingerprint=r["source_sha256"],
        )
        validate(obj, read(BASE / "schemas/prepresentation_evidence.schema.json"))
        evidence.append(obj)
    for f in ref["findings"]:
        f["evidence_ids"] = [
            project.name + ":" + p for p in BINDINGS[project.name][f["finding_id"]]
        ]
        f["claim_strength"] = "bounded_descriptive"
        f["topic_cluster"] = f["finding_id"]
        validate(f, read(BASE / "schemas/prepresentation_finding.schema.json"))
    ref["version"] = "1.0.0"
    ref["rule"] = (
        "Frozen before first model exposure; numerical evidence bindings are deterministic."
    )
    write(project / "reference/reference_findings.json", ref)
    write(
        project / "reference/evidence_inventory.json",
        dict(study_id=project.name, evidence=evidence),
    )


def verify(project):
    f = read(project / "freeze.json")
    if f["status"] != "FROZEN":
        raise ValueError("Study not frozen")
    for path, digest in f["artifacts"].items():
        if sha(REPO / path) != digest:
            raise ValueError("Frozen artifact changed: " + path)
    return f


def freeze(project):
    if (project / "freeze.json").exists():
        return verify(project)
    checks = check_study(project)
    write(
        project / "hidden/freeze_validation.json",
        dict(
            status="PASS" if all(c["pass"] for c in checks) else "FAIL", checks=checks
        ),
    )
    if not all(c["pass"] for c in checks):
        raise ValueError(
            "Realised study failed: "
            + ", ".join(c["id"] for c in checks if not c["pass"])
        )
    bind_reference(project)
    package = project / "model_inputs"
    package.mkdir(exist_ok=True)
    write(package / "study_materials.json", public_materials(project))
    df = pd.read_csv(project / "synthetic_data/respondents.csv")
    codebook = {}
    for name in df.columns:
        if name == "respondent_id":
            codebook[name] = dict(type="identifier")
        elif name == "wt_final":
            codebook[name] = dict(
                type="weight", role="supplied calibration weight; use as primary"
            )
        elif name.endswith("_5") or name.startswith("food_p"):
            codebook[name] = dict(
                type="ordinal",
                codes={str(i): str(i) for i in range(1, 6)},
                labels="See questionnaire endpoints",
                missing="blank is not asked; exclude from valid base",
            )
        elif name == "nps_0_10":
            codebook[name] = dict(
                type="ordinal",
                codes={str(i): str(i) for i in range(11)},
                groups={"0-6": "detractor", "7-8": "passive", "9-10": "promoter"},
            )
        else:
            values = sorted(df[name].dropna().unique().tolist())
            codebook[name] = dict(
                type="categorical",
                codes={
                    str(v): (
                        "Yes/selected"
                        if v == 1
                        else "No/not selected" if v == 0 else str(v)
                    )
                    for v in values
                },
                missing="blank is not asked; exclude from valid base",
            )
    write(package / "codebook.json", codebook)
    for source, target in [
        ("questionnaire.md", "questionnaire.md"),
        ("synthetic_data/respondents.csv", "respondents.csv"),
        ("reference/analysis_results.json", "analysis_results.json"),
    ]:
        shutil.copyfile(project / source, package / target)
    m = read(project / "manifest.json")
    m.update(version="1.0.0", status="data_reference_frozen")
    write(project / "manifest.json", m)
    paths = [
        p
        for p in project.rglob("*")
        if p.is_file()
        and p.suffix in {".json", ".csv", ".md", ".py"}
        and "__pycache__" not in p.parts
        and p.name != "freeze.json"
    ]
    paths += [
        BASE / "prepresentation_scoring_contract.json",
        BASE / "experiment_protocol.json",
        BASE / "model_exposure_contract.json",
    ]
    paths += list((BASE / "schemas").glob("*representation*.json")) + [
        BASE / "schemas/model_research_output.schema.json"
    ]
    paths += [
        REPO / "scripts/python/research_quality" / name
        for name in ["analysis.py", "freeze_study.py"]
    ]
    paths += [
        REPO / "scripts/python/synthetic_tracker/requirements.txt",
        REPO / "scripts/python/research_quality/requirements.txt",
    ]
    f = dict(
        study_id=project.name,
        version="1.0.0",
        status="FROZEN",
        runtime=dict(
            python=platform.python_version(),
            numpy=np.__version__,
            pandas=pd.__version__,
            scipy=scipy.__version__,
        ),
        artifacts={p.relative_to(REPO).as_posix(): sha(p) for p in sorted(set(paths))},
        model_allowlist={p.name: sha(p) for p in sorted(package.iterdir())},
    )
    write(project / "freeze.json", f)
    return f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("study", choices=["SBT-002", "SBT-003"])
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--check-only", action="store_true")
    a = ap.parse_args()
    project = BASE / "projects/synthetic" / a.study
    if a.check_only:
        checks = check_study(project)
        print(json.dumps(checks, indent=2))
        raise SystemExit(0 if all(c["pass"] for c in checks) else 1)
    result = verify(project) if a.verify else freeze(project)
    print(
        json.dumps(
            dict(
                study_id=result["study_id"],
                status=result["status"],
                artifacts=len(result["artifacts"]),
            )
        )
    )


if __name__ == "__main__":
    main()
