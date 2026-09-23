import importlib.util
from pathlib import Path
import pandas as pd
import pytest

P = (
    Path(__file__).resolve().parents[2]
    / "evals/research_quality/projects/synthetic/SBT-005/build_reference.py"
)
spec = importlib.util.spec_from_file_location("sbt005_reference", P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def test_paired_change_uses_within_person_difference_and_fixed_weight_variance():
    d = pd.DataFrame(
        {
            "weight_base": [1.0, 2.0, 1.0],
            "assignment": [0, 0, 0],
            "followup_status": [1, 1, 1],
            "awareness_pre": [0, 1, 0],
            "awareness_post": [1, 0, 1],
        }
    )
    r = m.pair_cell(d, "awareness", suppress=False)
    assert r["change_pp"] == 0
    assert r["variance_change"] == pytest.approx(9 / 16)
    assert r["pair_n"] == 3
    assert r["pre_pct"] == 50 and r["post_pct"] == 50


def test_invalid_and_nonreturn_are_not_zero_changes():
    d = pd.DataFrame(
        {
            "weight_base": [1.0, 2.0, 1.0, 1.0],
            "followup_status": [1, 1, 1, 0],
            "awareness_pre": [0, 1, 97, 0],
            "awareness_post": [1, 0, 1, float("nan")],
        }
    )
    r = m.pair_cell(d, "awareness", suppress=False)
    assert r["eligible_n"] == 4 and r["returned_n"] == 3 and r["pair_n"] == 2
    assert r["change_pp"] == pytest.approx(-100 / 3)
    assert r["post_missing_counts"]["structural_blank"] == 1
    assert "change_pp" not in m.pair_cell(d, "awareness")


def test_descriptive_eligible_base_preserves_missing_breakdown():
    d = pd.DataFrame(
        {
            "weight_base": [1.0, 1.0, 1.0, 1.0],
            "recall_post": [1, 97, 98, float("nan")],
            "followup_status": [1, 1, 1, 0],
        }
    )
    r = m.describe(
        d, "recall_post", [0, 1], eligible=d.followup_status.eq(1), suppress=False
    )
    assert r["eligible_n"] == 3 and r["n_unweighted"] == 1
    assert r["missing_counts"] == {"97": 1, "98": 1, "99": 0, "unexpected_blank": 0}
    assert r["structural_excluded_n"] == 1
