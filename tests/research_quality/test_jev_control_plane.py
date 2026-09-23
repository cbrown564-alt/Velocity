import json
from pathlib import Path
import subprocess
import sys
import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
JEV = ROOT / "evals/research_quality/jev"
SCHEMAS = ROOT / "evals/research_quality/schemas"
SCRIPT = ROOT / "scripts/python/research_quality/jev_gate.py"


def test_jev_gate_result_schema_valid():
    Draft202012Validator.check_schema(
        json.loads((SCHEMAS / "jev_gate_result.schema.json").read_text())
    )


def test_stage_roles_bind_existing_packs():
    roles = json.loads((JEV / "stage_roles.json").read_text())
    assert roles["provider"] == "typesafe"
    for stage, cfg in roles["stages"].items():
        path = JEV / cfg["questions_file"]
        assert path.exists(), stage
        pack = json.loads(path.read_text())
        assert pack["stage"] in {stage, "verifier"}  # prioritiser reuses verifier pack
        assert len(pack["questions"]) >= 3
        assert pack["state_paths_required"]


@pytest.mark.parametrize("pack_name", ["verifier_questions.json", "cleaning_questions.json"])
def test_question_packs_are_typesafe_shaped(pack_name):
    pack = json.loads((JEV / pack_name).read_text())
    for qid, q in pack["questions"].items():
        assert q["type"] in {"noul", "choice", "score"}, qid
        assert "`" in q["instructions"], f"{qid} should backtick state paths"
        if q["type"] == "choice":
            assert len(q["criteria"]) >= 2


def test_cleaning_recipes_are_closed_enum():
    pack = json.loads((JEV / "cleaning_questions.json").read_text())
    recipes = set(pack["questions"]["recommended_recipe"]["criteria"])
    assert "escalate" in recipes
    assert "none" in recipes
    # No free-text transform authoring in-enum
    assert "custom_sql" not in recipes


def test_verifier_covers_hard_failures_and_disposition():
    pack = json.loads((JEV / "verifier_questions.json").read_text())
    hf = pack["questions"]["hard_failure"]["criteria"]
    for key in ["none", "fabricated_evidence", "wrong_routed_universe", "unsupported_causal", "low_base_elevated"]:
        assert key in hf
    assert set(pack["questions"]["disposition"]["criteria"]) == {"accept", "repair", "reject"}


def test_experiment_protocol_documents_jev_control_plane():
    p = json.loads((ROOT / "evals/research_quality/experiment_protocol.json").read_text())
    assert "jev_control_plane" in p
    assert p["jev_control_plane"]["provider"] == "typesafe"
    assert "verifier" in p["jev_control_plane"]["stages"]
    assert "cleaning" in p["jev_control_plane"]["stages"]


def test_jev_gate_script_offline_pass():
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "verifier"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(proc.stdout)
    assert data["status"] == "PASS"
    assert data["live"] is False
    assert data["question_count"] >= 5
