# SBT-001 Turn 2 — Implementation Checklist

Turn 1 freezes the semantic contract. Turn 2 implements and calibrates it.

## Required implementation

- `scripts/python/synthetic_tracker/` generator package.
- deterministic named RNG streams.
- correlated latent respondent factors.
- demographic/profile population model.
- five brand latent positions and utilities.
- awareness/familiarity/consideration/preference/current-provider generation.
- brand-image grid with familiar-brand routing.
- customer-experience routing.
- marketing/campaign module.
- wave event module.
- recruitment/sample-composition module.
- post-stratification weight generation and diagnostics.
- CSV output; deterministic SAV conversion if supported by the repository environment.
- questionnaire/codebook metadata emission.
- reference processing recipe.
- hidden event/trap truth.
- validation report.

## Calibration procedure

1. Fill numerical parameters in `generator_config.template.json` without changing the qualitative SBT-001 contract.
2. Validate latent correlation matrix is positive definite.
3. Simulate candidate population/sample with root seed child stream.
4. Compute weighted and unweighted reference metrics.
5. Evaluate structural/distribution/storyline gates.
6. If required storyline gates fail, try the next bounded child seed and record the rejection reason.
7. Stop after the first seed satisfying all hard gates; do not optimise for prettiest effect sizes.
8. Freeze selected config as `generator_config.json` and record hashes/validation output.

## Initial target bands to calibrate

These are starting targets, not yet frozen statistical gold:

- Northstar W1 prompted awareness roughly 80–95%.
- Pulse W1 prompted awareness roughly 45–70%.
- Harbour W1 prompted awareness roughly 65–85%.
- No tracked brand below ~15% awareness.
- Pulse W2→W3 weighted consideration increase around 3–7pp overall, larger among 18–34.
- Pulse W2→W3 unweighted increase at least ~1.5pp larger than weighted increase due to sample composition.
- Northstar current-customer NPS/satisfaction materially worse W4 than W3.
- Northstar W3→W4 total awareness movement practically small (candidate <2pp absolute).
- Harbour 18–34 consideration W1→W5 decline around 5–10pp.
- Core routed analyses retain adequate unweighted bases; low-base trap deliberately falls below the future reporting threshold.
- Kish/design-effect diagnostics remain plausible after weighting; avoid extreme weights.

## Turn 2 deliverable definition

Turn 2 is complete only when:

- all five raw waves exist;
- codebook/questionnaire and raw files agree;
- weights and routing validate;
- hidden events/traps are empirically verified;
- a machine-readable validation report marks every hard gate pass/fail;
- rerunning with the frozen config reproduces identical outputs;
- no analysis/deck gold has been manually written to force the storyline.

If SAV generation cannot be made deterministic/reliable in the available environment, Turn 2 should document the blocker and keep CSV as canonical. Do not compromise the generator or hand-edit a SAV file.
