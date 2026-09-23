import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_evidence_reference_notations_resolve_without_guessing(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / "scripts/python/research_quality"))
    spec = importlib.util.spec_from_file_location(
        "score_run", ROOT / "scripts/python/research_quality/score_run.py"
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    analysis = {"company": {"nps": -55}, "pairwise": {"appeal": [1, 2]}}
    output = {
        "analysis_claims": [{"analysis_id": "primary", "values": {"estimate": 61}}]
    }
    assert m.resolve(output, analysis, "analysis_results.json.company.nps") == -55
    assert m.resolve(output, analysis, "pairwise.appeal[1]") == 2
    assert m.resolve(output, analysis, "analysis_claims.primary.values.estimate") == 61
    assert m.resolve(output, analysis, "/analysis_claims/0/values/estimate") == 61
    assert m.resolve(output, analysis, "invented.primary") is None
