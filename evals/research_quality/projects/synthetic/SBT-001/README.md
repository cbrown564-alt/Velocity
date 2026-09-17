# SBT-001 generated project

SBT-001 is a wholly synthetic five-wave UK mobile-network tracker with 2,000 respondents per wave and fictional brands only.

Run `python scripts/python/synthetic_tracker/generate_sbt001.py` from repository root to materialise `raw/wave_01.csv` through `wave_05.csv`, the generated codebook, processing references and hidden truth artifacts. The canonical CSV outputs are reproducible build artifacts rather than hand-edited fixtures.

The frozen calibration run uses root/selected seed `564001`. It passed every hard storyline and structural gate, including weighting, routed bases, campaign targeting, Northstar's Wave 4 customer-experience event, Harbour's multi-wave youth decline and the deliberately unstable Mosaic low-base subgroup.

See `hidden/validation_report.json` for the frozen evidence. CSV is canonical. SAV should be derived from the same CSV/codebook when a compatible writer is available.