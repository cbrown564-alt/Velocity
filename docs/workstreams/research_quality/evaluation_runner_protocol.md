# Evaluation runner/output protocol

## Principle

The runner must make model experiments reproducible without making the benchmark self-revealing. Every run has an immutable manifest containing study/version, experiment arm, exact model identifier and SHA-256 hashes of every supplied artifact.

## Lifecycle

1. Confirm study freeze prerequisites.
2. Build run manifest from an explicit allowlisted input set.
3. Run leakage validator. Fail closed.
4. Invoke the model/stage externally.
5. Validate structured output against `model_research_output.schema.json`.
6. Preserve raw response separately from parsed output.
7. Adjudicate model findings against frozen reference findings using semantic proposition + evidence compatibility.
8. Compute deterministic selection metrics.
9. Score the remaining dimensions and record hard failures.
10. Never modify study ground truth after the first valid model run; a necessary correction creates a new benchmark version and invalidates comparability with previous runs.

## E2 staged information flow

**Analyst:** study materials/raw data or analysis surface → analysis/evidence candidates.  
**Verifier:** candidates + necessary study semantics → verified/rejected/repaired evidence.  
**Prioritiser:** verified findings → primary/secondary/context selection with redundancy clusters.  
**Story editor:** selected findings → ordered renderer-neutral story beats.

The story editor cannot access hidden reference material and cannot introduce a new empirical finding without an upstream evidence reference.

## Adjudication

Automated matching may propose candidate matches later, but benchmark scoring treats matching as an inspectable artifact. Full match requires compatible proposition direction, estimand/universe and evidence family. Partial matches do not count toward full mandatory recall. Contradictions and unsupported findings reduce precision.

The deterministic scorer uses reference topic clusters, never model-invented clusters. Only mandatory/secondary clusters contribute coverage. A do-not-elevate reference counts once even if multiple model claims promote it. Explicit evidence or claim-strength incompatibility prevents support credit. Every model finding must have one adjudication row; factual support for a restraint finding and whether it was inappropriately promoted are separate judgements.

`supported_novel` is an explicit additional supported-claim state in selection-1.1. It earns precision only and cannot improve frozen-reference recall or coverage. A novel claim must have a null reference ID; contradictory input that tries to borrow a reference cluster is rejected. It was added after the dry pilot exposed a scoring defect; all completed runs use that same scorer version. A full semantic match can name complementary selected findings in `supporting_model_finding_ids`; each contribution remains inspectable. Human preference and correction burden are null until reviewers provide them.

The September raw arms did not receive an exact inferential-method specification and had binary diagnostic items absent from the approved-analysis extract. Record these confounds when comparing input surfaces. The observed trace audit is a separate immutable artifact; the original execution manifest's pending audit field remains historical. Runner formatting after execution does not rewrite historical runner hashes or stage prompts.

## Implemented pilot runner

`scripts/python/research_quality/freeze_study.py` checks realised rows/tables, binds numeric reference evidence, writes an explicit public input package, and hashes frozen artifacts. Re-running a freeze only verifies it; changed bytes fail. The public package excludes concept roles, trap truth, reference findings and scoring keys. Model exposure is checked against resolved paths and exact bytes, including symlink escapes. SBT-001 retains its versioned camelCase reference format; SBT-002/003 use the pre-presentation snake_case schemas. These are separate versioned adapters, not interchangeable payloads.

`pilot_runner.py` uses existing Codex ChatGPT access in a temporary directory containing only approved inputs, ignores user configuration and project instructions, and preserves prompts, raw events, parsed output, runtime, token usage and hashes. Analysis inputs are included verbatim (JSON whitespace compressed) in the prompt; raw-data arms can calculate from the CSV using local tools. Monetary cost is unavailable through the CLI and is recorded as null, never zero. Tool traces require exposure review before scoring. Failed attempts remain in their run directories.

The pilot crosses `input_surface = analysis|raw` with `workflow = one_pass|staged`. Comparisons of workflow hold the input surface constant. Staged execution uses four fresh calls, carries the prior output forward, and preserves the original study evidence so verification can check it. Prompts and model configuration remain fixed for replicates. Do not treat a single pair or the same model's verification as independent researcher validation. E1–E5 here name experiment arms; the strategy's E1–E8 labels name research stages.

Reference proportions exclude routed missing values and use supplied weights. Uncertainty uses an approximate independent-cell Wald test with Kish ESS, with Holm over the declared three comparisons per metric. The two pre-specified Plus-versus-Flex interaction contrasts form a separate Holm family. These are offline reference methods; the product engine's statistical methods are unchanged.

## Stability

### RQ-COVERAGE-01 second-pass development pilot

The predeclared protocol is `evals/research_quality/runs/2026-09-completeness-comparison/protocol.json`. Six calls compare a general review with a study-neutral completeness checklist on SBT-004–006. Each pair receives identical frozen public evidence and the exact original approved-analysis one-pass draft. The checklist is derived from the public decision questions; hidden findings, scores and corrections are excluded. The coordinator has already seen prior failures, so this is explicitly a development experiment.

`completeness_pilot.py RUN_ID` verifies the protocol dependencies, prior manifest/output hashes and frozen public inputs without calling a model. `--execute` consumes the corresponding declared slot using existing Codex access. The protocol must already be committed. Each slot permits one call, 360 seconds, with no retry; existing run directories fail closed. The model receives all evidence inline in an empty temporary directory and is instructed not to call tools. Any recorded tool action or failed turn invalidates the review. Exact prompts, responses, events, prior-output provenance, runtime and available usage are retained, including failures.

Keep baseline and paired review results separate. Score gained and lost mandatory findings, partial secondary coverage, unsupported claims, wrong bases, restraint, provenance and numeric support. Also report extra findings, words, tokens and latency: a longer checklist is a burden, not free completeness. Human preference and correction minutes stay null. One pair per exposed study cannot establish reliability, unseen transfer or product readiness. Preserve the original studies, outputs and distributed reviewer packs.

E5 should use at least five replicates per mature arm/model configuration. Report selection frequency for every mandatory finding and pairwise/Jaccard agreement of selected topic clusters; do not report only average total score.

## Cross-study reporting

Keep study-level metrics visible. Macro summaries across SBT-001/002/003 should not conceal an archetype-specific collapse.

## TypeSafe Jev gates

Optional System One gates may run at cleaning (pre-analysis), E2 verifier, and E2 prioritiser. Use `evals/research_quality/jev/` question packs and `scripts/python/research_quality/jev_gate.py`. Jev must not receive forbidden exposure paths and must not author findings, story beats, or transform code. See `jev_control_plane.md`.

## SBT-004–006 expansion

GPT-6 Pro authors the new deterministic study generators and pre-execution study designs in the original ChatGPT conversation. Codex retains the source/response provenance, executes the generators, independently audits the realised analyses and freezes each study before evaluated-model exposure. Authorship is distinct from independent verification; a generated study can fail its intended criteria.

The new offline estimators exclude explicit invalid codes before any recoding or aggregation. Each result retains valid unweighted N, weighted N and Kish ESS. Multiple-response percentages use respondents, never the sum of selections. Reverse-keyed five-point items map valid codes to `6 - code`; DK and structural blanks remain missing. Paired change requires both observations to be valid for that respondent. Weighted means use the supplied nonnegative weights; their approximate SE is `sqrt(weighted_population_variance / (Kish_ESS - 1))` when ESS exceeds one. This approximation is not a complex-survey variance estimator. A zero-weight or empty valid base is explicitly unavailable. Study-specific inference and multiplicity families must be declared publicly before use.

Each new study must complete generation, schema/routing checks, independent numerical audit, realised-finding checks, freeze, capped model execution, explicit semantic adjudication, scorecard/gap interpretation and a blinded review/export prototype. Human reviews remain pending until returned; synthetic and QA approvals never count as independent validation. Existing frozen studies and prior reviewer packs remain byte-for-byte unchanged.

The fixed four-arm matrix uses `gpt-6-astra` with low reasoning through existing Codex access. GPT-6 Pro is the generator author, not the evaluated model. Each study permits ten planned calls (two one-pass calls and two four-stage workflows), 360 seconds per call and at most one replacement for a technical failure. Quality failures must not be retried. Original attempts, including timeouts, remain in the comparison. One replicate per arm does not satisfy E5 reliability requirements.

SBT-004 uses the approximate ESS-based mean variance described above. SBT-005 paired changes and SBT-006 intent/proxy estimates instead use the publicly specified independent-row fixed-weight ratio variance `n/(n-1) * sum(w² * (y-mean)²) / sum(w)²`. The campaign has separate three-test primary and interaction Holm families. Pricing has six tests in each intent/gross family, eighteen contribution comparisons jointly across all three fixed costs, and two audience tests. Intervals remain pointwise. Both input surfaces receive the same declared study methods; approved tables provide more precomputed secondary detail, so equivalence of analytical opportunity is not implied.

`freeze_expansion.py` preserves the original freeze implementation and locks the new source, rows, reference tables, findings, public inputs, methods and scoring dependencies. Study-specific CSV/`math.fsum` audits recompute values independently of the reference builder and replay unchanged author output. Author-reported first-draw checks are recorded as author claims; the local checks are separate evidence.

The scorer and review page resolve explicit JSON pointers, named analysis-file pointers, indexed claim paths and slash-delimited claim IDs. This is an exact-reference notation adapter, not fuzzy evidence matching. Original model responses remain unchanged. `audit_expansion_pilot.py` checks inspected mappings bound to the output hash; selected prose can use exact character spans and half-last-printed-place rounding tolerance. Reports state their coverage and do not certify every number in a response.

The expansion review pack requires an explicit output directory, preserving the September pilot pack. Its browser QA visits every candidate, tests preparation/decision/revision requirements and invalidates approvals after evidence replacement. `research-expansion-deck.ts` consumes an approved analysis candidate, resolves every cited table, binds source and analysis hashes, and reuses the native PPTX exporter. Each story beat gets one representative editable chart; all claims, qualifications, original wording and review records remain in notes. Flat category caches, zero-based axes and decimal metric labels are checked in the exported slides. Raw claim-only candidates can be reviewed but require approved-table mapping before this bounded deck adapter can export them.

Current study-level results and preserved failures are in `evals/research_quality/runs/2026-09-expansion-comparison/readout.md`. Human preference, active correction minutes and validated product benefit remain pending. A known SBT-004 v1 limitation is that the current-tool-use table prefilters valid responses before its eligible-base metadata is built; its DK/refusal split is absent from that table. Preserve v1 and correct this only in a new version. One-reference-per-finding scoring can also undercredit secondary propositions bundled into a mandatory finding; retain explicit adjudication notes rather than duplicating findings for score gain.
