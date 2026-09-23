"""Capped Codex ChatGPT pilot; isolated input directory, frozen provenance, raw events.

This is an offline experiment runner, not a product agent. No API key is used.
Tools are permitted only for calculations on the supplied files. Tool traces need
review for exposure violations before any score can be treated as valid.
"""

import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

from jsonschema import validate
from freeze_study import BASE, REPO, verify, sha, read, write

TASK = """You are a survey researcher working on a fictional benchmark study. Answer the business question using only the supplied study files. Do not browse, use connectors, inspect parent directories, discover other files, or access benchmark/generator/reference/scoring material. No delegated agents. Your only permitted shell work is reading supplied files and doing local numerical calculations. Do not install packages. Use the available Python scientific libraries if needed.
Produce a concise, prioritised researcher narrative, with at most 10 findings, and a renderer-neutral story. Retain enough numerical detail, bases, inference and qualifications to audit each claim. The brief's declared analysis policy applies. Do not treat a numerical lead as proof of superiority. Evidence_refs should name exact analysis table paths; raw-data work should define analysis_claims with stable analysis_id, values, universe and weighting. All finding references in the story must resolve.
Return ONLY a JSON object with these keys:
study_id: string;
analysis_claims: array of {analysis_id:string, values:object, universe:string, weighting:string};
findings: array of {model_finding_id:string, proposition:string, evidence_refs:string[], importance:"primary"|"secondary"|"context", claim_strength:string, qualification:string, topic_cluster:string};
story: {beats: array of {order:integer, finding_refs:string[], headline_intent:string, analytical_relationship:string}};
method_notes: string[].
"""
STAGES = {
    "analyst": "Compute or inspect evidence and draft candidate findings and an initial story. Make numerical claims auditable.",
    "verifier": "Independently check the prior draft against the supplied study evidence. Repair or remove unsupported findings, numerical/base errors and overstatement. Record corrections in method_notes. Return the full corrected JSON.",
    "prioritiser": "Select and rank findings from the verified draft. Collapse redundancy and preserve important qualifications. Do not invent new empirical evidence. Return the full revised JSON.",
    "story_editor": "Order the selected findings into a coherent business argument. Preserve evidence and qualifications; introduce no new empirical findings. Return the full final JSON.",
}


def parse(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


def check_output(result, study):
    validate(result, read(BASE / "schemas/model_research_output.schema.json"))
    if result["study_id"] != study:
        raise ValueError("Wrong study ID")
    ids = [f["model_finding_id"] for f in result["findings"]]
    if len(set(ids)) != len(ids) or not ids:
        raise ValueError("Missing/duplicate finding IDs")
    for beat in result["story"]["beats"]:
        if not beat["finding_refs"] or not set(beat["finding_refs"]) <= set(ids):
            raise ValueError("Broken story finding reference")
    if any(not f["evidence_refs"] for f in result["findings"]):
        raise ValueError("Unreferenced finding")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("study", choices=["SBT-002", "SBT-003", "FSA-CIT-2025-03"])
    ap.add_argument("--surface", choices=["analysis", "raw"], default="analysis")
    ap.add_argument("--workflow", choices=["one_pass", "staged"], default="one_pass")
    ap.add_argument("--replicate", type=int, default=1)
    ap.add_argument("--model", default="gpt-6-astra")
    ap.add_argument("--codex", default="codex")
    ap.add_argument("--timeout", type=int, default=360)
    ap.add_argument("--run-id", required=True)
    a = ap.parse_args()
    project = (
        BASE
        / ("projects/public" if a.study.startswith("FSA-") else "projects/synthetic")
        / a.study
    )
    verify(project)
    run = BASE / "runs" / a.run_id
    run.mkdir(parents=True, exist_ok=False)
    manifest_path = run / "manifest.json"
    subprocess.run(
        [
            sys.executable,
            str(Path(__file__).with_name("run_manifest.py")),
            "--project",
            str(project),
            "--surface",
            a.surface,
            "--workflow",
            a.workflow,
            "--model",
            a.model,
            "--run-id",
            a.run_id,
            "--replicate",
            str(a.replicate),
            "--out",
            str(manifest_path),
        ],
        check=True,
    )
    manifest = read(manifest_path)
    manifest.update(
        status="running",
        started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        runner_sha256=sha(__file__),
        cli_version=subprocess.check_output([a.codex, "--version"], text=True).strip(),
        reasoning_effort="low",
        timeout_per_stage_seconds=a.timeout,
        cost=dict(
            billing="existing ChatGPT Codex access",
            incremental_usd=None,
            reason="CLI reports token usage, not monetary cost",
        ),
        exposure_audit="pending tool-trace review",
    )
    write(manifest_path, manifest)
    stages = list(STAGES) if a.workflow == "staged" else ["researcher"]
    previous = None
    try:
        with tempfile.TemporaryDirectory(prefix="velocity-study-") as folder:
            sandbox = Path(folder)
            for art in manifest["input_artifacts"]:
                shutil.copyfile(art["path"], sandbox / Path(art["path"]).name)
            for i, stage in enumerate(stages):
                stage_dir = run / f"{i+1:02d}-{stage}"
                stage_dir.mkdir()
                prompt = (
                    (
                        TASK.replace(
                            "fictional benchmark study", "documented real survey"
                        )
                        if a.study.startswith("FSA-")
                        else TASK
                    )
                    + "\n"
                    + STAGES.get(stage, "Complete the research task in one pass.")
                    + "\nSupplied files: "
                    + ", ".join(p.name for p in sorted(sandbox.iterdir()))
                    + "\n"
                )
                if previous is not None:
                    prompt += "\nPrior stage output:\n" + json.dumps(
                        previous, separators=(",", ":")
                    )
                # Analysis arms can read all bytes without tools. Raw arms must calculate from CSV.
                for path in sorted(sandbox.iterdir()):
                    if path.suffix != ".csv":
                        content = path.read_text()
                        if path.suffix == ".json":
                            content = json.dumps(
                                json.loads(content), separators=(",", ":")
                            )
                        prompt += (
                            "\nFILE " + path.name + "\n" + content + "\nEND FILE\n"
                        )
                if a.surface == "analysis":
                    prompt += "\nAll evidence is included above. Do not call tools. Return final JSON now.\n"
                (stage_dir / "prompt.txt").write_text(prompt)
                response = stage_dir / "response.txt"
                cmd = [
                    a.codex,
                    "exec",
                    "--ignore-user-config",
                    "--ignore-rules",
                    "--ephemeral",
                    "--skip-git-repo-check",
                    "--color",
                    "never",
                    "--json",
                    "--sandbox",
                    "read-only",
                    "--model",
                    a.model,
                    "-c",
                    'model_reasoning_effort="low"',
                    "-c",
                    "project_doc_max_bytes=0",
                    "-c",
                    'shell_environment_policy.inherit="none"',
                    "-C",
                    str(sandbox),
                    "-o",
                    str(response),
                    "-",
                ]
                start = time.monotonic()
                with (stage_dir / "events.jsonl").open("w") as stdout, (
                    stage_dir / "stderr.txt"
                ).open("w") as stderr:
                    env = {
                        k: v
                        for k, v in os.environ.items()
                        if k
                        not in {
                            "OPENAI_API_KEY",
                            "ANTHROPIC_API_KEY",
                            "OPENROUTER_API_KEY",
                        }
                    }
                    process = subprocess.run(
                        cmd,
                        input=prompt,
                        text=True,
                        stdout=stdout,
                        stderr=stderr,
                        timeout=a.timeout,
                        env=env,
                    )
                elapsed = time.monotonic() - start
                events = [
                    json.loads(l)
                    for l in (stage_dir / "events.jsonl").read_text().splitlines()
                    if l.strip()
                ]
                usages = [
                    e.get("usage") for e in events if e.get("type") == "turn.completed"
                ]
                manifest["stage_runs"].append(
                    dict(
                        stage=stage,
                        elapsed_seconds=elapsed,
                        returncode=process.returncode,
                        usage=usages,
                        prompt_sha256=sha(stage_dir / "prompt.txt"),
                    )
                )
                write(manifest_path, manifest)
                if process.returncode:
                    raise ValueError(f"Codex {stage} failed; inspect stderr/events")
                previous = parse(response.read_text())
                check_output(previous, a.study)
                write(stage_dir / "output.json", previous)
                print(
                    json.dumps(
                        dict(
                            run_id=a.run_id,
                            stage=stage,
                            status="complete",
                            seconds=round(elapsed),
                        )
                    ),
                    flush=True,
                )
            write(run / "output.json", previous)
        verify(project)
        manifest["status"] = "complete"
    except Exception as exc:
        manifest.update(status="failed", invalid_reason=str(exc))
        raise
    finally:
        manifest["completed_at"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()
        manifest["output_artifacts"] = [
            dict(
                path=p.relative_to(REPO).as_posix(),
                sha256=sha(p),
                artifact_type=p.suffix.lstrip("."),
            )
            for p in sorted(run.rglob("*"))
            if p.is_file() and p != manifest_path
        ]
        write(manifest_path, manifest)


if __name__ == "__main__":
    main()
