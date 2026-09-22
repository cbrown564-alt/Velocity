"""New study estimators must retain survey bases and missing-code semantics."""

import importlib.util
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]


def stats():
    spec = importlib.util.spec_from_file_location(
        "expansion_statistics",
        ROOT / "scripts/python/research_quality/expansion_statistics.py",
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_distribution_excludes_dk_codes_and_structural_missing():
    s = stats()
    r = s.distribution(
        pd.Series([1, 4, 5, 97, np.nan]),
        pd.Series([1.0, 2.0, 3.0, 90.0, 100.0]),
        [1, 2, 3, 4, 5],
    )
    assert r["n_unweighted"] == 3
    assert r["n_weighted"] == 6
    assert r["n_eff"] == pytest.approx(36 / 14)
    assert r["top2_pct"] == pytest.approx(500 / 6)
    assert r["missing_n"] == 2
    assert sum(r["distribution_pct"].values()) == pytest.approx(100)


def test_multiresponse_uses_respondents_and_does_not_normalise_to_100():
    s = stats()
    d = pd.DataFrame({"a": [1, 1, 0, 97], "b": [1, 0, 1, 97]})
    r = s.multiresponse(d, pd.Series([1.0, 2.0, 1.0, 50.0]), ["a", "b"])
    assert r["a"]["pct"] == 75
    assert r["b"]["pct"] == 50
    assert r["a"]["n_unweighted"] == 3
    assert sum(x["pct"] for x in r.values()) == 125


def test_reverse_keying_masks_missing_before_reversing():
    s = stats()
    r = s.reverse_five(pd.Series([1, 2, 5, 97, np.nan]))
    assert r.iloc[:3].tolist() == [5, 4, 1]
    assert r.iloc[3:].isna().all()


def test_paired_change_keeps_only_complete_valid_pairs():
    s = stats()
    d = s.paired_change(
        pd.Series([0, 0, 1, 97, 1]),
        pd.Series([1, 0, 0, 1, np.nan]),
        pd.Series([1.0, 2.0, 1.0, 50.0, 50.0]),
    )
    assert d["mean"] == 0
    assert d["n_unweighted"] == 3
    assert d["n_weighted"] == 4
    assert d["n_eff"] == pytest.approx(16 / 6)


def test_invalid_weights_and_unavailable_bases_fail_explicitly():
    s = stats()
    with pytest.raises(ValueError, match="weight"):
        s.mean(pd.Series([1, 2]), pd.Series([1.0, -1.0]))
    r = s.mean(pd.Series([1, 2]), pd.Series([0.0, 0.0]))
    assert r["mean"] is None and r["se"] is None
    assert r["n_eff"] == 0
