"""Expansion must preserve frozen records and allow deliberate review-pack scope."""

import importlib.util
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location(
        name, ROOT / f"scripts/python/research_quality/{name}.py"
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_review_pack_can_select_studies_without_changing_the_original_pack():
    m = module("review_pack")
    original = (
        ROOT / "evals/research_quality/review/2026-09-pilot/reviewer_pack.zip"
    ).read_bytes()
    payload, key = m.build_payload(studies=["SBT-003"])
    assert [c["study_id"] for c in payload["cases"]] == ["SBT-003"]
    assert len(key) == 1
    assert (
        ROOT / "evals/research_quality/review/2026-09-pilot/reviewer_pack.zip"
    ).read_bytes() == original


def test_review_pack_fails_when_a_requested_study_has_no_completed_run():
    m = module("review_pack")
    with pytest.raises(ValueError, match="No completed"):
        m.build_payload(studies=["SBT-999"])
