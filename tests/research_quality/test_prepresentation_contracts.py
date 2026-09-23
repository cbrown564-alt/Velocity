import json
from pathlib import Path
import pytest
from jsonschema import Draft202012Validator

ROOT=Path(__file__).resolve().parents[2]
SCHEMAS=ROOT/'evals/research_quality/schemas'

@pytest.mark.parametrize('name',[
 'prepresentation_study.schema.json','prepresentation_evidence.schema.json',
 'prepresentation_finding.schema.json','prepresentation_story.schema.json',
 'evaluation_run.schema.json','model_research_output.schema.json','evaluation_score.schema.json'])
def test_schema_is_valid_draft_2020_12(name):
    Draft202012Validator.check_schema(json.loads((SCHEMAS/name).read_text()))

def test_scoring_weights_sum_to_100_and_presentation_is_zero():
    c=json.loads((ROOT/'evals/research_quality/prepresentation_scoring_contract.json').read_text())
    assert sum(x['weight'] for x in c['dimensions'])==100
    assert c['presentation_score']==0

def test_experiment_protocol_has_all_preregistered_arms():
    p=json.loads((ROOT/'evals/research_quality/experiment_protocol.json').read_text())
    assert set(p['arms'])=={'E1_ONE_CALL','E2_STAGED','E3_ANALYSIS_SURFACE','E4_RAW_DATA','E5_STABILITY'}
    assert p['arms']['E5_STABILITY']['minimum_replicates']>=5

def test_model_exposure_contract_forbids_ground_truth():
    c=json.loads((ROOT/'evals/research_quality/model_exposure_contract.json').read_text())
    text=' '.join(c['forbidden_classes']).lower()
    for token in ['generator','trap','reference finding','scoring']:
        assert token in text

@pytest.mark.parametrize('study', ['SBT-002','SBT-003'])
def test_new_studies_explicitly_exclude_presentation(study):
    m=json.loads((ROOT/f'evals/research_quality/projects/synthetic/{study}/manifest.json').read_text())
    assert m['presentation_in_scope'] is False
    assert 'freeze' in m.get('freeze_rule','').lower()
