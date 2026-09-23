import importlib.util
from pathlib import Path
import pandas as pd

PROJECT = (
    Path(__file__).resolve().parents[2]
    / "evals/research_quality/projects/synthetic/SBT-004"
)
spec = importlib.util.spec_from_file_location(
    "sbt004_reference", PROJECT / "build_reference.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_tiny_cell_keeps_bases_but_never_releases_rate():
    f = pd.DataFrame({"x": [5] * 18, "wt_final": [1] * 18})
    r = module.describe(f, "x", [1, 2, 3, 4, 5], ordinal=True)
    assert r["n_unweighted"] == 18
    assert r["status"] == "suppressed"
    assert "mean" not in r and "top2_pct" not in r and "distribution_pct" not in r


def test_routed_base_counts_eligible_missing_separately():
    f = pd.DataFrame({"x": [5, 97, 98, None], "wt_final": [1, 2, 3, 4]})
    r = module.describe(f, "x", [1, 2, 3, 4, 5], ordinal=True)
    assert r["eligible_n"] == 4
    assert r["n_unweighted"] == 1
    assert r["missing_counts"] == {"97": 1, "98": 1, "99": 0, "blank": 1}
