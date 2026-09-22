"""Freeze only independently audited realised studies; never silently re-freeze."""

import importlib.util
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]


def module():
    spec = importlib.util.spec_from_file_location(
        "freeze_expansion", ROOT / "scripts/python/research_quality/freeze_expansion.py"
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_failed_or_missing_independent_audit_blocks_freeze(tmp_path):
    m = module()
    for name in ["freeze_validation", "independent_audit"]:
        checks = {
            "freeze_validation": {
                "status": "PASS",
                "checks": [{"id": "rows", "pass": True}],
            },
            "independent_audit": {
                "status": "PASS",
                "checks": [{"id": "numbers", "pass": True}],
            },
        }
        checks[name]["status"] = "FAIL"
        with pytest.raises(ValueError, match="audit|validation"):
            m.require_passed_checks(checks)
    with pytest.raises(ValueError):
        m.require_passed_checks({"freeze_validation": {"status": "PASS", "checks": []}})


def test_pass_label_cannot_hide_a_failed_or_empty_check_list():
    m = module()
    for rows in [[], [{"id": "wrong-base", "pass": False}]]:
        checks = {
            "freeze_validation": {"status": "PASS", "checks": rows},
            "independent_audit": {
                "status": "PASS",
                "checks": [{"id": "n", "pass": True}],
            },
        }
        with pytest.raises(ValueError):
            m.require_passed_checks(checks)


def test_reference_binding_must_resolve_to_current_table():
    m = module()
    with pytest.raises(ValueError, match="Unresolved"):
        m.require_evidence_bindings(
            {"tables": {}},
            [
                {
                    "evidence_id": "E1",
                    "analysis_id": "tables.missing.values",
                    "values": {},
                }
            ],
            [{"finding_id": "M1", "evidence_ids": ["E1"]}],
        )
    with pytest.raises(ValueError, match="Evidence values"):
        m.require_evidence_bindings(
            {"tables": {"x": {"values": {"n": 2}}}},
            [
                {
                    "evidence_id": "E1",
                    "analysis_id": "tables.x.values",
                    "values": {"n": 1},
                }
            ],
            [{"finding_id": "M1", "evidence_ids": ["E1"]}],
        )
