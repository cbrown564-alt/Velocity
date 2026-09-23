"""A coverage gain cannot hide losses, a failed arm or unsafe new claims."""

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def module():
    spec = importlib.util.spec_from_file_location(
        "compare_completeness",
        ROOT / "scripts/python/research_quality/compare_completeness.py",
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def row(missing, **overrides):
    return dict(
        status="complete",
        missed_mandatory_findings=missing,
        unsupported_rate=0,
        do_not_elevate_rate=0,
        hard_failures=[],
        provenance_coverage=1,
        numerical_audit="PASS",
        **overrides
    )


def test_only_safe_gain_over_both_comparators_is_promising():
    m = module()
    assert m.pair_result(row(["M3"]), row(["M3"]), row([]))["promising"]
    assert not m.pair_result(row(["M3"]), row([]), row([]))["promising"]
    unsafe = row([])
    unsafe["unsupported_rate"] = 0.1
    assert not m.pair_result(row(["M3"]), row(["M3"]), unsafe)["promising"]


def test_same_total_can_conceal_a_lost_mandatory_finding():
    result = module().pair_result(row(["M3"]), row(["M3"]), row(["M2"]))
    assert result["coverage_gained_from_baseline"] == ["M3"]
    assert result["coverage_lost_from_baseline"] == ["M2"]
    assert not result["promising"]


def test_failed_arm_is_not_zero_quality_or_zero_cost():
    result = module().pair_result(row([]), {"status": "failed"}, row([]))
    assert result["status"] == "incomplete_pair"
    assert result["promising"] is None
