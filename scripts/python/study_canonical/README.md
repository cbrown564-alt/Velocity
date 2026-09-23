# Canonical synthetic studies (`velocity.study.v1`)

This converts the six synthetic studies (SBT-001 to SBT-006) into one codebook shape and one missing-value convention. Each study is also written as an SPSS `.sav` file. Once converted, tablebook and deck generators — and Velocity itself — can run over every study the same way.

```bash
# From the repository root. Python 3.11+ (numpy 2.4 needs it).
python -m venv tmp/study-venv && source tmp/study-venv/bin/activate
pip install -r scripts/python/synthetic_tracker/requirements.txt pyreadstat
python scripts/python/synthetic_tracker/generate_sbt001.py   # SBT-001 raw waves are generated, not committed
python scripts/python/study_canonical/build_all.py           # all studies; --only SBT-004 for one
python -m unittest discover -s scripts/python/study_canonical/tests -v
```

The build writes to `evals/research_quality/projects/synthetic/<ID>/canonical/`:

| File | Contents |
| :--- | :--- |
| `sbt_00N.sav` | Integer codes, variable and value labels, user-missing 97/98/99 declared, measurement level set. Row-compressed. |
| `sbt_00N.csv` | The same values as plain CSV. |
| `codebook.json` | The canonical codebook: study metadata, variables, sets, banner candidates, provenance (source SHA-256) and conversion notes. |
| `validation.json` | Results of the structural, universe and SAV round-trip checks. |

For SBT-001, the canonical CSV and SAV are gitignored, like its raw waves. Its codebook and validation report are committed.

## The convention

| Value | Meaning |
| :--- | :--- |
| blank / system-missing | **Not asked**: the respondent was outside the question's universe. Never a zero, a "No" or a don't know. |
| 97 | Don't know / can't judge |
| 98 | Prefer not to say |
| 99 | Not answered / cannot be derived |

Valid codes may never use 97–99. Every variable declares the missing codes that apply to it.

**Where each study started from:**

| Study | Source convention | Conversion |
| :--- | :--- | :--- |
| SBT-004, 005, 006 | Already this convention | Unchanged |
| SBT-001 | 97 = not asked, 98 = DK, 99 = refused | 97 → blank, 98 → 97, 99 → 98 |
| SBT-002, 003 | Text answers, blanks for not asked | Recoded to integers. "Prefer not" → 98. SBT-003's literal "Not asked" → blank. |

## Variable record

Each variable record has these fields:

- `name` and `source_name`
- `label` and `question_text`
- `text_source`: `questionnaire`, `codebook` or `authored`
- `type`: identifier, weight, single, ordinal, scale, binary, count or numeric
- `role`: admin, screener, profile, design, core, diagnostic, derived or weight
- `measure`
- `values`: an ordered list of code and label
- `missing`
- `universe`: `text` plus an executable pandas `expr`
- `set`
- `scale`: points, end labels, top and bottom box
- `recode`: source text → code, so every conversion can be reversed
- `derivation`
- `notes`

Studies also declare `sets`. The set types are battery, multi_response, brand_grid, brand_attribute_grid and paired_measure.

## Checks (build fails on any error)

- Every column has exactly one codebook entry, in the same order.
- There are no text codes, and no values outside the declared codes.
- No valid code collides with 97–99.
- **Universe:** answers are blank exactly when the respondent is outside the universe expression.
- Weights are positive, and IDs are unique (within wave for trackers).
- **SAV round trip:** values, variable labels, value labels and user-missing all survive a re-read.
- **Tests:** the conversion is proven lossless by inverting it back to the source files. The validator is shown to catch injected faults.

## Rules the adapters follow

- **Inputs:** only model-visible inputs are used (`model_inputs/`, `questionnaire.md`). Hidden answer-key material is never used; for example, SBT-002's manifest labels a concept "credible but weak".
- **Authored wording:** where the source has no wording, it is authored and marked `text_source: "authored"`. This affects SBT-003 and the SBT-006 battery stem.
- **Discrepancies:** differences between the data and the questionnaire are recorded in `conversion_notes`, not silently fixed.
