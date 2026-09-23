"""Shared translation for the GPT-6 Pro-authored codebooks (SBT-004/005/006).

Their missing semantics already match the canonical convention (97 DK, 98 refused,
99 not answered/not derivable, blank = not asked), so the work here is field mapping,
type inference and turning route descriptions into executable universe expressions.
"""
from __future__ import annotations
from .common import var, scale_meta, binary_values


def infer_type(name: str, codes: dict[int, str], role: str) -> str:
    keys = sorted(codes)
    if role == "identifier": return "identifier"
    if role == "weight": return "weight"
    if keys == [0, 1]: return "binary"
    if name.endswith("_5") and keys == [1, 2, 3, 4, 5]: return "scale"
    if keys and keys == list(range(0, 8)) and ("days" in name or name.endswith("_7")): return "count"
    if "band" in name: return "ordinal"
    return "single"


def make_var(name, qid, label, codes, missing, role, universe_expr, universe_text, *, question_text=None,
             set_id=None, text_source="codebook", derivation=None, notes=None, waves=None, vtype=None):
    codes = {int(k): v for k, v in (codes or {}).items()}
    vtype = vtype or infer_type(name, codes, role)
    values = sorted(codes.items())
    if vtype == "binary" and all(l in ("0", "1") for _, l in values):
        values = binary_values()
    sc = None
    if vtype == "scale":
        sc = scale_meta(sorted(codes), codes[min(codes)], codes[max(codes)])
    return var(name, label, vtype, role, question_id=qid, question_text=question_text or label,
               text_source=text_source, values=values, missing=sorted(int(m) for m in (missing or {})),
               universe=universe_expr, universe_text=universe_text, set_id=set_id, scale=sc,
               derivation=derivation, notes=notes, waves=waves)
