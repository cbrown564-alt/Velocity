"""Build a shareable, blinded researcher review pack and a separate private key."""

import argparse
import hashlib
import json
from pathlib import Path
import random
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "evals/research_quality"


def read(p):
    return json.loads(p.read_text())


def build_payload(studies=None, run_prefix=None):
    cases = []
    key = {}
    rng = random.Random(20260922)
    for study in studies or ["SBT-002", "SBT-003", "FSA-CIT-2025-03"]:
        project = (
            BASE
            / ("projects/public" if study.startswith("FSA") else "projects/synthetic")
            / study
        )
        candidates = []
        runs = []
        for manifest in sorted((BASE / "runs").glob("*/manifest.json")):
            m = read(manifest)
            if (
                m["study_id"] == study
                and (run_prefix is None or m["run_id"].startswith(run_prefix))
                and m["status"] == "complete"
                and (manifest.parent / "output.json").exists()
            ):
                runs.append((manifest.parent, m))
        if not runs:
            raise ValueError("No completed runs for " + study)
        rng.shuffle(runs)
        for index, (run, m) in enumerate(runs, 1):
            id = study + f"-{index:02d}"
            output = read(run / "output.json")
            # Preserve substantive method statements but omit explicit model/runner metadata.
            candidates.append(dict(candidate_id=id, output=output))
            key[id] = dict(
                run_id=m["run_id"],
                model=m["model"],
                input_surface=m["input_surface"],
                workflow=m["workflow"],
                replicate=m["replicate"],
            )
        if candidates:
            cases.append(
                dict(
                    study_id=study,
                    materials=read(project / "model_inputs/study_materials.json"),
                    questionnaire=(
                        project / "model_inputs/questionnaire.md"
                    ).read_text(),
                    evidence=read(project / "model_inputs/analysis_results.json"),
                    candidates=candidates,
                )
            )
    payload = dict(
        version="1.0",
        purpose="Independent researcher assessment; identities, experiment arms and provisional scores withheld.",
        cases=cases,
    )
    payload["pack_id"] = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode()
    ).hexdigest()[:16]
    return payload, key


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--studies", nargs="+")
    ap.add_argument("--run-prefix")
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    if args.studies and not args.out:
        ap.error("--out is required with --studies; preserve the original pilot pack")
    payload, key = build_payload(args.studies, args.run_prefix)
    root = args.out or BASE / "review/2026-09-pilot"
    public = root / "reviewer_pack"
    public.mkdir(parents=True, exist_ok=True)
    # The key is deliberately outside the directory that is zipped/shared.
    (root / "private_key.json").write_text(json.dumps(key, indent=2) + "\n")
    serialized = json.dumps(payload).replace("<", "\\u003c")
    template = (Path(__file__).with_name("review_template.html")).read_text()
    (public / "index.html").write_text(template.replace("__PAYLOAD__", serialized))
    (public / "review_data.json").write_text(json.dumps(payload, indent=2) + "\n")
    for case in payload["cases"]:
        study = case["study_id"]
        project = (
            BASE
            / ("projects/public" if study.startswith("FSA") else "projects/synthetic")
            / study
        )
        dest = public / "materials" / study
        dest.mkdir(parents=True, exist_ok=True)
        for p in (project / "model_inputs").iterdir():
            shutil.copyfile(p, dest / p.name)
    (public / "README.md").write_text(
        """# Independent research review\n\nOpen index.html in a browser. Keep identities and provisional scores hidden until assessments are submitted. The review is saved in that browser; export progress before moving devices. Do not use this data for training.\n\n1. Inspect the study brief, questionnaire and approved tables before opening candidates. Record your own important findings and unacceptable claims.\n2. Review candidates in the displayed order. Check numbers, bases, inference and claim strength against source evidence. Accept, revise or reject each finding, giving reasons. Record missed important findings.\n3. Select the story beats to keep and edit their headlines if needed. Approval requires reviewed preparation, a decision on each finding and a story that uses only accepted findings.\n4. Export the review JSON. Report active review minutes and compare candidates within a study. A tie is allowed. Two or more researchers should assess independently before discussing disagreements.\n5. Return exports to the study owner. The owner will reveal the private key only after submission and reconcile disagreements without overwriting original reviews.\n\nThe pack contains the completed study outputs selected by the study owner. Compare candidates within each study; differences between studies do not establish a model ranking. Method wording may make workflow identity guessable; blinding hides labels, not writing style. These are study outputs awaiting review, not validated findings.\n\nThe local review flow is an evaluation prototype. It exports evidence-bound review decisions; it is not a Velocity workspace/session format. Loading revised evidence invalidates all approvals while preserving edits, so numbers cannot silently change under an approved story.\n"""
    )
    with zipfile.ZipFile(
        root / "reviewer_pack.zip", "w", zipfile.ZIP_DEFLATED
    ) as archive:
        for p in sorted(public.rglob("*")):
            if p.is_file():
                archive.write(p, p.relative_to(public))
    print(
        json.dumps(
            dict(
                pack_id=payload["pack_id"],
                candidates=len(key),
                path=str(public / "index.html"),
            )
        )
    )


if __name__ == "__main__":
    main()
