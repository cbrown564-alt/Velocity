# Researcher Taste and Steerability Rubric

Correctness is a gate, not the complete definition of quality. This rubric evaluates the part of the product that should distinguish Velocity from mechanical report automation.

## Pairwise review protocol

Prefer blinded **A vs B** comparisons. Show reviewers the same brief plus two outputs in random order. Ask first for a forced preference, then the reason. Scalar ratings may be collected secondarily.

For full decks, reviewers answer:

> Which output would you rather put in front of a client after the least additional work?

For individual slides:

> Which slide communicates the supported finding more clearly and appropriately for a professional research deliverable?

Reviewers can also select `tie / neither acceptable` when both violate a hard quality bar.

## Dimensions

### 1. Story judgement

Strong output:

- prioritises what materially matters to the client;
- connects findings into a coherent argument;
- distinguishes headline, support and context;
- omits low-value findings even when statistically interesting;
- avoids one-slide-per-question mechanical coverage;
- knows when a result is too weak, too low-base or too unsurprising to headline.

Mechanical failure:

- narrates tables in sequence;
- treats every significant difference as equally interesting;
- produces generic implications unrelated to the brief;
- repeats the same observation in title, subtitle and body;
- confuses comprehensiveness with insight.

### 2. Headline quality

Strong output:

- makes a specific, evidence-bounded claim;
- communicates the implication without overstating causality or certainty;
- uses natural research language rather than template phrases;
- reflects the most important evidence on the slide.

Failures include:

- 'Key findings' / 'Awareness by segment';
- empty adjectives such as 'significant opportunity' without context;
- causal wording from cross-sectional evidence;
- 'stable' solely because a test is non-significant;
- copying chart labels into a sentence.

### 3. Visual hierarchy

Strong output:

- has one obvious reading path;
- gives the most important evidence visual priority;
- uses whitespace deliberately;
- limits decoration;
- keeps annotation adjacent to evidence;
- makes bases/caveats discoverable without dominating the slide.

### 4. Chart/table choice

Strong output chooses the representation that best supports the research question, not the one that looks most elaborate. Tables are acceptable when precision and multi-dimensional comparison matter. Charts are preferable when shape, rank or movement is the point.

### 5. Density and restraint

Strong output fits the audience and meeting context. It avoids both dashboard-like clutter and empty 'consulting theatre'. The deck should feel edited.

### 6. Consistency without sameness

Typography, spacing, colour semantics and chart conventions should be consistent, while slide composition can vary with the analytical job. A good deck should not look like 20 instances of one template.

### 7. Evidence discipline

Every numerical headline must be traceable. Interpretation should be visibly distinguishable from measurement. Caveats should appear where they change the reader's decision, not be dumped into a methodology appendix only.

### 8. Client readiness

Reviewers judge whether the artifact feels finished enough to share externally: no internal jargon, debug labels, unexplained variable names, awkward AI prose, layout defects or inconsistent formatting.

## Steerability rubric

For a revision request, score:

- **instruction adherence** — requested change achieved;
- **locked-evidence preservation** — numbers, bases and approved claims unchanged unless the request/data requires change;
- **locality** — unrelated slides/components not needlessly rewritten;
- **style persistence** — brand/template conventions retained;
- **research integrity** — request does not cause unsupported claims;
- **revision quality** — result is better, not merely different.

## Hard failures

Any of the following overrides aesthetic preference:

- fabricated or altered number;
- wrong base/universe/weight;
- unsupported causal claim presented as fact;
- hidden failed analysis represented as complete;
- clipped/overlapping content that obscures evidence;
- changed-wave claim not recomputed from the new data;
- client instruction followed by violating a locked methodological constraint.

## Calibration

Before using an automated multimodal judge, collect at least a small expert-labelled pairwise set. Measure judge agreement with researcher preferences overall and by dimension. If agreement is poor on a dimension such as restraint or research relevance, retain human grading for that dimension rather than hiding the disagreement in an aggregate score.
