# Synthetic tracker generator

From the repository root, with Python 3.11+:

```bash
python3 -m venv tmp/sbt001-venv
source tmp/sbt001-venv/bin/activate
python -m pip install -r scripts/python/synthetic_tracker/requirements.txt
python scripts/python/synthetic_tracker/generate_sbt001.py
python scripts/python/synthetic_tracker/generate_agency_exports.py
python scripts/python/synthetic_tracker/build_sbt001_analysis.py
python -m unittest discover -s scripts/python/synthetic_tracker/tests -v
```

The three builders write under `evals/research_quality/projects/synthetic/SBT-001/`:

- five canonical CSV waves, codebook, processing recipe and hidden generation report;
- five agency CSV waves, per-column inverse mappings, preparation recipe and exact round-trip report;
- 147 reference analyses, six evidence-bound findings and schema-checked analysis report.

Large generated CSVs and intermediate reference files are ignored by Git. The compact validation reports are committed. Tests generate in a temporary directory and never rewrite those reports. The GitHub `research-quality` job runs the same regression suite using the pinned dependencies.

## Corrected version

`synthetic_brand_tracker_v2` uses the same root seed `564001`. Image eligibility is the valid familiarity codes **3, 4 or 5**, excluding 97/98/99. The same correction applies to the familiarity term in spontaneous-awareness generation. RNG draw counts, weights and other questionnaire responses are unchanged by this fix. An independent validator checks awareness plus valid familiarity against the generated image values. The generation report fingerprints all five canonical CSVs; agency and analysis builders reject stale versions or modified data before labelling outputs v2. A failed validation exits nonzero.

Reference analysis `turn4-v2` also explicitly filters image eligibility, uses finding schema v2 and labels unweighted diagnostics with `weight: null`. Proportions use valid 0/1 answers; weighted estimates use `wt_final`, and Kish ESS is `(sum w)^2 / sum(w^2)`. Existing approximate independent-wave standard errors are unchanged. This is a benchmark reference calculation, not a change to Velocity's statistical engine.

The original v1 reports are retained in `hidden/history/v1/` and `reference/analysis/history/v1/`. They incorrectly passed image routing because 97 satisfied the old `>= 3` predicate. Do not mix v1 image evidence with v2 outputs or treat the historical PASS as proof of correct routing. Exact CSV hashes identify a materialisation with its recorded Python/library versions; floating-point last bits can differ between environments.

`agency-v2` reconstructs the committed Turn 3 export conventions with explicit reversible mappings. Its hashes supersede the conversation-era agency hashes; it does not claim byte identity with that package. Missingness is transformed per variable, and textual labels retain their inverse code mappings. Recovery is checked after writing and rereading both mappings and CSVs, including exact floating-point weights and row order.

CSV is canonical. Optional SAV conversion should derive from the same CSV/codebook. Deck artifact availability and historical source links are recorded in `docs/workstreams/research_quality/sbt_001_turn6_visual_language.md`.
