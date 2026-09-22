# Pre-presentation evaluation design

## Objective

Evaluate the research work independently of presentation production. The benchmark asks whether a system can move from valid study inputs to a complete, prioritised, evidence-traceable narrative.

## Units of evaluation

The pipeline has five durable semantic objects: **study**, **analysis**, **evidence**, **finding**, and **story**. Study defines design and measurement semantics. Analysis defines an estimand. Evidence binds realised values to an analysis object. Findings make bounded propositions over evidence. Story orders non-redundant findings into a research argument.

## Finding matching

Reference/model matching is semantic rather than lexical. A full match requires the same substantive proposition/direction, compatible universe and estimand, and evidence from the correct analysis family. A model does not receive credit for reaching a superficially similar conclusion from an invalid denominator or unsupported causal interpretation.

Reference tiers are asymmetric:

- **mandatory** drives recall;
- **secondary** contributes coverage but omission is not automatically a major failure;
- **context** tests qualification/methodological understanding;
- **do_not_elevate** tests restraint.

Precision is computed over selected reportable findings. Redundant paraphrases are collapsed into topic clusters before coverage scoring.

## Pre-registered architecture experiments

### E1 — One-call researcher

One strong model receives the allowed study material and produces analysis/findings/story in one response or structured run.

### E2 — Staged researcher

Analyst → verifier → prioritiser → story editor. Each stage receives only the minimum previous-stage structured artifact it needs. Compare accuracy, recall, unsupported findings, redundancy, stability, cost and latency with E1.

### E3 — Deterministic analysis surface

Give the model the frozen analysis surface rather than respondent-level data. This isolates research judgement from numerical analysis.

### E4 — Raw-data analysis

Give the model respondent data plus study semantics. The gap between E3 and E4 estimates how much failure originates in analysis rather than interpretation/prioritisation.

### E5 — Repeated-run stability

Repeat mature E1/E2 arms with fixed inputs. Measure mandatory-finding selection frequency, unsupported-finding variance, importance-order agreement and story-cluster agreement.

## Cross-study aggregation

Do not average everything into one opaque score. Report the seven dimension scores plus mandatory recall, selected precision, unsupported rate, restraint failures and provenance coverage by study and archetype. A cross-study summary may macro-average these metrics after every study has passed its own data/reference freeze.

## Human validation later

Experienced researchers should independently label mandatory/secondary/suppress findings and acceptable claim strength. Human editorial agreement supplements deterministic correctness; it does not replace it.

## Presentation boundary

No slide, chart or rendering quality is scored. Story output must be renderer-neutral. A future renderer consumes the story/evidence contracts without rerunning research reasoning.
