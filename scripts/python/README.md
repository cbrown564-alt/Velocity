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
```
