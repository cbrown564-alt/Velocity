"""Numerical and exposure checks must precede benchmark freeze/model use."""

import importlib.util
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location(
        name, ROOT / f"scripts/python/research_quality/{name}.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_weighted_distribution_retains_valid_base_and_codes():
    m = module("analysis")
    # Missing row's weight must never enter the denominator; zero weights are allowed.
    result = m.distribution(
        pd.Series([1, 4, 5, np.nan, 2]), pd.Series([1.0, 2.0, 3.0, 100.0, 0.0])
    )
    assert result["top2_pct"] == pytest.approx(500 / 6)
    assert result["n_unweighted"] == 4
    assert result["n_weighted"] == 6
    assert result["n_eff"] == pytest.approx(36 / 14)
    assert result["distribution_pct"]["1"] == pytest.approx(100 / 6)
    assert sum(result["distribution_pct"].values()) == pytest.approx(100)
    json.dumps(result, allow_nan=False)


def test_zero_weight_and_all_missing_are_explicitly_unavailable():
    m = module("analysis")
    for x, w in [([1, 2], [0.0, 0.0]), ([np.nan], [1.0])]:
        result = m.distribution(pd.Series(x), pd.Series(w))
        assert result["top2_pct"] is None
        assert result["n_eff"] == 0
        json.dumps(result, allow_nan=False)


def test_holm_is_monotonic_and_native_json():
    m = module("analysis")
    assert m.holm([0.04, 0.001, 0.03]) == pytest.approx([0.06, 0.003, 0.06])
    json.dumps(m.holm([0.04, 0.001, 0.03]), allow_nan=False)


def test_scoring_rejects_incompatible_matches_and_invented_clusters():
    m = module("score_selection")
    ref = [
        dict(finding_id="A", tier="mandatory", topic_cluster="a"),
        dict(finding_id="D", tier="do_not_elevate", topic_cluster="d"),
    ]
    matches = [
        dict(
            model_finding_id="m1",
            reference_finding_id="A",
            match_state="full",
            evidence_compatible=False,
            claim_strength_compatible=True,
            topic_cluster="invented",
        ),
        dict(
            model_finding_id="m2",
            reference_finding_id="D",
            match_state="full",
            model_importance="primary",
        ),
        dict(
            model_finding_id="m3",
            reference_finding_id="D",
            match_state="full",
            model_importance="primary",
        ),
    ]
    out = m.score(ref, matches)
    assert out["mandatory_recall"] == 0
    assert out["redundancy_adjusted_coverage"] == 0
    assert out["do_not_elevate_rate"] == 1
    assert out["unsupported_rate"] == pytest.approx(1 / 3)
    with pytest.raises(ValueError):
        m.score(
            ref,
            [
                dict(
                    model_finding_id="m",
                    reference_finding_id="missing",
                    match_state="full",
                )
            ],
        )


def test_exposure_rejects_changed_hash_unlisted_file_and_empty_input(tmp_path):
    m = module("validate_exposure")
    data = tmp_path / "analysis_results.json"
    data.write_text("{}")
    manifest = {
        "run_id": "x",
        "input_artifacts": [
            {"path": str(data), "sha256": "wrong", "exposure_class": "analysis_surface"}
        ],
    }
    with pytest.raises(ValueError):
        m.validate(manifest, {"analysis_results.json": "correct"}, tmp_path)
    with pytest.raises(ValueError):
        m.validate({"run_id": "x", "input_artifacts": []}, {}, tmp_path)


def test_analysis_scripts_execute_and_emit_json(tmp_path):
    # Existing implementation fails on numpy.bool_ during serialization.
    import subprocess
    import sys
    import os
    import shutil

    for study in ["SBT-002", "SBT-003"]:
        project = tmp_path / study
        shutil.copytree(
            ROOT / "evals/research_quality/projects/synthetic" / study, project
        )
        env = dict(os.environ, PYTHONPATH=str(ROOT / "scripts/python/research_quality"))
        subprocess.run(
            [
                sys.executable,
                str(
                    project / "hidden" / f'generate_{study.lower().replace("-", "")}.py'
                ),
            ],
            check=True,
            capture_output=True,
            env=env,
        )
        subprocess.run(
            [sys.executable, str(project / "reference/reference_analysis.py")],
            check=True,
            capture_output=True,
            env=env,
        )
        result = json.loads((project / "reference/analysis_results.json").read_text())
        assert result["weighting"] == "wt_final"
        assert result["source_sha256"]


def test_freeze_validates_realised_traps_and_rejects_tampering(tmp_path):
    m = module("freeze_study")
    import shutil

    original = ROOT / "evals/research_quality/projects/synthetic/SBT-002"
    project = tmp_path / "SBT-002"
    shutil.copytree(original, project)
    checks = m.check_study(project)
    assert all(c["pass"] for c in checks), checks
    data = project / "synthetic_data/respondents.csv"
    frame = pd.read_csv(data)
    frame.loc[frame.understanding_5 < 3, "premium_value_5"] = 5
    frame.to_csv(data, index=False)
    checks = m.check_study(project)
    assert any(c["id"] == "routing" and not c["pass"] for c in checks)
    assert any(c["id"] == "source_hash" and not c["pass"] for c in checks)


def test_model_materials_do_not_contain_hidden_roles():
    m = module("freeze_study")
    project = ROOT / "evals/research_quality/projects/synthetic/SBT-002"
    public = m.public_materials(project)
    text = json.dumps(public)
    for forbidden in [
        "broad_acceptance",
        "differentiated_target_opportunity",
        "credible_but_weak",
        "mandatory",
        "trap_truth",
    ]:
        assert forbidden not in text
    assert public["synthetic"] is True


def test_symlink_escape_cannot_be_allowlisted(tmp_path):
    m = module("validate_exposure")
    package = tmp_path / "package"
    package.mkdir()
    secret = tmp_path / "truth.json"
    secret.write_text("{}")
    link = package / "analysis_results.json"
    link.symlink_to(secret)
    import hashlib

    digest = hashlib.sha256(secret.read_bytes()).hexdigest()
    with pytest.raises(ValueError):
        m.validate(
            {"input_artifacts": [{"path": str(link), "sha256": digest}]},
            {link.name: digest},
            package,
        )


def test_novel_claim_cannot_borrow_a_reference_cluster():
    m = module("score_selection")
    reference = [dict(finding_id="A", tier="mandatory", topic_cluster="a")]
    with pytest.raises(ValueError, match="Novel claims"):
        m.score(
            reference,
            [
                dict(
                    model_finding_id="m",
                    reference_finding_id="A",
                    match_state="supported_novel",
                    evidence_compatible=True,
                    claim_strength_compatible=True,
                )
            ],
        )
