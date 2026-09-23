"""Compatibility entry point for the shared realised-study validator."""

import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[6]
raise SystemExit(
    subprocess.call(
        [
            sys.executable,
            str(root / "scripts/python/research_quality/freeze_study.py"),
            "SBT-003",
            "--check-only",
        ]
    )
)
