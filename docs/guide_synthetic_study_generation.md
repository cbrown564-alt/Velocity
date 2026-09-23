# Guide: generating synthetic survey studies at scale

**Status:** v1, 23 September 2026. Written after SBT-001 was materialised, SBT-002 to SBT-006 were converted, and the common study format was set up.
**Audience:** whoever plans a batch, the model that writes the generators (GPT-6 Pro), and the agent that runs, checks and freezes the results.
**Goal:** up to 100 synthetic survey studies, used to evaluate Velocity and later to fine-tune a model such as Kimi K3. The batch needs **deliberate consistency** (every study is built, checked and recorded the same way) and **controlled variability** (differences between studies are chosen, recorded and balanced, never accidental).

---

## 1. What exists today

### 1.1 Work already done

| Piece | Where | What it gives us |
| :--- | :--- | :--- |
| **SBT-001 materialised** | `scripts/python/synthetic_tracker/` → `evals/research_quality/projects/synthetic/SBT-001/` | A five-wave UK mobile tracker: 5 brands, 2,000 respondents per wave. It has planted events (Pulse W3 step-up, Northstar W4 experience drop and partial W5 recovery, Harbour youth decline) and traps (unweighted overstatement, low-base subgroup, routed bases). The output reproduced the committed hashes byte for byte, and the 10 existing tests pass. Its raw waves stay gitignored and are rebuilt from seed `564001`. |
| **SBT-002 to 006 converted** | `scripts/python/study_canonical/adapters/` | One adapter per study translates its own codebook and data. The conversion is **lossless**: tests invert it back to the source files exactly. Only model-visible inputs are read; hidden answer keys are never used. |
| **Common study format** `velocity.study.v1` | `scripts/python/study_canonical/canonical.py`, README | One codebook shape and one missing-value convention. Every question records who was asked it (an executable universe expression). Question groups (sets) are explicit. Outputs are a labelled SPSS `.sav`, a CSV, the codebook and a validation report. |
| **Validation gates** | `canonical.validate`, `check_sav_roundtrip` | Hard failures for: uncoded values; text codes; valid codes that collide with missing codes; answers outside the universe; bad weights; duplicate IDs; and any `.sav` label, value or missing loss. |
| **Velocity ingestion check** | README findings | All six `.sav` files load in Velocity's CLI with user-missing handled correctly. A weighted crosstab matched pandas exactly. |
| **Report generator** | `scripts/python/study_reports/` | A tablebook and a findings deck for any canonical study. The tablebook comes from the codebook alone; the storyline uses an archetype module plus a short spec. It recomputes all 147 SBT-001 reference analyses and the SBT-002 reference metrics exactly. Storyline tests confirm the planted findings are found and the traps avoided. |

### 1.2 What the first conversion taught us (these drive the rules below)

1. **The same code meant different things across studies.** Code 97 meant *not asked* in SBT-001 but *don't know* in SBT-004 to 006. A single global rule would have corrupted one family silently. → **Rule C3:** one missing-value convention, declared per variable.
2. **Every study arrived in a different codebook shape.** There were five, some with no question wording and some storing answers as text. → **Rule C2:** generators write the common format directly; adapters exist only for legacy studies.
3. **The questionnaire and the data drifted apart** (SBT-001: M3 is 0/1 against four options in the questionnaire; M4 is missing). → **Gate G3** checks the questionnaire against the data.
4. **Some distributions were unrealistic.** SBT-003's satisfaction was almost uniform and its NPS centred on 5; SBT-006's intent was U-shaped; SBT-004 and 005 used only 8 distinct weight values. → The **realism checks** in §7.
5. **Velocity's automatic grid detection was wrong on every study.** It merged separate blocks and missed batteries and brand grids. The explicit `sets` in each codebook are the right answer. → Every study must declare its sets; they double as a test of detection.
6. **Four of six studies were about groceries or meal planning.** → The **quotas** in §5 stop topics clustering.

### 1.3 What still needs building (tracked in §11)

A batch runner, a degradation engine (for deliberately broken files), a realism checker, a near-duplicate checker, storyline modules for the four remaining archetypes, and automatic report specs derived from the study spec.

---

## 2. Core principles

1. **Truth first, data second.** Each study starts from a written design. That design covers the population, the questionnaire, a data-generating process (DGP), the planted findings and the traps. Data is sampled from the design and checked against it. Nobody tunes numbers after the fact.
2. **Two layers for every study.**
   - The **gold layer** is clean, in the common format, and hidden from evaluated models.
   - The **delivery layer** is what Velocity or a model actually receives. It can be as clean as gold or deliberately degraded.
   - Every study has a gold layer. Every degradation is recorded in a ledger, so any score can be traced back to gold.
3. **Deterministic and reproducible.** Every artifact comes from (generator source, spec, seed, library versions). Hashes are recorded at each stage, and a re-run must reproduce them.
4. **Keep what models see separate from what they don't.** This follows `evals/research_quality/model_exposure_contract.json`. Generator source, DGP, planted truths, traps, ledgers and reference findings never reach an evaluated model. They reach a fine-tuning corpus only if §9 explicitly allows it.
5. **Variability is chosen, not accidental.** Every way a study can differ is an explicit field in the study spec, sampled from a batch plan (§5). Anything not listed is held constant.
6. **No study goes in without passing its gates.** A study joins the registry only after it passes every gate in §6. Failed seeds are recorded with their reasons, never deleted quietly.

---

## 3. What stays the same (the consistency contract)

Every study in every batch meets these rules, whatever its content or degradation.

| ID | Rule |
| :--- | :--- |
| **C1 Identity** | Study IDs continue the SBT sequence. **This programme uses SBT-101 to SBT-200.** Each belongs to a batch, e.g. `GEN-2026-10-A`, and has a `family` ID (§9) used for splitting. |
| **C2 Format** | The gold layer is `velocity.study.v1`: canonical CSV, `.sav` and `codebook.json`, built and checked by `scripts/python/study_canonical/canonical.py`. New generators write this format directly; no adapter is needed. |
| **C3 Missing values** | Gold: blank = *not asked* (outside the universe); 97 = don't know; 98 = prefer not to say; 99 = not answered / not derivable. Valid codes never use 97–99, and each variable lists the codes that apply to it. (Degraded deliveries may break this on purpose; the ledger records how.) |
| **C4 Universes** | Every variable has universe text *and* an executable expression. Gate G2 checks that answers are blank exactly outside the universe. |
| **C5 Sets** | Every question group is declared as a set: battery, multi_response, brand_grid, brand_attribute_grid, paired_measure, or ranking and allocation (new types in §4.3). Each has a question ID, the question wording and its members. |
| **C6 Wording** | Every variable has `question_text` and `text_source`: `questionnaire`, `codebook` or `authored`. Gold studies should have no `authored` wording, because the generator writes the questionnaire. |
| **C7 Weights** | One primary weight, with its method (rim, cell, design or none) and targets in the spec. Design effect, the effective base, and minimum and maximum weight are recorded. |
| **C8 Study materials** | Every study ships the materials a researcher would get: a brief, a decision question, the population, fieldwork dates, the questionnaire and an analysis policy. That policy covers materiality, low-base rules, the pre-specified subgroups and the multiple-testing approach. |
| **C9 Hidden truth** | The planted findings, traps and DGP parameters follow `schemas/synthetic_truth.schema.json`, extended for non-tracker archetypes. Each truth says how it is measured, so an independent script can check it. |
| **C10 Provenance** | Recorded for every study: generator author and model, source hash, spec hash, seed, rejected seeds with reasons, library versions, output hashes, and who did the independent audit. |
| **C11 References** | Every study has reference analyses and reference findings that an independent script computes from gold. It also has a generated tablebook and deck from `study_reports` (once its archetype has a storyline module). |
| **C12 Registry** | Every study has one line in `registry/datasets.jsonl` and one in `registry/splits.jsonl`. Split is decided by family (§9), never study by study. |

### 3.1 Folder layout (one study)

```
evals/research_quality/projects/synthetic/<batch>/SBT-1NN/
  manifest.json                # id, batch, family, archetype, tier, status, variability fields
  spec/study_spec.json         # the full design (hidden) — §4
  spec/report_spec.json        # banner, entities, measures for study_reports (derived from the study spec)
  model_inputs/                # EXACTLY what an evaluated model receives (delivery layer)
      <files per delivery format>   study_materials.json   questionnaire.md (if the tier includes it)
  gold/                        # velocity.study.v1: sbt_1nn.csv, sbt_1nn.sav, codebook.json, validation.json
  hidden/
      generator/generate.py    # GPT-6 Pro source, unedited; edits go in a new version
      truth.json               # planted findings, traps, DGP parameters (C9)
      degradation_ledger.json  # every operation applied to make model_inputs from gold (§4.4)
      audit.json               # independent audit results (gate G5)
      provenance.json          # C10
  reference/
      analysis_results.json    # independent reference analyses on gold
      findings.json            # reference findings (the answer key for storylines)
      reports/                 # tablebook and deck from study_reports
  freeze.json                  # hashes of every artifact above, once all gates pass
```

---

## 4. What changes, and how (controlled variability)

Variability lives in named fields of the study spec. Each field has an allowed set of values, and the batch plan (§5) samples from them.

### 4.1 Study-level fields

| Field | Allowed values (v1) | Notes |
| :--- | :--- | :--- |
| `archetype` | `tracker`, `concept_test`, `cx_diagnostic`, `usage_attitudes`, `campaign_evaluation`, `pricing`, `segmentation`, `ad_test`, `employee_survey`, `public_attitudes` | The first six have working examples (SBT-001 to 006). The other four need a report archetype before their decks can be generated. |
| `domain` | open list, with a quota (§5) | For example telecoms, grocery, banking, insurance, travel, energy, streaming, automotive, health services, local government, higher education, B2B software. |
| `country_language` | `UK-en` (default), `US-en`, `IE-en`, `multi-country-en` | Label wording and region codes follow the country. |
| `n` | 300–6,000 (per wave for trackers) | Small n deliberately produces low-base subgroups. |
| `waves` | 1, 2–3, 4–8 | Only trackers and campaign studies have more than one. |
| `design` | cross-section, repeated cross-section, panel/paired, randomised monadic, sequential monadic, randomised pricing, encouragement RCT | Record randomisation units and cells. |
| `weighting` | none, rim (2–4 dimensions), cell, design weight, trimmed rim | Include the target design effect range. |
| `variable_count` | 20–60 (small), 60–200 (medium), 200–600 (large) | Grids drive the count. |
| `question_mix` | weights across the types in §4.3 | For example `{"single":0.3,"scale":0.3,"grid":0.2,"multi":0.15,"numeric":0.05}`. |
| `routing_complexity` | none, simple filters, nested filters, loops (brand × attribute), piping | Every route needs an executable universe (C4). |
| `open_ends` | none, coded only, coded + verbatim text | Verbatims must be synthetic and must not contain personal data. |
| `planted_findings` | 3–8, drawn from the catalogue in §4.2 | At least one must be null (a plausible-looking non-effect). |
| `traps` | 1–4, drawn from the catalogue in §4.2 | Each has a stated gold behaviour. |
| `tier` | T0–T3 (§4.4) | Decides how the delivery layer is degraded. |
| `delivery_format` | `sav_labelled`, `csv_plus_codebook`, `csv_plus_dictionary_xlsx`, `xlsx_export`, `agency_csv_text_labels`, `csv_only` | Depends on tier (§4.4). |
| `label_style` | clean, terse (e.g. `Q7_3`), verbose (full question in the label), inconsistent | Applies to the delivery layer only. |

### 4.2 Catalogues

**Planted findings.** Each carries its effect size, the base it lives on, and the test that should detect it.

| Kind | Example | Archetypes |
| :--- | :--- | :--- |
| step change | Brand awareness +12 pts in W3 | tracker, campaign |
| gradual trend | −1 pt per wave, no single significant step | tracker |
| event + recovery | Drop in W4, partial recovery in W5 | tracker, CX |
| subgroup concentration | Change only among 18–34s | all |
| interaction | Concept B wins only among a pre-specified segment | concept, ad test, pricing |
| winner / no winner | Material and significant lead, or a lead below materiality | concept, ad test |
| price response | Monotonic decline with a kink at one price | pricing |
| driver | Reliability explains NPS more than value does | CX, U&A |
| segment structure | 4 latent segments with distinct need profiles | segmentation, U&A |
| **null** | A plausible-looking difference that is not significant | all (required) |

**Traps.** Each has a stated *gold behaviour*: what a correct analyst or Velocity does.

| ID | Trap | Gold behaviour |
| :--- | :--- | :--- |
| TR-WEIGHT | An effect that is significant only unweighted | Report the weighted result; don't claim the effect. |
| TR-LOWBASE | A striking change in a subgroup of n < 50 | Flag it or suppress it; no headline claim. |
| TR-ROUTE | A routed question compared as if everyone were asked | Use the routed base; warn about comparability. |
| TR-GRIDBASE | Grid items with a per-item eligibility base | Use the base for each item. |
| TR-DK | Don't know is large and differs by group | Report the valid base; make the don't-know share visible. |
| TR-MULTI | Many subgroup tests, some "significant" by chance | Adjust for multiple tests or label as exploratory. |
| TR-COMPOSITION | A total change driven by a change in sample mix | Explain the composition effect. |
| TR-REVERSE | A reverse-keyed item in an index | Reverse it before combining. |
| TR-STATED | Stated intent read as behaviour | Use cautious wording; no revenue claim. |
| TR-BREAK | A series break (question wording changes in wave k) | Don't trend across the break, or caveat it. |

### 4.3 Question types the generator must support

These are single, multi-response (0/1 flags), scale (5, 7, 10 or 11 points), grid/battery, brand grid, brand × attribute grid, numeric/count, ranking (rank positions), constant-sum allocation, date, coded open end, and verbatim open end. New set types: `ranking` and `allocation` (members sum to a fixed total). Add them to `canonical.py` and `tables.py` before the first study that uses them.

### 4.4 Degradation tiers (structural weakness on purpose)

The **gold** layer is always clean. The **delivery** layer is made from gold by a *degradation engine* running a list of named operations with parameters and a seed. Every operation writes an entry to `hidden/degradation_ledger.json`, e.g. `{op, params, columns, rows, recoverable, expected_behaviour}`.

| Tier | What Velocity receives | Share (§5) |
| :--- | :--- | :--- |
| **T0 Clean** | Labelled `.sav` or CSV with the common codebook, straight from gold | Early batches |
| **T1 Agency-realistic** | Typical real-world export quirks; a codebook or dictionary is present but imperfect | Early batches |
| **T2 Structurally weak** | Several faults across metadata and structure; partial dictionary; some faults are unrecoverable | Later batches |
| **T3 Hostile** | CSV only, no dictionary, cryptic names, mixed types, extra rows | Later batches |

**Operation catalogue (v1).** Each op has an ID, a recoverable flag (can gold be recovered from the delivery plus reasonable inference?) and an expected behaviour for Velocity:

- `detect`: notice and report it.
- `repair`: fix it automatically, and say so.
- `ask`: ask the researcher.
- `refuse`: stop, explaining why.
- `tolerate`: carry on correctly.

| Op | Description | Tiers | Recoverable | Expected |
| :--- | :--- | :--- | :--- | :--- |
| M-TEXTCODE | Answers stored as label text | T1+ | yes | repair |
| M-LABELDRIFT | The same code has different labels in different waves | T1+ | yes | detect, repair |
| M-MISSMIX | DK stored as 99 in some variables and −1 or blank in others | T1+ | partial | detect, ask |
| M-NOVALLABELS | Value labels missing for some variables | T1+ | partial | detect, ask |
| M-VARLABELTRUNC | Variable labels cut to 40 characters | T1+ | yes (from questionnaire) | tolerate |
| M-NODICT | No codebook or dictionary at all | T3 | partial | detect, ask |
| M-CRYPTICNAMES | Columns renamed `V1..Vn` or `Q7r3c2` | T2+ | partial | ask |
| S-MULTIDELIM | Multi-response stored as `"1;4;7"` strings | T1+ | yes | repair |
| S-WIDELONG | A tracker delivered as separate wave files with different column orders | T1+ | yes | repair |
| S-HEADERROWS | Two header rows (question text + code) or a title row above the header | T2+ | yes | repair |
| S-TOTALROW | Stray "Total" or summary rows at the end | T2+ | yes | detect, repair |
| S-DUPIDS | Duplicate respondent IDs (true duplicates and ID collisions) | T2+ | partial | detect, ask |
| S-MIXEDTYPES | Numbers with thousands separators, `"n/a"`, `"-"`, `"5 - Very likely"` in one column | T2+ | yes | repair |
| S-DATES | Interview dates in three formats | T2+ | yes | repair |
| S-ENCODING | cp1252 or UTF-8 with a BOM; `£` and accents mangled | T2+ | partial | detect, repair |
| S-DELIM | Semicolon delimiter and a decimal comma | T3 | yes | detect, repair |
| R-ROUTEBREAK | Answers present outside the universe (a routing error) | T2+ | no | detect, refuse to use them |
| R-STRAIGHTLINE | 3–5% of respondents straight-line the grids; one block of speeders | T1+ | yes (flags) | detect |
| R-OUTOFRANGE | Values out of range (e.g. age 999, scale code 6) | T2+ | no | detect, exclude |
| W-NOWEIGHT | Weight column dropped (targets given in study materials) | T2+ | yes (re-weight) | ask or repair |
| W-BADWEIGHT | Weight contains zeros, blanks or a rescaled total | T2+ | partial | detect |
| Q-QDRIFT | Questionnaire and data disagree (an extra option, a missing question) | T1+ | no | detect |
| Q-BREAK | Wording change in wave k with no flag (series break) | T2+ | no | detect if the questionnaire is supplied |

**Tier recipes.** Recipes are sampled per study and recorded in the ledger.

| Tier | Metadata ops | Structure ops | Response ops | Weight ops | Delivery format |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T1** | 1–3 | 0–1 | 0–1 | 0 | `agency_csv_text_labels`, `xlsx_export` or `sav_labelled` |
| **T2** | 2–4 | 1–3 | 1–2 | 0–1 | Partial dictionary |
| **T3** | `M-NODICT` + `M-CRYPTICNAMES` | ≥2 | ≥1 | ≥0 | `csv_only`; study materials stay minimal (brief + population), no questionnaire |

T3 files still have a complete gold layer and truth file, so any score can be computed even though the delivery is hostile.

---

## 5. Batch plan: 100 studies in three phases

Early batches are structured and clean; deliberately broken files come later.

| Phase | Studies | Tiers | Purpose |
| :--- | :--- | :--- | :--- |
| **A** `GEN-2026-10-A` | 30 | T0 × 15, T1 × 15 | Prove the pipeline end to end; stretch the archetypes and domains; refine realism checks. |
| **B** `GEN-2026-11-B` | 40 | T0 × 8, T1 × 12, T2 × 20 | Structural weakness; Velocity preparation workflows; repair and ask behaviour. |
| **C** `GEN-2026-12-C` | 30 | T1 × 5, T2 × 10, T3 × 15 | Hostile deliveries, CSV-only, no dictionary. |

**Quotas across all 100.** The batch planner enforces these and rejects plans that break them.

| Axis | Quota |
| :--- | :--- |
| Archetype | No archetype more than 20%. Trackers and concept tests together no more than 35%. At least 5 studies of each of the ten archetypes. |
| Domain | No domain more than 10%. At least 10 distinct domains per phase. |
| Size | About 30% small, 50% medium, 20% large (by variable count). About 20% of studies with n < 800. |
| Weighting | At least 20% with no weight; at least 15% with design effect > 1.4. |
| Planted findings | Every study has at least one null. Each finding kind appears in at least 5 studies. |
| Traps | Each trap appears in at least 5 studies; no study has more than 4. |
| Paired variants | 10 "twin" pairs: the same gold delivered at two tiers (e.g. T0 and T3), to measure how degradation alone affects Velocity. Twins share a family and so a split. |

**Batch plan file.** It lives at `evals/research_quality/batches/<batch>/plan.json`. The planner samples it with its own seed and writes it before any generation starts.

```json
{
  "batch": "GEN-2026-10-A",
  "plan_seed": 20261001,
  "generator_model": "GPT-6 Pro",
  "studies": [
    {"study_id": "SBT-101", "family": "FAM-telco-tracker-01", "archetype": "tracker", "domain": "broadband",
     "country_language": "UK-en", "n": 1500, "waves": 4, "design": "repeated_cross_section", "weighting": "rim",
     "variable_count": "medium", "routing_complexity": "loops", "tier": "T0", "delivery_format": "sav_labelled",
     "planted_findings": ["step_change", "subgroup_concentration", "null"], "traps": ["TR-WEIGHT", "TR-GRIDBASE"],
     "twin_of": null}
  ],
  "quota_check": {"passed": true, "report": "..."}
}
```

---

## 6. The per-study pipeline

Each stage has an owner, inputs, outputs and a gate. A study moves on only when its gate passes.

| Stage | Owner | Output | Gate |
| :--- | :--- | :--- | :--- |
| **S1 Study spec** | GPT-6 Pro, from the plan row + prompt P1 (§8) | `spec/study_spec.json`, `model_inputs/questionnaire.md`, `study_materials.json` | **G1** Spec is valid against `study_spec.schema.json` (to build). It covers every planned field. Each planted finding and trap has a measurement rule and a gold behaviour. |
| **S2 Generator** | GPT-6 Pro, prompt P2 | `hidden/generator/generate.py` (captured unedited, hash recorded) | Code review: deterministic; no network; only allowed libraries; the interface matches §8.2. |
| **S3 Execute** | Agent, cloud workspace (Python 3.11+, pinned libraries) | Gold CSV + `codebook.json` + `truth.json` + execution receipt | **G2** `canonical.validate` passes: codes, universes, sets, weights, IDs. |
| **S4 Gold build** | `study_canonical` | `gold/*.sav`, `validation.json` | **G3** SAV round trip passes. Questionnaire ↔ codebook ↔ data agree: every questionnaire item exists and vice versa, and the options match. |
| **S5 Independent audit** | A separate script, not written by the generator author | `hidden/audit.json` | **G4** Each planted finding is present within tolerance, and each null is not significant. Each trap behaves as described (e.g. TR-WEIGHT is significant unweighted and not weighted). Realism checks pass (§7). Near-duplicate check against the registry passes (§7.3). If this fails, reject the seed, record why, and try the next seed; three failures → back to S1. |
| **S6 Degrade** | Degradation engine (to build), recipe from the plan | `model_inputs/*` + `hidden/degradation_ledger.json` | **G5** Every ledger entry marked *recoverable* can be reversed to gold by the reference repair script. Non-recoverable entries list the columns and rows affected. |
| **S7 References** | `study_reports` + a reference analysis script | `reference/analysis_results.json`, `findings.json`, `reports/` | **G6** Reference findings match `truth.json`. `study_reports` storyline tests pass, where the archetype module exists. |
| **S8 Freeze** | Agent | `freeze.json`, registry lines | **G7** All hashes recorded; registry and split lines written; manifest status set to `frozen`. |
| **S9 Velocity run** | Evaluation runner (`docs/workstreams/research_quality/evaluation_runner_protocol.md`) | Run records and scores | Scored against the gold behaviours and reference findings. |

**Where each stage runs.** Stages S3 to S7 run in the cloud workspace or CI, not on a laptop's system Python: the pinned libraries need Python 3.11 or later. Keep large generated files (raw waves, big deliveries) gitignored and rebuild them from seed, as SBT-001 does. Commit specs, sources, ledgers, validation reports, references and freeze files.

---

## 7. Quality checks that keep the corpus useful

### 7.1 Realism checks (automated, part of G4)

Each check has a threshold. A failure blocks the study unless the spec declares the pattern deliberate, e.g. "polarised concept".

| Check | Rule of thumb |
| :--- | :--- |
| Scale shape | 5-point satisfaction, agreement and likelihood scales are not near-uniform (share of each point ≠ 20% ± 3 on every point). Satisfaction usually leans positive unless the spec says otherwise. |
| NPS | Scores are rarely centred below 6 without a stated reason. The promoter/passive/detractor mix sits within plausible ranges for the domain. |
| Correlations | Related items correlate at 0.3–0.8; unrelated items at \|r\| < 0.3. No item pair has r > 0.95 unless it's a duplicate by design. |
| Response styles | 1–5% straight-liners in grids; some acquiescence; don't know rates of 1–10% where DK is offered. |
| Weights | The weight takes more than 20 distinct values for rim or trimmed weights. Design effect falls in the planned range. No zero or negative weights in gold. |
| Demographics | Marginals are consistent with the stated population, e.g. an 18–64 frame has no over-65s. |
| Routing rates | Each routed base is at least 5% of the sample unless a low base is the trap. |
| Open ends | Coded shares follow a long tail; verbatims differ from one another (no template repetition above 5%). |

### 7.2 Consistency checks (G3)

Questionnaire, codebook and data must agree. Every set member exists. Every universe expression parses and references only earlier questions. Labels contain no placeholder text ("TBD", "Option 3", "Lorem").

### 7.3 Near-duplicate check (G4)

Compare each new study with every registered one on:

- normalised variable names;
- questionnaire text (similarity above 0.8 is a flag);
- the DGP parameter vector;
- the set of planted findings.

Studies in the same family may be similar; across families, flag anything above the thresholds for review. This protects both the evaluation (no memorised twins) and fine-tuning (no near-duplicates split between training and test).

---

## 8. Prompts and interfaces for GPT-6 Pro

### 8.1 P1: study spec prompt (skeleton)

> You are designing a synthetic survey study for evaluating and training research software. Here is one row of a batch plan and the Velocity study format (`velocity.study.v1`, attached: `canonical.py`, the codebook of SBT-004 as a worked example, and this guide's §3–§4).
>
> Produce `study_spec.json`, `questionnaire.md` and `study_materials.json` for this row.
> Requirements:
> - The fictional brand, organisation and setting fit the domain.
> - A population and sampling frame you state explicitly.
> - A questionnaire with question IDs, full wording, response options, routing written as conditions on earlier questions, and set membership.
> - A DGP: latent factors, segment structure, the relationships between them, and response-style parameters.
> - Each planted finding, with its effect size, the base it lives on, and how to measure it.
> - Each trap with its gold behaviour.
> - An analysis policy: materiality, low-base thresholds, pre-specified subgroups and multiple-testing handling.
> - A report spec: banner, entities, key measures.
>
> Do not choose tier or degradation; that is applied later. Use only fictional names. Keep every value consistent with the plan row; if a field is infeasible, say why rather than silently changing it.

### 8.2 P2: generator prompt and the required interface

> Write a single deterministic Python 3.11 module that implements the attached `study_spec.json`.
> Allowed libraries: numpy, pandas, scipy. No network access; no file reads except the spec.
>
> Interface: `python generate.py --spec spec/study_spec.json --seed <int> --out <dir>`.
> It writes:
> 1. `<dir>/gold.csv`: integer codes, blank = not asked, 97/98/99 as defined, one row per respondent (and wave).
> 2. `<dir>/codebook.json`: `velocity.study.v1` fields for every column and every set.
> 3. `<dir>/truth.json`: planted findings, traps and DGP parameters, with the realised values measured in the generated data.
> 4. `<dir>/receipt.json`: seed, library versions, SHA-256 of each output.
>
> Also:
> - Sample weights to the stated targets.
> - Include the response styles in the spec.
> - Never write a value outside a variable's codes.
> - Exit non-zero if any planted finding misses its tolerance, so the runner can try the next seed.

### 8.3 Study spec schema (to be added at `evals/research_quality/schemas/study_spec.schema.json`)

Top-level keys:

| Key | Contents |
| :--- | :--- |
| `study_id` | |
| `batch` | |
| `family` | |
| `archetype` | |
| `domain` | |
| `country_language` | |
| `population` | |
| `fieldwork` | Dates per wave |
| `design` | Type, cells, waves, n |
| `weighting` | Method, targets, design effect range |
| `questionnaire` | Questions with ID, text, type, options, route, set |
| `sets` | |
| `dgp` | Latent factors, correlations, segments, parameters, response styles |
| `planted_findings[]` | Kind, target, size, base, measure, tolerance |
| `traps[]` | ID, construction, gold behaviour |
| `analysis_policy` | |
| `report_spec` | Banner, entities, measures |
| `variability` | Echo of the plan row |

The report spec block feeds `scripts/python/study_reports` directly, so no per-study spec needs writing by hand.

---

## 9. Evaluation versus fine-tuning hygiene

- **Split by family, not by file.**
  - A family is a generator design plus domain plus archetype. Seed re-runs, twins (same gold, different tier) and waves of the same study all stay in one family.
  - Assign whole families to `train`, `dev` or `test` in `registry/splits.jsonl`.
  - Suggested split: 70% train, 10% dev, 20% test by family.
  - Test families should include at least one archetype–domain combination that is absent from train.
- **Existing studies are development evaluation only.** SBT-001 to SBT-006 (and the brand tracker demo) are exposed and stay `development_evaluation` with `training_allowed: false`, as `registry/datasets.jsonl` already records.
- **What a training example may contain** (for families marked train): the model-visible inputs; the target outputs (reference findings, tablebook structure, data preparation actions implied by the degradation ledger); and, for the repair and ask skills, the ledger itself as supervision.
- **What a training example never contains:** generator source; the raw DGP; or anything from a test or dev family.
- **Record the training-set composition.** Log the exact family list and hashes for any fine-tuning run so later evaluations can prove they're uncontaminated.
- **Licensing.** Everything is wholly synthetic with fictional brands. Keep the `licensing` block from the SBT-001 manifest (evaluation, training, commercial prototype and redistribution all allowed) on every study.

---

## 10. Checklists

**Per study, before freeze:**

- [ ] Plan row, spec, questionnaire and study materials exist and agree (G1, G3).
- [ ] Generator source captured unedited; hash recorded.
- [ ] Gold passes `canonical.validate` and the SAV round trip (G2, G3).
- [ ] The independent audit confirms every planted finding and null and every trap behaviour; realism and near-duplicate checks pass (G4).
- [ ] The degradation ledger is complete; recoverable entries reverse to gold (G5).
- [ ] Reference analyses and findings computed independently; reports generated (G6).
- [ ] Freeze hashes written; registry and split lines added; `training_allowed` set by family (G7).

**Per batch, before release:**

- [ ] Quota report passes (§5).
- [ ] No near-duplicates across families.
- [ ] Rejected seeds and specs listed with reasons.
- [ ] Batch summary written: counts by archetype, domain, tier, trap and finding; Velocity load success rate; open issues.

---

## 11. Build list (to make this run at scale)

| Item | Where | Priority |
| :--- | :--- | :--- |
| `study_spec.schema.json` and a spec validator | `evals/research_quality/schemas/`, `scripts/python/study_generation/` | Before phase A |
| Batch planner with quota checks | `scripts/python/study_generation/plan.py` | Before phase A |
| Batch runner (S3–S8, seed retry, receipts, freeze) | `scripts/python/study_generation/run.py` | Before phase A |
| Independent audit framework (truth checks by kind, trap checks, realism, near-duplicates) | `scripts/python/study_generation/audit/` | Before phase A |
| `ranking` and `allocation` set types; date and verbatim types | `study_canonical/canonical.py`, `study_reports/tables.py` | Before the first study that uses them |
| Report archetypes: CX, U&A, campaign, pricing (then segmentation, ad test, employee, public attitudes) | `study_reports/archetypes/` | Phase A (the first four), phase B (the rest) |
| Report spec derived from `study_spec.report_spec` | `study_reports/build.py` | Phase A |
| Degradation engine and reference repair script | `scripts/python/study_generation/degrade/` | Before phase B |
| Velocity scoring against gold behaviours (detect, repair, ask, refuse, tolerate) | `evals/research_quality/` runner | Before phase B |
| CI job: regenerate a random 10% of frozen studies from seed and compare hashes | `.github/workflows` | Phase B |

---

## 12. Worked example: one phase A study, end to end

1. The plan row says: `SBT-107`, family `FAM-energy-cx-01`, archetype `cx_diagnostic`, domain `home energy`. n = 1,800, one wave, rim weighting with a target design effect of 1.2–1.4, medium size, simple filters. Planted: a driver, a subgroup concentration and a null. Trap: TR-ROUTE. Tier T1, delivered as `agency_csv_text_labels`.
2. **S1.** GPT-6 Pro writes a spec for fictional supplier "Brightwell". It has 64 variables: satisfaction and NPS, 8 diagnostics, a billing-issue route and a smart-meter module. The driver is "billing accuracy drives NPS more than price". The concentration is "prepayment customers' satisfaction fell". The null is "a regional difference that is not significant". The trap is to compare complaint resolution across all customers when only those who complained were asked.
3. **S2–S4.** The generator runs with seed `2026100107`. Gold validates, and the SAV round trip passes.
4. **S5.**
   - The driver's standardised coefficient is within ±0.05 of plan.
   - The prepayment drop is significant; the regional null is not.
   - The complaint question's routed base is 14% of the sample, as planned.
   - Realism: satisfaction leans positive, and the weight takes 1,300 distinct values. Near-duplicate check: clear.
5. **S6.** The T1 recipe applies M-TEXTCODE, S-MULTIDELIM and R-STRAIGHTLINE, all recorded in the ledger.
6. **S7–S8.** Reference findings are computed, the CX report archetype builds the deck, and the study is frozen. The registry puts it in `train` because its family is assigned there.
7. **S9.** Velocity is scored on three things: loading the file and repairing the text codes, detecting straight-liners, and building the driver analysis on the routed base correctly.
