"""Freeze the new GPT-6 Pro authored studies after independent local checks.

The original freeze_study.py is itself frozen by SBT-002/003 and stays unchanged.
Both formats use the same exact-byte verification and public input allowlist.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
from jsonschema import validate

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "evals/research_quality"
PUBLIC = (
    "study_materials.json",
    "questionnaire.md",
    "codebook.json",
    "respondents.csv",
    "analysis_results.json",
)


def read(p):
    return json.loads(p.read_text())


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write(p, value):
    p.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def require_passed_checks(checks):
    for name in ["freeze_validation", "independent_audit"]:
        r = checks.get(name, {})
        if (
            r.get("status") != "PASS"
            or not r.get("checks")
            or not all(c.get("pass") is True for c in r["checks"])
        ):
            raise ValueError("Realised validation or independent audit failed: " + name)


def require_evidence_bindings(analysis, evidence, findings):
    ids = [e["evidence_id"] for e in evidence]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("Missing or duplicate evidence IDs")
    for e in evidence:
        value = analysis
        for key in e["analysis_id"].split("."):
            if not isinstance(value, dict) or key not in value:
                raise ValueError("Unresolved reference evidence: " + e["analysis_id"])
            value = value[key]
        if value != e["values"]:
            raise ValueError("Evidence values differ from current table")
    if not findings or len({f["finding_id"] for f in findings}) != len(findings):
        raise ValueError("Missing or duplicate findings")
    if any(
        not f["evidence_ids"] or not set(f["evidence_ids"]) <= set(ids)
        for f in findings
    ):
        raise ValueError("Unresolved finding evidence")


def verify(project):
    frozen = read(project / "freeze.json")
    if frozen["status"] != "FROZEN":
        raise ValueError("Study is not frozen")
    for name, expected in frozen["artifacts"].items():
        if digest(ROOT / name) != expected:
            raise ValueError("Frozen artifact changed: " + name)
    return frozen


def freeze(project):
    if (project / "freeze.json").exists():
        return verify(project)
    reports = {
        n: read(project / "hidden" / f"{n}.json")
        for n in ["freeze_validation", "independent_audit"]
    }
    require_passed_checks(reports)
    source = project / "synthetic_data/respondents.csv"
    analysis = read(project / "reference/analysis_results.json")
    if analysis["source_sha256"] != digest(source):
        raise ValueError("Analysis source hash mismatch")
    if not analysis.get("tables"):
        raise ValueError("No approved analysis tables")
    source_record = read(project / "hidden/generation_provenance.json")
    if source_record.get("model") != "GPT-6 Pro" or not source_record.get(
        "conversation_url"
    ):
        raise ValueError("Missing generator authorship provenance")
    if digest(project / source_record["source_file"]) != source_record["source_sha256"]:
        raise ValueError("Generator source changed after provenance capture")
    evidence = read(project / "reference/evidence_inventory.json")["evidence"]
    findings = read(project / "reference/reference_findings.json")["findings"]
    require_evidence_bindings(analysis, evidence, findings)
    for item in evidence:
        validate(item, read(BASE / "schemas/prepresentation_evidence.schema.json"))
    for item in findings:
        validate(item, read(BASE / "schemas/prepresentation_finding.schema.json"))
    read(project / "experiment_plan.json")
    package = project / "model_inputs"
    package.mkdir(exist_ok=True)
    origins = {
        "study_materials.json": project / "study_materials.json",
        "questionnaire.md": project / "questionnaire.md",
        "codebook.json": project / "codebook.json",
        "respondents.csv": source,
        "analysis_results.json": project / "reference/analysis_results.json",
    }
    if any(p.name not in PUBLIC for p in package.iterdir()):
        raise ValueError("Unexpected public input file")
    for name, src in origins.items():
        shutil.copyfile(src, package / name)
    manifest = read(project / "manifest.json")
    manifest.update(status="data_reference_frozen", version="1.0.0")
    write(project / "manifest.json", manifest)
    files = [
        p
        for p in project.rglob("*")
        if p.is_file()
        and p.name != "freeze.json"
        and "__pycache__" not in p.parts
        and p.suffix in {".py", ".json", ".csv", ".md", ".txt", ".zip"}
    ]
    files += [
        Path(__file__),
        Path(__file__).with_name("expansion_statistics.py"),
        Path(__file__).with_name("expansion_inference.py"),
        Path(__file__).with_name("requirements.txt"),
    ]
    files += [
        BASE / "prepresentation_scoring_contract.json",
        BASE / "schemas/model_research_output.schema.json",
        BASE / "schemas/prepresentation_finding.schema.json",
        BASE / "schemas/prepresentation_evidence.schema.json",
        BASE / "model_exposure_contract.json",
    ]
    frozen = dict(
        study_id=project.name,
        version="1.0.0",
        status="FROZEN",
        generator_author="GPT-6 Pro; source recorded separately from local execution and independent audit",
        artifacts={
            p.relative_to(ROOT).as_posix(): digest(p) for p in sorted(set(files))
        },
        model_allowlist={n: digest(package / n) for n in PUBLIC},
    )
    write(project / "freeze.json", frozen)
    return frozen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("study", choices=["SBT-004", "SBT-005", "SBT-006"])
    ap.add_argument("--verify", action="store_true")
    a = ap.parse_args()
    p = BASE / "projects/synthetic" / a.study
    r = verify(p) if a.verify else freeze(p)
    print(
        json.dumps(
            dict(
                study_id=r["study_id"],
                status=r["status"],
                artifacts=len(r["artifacts"]),
            )
        )
    )


if __name__ == "__main__":
    main()
