# Pre-presentation research benchmark roadmap

## Current conclusion — 22 September 2026

The [September pilot](../../../evals/research_quality/runs/2026-09-pilot-comparison/readout.md) has ten completed outputs across frozen SBT-002/003 and a documented real published-table case. It supports improving finding completeness before training: both raw workflows computed full distributions but omitted polarisation from the final narrative. Five repeated approved-analysis runs fully recovered mandatory findings four times. A single staged analysis run recovered all of them; one pair cannot establish a staging advantage.

SBT-001 generation/preparation/reference corrections are merged in PR 76. Earlier positive story and presentation experiments remain historical evidence, not validation of corrected data. SBT-002/003 now pass realised-data and independent numerical checks; intended traps that did not occur are described as structural opportunities, not realised successes.

Independent researcher assessments and correction burden are pending. The user's blinded review pack contains ten anonymous outputs. An offline review-to-native-chart prototype exercises provenance and renewed approval after evidence changes. It is not an integrated product feature or publication-quality presentation claim.

Still unestablished: researcher agreement on mandatory findings, reduced review burden, multiple-model robustness, unseen-project generalisation, raw real-survey preparation and autonomous presentation quality. The FSA case supplies bounded transfer evidence from nine published tables only.

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

Preserve prior PowerPoint/native-chart experiments as downstream research. The bounded September adapter verifies that approved evidence can feed the existing native-chart renderer without rerunning research reasoning. Broad slide styling, new templates and autonomous presentation production remain deferred.

## Study expansion strategy

Choose new studies for **orthogonality**, not volume. Each should expose research problems SBT-001 does not sufficiently test.

Proposed sequence:

1. **SBT-002 — concept/product test**: monadic concept cells, purchase intent, appeal/uniqueness, diagnostics, significance, subgroup heterogeneity, multiple-comparison traps and commercially trivial significant effects.
2. **SBT-003 — customer experience**: NPS composition, satisfaction, service incidents, driver/correlation traps, customer subgroups and low bases.
3. **SBT-004 — attitudinal/U&A study**: Likert batteries, multi-response questions, derived need states, segmentation-like profiles and correlated findings.
4. **SBT-005 — campaign evaluation**: exposed/unexposed groups, pre/post or matched structure, awareness/consideration outcomes, selection/confounding traps and causal-claim boundaries.

Pricing/choice and full segmentation can follow once these contracts are stable because they introduce additional modelling/evaluation complexity.

## Current milestone and promotion boundary

SBT-002/003 and the selected FSA tables/references were frozen before valid model exposure. The capped pilot, scorecards, exposure audits and review pack are complete. Scoring remains provisional agent adjudication until the user's reviewers return independent exports. The scorer's post-dry-pilot addition of supported novel claims is recorded; frozen data, reference tiers and scoring weights were not changed.

Next: collect independent reviews; resolve benchmark ambiguities in a new version; align inference methods and information across arms; test completeness checks on a new project; then decide whether to integrate the approved-evidence workflow into the product. The current SBT-002 adapter proves data-bound export through the existing renderer without changing production APIs or session persistence. Fine-tuning is deferred pending persistent failures that simpler changes do not resolve.

## TypeSafe Jev control plane

TypeSafe Jev is an optional proposed aid for verifier, prioritiser and raw-data cleaning decisions. Packs and offline validation exist; live use and calibration remain untested. The September pilot did not use it. Spec: [`jev_control_plane.md`](jev_control_plane.md). Packs live under `evals/research_quality/jev/`.

