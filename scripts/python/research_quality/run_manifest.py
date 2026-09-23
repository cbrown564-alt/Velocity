"""Create run manifests only from exact frozen, allowlisted public inputs."""

import argparse
import datetime
import hashlib
import json
from pathlib import Path

FORBIDDEN = (
    "/hidden/",
    "reference_findings",
    "trap_truth",
    "freeze_validation",
    "scoring_key",
)


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def classify(path):
    s = str(path).replace("\\", "/")
    if any(x in s for x in FORBIDDEN):
        return "forbidden"
    if s.endswith("respondents.csv"):
        return "raw_data"
    if s.endswith("analysis_results.json"):
        return "analysis_surface"
    if Path(s).name in {"questionnaire.md", "codebook.json", "study_materials.json"}:
        return "study_material"
    return "forbidden"


def main():
    from freeze_study import verify
    from validate_exposure import validate

    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--surface", choices=["analysis", "raw"], required=True)
    ap.add_argument("--workflow", choices=["one_pass", "staged"], required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--replicate", type=int, default=1)
    a = ap.parse_args()
    project = Path(a.project).resolve()
    frozen = verify(project)
    names = [
        "study_materials.json",
        "questionnaire.md",
        "codebook.json",
        "analysis_results.json" if a.surface == "analysis" else "respondents.csv",
    ]
    arts = [
        dict(
            path=str(project / "model_inputs" / n),
            sha256=sha(project / "model_inputs" / n),
            exposure_class=classify(n),
        )
        for n in names
    ]
    result = dict(
        run_id=a.run_id,
        study_id=frozen["study_id"],
        study_version=frozen["version"],
        arm=(
            "E2_STAGED"
            if a.workflow == "staged"
            else ("E3_ANALYSIS_SURFACE" if a.surface == "analysis" else "E4_RAW_DATA")
        ),
        input_surface=a.surface,
        workflow=a.workflow,
        model=dict(provider="codex_chatgpt", model_id=a.model),
        replicate=a.replicate,
        input_artifacts=arts,
        output_artifacts=[],
        stage_runs=[],
        status="planned",
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        freeze_sha256=sha(project / "freeze.json"),
    )
    validate(result, frozen["model_allowlist"], project / "model_inputs")
    with Path(a.out).open("x") as out:
        out.write(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
