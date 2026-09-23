"""Summarise the predeclared paired reviews without changing semantic judgements."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "evals/research_quality"
OUT = BASE / "runs/2026-09-completeness-comparison"


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pair_result(baseline, general, coverage):
    if any(row["status"] != "complete" for row in [baseline, general, coverage]):
        return dict(status="incomplete_pair", promising=None)
    before = set(baseline["missed_mandatory_findings"])
    after = set(coverage["missed_mandatory_findings"])
    control = set(general["missed_mandatory_findings"])
    safe = all(
        [
            coverage["unsupported_rate"] == 0,
            coverage["do_not_elevate_rate"] == 0,
            not coverage["hard_failures"],
            coverage["provenance_coverage"] == 1,
            coverage["numerical_audit"] == "PASS",
            not (after - before),
        ]
    )
    return dict(
        status="complete_pair",
        coverage_gained_from_baseline=sorted(before - after),
        coverage_lost_from_baseline=sorted(after - before),
        general_gained_from_baseline=sorted(before - control),
        general_lost_from_baseline=sorted(control - before),
        coverage_found_but_general_missed=sorted(control - after),
        general_found_but_coverage_missed=sorted(after - control),
        coverage_passes_safety_checks=safe,
        promising=safe and len(after) < len(before) and len(after) < len(control),
    )


def summary(run_id, *, current=False):
    run = BASE / "runs" / run_id
    m = read(run / "manifest.json")
    for artifact in m["output_artifacts"]:
        if sha(ROOT / artifact["path"]) != artifact["sha256"]:
            raise ValueError("Changed original artifact: " + artifact["path"])
    result = dict(
        run_id=run_id,
        status=m["status"],
        study_id=m["study_id"],
        condition=m["workflow"],
        elapsed_seconds=sum(s["elapsed_seconds"] for s in m["stage_runs"]),
    )
    if m["status"] != "complete":
        result.update(
            invalid_reason=m.get("invalid_reason"),
            input_tokens=None,
            output_tokens=None,
            incremental_usd=None,
        )
        return result
    o = read(run / "output.json")
    score = read(run / "scorecard.json")
    adjudication = read(run / "adjudication.json")
    audit = read(run / "numerical_audit.json")
    exposure = read(run / "exposure_audit.json")
    digest = sha(run / "output.json")
    if audit["output_sha256"] != digest or (
        current and adjudication["output_sha256"] != digest
    ):
        raise ValueError("Audit/adjudication is not bound to current output")
    if exposure["status"] != "PASS":
        raise ValueError("Exposure audit failed")
    if current and m["protocol_sha256"] != sha(OUT / "protocol.json"):
        raise ValueError("Changed experiment protocol")
    full = sorted(
        {
            r["reference_finding_id"]
            for r in score["finding_matches"]
            if r["match_state"] == "full"
            and r.get("evidence_compatible")
            and r.get("claim_strength_compatible")
        }
    )
    result.update(score["selection_metrics"])
    result.update(
        missed_mandatory_findings=score["missed_mandatory_findings"],
        full_reference_findings=full,
        hard_failures=score["hard_failures"],
        provenance_coverage=score["provenance_coverage"],
        numerical_audit=audit["status"],
        numeric_checks=len(audit["checks"]),
        output_sha256=digest,
        findings=len(o["findings"]),
        story_beats=len(o["story"]["beats"]),
        finding_words=sum(
            len(f["proposition"].split()) + len(f.get("qualification", "").split())
            for f in o["findings"]
        ),
        method_note_words=sum(len(n.split()) for n in o.get("method_notes", [])),
        response_characters=len((run / "output.json").read_text()),
        input_tokens=score["costs"]["input_tokens"],
        cached_input_tokens=score["costs"]["cached_input_tokens"],
        output_tokens=score["costs"]["output_tokens"],
        incremental_usd=None,
        human_preference=None,
        human_correction_minutes=None,
        correction_proposals=adjudication["proposed_corrections"],
    )
    return result


def main():
    plan = read(OUT / "protocol.json")
    rows, studies = [], []
    for study in sorted({s["study_id"] for s in plan["slots"]}):
        slots = [s for s in plan["slots"] if s["study_id"] == study]
        baseline = summary(slots[0]["baseline_run"])
        reviewed = {s["condition"]: summary(s["run_id"], current=True) for s in slots}
        rows.extend([baseline, *reviewed.values()])
        studies.append(
            dict(
                study_id=study,
                baseline_run=baseline["run_id"],
                **pair_result(
                    baseline, reviewed["general_review"], reviewed["coverage_review"]
                )
            )
        )
    result = dict(
        experiment_id=plan["experiment_id"],
        status="provisional_agent_adjudication",
        protocol_sha256=sha(OUT / "protocol.json"),
        protocol=plan["decision_question"],
        rows=rows,
        studies=studies,
        limits=plan["limitations"],
        completed_new_calls=sum(
            r["status"] == "complete" for r in rows if r["condition"] != "one_pass"
        ),
        incremental_usd=None,
        human_assessments_received=0,
    )
    (OUT / "comparison.json").write_text(json.dumps(result, indent=2) + "\n")
    print(
        json.dumps(
            dict(studies=studies, completed_new_calls=result["completed_new_calls"]),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
