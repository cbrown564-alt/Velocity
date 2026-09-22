import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_blinded_payload_excludes_model_identity_scores_and_private_key():
    spec = importlib.util.spec_from_file_location(
        "review_pack", ROOT / "scripts/python/research_quality/review_pack.py"
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    payload, key = m.build_payload()
    assert payload["cases"]
    text = json.dumps(payload)
    for forbidden in [
        "gpt-6-astra",
        "mandatory_recall",
        "reference_findings",
        "trap_truth",
        "run_id",
        "stage_runs",
    ]:
        assert forbidden not in text
    assert key
    for case in payload["cases"]:
        for candidate in case["candidates"]:
            assert candidate["candidate_id"] in key
            assert candidate["output"]["findings"]
