# Pre-presentation research benchmark roadmap

## Current conclusion

Velocity has positive evidence for the research-reasoning pipeline through a structured, presentation-neutral story specification. It does **not** yet have evidence for high-quality autonomous presentation production. Presentation generation is therefore backburnered and treated as an unresolved downstream renderer.

The active research question is now:

> Given an unfamiliar synthetic research study, can Velocity reliably identify the important, defensible findings, reject seductive but invalid ones, and produce a complete, prioritised, evidence-traceable research narrative?

## What SBT-001 has established

### Strongly established

1. **Controlled synthetic research worlds can be generated.** SBT-001 contains intentional phenomena, realistic survey structure and known analytical truth rather than merely plausible random rows.
2. **Deterministic reference analysis is viable.** Weighted/unweighted estimates, routing, universes, waves, segments, customer-only measures and derived measures can be represented and checked independently of model output.
3. **Evaluation can distinguish arithmetic correctness from research correctness.** Wrong universes, incompatible denominators, routed measures, low bases, causal overclaiming and misleading marginal comparisons are detectable failure modes.
4. **Strong models can recover the major SBT-001 story.** They can identify Pulse momentum, Northstar customer deterioration/recovery and Harbour younger-audience weakness while declining to elevate seductive low-base Mosaic evidence.
5. **Finding quality can be separated from numerical correctness.** Importance, evidence strength, redundancy, restraint, qualification and narrative role are useful independent dimensions.
6. **Findings can be composed into a coherent presentation-neutral story.** Analytical relationships such as trend/inflection, position-versus-momentum, subgroup change, divergence and recovery-versus-reference can be specified before rendering.

### Promising but not yet broadly established

- finding prioritisation;
- narrative synthesis;
- visual-argument/analytical-relationship selection;
- omission of technically true but strategically weak findings;
- consistency across repeated runs/models.

### Not established

- generalisation beyond the brand-tracker archetype;
- completeness/recall of important findings;
- robustness across model families and repeated runs;
- agreement with experienced human researchers on editorial importance;
- transfer to real research datasets;
- high-quality autonomous presentation production.

## Canonical active pipeline

```text
synthetic study specification
        ↓
synthetic respondent/data generation
        ↓
data + study validation
        ↓
questionnaire/codebook/processing semantics
        ↓
deterministic analysis/reference layer
        ↓
evidence objects / provenance
        ↓
candidate finding inventory
        ↓
finding verification
        ↓
importance / prioritisation / redundancy control
        ↓
analytical relationship specification
        ↓
structured research narrative / storyboard
        ↓
PRESENTATION BOUNDARY
        ↓
unresolved downstream renderer
```

Each active stage must be independently evaluable. Slide quality must not contaminate the score of upstream research reasoning.

## Required contracts

### Study contract

Defines research objective, questionnaire, variables, routing, universes, weights, waves/groups, synthetic latent phenomena and intentional traps.

### Analysis contract

For every permitted analysis object:

- stable analysis ID;
- source variables;
- statistic/estimator;
- universe/denominator;
- weighting;
- wave/group/segment;
- bases and effective bases where relevant;
- uncertainty/significance method where relevant;
- deterministic expected value or derivation;
- comparability constraints.

### Evidence contract

Every evidence object should bind:

- analysis ID;
- values/comparison;
- universe;
- weighting;
- bases;
- uncertainty/significance;
- source variables;
- permitted interpretation;
- known unsupported extensions.

### Finding contract

Every candidate/final finding should bind:

- claim text or structured proposition;
- supporting evidence IDs;
- contextual/counter evidence IDs;
- claim strength;
- qualification;
- importance class;
- validity state;
- redundancy/topic cluster;
- analytical relationship;
- reason for inclusion or omission.

### Story contract

The final presentation-neutral narrative should specify:

- ordered story beats;
- finding IDs per beat;
- narrative role;
- analytical relationship;
- supporting/context evidence;
- headline intent;
- required qualification;
- management/research question where appropriate;
- no renderer-specific geometry as a correctness requirement.

## Evaluation dimensions

### Analysis correctness

- numeric correctness;
- correct universe/denominator;
- correct weighting;
- routing/missingness correctness;
- valid comparison;
- uncertainty/significance correctness.

### Finding correctness

- evidence support;
- claim/evidence consistency;
- qualification;
- no causal or longitudinal overreach;
- no low-base/suppressed evidence misuse.

### Finding completeness

Create a reference inventory of reportable findings with importance tiers. Evaluate:

- recall of major findings;
- precision of selected findings;
- unsupported finding rate;
- omission of mandatory findings;
- redundancy-adjusted coverage.

### Prioritisation

Evaluate whether major findings outrank medium findings and technically true distractions. Include deliberately seductive false leads and commercially trivial significance.

### Synthesis/story

- combines related evidence rather than listing it;
- preserves counter-evidence;
- avoids redundant story beats;
- selects an appropriate analytical relationship;
- produces a coherent ordering;
- ends at a renderer-independent specification.

## Cross-model robustness

For mature studies run repeated evaluations across model tiers/families. Measure:

- core-finding selection stability;
- unsupported finding variance;
- importance-order agreement;
- story-structure agreement;
- benefit/cost of staged analyst → verifier → prioritiser → editor architectures versus one-call research reasoning.

## Human validation

Once several synthetic archetypes are stable, ask experienced researchers independently to identify:

- mandatory findings;
- reportable secondary findings;
- findings to suppress/omit;
- top management implications/questions;
- acceptable versus overstated claims.

Compare deterministic correctness and human editorial consensus separately.

## External validation

Only after synthetic coverage is mature, evaluate selected real survey datasets/reports. Published reports are comparison evidence, not absolute ground truth. The purpose is transfer testing: does synthetic-benchmark performance predict useful behaviour on real research?

## Presentation boundary

Preserve prior PowerPoint/native-chart experiments as downstream research. Do not spend the current workstream on slide styling, chart templates or rendering. A future renderer should consume the structured story/evidence contracts without rerunning research reasoning.

## Study expansion strategy

Choose new studies for **orthogonality**, not volume. Each should expose research problems SBT-001 does not sufficiently test.

Proposed sequence:

1. **SBT-002 — concept/product test**: monadic concept cells, purchase intent, appeal/uniqueness, diagnostics, significance, subgroup heterogeneity, multiple-comparison traps and commercially trivial significant effects.
2. **SBT-003 — customer experience**: NPS composition, satisfaction, service incidents, driver/correlation traps, customer subgroups and low bases.
3. **SBT-004 — attitudinal/U&A study**: Likert batteries, multi-response questions, derived need states, segmentation-like profiles and correlated findings.
4. **SBT-005 — campaign evaluation**: exposed/unexposed groups, pre/post or matched structure, awareness/consideration outcomes, selection/confounding traps and causal-claim boundaries.

Pricing/choice and full segmentation can follow once these contracts are stable because they introduce additional modelling/evaluation complexity.

## Immediate milestone

Build SBT-002 end-to-end only through the presentation boundary. Before model evaluation, freeze:

1. study brief and questionnaire;
2. synthetic data-generating process and latent truth;
3. intentional trap matrix;
4. deterministic validation/reference analysis;
5. reference evidence objects;
6. reference finding inventory with importance tiers;
7. scoring contract for analysis, finding correctness, completeness, prioritisation and synthesis.

Then evaluate models without changing ground truth in response to their outputs.

## TypeSafe Jev control plane

For verifier, prioritiser, and raw-data cleaning triage, Velocity uses TypeSafe Jev as a calibrated decision layer (not a prose researcher). Spec: [`jev_control_plane.md`](jev_control_plane.md). Packs live under `evals/research_quality/jev/`.

