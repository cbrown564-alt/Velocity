#!/usr/bin/env python3
"""Validate Jev question packs and optionally run typesafe ask.

Offline by default (structure + state path checks). Live Mode requires
TYPESAFE_API_KEY and a `typesafe` binary on PATH.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
JEV_DIR = ROOT / "evals/research_quality/jev"


def load_pack(stage: str) -> dict:
    roles = json.loads((JEV_DIR / "stage_roles.json").read_text())
    stage_cfg = roles["stages"][stage]
    pack = json.loads((JEV_DIR / stage_cfg["questions_file"]).read_text())
    return {"roles": roles, "stage_cfg": stage_cfg, "pack": pack}


def validate_pack(pack: dict) -> list[str]:
    errors: list[str] = []
    if "questions" not in pack or not isinstance(pack["questions"], dict):
        return ["pack.questions must be an object"]
    if "state_paths_required" not in pack:
        errors.append("state_paths_required missing")
    for qid, q in pack["questions"].items():
        if q.get("type") not in {"noul", "choice", "score"}:
            errors.append(f"{qid}: invalid type")
        if "instructions" not in q:
            errors.append(f"{qid}: instructions required")
        if q.get("type") == "choice" and len((q.get("criteria") or {})) < 2:
            errors.append(f"{qid}: choice needs >=2 criteria")
        if q.get("type") == "score" and len((q.get("levels") or q.get("criteria") or {})) < 2:
            errors.append(f"{qid}: score needs >=2 levels")
    return errors


def state_covers_paths(state: dict, paths: list[str]) -> list[str]:
    missing = []
    for path in paths:
        cur: object = state
        ok = True
        for part in path.split("."):
            if not isinstance(cur, dict) or part not in cur:
                ok = False
                break
            cur = cur[part]
        if not ok:
            missing.append(path)
    return missing


def to_typesafe_questions(pack: dict) -> dict:
    out = {}
    for qid, q in pack["questions"].items():
        item = {"type": q["type"], "instructions": q["instructions"]}
        if q["type"] == "choice":
            item["criteria"] = q["criteria"]
        if q["type"] == "score" and "levels" in q:
            item["levels"] = q["levels"]
        out[qid] = item
    return out


def run_typesafe(state: dict, questions: dict, model: str) -> dict:
    with tempfile.TemporaryDirectory(prefix="velocity-jev-") as tmp:
        t = Path(tmp)
        state_path = t / "state.json"
        q_path = t / "questions.json"
        state_path.write_text(json.dumps(state))
        q_path.write_text(json.dumps(questions))
        cmd = [
            "typesafe",
            "ask",
            "--state-file",
            str(state_path),
            "--questions-file",
            str(q_path),
            "--model",
            model,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        payload = proc.stdout.strip() or proc.stderr.strip()
        try:
            return json.loads(payload)
        except json.JSONDecodeError as e:
            raise SystemExit(f"typesafe returned non-JSON (exit {proc.returncode}): {payload[:500]}") from e


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("stage", choices=["cleaning", "verifier", "prioritiser"])
    ap.add_argument("--state-file", type=Path, help="JSON state for live ask")
    ap.add_argument("--live", action="store_true", help="Call typesafe ask")
    ap.add_argument("--model", default=None)
    args = ap.parse_args()

    loaded = load_pack(args.stage)
    pack = loaded["pack"]
    errors = validate_pack(pack)
    if errors:
        raise SystemExit("INVALID PACK: " + "; ".join(errors))

    result = {
        "status": "PASS",
        "stage": args.stage,
        "question_count": len(pack["questions"]),
        "state_paths_required": pack["state_paths_required"],
        "live": False,
    }

    if args.state_file:
        state = json.loads(args.state_file.read_text())
        missing = state_covers_paths(state, pack["state_paths_required"])
        result["missing_state_paths"] = missing
        if missing and args.live:
            raise SystemExit("MISSING STATE PATHS: " + ", ".join(missing))

    if args.live:
        if not args.state_file:
            raise SystemExit("--state-file required for --live")
        # Prefer `typesafe auth status` so a wrapper-managed key file works without
        # this process inspecting secrets.
        auth = subprocess.run(
            ["typesafe", "auth", "status"], capture_output=True, text=True
        )
        try:
            auth_payload = json.loads(auth.stdout or auth.stderr or "{}")
        except json.JSONDecodeError:
            auth_payload = {}
        if not ((auth_payload.get("data") or {}).get("has_key")):
            raise SystemExit("typesafe auth status reports has_key=false")
        model = args.model or loaded["roles"].get("default_model", "jev-latest")
        state = json.loads(args.state_file.read_text())
        ts = run_typesafe(state, to_typesafe_questions(pack), model)
        result["live"] = True
        result["typesafe"] = ts

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
