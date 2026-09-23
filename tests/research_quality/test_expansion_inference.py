import math
import sys
from pathlib import Path
import pandas as pd
import pytest

sys.path.insert(
    0, str(Path(__file__).resolve().parents[2] / "scripts/python/research_quality")
)
from expansion_inference import stratified_contrast, holm


def test_stratified_ratio_difference_has_hand_calculated_variance():
    f = pd.DataFrame(
        {"y": [1, 0, 3, 1], "group": [1, 0, 1, 0], "w": [1, 1, 2, 2], "h": [1, 1, 2, 2]}
    )
    r = stratified_contrast(f, "y", "group", "w", ["h"], valid_codes=range(4))
    assert r["difference"] == pytest.approx(5 / 3)
    assert r["se"] == pytest.approx(math.sqrt(8 / 9))
    assert r["group_1"]["n_unweighted"] == 2


def test_missing_domain_rows_stay_in_variance_strata():
    f = pd.DataFrame(
        {
            "y": [1, 0, 97, 3, 1, 97],
            "group": [1, 0, 1, 1, 0, 0],
            "w": [1, 1, 1, 2, 2, 2],
            "h": [1, 1, 1, 2, 2, 2],
        }
    )
    r = stratified_contrast(f, "y", "group", "w", ["h"], valid_codes=range(4))
    assert r["se"] == pytest.approx(math.sqrt(56 / 81))


def test_holm_keeps_missing_family_slot_and_monotonicity():
    assert holm([0.01, 0.03, None]) == pytest.approx([0.03, 0.06, 1.0])
