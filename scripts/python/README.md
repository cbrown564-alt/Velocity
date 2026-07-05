# Python tooling

Optional helpers for SAV fixture generation and inspection. Requires a local Python env with `pandas` and `pyreadstat` (see repo `.venv` if present).

Run all commands from the **repository root**:

```bash
# Regenerate the small Playwright OPFS fixture
python scripts/python/generate_sav.py

# Inspect variable metadata (prints JSON to stdout)
python scripts/python/inspect_sav.py

# Generate a large stress-test SAV (gitignored)
python scripts/python/generate_large_sav.py

# One-off sleep.sav vs SPS variable cross-check
python scripts/python/analyze_data.py

# Brand tracker demo dataset (5 waves + raw W4 + ground truth)
python3 scripts/python/generate_brand_tracker.py
```

## Brand tracker generator

**Script:** `scripts/python/generate_brand_tracker.py`  
**Config:** `scripts/python/brand_tracker_config.json` (planted storyline targets, margins, seed — auditable)

Regenerates the multi-wave fictional "chilled coffee" tracker (Atlas / Beacon / Meridian / Solstice / Cardinal) and writes:

| Output | Purpose |
| :--- | :--- |
| `public/examples/brandtracker_w4.sav` | Demo file (Load Example) |
| `test_data/fixtures/brand_tracker/brandtracker_w{1,2,3,5}.sav` | Prior/refresh waves for parity tests |
| `test_data/fixtures/brand_tracker/brandtracker_w4_raw.sav` | Messy raw agency export (recipe demo) |
| `validation/brand_tracker_ground_truth.json` | Weighted funnel metrics + significance verdicts |

Deterministic data values (fixed seed); `.sav` bytes may differ across runs due to pyreadstat creation timestamps — compare `data_checksums_sha256` in the ground truth JSON.

Golden test: `npx vitest run tests/golden/brand_tracker_parity.test.ts`
