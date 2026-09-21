import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
REG=ROOT/'evals/research_quality/native_chart_primitives.json'
PLAN=ROOT/'evals/research_quality/projects/synthetic/SBT-001/reference/story/native_chart_plan.json'
E6=ROOT/'evals/research_quality/native_chart_e6_contract.json'


def test_registry_has_core_market_research_primitives():
    data=json.loads(REG.read_text());ids={p['primitiveId'] for p in data['primitives']}
    required={'MR_BAR_RANKED','MR_STACKED_100','MR_LIKERT_DIVERGING','MR_BAR_DIVERGING_NET','MR_TREND_HERO','MR_TREND_COMPARE','MR_DUMBBELL_XY','MR_DUMBBELL_XY_MULTI','MR_SCATTER_POSITION_CHANGE','MR_NPS_COMPOSITION'}
    assert required <= ids


def test_all_primitives_preserve_human_readable_display_data():
    data=json.loads(REG.read_text())
    assert all(p['dataContract']['displayDataHumanReadable'] is True for p in data['primitives'])


def test_sbt001_data_slides_require_native_charts():
    plan=json.loads(PLAN.read_text())
    by_slide={s['slide']:s for s in plan['slides']}
    assert by_slide[1]['nativeChartsRequired']==0 and by_slide[10]['nativeChartsRequired']==0
    for slide in range(2,10): assert by_slide[slide]['nativeChartsRequired'] >= 1
    assert plan['acceptance']['quantitativeShapeMarksAllowed'] is False
    assert plan['acceptance']['embeddedWorkbookRequiredPerChart'] is True


def test_e6_non_native_quantitative_mark_is_hard_failure():
    e6=json.loads(E6.read_text());ids={x['id'] for x in e6['hardFailures']}
    assert 'E6_NON_NATIVE_QUANT_MARK' in ids
    assert 'E6_NO_EMBEDDED_DATA' in ids
