# Research quality evaluation harness

This directory implements the experimental programme owned by `docs/workstreams/research_quality/00_strategy.md`. Current evidence comprises the [original September pilot](runs/2026-09-pilot-comparison/readout.md) and [SBT-004–006 expansion](runs/2026-09-expansion-comparison/readout.md), with machine-readable comparisons and per-run adjudications. Independent researcher validation is pending.

## Current scope

- SBT-001 corrections are merged in PR 76. Reproduce canonical data, agency exports and corrected `turn4-v2` reference analysis with `scripts/python/synthetic_tracker/README.md`. Original v1 findings are historical and contain a known routing defect.
- SBT-002 and SBT-003 v1.0.0 have realised-data checks, independent calculations, frozen reference findings and explicit model-input packages. Frozen bytes must not change after model exposure.
- The existing-Codex pilot produced ten outputs: five repeated SBT-002 analysis/one-pass runs, one analysis/staged run, two raw-data workflows, one SBT-003 run and one public FSA published-table transfer run. Every stage preserves prompts, raw events, outputs, usage and hashes; one initial CLI-version failure is retained.
- SBT-004 (usage and attitudes), SBT-005 (campaign assignment) and SBT-006 (stated-intent pricing) add unchanged GPT-6 Pro generators, independently audited rows/tables, realised-trap checks and pre-exposure freezes. The expansion compares raw versus approved-analysis inputs and one-pass versus staged workflows using existing Codex access. Its artifacts and reviewer pack are separate from the original pilot.
- Selection metrics are executable from explicit semantic adjudications. The current scores were adjudicated by the primary agent, not independent researchers. Prioritisation, narrative preference and human correction burden remain unmeasured.
- The blinded review prototype and offline SBT-002 native-chart adapter are implemented. They do not change Velocity's workspace/session format or production UI. General model comparison, product integration and publication-quality deck validation remain future work.

## Reproduce and inspect

From the repository root, install `scripts/python/research_quality/requirements.txt` in an isolated environment, then run:

```sh
python -m pytest tests/research_quality -q
python scripts/python/research_quality/freeze_study.py SBT-002 --verify
python scripts/python/research_quality/freeze_study.py SBT-003 --verify
python scripts/python/research_quality/audit_pilot_numbers.py
python scripts/python/research_quality/score_run.py 2026-09-21-sbt002-analysis-one-r1b
node tests/research_quality/review_pack.browser.mjs
npx vitest run tests/research_quality/reviewed-deck.test.ts
```

For the expansion, inspect frozen artifacts without consuming model allowance:

```sh
python scripts/python/research_quality/freeze_expansion.py SBT-004 --verify
python scripts/python/research_quality/freeze_expansion.py SBT-005 --verify
python scripts/python/research_quality/freeze_expansion.py SBT-006 --verify
python scripts/python/research_quality/audit_expansion_pilot.py 2026-09-expansion-sbt006-analysis-onepass-1
python scripts/python/research_quality/score_run.py 2026-09-expansion-sbt006-analysis-onepass-1
node tests/research_quality/review_expansion.browser.mjs evals/research_quality/review/2026-09-expansion/reviewer_pack tmp/expansion-review-qa
npx vitest run tests/research_quality/expansion-deck.test.ts
```

To generate a new pack, always select a new output directory with `review_pack.py --studies SBT-004 SBT-005 SBT-006 --run-prefix 2026-09-expansion --out NEW_DIRECTORY`. Do not overwrite a distributed pack or invoke the original pilot default as a routine inspection step.

`pilot_runner.py --help` documents opt-in model execution. Do not rerun models merely to inspect results; those commands consume Codex allowance. `run_manifest.py` and `validate_exposure.py` check exact allowlisted inputs. FSA input hashes are verified by the same run-manifest path; its source workbook is excluded from git and the source/rights record is in its `data_card.json`.

## Independent researcher review

For SBT-004–006, share **only** [the expansion reviewer ZIP](review/2026-09-expansion/reviewer_pack.zip). The [original pilot ZIP](review/2026-09-pilot/reviewer_pack.zip) is unchanged. Each is a blinded package that contains `index.html`, instructions and source materials. Keep the adjacent private identity key, gold findings and pilot scores hidden until submissions are locked. Reviewers first record their own findings, then assess anonymous candidates, edit or reject findings, select a narrative, and export their decisions. Ask at least two researchers to work independently before discussing disagreements. Do not treat automated QA approvals as researcher judgements.

The pack records active minutes and corrections, supports export/import, and invalidates approvals after evidence changes. `reviewed_research_prototype` is an explicitly versioned experimental export; it is not `VelocitySessionFile`.

For an approved SBT-002 analysis candidate:

```sh
npx tsx scripts/research-reviewed-deck.ts approved-review.json   evals/research_quality/projects/synthetic/SBT-002/model_inputs/analysis_results.json   reviewed.pptx
```

This adapter reuses Velocity's existing native PPTX exporter. It checks data/evidence hashes, accepted finding references and story positions, and retains original wording, corrections and every cited table in notes. It draws one representative chart per approved beat, favouring full ordinal distributions. Revised evidence requires renewed approval; values come from the new evidence after that approval. Raw claim-only references and other study types are outside this bounded adapter. The adapter omits labels below 5% to avoid collisions, retaining every value in native chart data and notes, and fixes stacked-distribution axes at 0–100%. It is a representative chart per beat, not a complete visualisation of every cited finding.

## Data and scoring rules

1. Split by project, never respondent rows. The registry labels these exposed development cases honestly; no secret holdout is claimed.
2. Never use evaluation artifacts, reviewer corrections or public cases for training.
3. Keep deterministic numerical checks, inspectable semantic adjudication and human editorial preference separate.
4. Preserve failed runs and original outputs. A changed study creates a new benchmark version.
5. Monetary cost unavailable from the CLI is null, not zero.
6. See the runner protocol for the post-dry-pilot `supported_novel` scorer correction and the raw-arm method/input confounds. Do not infer a causal staging benefit from one pair.

The original E1–E8 strategy labels describe research stages; the pre-presentation E1–E5 labels describe experiment arms. Their versioned camelCase (SBT-001) and snake_case (SBT-002/003) formats remain explicit adapters, not interchangeable schemas.

For an approved SBT-004, SBT-005 or SBT-006 analysis candidate, use `scripts/research-expansion-deck.ts` with the same three arguments. It preserves all evidence and reviewer changes in notes, uses a representative native chart per beat and requires renewed approval when evidence changes. These decks are software QA examples, not researcher-approved deliverables or publication-quality validation. The expansion's browser screenshots and rendered export evidence are recorded alongside its comparison readout.
