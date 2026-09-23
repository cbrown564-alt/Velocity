"""Build canonical outputs for every synthetic study.

    python scripts/python/study_canonical/build_all.py [--root .] [--only SBT-004 ...]

Writes evals/research_quality/projects/synthetic/<ID>/canonical/{<id>.sav,<id>.csv,codebook.json,validation.json}.
Exits non-zero if any study fails validation or the SAV round trip.
"""
from __future__ import annotations
import argparse, importlib, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from canonical import validate, write_outputs, check_sav_roundtrip  # noqa: E402
from adapters import ADAPTERS  # noqa: E402


def run(root: Path, only=None, outroot: Path | None = None):
    results = {}
    for mod in ADAPTERS:
        sid = f"SBT-{mod[3:]}"
        if only and sid not in only: continue
        df, study = importlib.import_module(f"adapters.{mod}").build(root)
        report = validate(df, study)
        out = (outroot or root / "evals/research_quality/projects/synthetic") / sid / "canonical"
        paths = write_outputs(df, study, out, sid.lower().replace("-", "_"))
        rt = check_sav_roundtrip(df, study, paths["sav"])
        report["sav_roundtrip"] = rt
        report["passed"] = report["passed"] and rt["passed"]
        (out / "validation.json").write_text(json.dumps(report, indent=2) + "\n")
        results[sid] = report
        print(f"{sid}: {'PASS' if report['passed'] else 'FAIL'}  rows={report['checks']['rows']} vars={len(study['variables'])} "
              f"errors={len(report['errors'])} warnings={len(report['warnings'])}")
        for e in report["errors"][:10] + rt["problems"][:10]: print("   ERROR", e)
        for w in report["warnings"][:10]: print("   warn ", w)
    return results


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(HERE.parents[2]))
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    res = run(Path(a.root), a.only)
    sys.exit(0 if all(r["passed"] for r in res.values()) else 1)
