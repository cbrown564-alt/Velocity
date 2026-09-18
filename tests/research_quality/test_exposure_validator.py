import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
MOD=ROOT/'scripts/python/research_quality/run_manifest.py'
spec=importlib.util.spec_from_file_location('run_manifest',MOD);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def test_exposure_classifier_fails_closed_for_hidden_truth():
    for p in ['x/hidden/generate.py','x/trap_truth.json','x/reference_findings.json','x/freeze_validation.json']:
        assert m.classify(p)=='forbidden'

def test_exposure_classifier_distinguishes_raw_and_analysis_inputs():
    assert m.classify('study/synthetic_data/respondents.csv')=='raw_data'
    assert m.classify('study/reference/analysis_results.json')=='analysis_surface'
    assert m.classify('study/questionnaire.md')=='study_material'
