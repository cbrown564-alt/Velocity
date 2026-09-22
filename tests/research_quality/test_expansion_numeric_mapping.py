import importlib.util
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "mapped_audit", ROOT / "scripts/python/research_quality/audit_expansion_pilot.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def test_mapping_requires_output_identity_and_nonempty_exact_references():
    with pytest.raises(ValueError, match="changed"):
        m.validate_mapping({"output_sha256": "old", "entries": [{}]}, "new")
    with pytest.raises(ValueError, match="empty"):
        m.validate_mapping({"output_sha256": "same", "entries": []}, "same")
    assert m.pointer({"items": [{"x/y": 2}]}, "/items/0/x~1y") == 2
    with pytest.raises((KeyError, IndexError, TypeError)):
        m.pointer({"items": []}, "/items/0/x")


def test_exact_prose_span_retains_original_number_and_rounding_precision():
    entry = {
        "output_pointer": "/claim",
        "numeric_span": [7, 13],
        "numeric_text": "−0.189",
    }
    value, tolerance = m.reported_value({"claim": "CI GBP −0.189 to 0.728"}, entry)
    assert value == -0.189
    assert tolerance == pytest.approx(0.0005)
    with pytest.raises(ValueError, match="span"):
        m.reported_value({"claim": "CI GBP −0.199 to 0.728"}, entry)
    value, tolerance = m.reported_value(
        {"q": 0.668358}, {"output_pointer": "/q", "output_scale": 100}
    )
    assert value == pytest.approx(66.8358)
    assert tolerance is None
    value, tolerance = m.reported_value(
        {"p": 0.001396}, {"output_pointer": "/p", "printed_precision": True}
    )
    assert tolerance == pytest.approx(0.0000005)
