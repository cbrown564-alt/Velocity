# Synthetic tracker generator

Generate the frozen SBT-001 five-wave project from repository root:

```bash
python scripts/python/synthetic_tracker/generate_sbt001.py
```

Runtime dependencies: Python 3.11+, `numpy`, `pandas`, `scipy`.

The generator writes five canonical CSV waves plus codebook/reference/hidden-truth artifacts under `evals/research_quality/projects/synthetic/SBT-001/`. Raw generated CSVs are reproducible build artifacts and do not need to be hand-edited. Root seed `564001` passes the frozen storyline gates on the first attempt.

CSV is the canonical source. SAV export is optional and should be derived deterministically from the same CSV/codebook when a compatible writer such as `pyreadstat` is available; do not maintain a separate hand-edited SAV truth.

The committed `hidden/validation_report.json` records the calibration run used to freeze SBT-001 v1.