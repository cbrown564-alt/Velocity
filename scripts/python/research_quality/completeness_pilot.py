"""Six predeclared second-pass reviews; dry by default, no quality retries.

Only frozen public evidence and an exact prior model output enter the prompt.
The prior draft is an additional experimental input, not part of the study freeze.
"""

import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

from freeze_study import BASE, REPO, read, sha, verify, write
from pilot_runner import TASK, check_output, parse
from validate_exposure import validate

PLAN = BASE / "runs/2026-09-completeness-comparison/protocol.json"


def select_slot(plan, run_id):
    ids = [slot["run_id"] for slot in plan["slots"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate planned run")
    if run_id not in ids:
        raise ValueError("Unplanned run")
    return plan["slots"][ids.index(run_id)]


def checked_baseline(base, slot):
    run = base / "runs" / slot["baseline_run"]
    for name in ["manifest", "output"]:
        if sha(run / f"{name}.json") != slot[f"baseline_{name}_sha256"]:
            raise ValueError("Changed baseline " + name)
    manifest, output = read(run / "manifest.json"), read(run / "output.json")
    required = dict(
        study_id=slot["study_id"],
        status="complete",
        input_surface="analysis",
        workflow="one_pass",
        reasoning_effort="low",
    )
    if (
        any(manifest.get(k) != v for k, v in required.items())
        or manifest["model"]["model_id"] != "gpt-6-astra"
    ):
        raise ValueError("Incompatible baseline")
    matches = [
        a
        for a in manifest["output_artifacts"]
        if a["path"]
        == f'evals/research_quality/runs/{slot["baseline_run"]}/output.json'
    ]
    if len(matches) != 1 or matches[0]["sha256"] != slot["baseline_output_sha256"]:
        raise ValueError("Baseline output is not bound to its original manifest")
    return manifest, output


def build_prompt(files, draft, instruction):
    prompt = (
        TASK
        + "\n"
        + instruction
        + "\nPrior draft:\n"
        + json.dumps(draft, separators=(",", ":"))
    )
    for name, content in sorted(files.items()):
        if name.endswith(".json"):
            content = json.dumps(json.loads(content), separators=(",", ":"))
        prompt += "\nFILE " + name + "\n" + content + "\nEND FILE\n"
    return (
        prompt
        + "\nAll evidence is included above. Do not call tools. Return final JSON now.\n"
    )


def audit_events(events):
    completed = 0
    for event in events:
        if event["type"] in {"turn.failed", "error"}:
            raise ValueError("Unexpected failed turn in trace")
        if event["type"].startswith("item.") and event["item"]["type"] not in {
            "agent_message",
            "reasoning",
        }:
            raise ValueError("Unexpected tool/action in no-tools review trace")
        if event["type"] == "turn.completed":
            completed += 1
    if completed != 1:
        raise ValueError("Expected exactly one completed turn")
    return dict(
        status="PASS",
        completed_turns=completed,
        tool_actions=0,
        scope="Recorded model actions only; not a claim of operating-system isolation",
    )


def prepare(plan, run_id):
    if len(plan["slots"]) != 6 or plan["maximum_calls"] != 6:
        raise ValueError("This pilot is capped at six declared calls")
    slot = select_slot(plan, run_id)
    for path, digest in plan["dependencies"].items():
        if sha(REPO / path) != digest:
            raise ValueError("Changed protocol dependency: " + path)
    baseline, draft = checked_baseline(BASE, slot)
    project = BASE / "projects/synthetic" / slot["study_id"]
    frozen = verify(project)
    if sha(project / "freeze.json") != slot["freeze_sha256"]:
        raise ValueError("Changed study freeze")
    check_output(draft, slot["study_id"])
    artifacts = [
        dict(
            path=str(project / "model_inputs" / Path(a["path"]).name),
            sha256=a["sha256"],
            exposure_class=a["exposure_class"],
        )
        for a in baseline["input_artifacts"]
    ]
    validate(
        dict(run_id=run_id, input_artifacts=artifacts),
        frozen["model_allowlist"],
        project / "model_inputs",
    )
    files = {Path(a["path"]).name: Path(a["path"]).read_text() for a in artifacts}
    prompt = build_prompt(files, draft, plan["instructions"][slot["condition"]])
    return slot, artifacts, prompt


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("run_id")
    ap.add_argument(
        "--execute", action="store_true", help="Consumes one planned Codex call"
    )
    ap.add_argument("--codex", default="codex")
    args = ap.parse_args()
    plan = read(PLAN)
    slot, artifacts, prompt = prepare(plan, args.run_id)
    run = BASE / "runs" / args.run_id
    if run.exists():
        raise ValueError("Run already exists; preserve it, never retry for quality")
    if not args.execute:
        print(
            json.dumps(
                dict(
                    status="DRY_PASS",
                    run_id=args.run_id,
                    condition=slot["condition"],
                    prompt_characters=len(prompt),
                    planned_calls=6,
                )
            )
        )
        return
    # A committed protocol must precede every invocation; include its commit in evidence.
    committed = subprocess.check_output(
        ["git", "show", "HEAD:" + PLAN.relative_to(REPO).as_posix()], cwd=REPO
    )
    if committed != PLAN.read_bytes():
        raise ValueError("Commit the exact protocol before executing")
    cli_version = subprocess.check_output([args.codex, "--version"], text=True).strip()
    run.mkdir(exist_ok=False)
    stage = run / "01-reviewer"
    stage.mkdir()
    (stage / "prompt.txt").write_text(prompt)
    manifest = dict(
        run_id=args.run_id,
        study_id=slot["study_id"],
        study_version="1.0.0",
        arm="COMPLETENESS_REVIEW",
        input_surface="analysis",
        workflow=slot["condition"],
        model=dict(provider="codex_chatgpt", model_id="gpt-6-astra"),
        reasoning_effort="low",
        replicate=1,
        input_artifacts=artifacts,
        prior_output=dict(
            run_id=slot["baseline_run"], sha256=slot["baseline_output_sha256"]
        ),
        protocol_sha256=sha(PLAN),
        protocol_commit=subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=REPO, text=True
        ).strip(),
        runner_sha256=sha(__file__),
        cli_version=cli_version,
        freeze_sha256=slot["freeze_sha256"],
        status="running",
        stage_runs=[],
        output_artifacts=[],
        started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        timeout_per_stage_seconds=plan["timeout_seconds"],
        cost=dict(
            billing="existing ChatGPT Codex access",
            incremental_usd=None,
            reason="CLI reports usage, not monetary cost",
        ),
    )
    write(run / "manifest.json", manifest)
    start, returncode, events = time.monotonic(), None, []
    try:
        with tempfile.TemporaryDirectory(prefix="velocity-review-") as folder:
            command = [
                args.codex,
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
                "gpt-6-astra",
                "-c",
                'model_reasoning_effort="low"',
                "-c",
                "project_doc_max_bytes=0",
                "-c",
                'shell_environment_policy.inherit="none"',
                "-C",
                folder,
                "-o",
                str(stage / "response.txt"),
                "-",
            ]
            write(stage / "command.json", command)
            env = {
                k: v
                for k, v in os.environ.items()
                if k
                not in {"OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"}
            }
            with (stage / "events.jsonl").open("w") as stdout, (
                stage / "stderr.txt"
            ).open("w") as stderr:
                result = subprocess.run(
                    command,
                    input=prompt,
                    text=True,
                    stdout=stdout,
                    stderr=stderr,
                    timeout=plan["timeout_seconds"],
                    env=env,
                )
            returncode = result.returncode
            events = [
                json.loads(line)
                for line in (stage / "events.jsonl").read_text().splitlines()
                if line.strip()
            ]
            if returncode:
                raise ValueError("CLI failed; original trace retained")
            exposure = audit_events(events)
            exposure.update(
                public_input_count=len(artifacts),
                prior_output_sha256=slot["baseline_output_sha256"],
                protocol_sha256=sha(PLAN),
            )
            write(run / "exposure_audit.json", exposure)
            output = parse((stage / "response.txt").read_text())
            check_output(output, slot["study_id"])
            write(run / "output.json", output)
        verify(BASE / "projects/synthetic" / slot["study_id"])
        manifest["status"] = "complete"
    except Exception as exc:
        manifest.update(status="failed", invalid_reason=str(exc))
        raise
    finally:
        # A timeout's complete event lines still carry useful usage; preserve the raw remainder.
        if not events and (stage / "events.jsonl").exists():
            for line in (stage / "events.jsonl").read_text().splitlines():
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    manifest["trace_has_incomplete_json_line"] = True
        manifest["stage_runs"] = [
            dict(
                stage="reviewer",
                elapsed_seconds=time.monotonic() - start,
                returncode=returncode,
                usage=[
                    e.get("usage") for e in events if e.get("type") == "turn.completed"
                ],
                prompt_sha256=sha(stage / "prompt.txt"),
            )
        ]
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
            if p.is_file() and p != run / "manifest.json"
        ]
        write(run / "manifest.json", manifest)
    print(
        json.dumps(
            dict(
                run_id=args.run_id,
                status=manifest["status"],
                seconds=round(time.monotonic() - start),
            )
        )
    )


if __name__ == "__main__":
    main()
