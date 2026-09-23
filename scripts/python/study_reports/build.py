"""Build the tablebook and deck for a canonical study from its report spec.

    python scripts/python/study_reports/build.py SBT-001 [--out DIR] [--root .]

Outputs <out>/<id>_tables.xlsx, <id>_deck.json and, if node + pptxgenjs are available, <id>_deck.pptx.
Also writes <id>_facts.json: every tested development the storyline could draw on.
"""
from __future__ import annotations
import argparse, json, shutil, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from engine import Study, build_banner  # noqa: E402
from tables import build_tables  # noqa: E402
from tablebook import Writer  # noqa: E402
from archetypes.tracker import Tracker  # noqa: E402
from archetypes.concept_test import ConceptTest  # noqa: E402

ARCH = {"tracker": Tracker, "concept_test": ConceptTest}


def build(root: Path, sid: str, out: Path, render=True):
    spec = json.loads((HERE / "specs" / f"{sid.lower().replace('-', '')}.json").read_text())
    st = Study(root, sid)
    arch = ARCH[spec["archetype"]](st, spec)
    deck, chart_rows, diag, _ = arch.deck()
    banner = build_banner(st, spec["banner"], spec.get("banner_scope"))
    if spec.get("banner_scope"):
        spec["banner_scope_text"] = "Columns after the wave group show the current wave only."
    tables = build_tables(st, spec.get("layout"))
    wr = Writer(st, spec, banner)
    wr.readme(extra_lines=[f"Banner: " + "; ".join(f"{g}" for g in banner.groups()) + "."])
    wr.grid_sheet("Key measures", arch.key_grid())
    for t in tables: wr.table_sheet(t)
    out.mkdir(parents=True, exist_ok=True)
    stem = sid.lower().replace("-", "_")
    xlsx = out / f"{stem}_tables.xlsx"
    wr.finish(xlsx, chart_rows)
    (out / f"{stem}_deck.json").write_text(json.dumps(deck, indent=1, ensure_ascii=False))
    (out / f"{stem}_facts.json").write_text(json.dumps(diag, indent=1, default=str))
    pptx = None
    if render and shutil.which("node"):
        pptx = out / f"{stem}_deck.pptx"
        r = subprocess.run(["node", str(HERE / "render_deck.mjs"), str(out / f"{stem}_deck.json"), str(pptx)], capture_output=True, text=True, cwd=root)
        if r.returncode: print(r.stderr); pptx = None
    print(f"{sid}: {len(tables)} tables, {len(deck['slides'])} slides -> {out}")
    return xlsx, pptx


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("study"); ap.add_argument("--root", default=str(HERE.parents[2])); ap.add_argument("--out")
    a = ap.parse_args()
    root = Path(a.root)
    build(root, a.study, Path(a.out) if a.out else root / "evals/research_quality/projects/synthetic" / a.study / "reports")
