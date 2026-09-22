import json
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[2]

@pytest.mark.parametrize('study', ['SBT-002','SBT-003'])
def test_reference_inventory_has_mandatory_and_restraint_findings(study):
    p=ROOT/f'evals/research_quality/projects/synthetic/{study}/reference/reference_findings.json'
    fs=json.loads(p.read_text())['findings'];tiers={x['tier'] for x in fs}
    assert 'mandatory' in tiers
    assert 'do_not_elevate' in tiers
    ids=[x['finding_id'] for x in fs];assert len(ids)==len(set(ids))

@pytest.mark.parametrize('study', ['SBT-002','SBT-003'])
def test_reference_findings_have_renderer_neutral_analytical_relationship(study):
    fs=json.loads((ROOT/f'evals/research_quality/projects/synthetic/{study}/reference/reference_findings.json').read_text())['findings']
    for f in fs:
        assert f.get('analytical_relationship')
        blob=json.dumps(f).lower()
        for forbidden in ['slide ','powerpoint','pptx','chart position']:
            assert forbidden not in blob
