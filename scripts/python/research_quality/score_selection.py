"""Deterministic metrics from explicit, inspectable semantic adjudication."""

import argparse
import json
from pathlib import Path


def safe(a, b):
    return a / b if b else 0.0


def score(reference, matches):
    refs = {r["finding_id"]: r for r in reference}
    if len(refs) != len(reference):
        raise ValueError("Duplicate reference finding ID")
    ids = [m["model_finding_id"] for m in matches]
    if len(set(ids)) != len(ids):
        raise ValueError("Adjudicate each model finding exactly once")
    for m in matches:
        if (
            m.get("reference_finding_id") is not None
            and m["reference_finding_id"] not in refs
        ):
            raise ValueError("Unknown reference finding ID")
        if m["match_state"] not in {
            "full",
            "partial",
            "unsupported",
            "contradiction",
            "duplicate",
            "supported_novel",
        }:
            raise ValueError("Unknown match state")
        if m["match_state"] in {"full", "partial"} and not m.get(
            "reference_finding_id"
        ):
            raise ValueError("Supported matches require a reference ID")
    mandatory = {k for k, v in refs.items() if v["tier"] == "mandatory"}
    dne = {k for k, v in refs.items() if v["tier"] == "do_not_elevate"}
    selected = [m for m in matches if m["match_state"] != "duplicate"]
    supported = [
        m
        for m in selected
        if m["match_state"] in {"full", "partial", "supported_novel"}
        and m.get("evidence_compatible", True)
        and m.get("claim_strength_compatible", True)
    ]
    full = {m["reference_finding_id"] for m in supported if m["match_state"] == "full"}
    eligible = {k for k, v in refs.items() if v["tier"] in {"mandatory", "secondary"}}
    cluster = lambda k: refs[k].get("topic_cluster") or k
    clusters = {
        cluster(m["reference_finding_id"])
        for m in supported
        if m["reference_finding_id"] in eligible
    }
    elevated = {
        m.get("reference_finding_id")
        for m in selected
        if m.get("model_importance") == "primary"
    } & dne
    return dict(
        mandatory_recall=safe(len(full & mandatory), len(mandatory)),
        selected_precision=safe(len(supported), len(selected)),
        unsupported_rate=safe(len(selected) - len(supported), len(selected)),
        do_not_elevate_rate=safe(len(elevated), len(dne)),
        redundancy_adjusted_coverage=safe(
            len(clusters), len({cluster(k) for k in eligible})
        ),
    )


def main():
    ap = argparse.ArgumentParser()
    for arg in ["reference", "matches", "out"]:
        ap.add_argument("--" + arg, required=True)
    a = ap.parse_args()
    result = score(
        json.loads(Path(a.reference).read_text())["findings"],
        json.loads(Path(a.matches).read_text()),
    )
    Path(a.out).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
