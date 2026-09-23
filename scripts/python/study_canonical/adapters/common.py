from __future__ import annotations
import json
from pathlib import Path
import pandas as pd
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from canonical import var, scale_meta, study_record, sha256, MISSING  # noqa: E402,F401

SYN = "evals/research_quality/projects/synthetic"


def proj(root: Path, sid: str) -> Path:
    return Path(root) / SYN / sid


def sources(root: Path, sid: str, rels: list[str]) -> list[dict]:
    p = proj(root, sid)
    return [{"path": f"{SYN}/{sid}/{r}", "sha256": sha256(p / r)} for r in rels]


def recode_text(s: pd.Series, order: list[str], special: dict | None = None) -> tuple[pd.Series, dict]:
    """Map text answers to 1..k in the given order; ``special`` maps text to a missing code or None (sysmis)."""
    special = special or {}
    mapping = {t: i for i, t in enumerate(order, 1)}
    full = {**mapping, **special}
    unknown = set(s.dropna().unique()) - set(full)
    if unknown:
        raise ValueError(f"{s.name}: unmapped text values {sorted(unknown)}")
    out = s.map(lambda x: full.get(x) if pd.notna(x) else None).astype("Float64")
    return out.astype(float), {str(k): v for k, v in full.items()}


def remap_missing(s: pd.Series, mapping: dict) -> pd.Series:
    """Map source missing codes to canonical ones; value None means system-missing."""
    out = s.astype(float).copy()
    for src, dst in mapping.items():
        out[s == src] = float("nan") if dst is None else float(dst)
    return out


def binary_values(no="No", yes="Yes"):
    return [(0, no), (1, yes)]
