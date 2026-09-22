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

`supported_novel` is an explicit additional supported-claim state in selection-1.1. It earns precision only and cannot improve frozen-reference recall or coverage. It was added after the dry pilot exposed a scoring defect; all completed runs use that same scorer version. A full semantic match can name complementary selected findings in `supporting_model_finding_ids`; each contribution remains inspectable. Human preference and correction burden are null until reviewers provide them.

The September raw arms did not receive an exact inferential-method specification and had binary diagnostic items absent from the approved-analysis extract. Record these confounds when comparing input surfaces. The observed trace audit is a separate immutable artifact; the original execution manifest's pending audit field remains historical. Runner formatting after execution does not rewrite historical runner hashes or stage prompts.

## Implemented pilot runner

`scripts/python/research_quality/freeze_study.py` checks realised rows/tables, binds numeric reference evidence, writes an explicit public input package, and hashes frozen artifacts. Re-running a freeze only verifies it; changed bytes fail. The public package excludes concept roles, trap truth, reference findings and scoring keys. Model exposure is checked against resolved paths and exact bytes, including symlink escapes. SBT-001 retains its versioned camelCase reference format; SBT-002/003 use the pre-presentation snake_case schemas. These are separate versioned adapters, not interchangeable payloads.

`pilot_runner.py` uses existing Codex ChatGPT access in a temporary directory containing only approved inputs, ignores user configuration and project instructions, and preserves prompts, raw events, parsed output, runtime, token usage and hashes. Analysis inputs are included verbatim (JSON whitespace compressed) in the prompt; raw-data arms can calculate from the CSV using local tools. Monetary cost is unavailable through the CLI and is recorded as null, never zero. Tool traces require exposure review before scoring. Failed attempts remain in their run directories.

The pilot crosses `input_surface = analysis|raw` with `workflow = one_pass|staged`. Comparisons of workflow hold the input surface constant. Staged execution uses four fresh calls, carries the prior output forward, and preserves the original study evidence so verification can check it. Prompts and model configuration remain fixed for replicates. Do not treat a single pair or the same model's verification as independent researcher validation. E1–E5 here name experiment arms; the strategy's E1–E8 labels name research stages.

Reference proportions exclude routed missing values and use supplied weights. Uncertainty uses an approximate independent-cell Wald test with Kish ESS, with Holm over the declared three comparisons per metric. The two pre-specified Plus-versus-Flex interaction contrasts form a separate Holm family. These are offline reference methods; the product engine's statistical methods are unchanged.

## Stability

E5 should use at least five replicates per mature arm/model configuration. Report selection frequency for every mandatory finding and pairwise/Jaccard agreement of selected topic clusters; do not report only average total score.

## Cross-study reporting

Keep study-level metrics visible. Macro summaries across SBT-001/002/003 should not conceal an archetype-specific collapse.

## TypeSafe Jev gates

Optional System One gates may run at cleaning (pre-analysis), E2 verifier, and E2 prioritiser. Use `evals/research_quality/jev/` question packs and `scripts/python/research_quality/jev_gate.py`. Jev must not receive forbidden exposure paths and must not author findings, story beats, or transform code. See `jev_control_plane.md`.
