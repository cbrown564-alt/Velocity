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

## Stability

E5 should use at least five replicates per mature arm/model configuration. Report selection frequency for every mandatory finding and pairwise/Jaccard agreement of selected topic clusters; do not report only average total score.

## Cross-study reporting

Keep study-level metrics visible. Macro summaries across SBT-001/002/003 should not conceal an archetype-specific collapse.
