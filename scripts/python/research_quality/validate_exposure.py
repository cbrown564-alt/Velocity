"""Validate exact paths AND bytes against the frozen model-facing allowlist."""

import argparse
import hashlib
import json
from pathlib import Path


def validate(manifest, allowlist, package):
    package = Path(package).resolve()
    inputs = manifest.get("input_artifacts", [])
    if not inputs:
        raise ValueError("No model inputs")
    seen = set()
    for artifact in inputs:
        path = Path(artifact["path"]).resolve()
        try:
            relative = path.relative_to(package).as_posix()
        except ValueError as exc:
            raise ValueError("Input is outside frozen package") from exc
        if relative in seen or relative not in allowlist:
            raise ValueError("Duplicate or unlisted model input: " + relative)
        seen.add(relative)
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != allowlist[relative] or actual != artifact["sha256"]:
            raise ValueError("Changed model input: " + relative)
    return dict(status="PASS", run_id=manifest["run_id"], inputs=len(inputs))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--package", required=True)
    ap.add_argument("--freeze", required=True)
    a = ap.parse_args()
    frozen = json.loads(Path(a.freeze).read_text())
    if frozen["status"] != "FROZEN":
        raise SystemExit("Study is not frozen")
    print(
        json.dumps(
            validate(
                json.loads(Path(a.manifest).read_text()),
                frozen["model_allowlist"],
                a.package,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
