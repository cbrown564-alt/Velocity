# SBT-001 Turn 3 — Agency-style preparation benchmark

**Status:** Implemented and independently materialised in the Turn 3 artifact package.

Turn 3 creates a deliberately heterogeneous agency-export layer over the frozen SBT-001 respondents. The canonical five-wave data remain unchanged; the new layer changes representation only. This gives E1/E2 an exact gold inverse transformation rather than relying on subjective notions of 'clean data'.

## Design principle

The benchmark should test whether a system can recover survey semantics across waves, not whether it can memorise one naming convention. Every wave therefore uses a different but plausible export convention while preserving all information required for exact recovery.

## Wave heterogeneity

| Wave | Naming style | Weight | Deliberate representation drift |
|---|---|---|---|
| 1 | legacy questionnaire numbers (`Q10_1`, `Q20_1_RELI`) | `weight` | numeric brand-first grids |
| 2 | analyst-friendly abbreviations (`aw_northstar`, `img_*`) | `WT_FINAL` | binary questions exported as labelled Yes/No/Not asked/Don't know |
| 3 | uppercase platform export (`AWARE_*`, `BIMAGE_*`) | `rimwt` | structural routed values exported as blanks; reversed column order |
| 4 | lower-case questionnaire IDs (`q10_1`, `q20_reliable_1`) | `final_weight` | image grid changes to attribute-first naming; structural/DK codes become -99/-98 |
| 5 | semantic descriptive names (`brand_aw_*`, `brand_img_*`) | `wt` | provider/preference exported as display labels; reversed column order |

Profile, CX and marketing variables also change names between waves. The benchmark therefore cannot be solved by identifying only the brand-grid prefixes.

## What must remain invariant

A successful preparation system must recover the canonical SBT-001 representation without changing substantive respondent answers. It must:

1. identify respondent and wave identifiers;
2. map wave-specific variables to canonical semantic variables;
3. identify the correct wave-specific analysis weight;
4. preserve variable-specific distinctions between structural not-asked, don't know and refused;
5. normalize display labels only where the codebook/semantic evidence warrants it;
6. preserve routed familiar-brand and customer-service bases;
7. preserve current provider separately from preferred provider;
8. emit an auditable transformation log.

Forbidden shortcuts include treating all missing codes globally, filling routed missing cells with No, inferring current provider from preference, or selecting a weight-like field without evidence.

## Gold artifacts

The materialised Turn 3 package contains:

- `agency_raw/agency_wave_01.csv` … `agency_wave_05.csv`;
- `reference/agency_wave_mapping.json` — exact wave-specific field mapping and value-normalisation rules;
- `reference/agency_processing_recipe.json` — semantic preparation contract;
- `hidden/agency_prep_validation.json` — round-trip validation and hashes;
- `generate_agency_exports.py` — deterministic corruption/materialisation script.

The generated agency files are intentionally not hand-edited. They are deterministic transformations of the frozen canonical waves.

## Validation result

All five waves passed exact round-trip recovery:

| Wave | Rows | Columns | Exact recovery |
|---|---:|---:|---|
| 1 | 2,000 | 85 | PASS |
| 2 | 2,000 | 85 | PASS |
| 3 | 2,000 | 85 | PASS |
| 4 | 2,000 | 85 | PASS |
| 5 | 2,000 | 85 | PASS |

This means every deliberate inconsistency is recoverable by the gold preparation recipe, with no respondent-level information loss.

## E1/E2 evaluation use

### E1 — interpretation

Score a model/system on semantic recovery before execution:

- canonical variable identity / grouping;
- grid membership and brand/attribute axes;
- weight identification;
- missing-value meaning;
- routing/base interpretation;
- value-label normalization proposal;
- evidence for each proposed mapping.

Use precision/recall/F1 for mappings and hard failures for unsafe semantic decisions.

### E2 — preparation execution

Execute the proposed transformation and compare the resulting canonical dataset to the frozen reference. Core metrics:

- exact cell agreement by canonical variable;
- row/respondent preservation;
- missingness agreement;
- routed-base agreement;
- weight agreement;
- derived-analysis parity after preparation;
- transformation-log completeness.

A system can therefore receive partial credit for mostly correct interpretation while still failing the publication pipeline if a wrong mapping changes an analytical result.

## Difficulty progression

SBT-001 Turn 3 is intentionally recoverable with good metadata reasoning. Later synthetic families should add harder but still realistic conditions: brand additions/removals, genuinely changed questionnaire wording, split variables, changed response scales, multi-response encoding changes, duplicate exports, stale labels and derived variables that cannot be replayed without an explicit semantic decision.

Those should be separate difficulty mechanisms rather than silently increasing SBT-001 complexity after its benchmark is frozen.
