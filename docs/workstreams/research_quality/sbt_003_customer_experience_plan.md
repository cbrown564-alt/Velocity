# SBT-003 — Customer experience benchmark plan

## Why this study

SBT-003 tests a different research archetype from tracker and concept testing: customer-experience diagnosis. It introduces NPS composition, service incidents, satisfaction, retention intent, correlated diagnostics, customer subgroups and the distinction between predictive/associational drivers and causal claims.

## Scenario

A fictional UK subscription broadband provider, **Northline**, wants to understand a recent deterioration in customer advocacy and identify where intervention should focus. The study is cross-sectional with recalled recent service experience plus administrative-style respondent attributes generated synthetically.

## Proposed sample/design

Approximately 2,400 current customers. Weight to the active customer profile by tenure, plan tier and region. Include adequate overall bases but deliberately small bases in selected service-contact subgroups.

## Measures

- NPS 0–10 and promoter/passive/detractor composition;
- overall satisfaction 1–5;
- renewal/retention intent 1–5;
- perceived reliability, value, support quality, ease, trust;
- recent outage incidence and severity;
- recent support contact, channel and resolution;
- complaint incidence;
- tenure, plan tier, household/context variables;
- optional open-ended/coded reasons.

## Latent truths to freeze

1. Recent unresolved service problems are strongly associated with worse NPS and retention intent.
2. A specific operational subgroup has genuinely poor experience, but its small population share means it does not explain the entire company-level NPS problem.
3. Reliability and support-resolution measures correlate strongly with advocacy; simple cross-sectional regression/correlation must not be described as proving causal drivers.
4. Long-tenure customers have lower NPS partly because they are more exposed to legacy-plan/service conditions; tenure itself should not be treated as the causal mechanism.
5. One high-value/small-base subgroup has dramatic scores that should be qualified rather than elevated.
6. Weighting materially changes at least one company-level estimate without reversing the core story.

## Trap matrix

- **CX1 NPS-only:** treating the net score as sufficient and ignoring promoter/passive/detractor composition.
- **CX2 driver causality:** calling correlated diagnostics causal drivers.
- **CX3 incident denominator:** comparing support-resolution among contacted customers with all-customer outcomes as though universes match.
- **CX4 small-base drama:** elevating a tiny high-value/service subgroup.
- **CX5 population contribution:** assuming the worst-scoring subgroup explains most aggregate deterioration despite small prevalence.
- **CX6 tenure confounding:** interpreting tenure association as causal.
- **CX7 weighting:** relying on unweighted company estimates.
- **CX8 derived net:** computing/rounding NPS incorrectly or inconsistently.
- **CX9 multiple diagnostics:** cherry-picking one of several correlated service measures.
- **CX10 retention overreach:** treating stated renewal intent as observed churn.

## Reference finding structure

Before model exposure freeze mandatory findings around: overall advocacy/retention problem; service-problem association; operational subgroup severity versus population contribution; diagnostic causal boundary. Secondary/context findings cover tenure/profile, weighting, NPS composition and routed support-contact measures. Small-base and isolated diagnostic findings populate do-not-elevate tiers.

## Implementation order

1. Freeze fictional business brief/questionnaire.
2. Freeze DGP/trap truth.
3. Implement deterministic NPS/composition, CX, incident, subgroup and weighting analyses.
4. Generate and validate data.
5. Freeze evidence and finding inventory.
6. Run the same E1–E5 architecture experiments used for SBT-002.
7. Compare failure patterns across tracker, concept-test and CX archetypes.

Presentation remains out of scope.
