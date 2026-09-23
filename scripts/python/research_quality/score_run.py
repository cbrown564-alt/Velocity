"""Score explicit adjudications; never infer semantic truth from lexical overlap."""

import argparse
import hashlib
import json
import re
from pathlib import Path
from jsonschema import validate
from score_selection import score

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "evals/research_quality"


def read(p):
    return json.loads(p.read_text())


def resolve(output, analysis, path):
    path = path.removeprefix("analysis_results.json.")
    if path.startswith("analysis_claims."):
        parts = path.split(".")
        value = next(
            (
                c
                for c in output.get("analysis_claims", [])
                if c["analysis_id"] == parts[1]
            ),
            None,
        )
        parts = parts[2:]
    elif path.startswith("/"):
        value = output
        parts = [x.replace("~1", "/").replace("~0", "~") for x in path.split("/")[1:]]
    else:
        value = analysis
        parts = re.sub(r"\[(\d+)\]", r".\1", path).split(".")
    try:
        for key in parts:
            value = value[int(key)] if isinstance(value, list) else value[key]
        return value
    except (KeyError, IndexError, ValueError, TypeError):
        claim = next(
            (c for c in output.get("analysis_claims", []) if c["analysis_id"] == path),
            None,
        )
        return claim


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run")
    a = ap.parse_args()
    run = BASE / "runs" / a.run
    m = read(run / "manifest.json")
    output = read(run / "output.json")
    judgement = read(run / "adjudication.json")
    project = (
        BASE
        / (
            "projects/public"
            if m["study_id"].startswith("FSA")
            else "projects/synthetic"
        )
        / m["study_id"]
    )
    reference = read(project / "reference/reference_findings.json")["findings"]
    analysis = read(project / "model_inputs/analysis_results.json")
    matches = judgement["matches"]
    ids = {f["model_finding_id"] for f in output["findings"]}
    if len(matches) != len(ids) or {x["model_finding_id"] for x in matches} != ids:
        raise ValueError("Adjudicate every finding exactly once")
    metrics = score(reference, matches)
    refs = [p for f in output["findings"] for p in f["evidence_refs"]]
    unresolved = [p for p in refs if resolve(output, analysis, p) is None]
    complete = {
        x.get("reference_finding_id")
        for x in matches
        if x["match_state"] == "full"
        and x.get("evidence_compatible")
        and x.get("claim_strength_compatible")
    }
    missing = [
        f["finding_id"]
        for f in reference
        if f["tier"] == "mandatory" and f["finding_id"] not in complete
    ]
    result = dict(
        run_id=m["run_id"],
        study_id=m["study_id"],
        status="provisional_agent_adjudication",
        scorer_version="selection-1.1",
        scorer_sha256=hashlib.sha256(
            Path(__file__).with_name("score_selection.py").read_bytes()
        ).hexdigest(),
        dimension_scores=judgement["dimension_scores"],
        selection_metrics=metrics,
        finding_matches=matches,
        hard_failures=judgement["hard_failures"],
        provenance_coverage=(len(refs) - len(unresolved)) / len(refs),
        unresolved_references=unresolved,
        missed_mandatory_findings=missing,
        correction_burden=dict(
            human_active_minutes=None,
            human_corrections=None,
            proposed_agent_corrections=judgement["proposed_corrections"],
        ),
        costs=dict(
            elapsed_seconds=sum(s["elapsed_seconds"] for s in m["stage_runs"]),
            input_tokens=sum(
                u.get("input_tokens", 0)
                for s in m["stage_runs"]
                for u in s["usage"]
                if u
            ),
            cached_input_tokens=sum(
                u.get("cached_input_tokens", 0)
                for s in m["stage_runs"]
                for u in s["usage"]
                if u
            ),
            output_tokens=sum(
                u.get("output_tokens", 0)
                for s in m["stage_runs"]
                for u in s["usage"]
                if u
            ),
            incremental_usd=None,
            billing="Existing Codex ChatGPT access; dollar cost unavailable",
        ),
        notes=judgement["notes"],
    )
    validate(result, read(BASE / "schemas/evaluation_score.schema.json"))
    (run / "scorecard.json").write_text(json.dumps(result, indent=2) + "\n")
    print(
        json.dumps(
            dict(
                run=m["run_id"],
                recall=metrics["mandatory_recall"],
                provenance=result["provenance_coverage"],
                missing=missing,
            )
        )
    )


if __name__ == "__main__":
    main()
