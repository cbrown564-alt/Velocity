import importlib.util
from pathlib import Path
import pandas as pd
import pytest

P = (
    Path(__file__).resolve().parents[2]
    / "evals/research_quality/projects/synthetic/SBT-006/build_reference.py"
)
spec = importlib.util.spec_from_file_location("sbt006_reference", P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def test_valid_and_all_assigned_intent_keep_distinct_denominators():
    d = pd.DataFrame(
        {
            "wt_design": [1.0, 2.0, 1.0, 2.0],
            "intent_5": [5, 1, 97, float("nan")],
            "postprice_responded": [1, 1, 1, 0],
        }
    )
    v = m.intent(d, False, suppress=False)
    a = m.intent(d, True, suppress=False)
    assert v["mean"] == pytest.approx(1 / 3) and a["mean"] == pytest.approx(1 / 6)
    assert v["n_unweighted"] == 2 and a["n_unweighted"] == 4
    assert a["completion_bounds"] == pytest.approx([1 / 6, 4 / 6])
    assert v["missing_counts"] == {"97": 1, "98": 0, "99": 0, "structural_blank": 1}


def test_fixed_weight_proxy_variance_and_suppression():
    d = pd.DataFrame(
        {
            "wt_design": [1.0, 2.0, 1.0],
            "intent_5": [5, 1, 4],
            "postprice_responded": [1, 1, 1],
        }
    )
    r = m.intent(d, False, suppress=False)
    assert r["variance"] == pytest.approx(9 / 64)
    assert m.proxy(r, 7, 2)["variance"] == pytest.approx(225 / 64)
    assert "mean" not in m.intent(d, False)
