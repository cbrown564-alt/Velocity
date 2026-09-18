# SBT-002 — Concept / product test benchmark plan

## Purpose

SBT-002 is the first generalisation test after SBT-001. It should determine whether Velocity's pre-presentation research pipeline transfers from a longitudinal brand tracker to a cross-sectional concept/product test with experimental cells, ordinal purchase-intent measures, diagnostics, statistical comparisons and subgroup heterogeneity.

The study ends at a structured research narrative. No PowerPoint/deck output is part of SBT-002 acceptance.

## Research scenario

A consumer subscription/service business is considering three alternative product concepts for a new premium offer. The research team needs to recommend which concept(s) merit further development and understand why, for whom, and with what caveats.

Use fictional concepts and a fictional category so the full data-generating process can be controlled and published in the benchmark.

### Proposed concepts

- **Concept A — Flex**: strongest broad appeal/purchase intent; familiar/easy to understand; weaker differentiation.
- **Concept B — Plus**: strongest uniqueness and premium-value diagnostics; polarising; particularly strong among one strategically important subgroup; somewhat weaker total-sample purchase intent than A.
- **Concept C — Simple**: superficially respectable top-line results but no meaningful diagnostic advantage; includes one seductive statistically significant but commercially tiny difference.

The exact names/category may change before the study contract is frozen; the latent analytical roles should remain.

## Design

### Core design

- approximately 1,800–2,400 synthetic respondents;
- randomised monadic assignment to A/B/C with roughly equal cells;
- UK-style general consumer sample unless category eligibility is required;
- calibration/rim weight with modest realistic variation;
- one strategically relevant subgroup with true heterogeneous concept response;
- several demographic/context variables for tempting but mostly irrelevant cuts.

### Measures

Minimum questionnaire surface:

1. category eligibility / usage;
2. randomised concept assignment;
3. overall appeal — 5 point;
4. purchase intent — 5 point;
5. uniqueness — 5 point;
6. relevance — 5 point;
7. credibility/believability — 5 point;
8. value for money — 5 point;
9. ease of understanding — 5 point;
10. open-ended-like coded reasons or multi-select likes/dislikes;
11. strategic subgroup variable(s);
12. demographics;
13. optional price/premium acceptance measure if it can be represented without turning SBT-002 into a pricing study.

## Latent truth to encode

The synthetic generator should create a known hierarchy rather than independently assigning target percentages.

### Major truths

1. **A has the strongest broad conversion potential.** Its total-sample top-2-box purchase intent and appeal are meaningfully above C and modestly above B.
2. **B has a differentiated proposition.** It leads on uniqueness and at least one premium/value diagnostic, but this does not automatically make it the best total-sample concept.
3. **B has genuine subgroup heterogeneity.** A strategically important subgroup responds materially better to B than the rest of the sample, creating a real target-versus-total trade-off.
4. **C is not a hidden winner.** It should generate plausible top-line results but lacks a compelling multi-measure case.
5. **Diagnostics explain, but do not become causal drivers by default.** Correlation between appeal/purchase intent and diagnostics should tempt models to use causal language that is not warranted by the design.

### Secondary truths

- A's familiarity/ease advantage partly explains its broad acceptance descriptively;
- B's polarisation should be visible in the full ordinal distribution, not just means/top-2-box;
- at least one subgroup difference should disappear or materially shrink after correct comparison/uncertainty treatment;
- weighting should alter at least one estimate enough to catch unweighted shortcutting without reversing the whole study.

## Intentional trap matrix

SBT-002 should explicitly encode and score the following traps.

### T1 — statistically significant but commercially trivial

Create a large enough base for a very small concept difference to be statistically detectable. Correct behaviour: recognise significance but do not elevate it above materially larger findings.

### T2 — multiple comparisons

Provide enough concepts × metrics × subgroups that naive pairwise scanning will generate false-positive-looking results. Freeze an approved comparison family/correction policy or explicitly label exploratory comparisons.

### T3 — subgroup fishing

Include several demographic cuts where one noisy subgroup appears dramatic because of chance/small base. Only the pre-specified strategic subgroup should have a strong latent interaction.

### T4 — top-2-box versus full distribution

Make B polarising: its top-2-box can look competitive while its full distribution contains more extreme negative responses. A model should not infer identical consumer response from one summary statistic.

### T5 — mean versus ordinal interpretation

Allow means for convenience if conventional, but preserve the ordinal response distribution and avoid treating tiny mean differences as intrinsically meaningful.

### T6 — weighting

Include a modest sample imbalance correlated with concept response. Weighted and unweighted conclusions should differ enough to test correct use of the study weight.

### T7 — diagnostic causality

Diagnostics correlate with appeal/purchase intent, but the study does not manipulate diagnostics independently. Statements such as `uniqueness drives purchase intent` should require a separate driver model/assumption and must not arise from simple correlation.

### T8 — randomisation versus observational subgroup

Concept assignment is randomised; subgroup membership is not. Concept-cell comparisons support experimental interpretation within the study design, while subgroup differences should not be described as caused by subgroup membership.

### T9 — base/routing mismatch

At least one diagnostic or follow-up should be routed to a subset (for example respondents who understand the concept or give a valid response), making its denominator incompatible with unconditional purchase intent unless explicitly handled.

### T10 — seductive C finding

Give C one striking but strategically weak result — e.g. a small niche subgroup or single diagnostic — that should not overturn the total evidence hierarchy.

## Reference analysis families

Before model evaluation, freeze deterministic objects for:

- weighted concept-level distributions for all core ordinal measures;
- top-2-box / bottom-2-box where substantively appropriate;
- means only where explicitly permitted;
- pairwise concept differences with confidence intervals/p-values;
- approved multiple-comparison treatment;
- strategic subgroup × concept interaction/comparison;
- weighted versus unweighted audit outputs;
- routed diagnostic universes and bases;
- likes/dislikes or coded-reason incidence;
- effect-size/commercial-materiality fields separate from significance.

## Reference finding inventory

Unlike early SBT-001 work, SBT-002 should have a frozen reference inventory **before** model scoring.

Each reference finding receives:

- `finding_id`;
- structured proposition;
- evidence IDs;
- importance tier: `mandatory`, `secondary`, `context`, `do_not_elevate`;
- claim-strength boundary;
- qualification;
- competing/counter evidence;
- analytical relationship;
- known seductive alternative interpretation.

This enables precision/recall-style evaluation of finding selection.

## Evaluation questions

SBT-002 should answer:

1. Does the system identify A's broad strength without reducing the study to a single purchase-intent ranking?
2. Does it identify B's differentiation and real strategic-subgroup opportunity without incorrectly declaring a universal winner?
3. Does it use the full response distribution when polarisation matters?
4. Does it distinguish statistical significance from commercial importance?
5. Does it resist subgroup fishing and multiple-comparison noise?
6. Does it preserve routed universes and weighting?
7. Does it avoid causal `driver` claims from diagnostic correlation alone?
8. Does it omit C's seductive but weak evidence from the primary narrative?
9. Does its selected finding set cover all mandatory reference findings with low unsupported/redundant output?
10. Can it compose the findings into a concise, evidence-traceable concept-development narrative?

## Scoring

Score independently:

- analysis correctness;
- universe/weight/routing correctness;
- statistical inference correctness;
- finding correctness;
- mandatory-finding recall;
- selected-finding precision;
- prioritisation/ranking quality;
- redundancy;
- qualification/causal restraint;
- synthesis/story coherence;
- provenance completeness.

No presentation score.

## Implementation sequence

1. Freeze fictional category, brief and questionnaire.
2. Write study manifest/schema and routing/codebook.
3. Implement latent data-generating process with fixed seed(s).
4. Generate respondent dataset.
5. Run structural/data-quality validation.
6. Implement deterministic analysis library/reference outputs.
7. Freeze trap truth table.
8. Author reference evidence objects.
9. Author mandatory/secondary/do-not-elevate finding inventory.
10. Freeze scoring contract.
11. Run baseline model(s).
12. Diagnose failures by stage rather than changing ground truth to fit outputs.
13. Compare one-call versus staged research-reasoning architectures once the baseline is stable.

## Acceptance before first model run

Do not evaluate a model until the following are immutable for the evaluation version:

- questionnaire and codebook;
- data-generating process/seed;
- dataset;
- trap truth table;
- deterministic analysis outputs;
- evidence inventory;
- reference finding inventory;
- scoring rules.

This prevents benchmark leakage and post-hoc redefinition of what counts as a good answer.
