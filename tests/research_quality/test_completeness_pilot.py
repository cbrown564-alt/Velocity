"""Review comparisons must bind the same ungraded draft and frozen evidence."""

import importlib.util
import json
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/python/research_quality"))


def module():
    spec = importlib.util.spec_from_file_location(
        "completeness_pilot",
        ROOT / "scripts/python/research_quality/completeness_pilot.py",
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def baseline(tmp_path, m):
    run = tmp_path / "runs" / "original"
    run.mkdir(parents=True)
    m.write(run / "output.json", {"study_id": "SBT-004"})
    m.write(
        run / "manifest.json",
        {
            "study_id": "SBT-004",
            "status": "complete",
            "input_surface": "analysis",
            "workflow": "one_pass",
            "model": {"model_id": "gpt-6-astra"},
            "reasoning_effort": "low",
            "output_artifacts": [
                {
                    "path": "evals/research_quality/runs/original/output.json",
                    "sha256": m.sha(run / "output.json"),
                }
            ],
        },
    )
    slot = {
        "study_id": "SBT-004",
        "baseline_run": "original",
        "baseline_output_sha256": m.sha(run / "output.json"),
        "baseline_manifest_sha256": m.sha(run / "manifest.json"),
    }
    return run, slot


def test_baseline_is_exact_completed_analysis_draft(tmp_path):
    m = module()
    run, slot = baseline(tmp_path, m)
    assert m.checked_baseline(tmp_path, slot)[1]["study_id"] == "SBT-004"
    (run / "output.json").write_text('{"study_id":"SBT-004","changed":true}')
    with pytest.raises(ValueError, match="Changed baseline"):
        m.checked_baseline(tmp_path, slot)


@pytest.mark.parametrize(
    "field,value",
    [
        ("status", "failed"),
        ("study_id", "SBT-005"),
        ("input_surface", "raw"),
        ("reasoning_effort", "high"),
    ],
)
def test_invalid_baseline_fails_even_with_current_hash(tmp_path, field, value):
    m = module()
    run, slot = baseline(tmp_path, m)
    manifest = m.read(run / "manifest.json")
    manifest[field] = value
    m.write(run / "manifest.json", manifest)
    slot["baseline_manifest_sha256"] = m.sha(run / "manifest.json")
    with pytest.raises(ValueError, match="Incompatible baseline"):
        m.checked_baseline(tmp_path, slot)


def test_only_predeclared_unique_run_slots_are_allowed():
    m = module()
    plan = {"slots": [{"run_id": "planned"}]}
    assert m.select_slot(plan, "planned")["run_id"] == "planned"
    with pytest.raises(ValueError, match="Unplanned"):
        m.select_slot(plan, "unplanned")
    plan["slots"].append({"run_id": "planned"})
    with pytest.raises(ValueError, match="Duplicate"):
        m.select_slot(plan, "planned")


def test_trace_rejects_tool_actions_and_failed_turns():
    m = module()
    valid = [
        {"type": "item.completed", "item": {"type": "agent_message"}},
        {"type": "turn.completed", "usage": {"input_tokens": 2}},
    ]
    assert m.audit_events(valid)["status"] == "PASS"
    for event in [
        {"type": "item.started", "item": {"type": "command_execution"}},
        {"type": "turn.failed"},
    ]:
        with pytest.raises(ValueError, match="Unexpected"):
            m.audit_events(valid + [event])
    with pytest.raises(ValueError, match="completed turn"):
        m.audit_events(valid[:1])


def test_prompt_includes_same_inputs_and_draft_without_coordinator_metadata():
    m = module()
    files = {"analysis_results.json": '{"value":42}', "questionnaire.md": "Question"}
    draft = {"study_id": "fictional", "findings": []}
    prompt = m.build_prompt(files, draft, "Review instruction")
    assert "Review instruction" in prompt and '"value":42' in prompt
    assert json.dumps(draft, separators=(",", ":")) in prompt
    assert "adjudication" not in prompt and "scorecard" not in prompt
    assert "Do not call tools" in prompt
