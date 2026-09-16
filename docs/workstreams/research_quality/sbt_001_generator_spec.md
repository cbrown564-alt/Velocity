# SBT-001 — Synthetic UK Mobile Brand Tracker

**Status:** Frozen design candidate for Turn 2 implementation  
**Project ID:** `SBT-001`  
**Generator family:** `synthetic_brand_tracker_v1`  
**Category:** UK consumer mobile networks (fictional brands)  
**Purpose:** First end-to-end synthetic project for Velocity E1–E8 evaluation and later development/training examples.  

## 1. Design goals

SBT-001 must be realistic enough to exercise researcher judgement, not merely statistical plumbing. It therefore models a latent consumer/brand world first and emits survey answers second.

The generator must provide six distinct forms of truth:

1. **World truth** — latent respondent preferences, brand positions and exogenous events.
2. **Measurement truth** — what each question/variable is intended to measure.
3. **Processing truth** — routing, missing codes, grids, multi-response sets, weights, recodes and derived variables.
4. **Population truth** — population-level quantities before sampling.
5. **Sample/statistical truth** — realised estimates, bases, uncertainty and reference tests.
6. **Research truth** — planted material developments, deliberate traps and expected editorial relevance conditional on a brief.

No downstream gold finding may be asserted solely because an event was intended. Turn 2 validation must confirm the realised sample supports the intended measurement/statistical claim.

## 2. Study frame

- Geography: United Kingdom.
- Target population: adults 18+ responsible for or involved in choosing their personal mobile service.
- Design: repeated cross-sectional online tracker; respondents do not intentionally persist across waves.
- Waves: 5 initial waves, with Wave 6 reserved for the later update benchmark.
- Nominal achieved sample: 2,000 completes per wave.
- Population model: synthetic finite/super-population distribution; not intended to reproduce official UK population estimates exactly.
- Weight: one analysis weight correcting deliberate sample-composition deviations on age × gender × region, with bounded trimming.

## 3. Fictional brands

| Brand | Strategic role | Initial latent position |
|---|---|---|
| Northstar | Market leader | Very high awareness, strong reliability/trust, broad usage, moderate value perception |
| Pulse | Growth challenger | Younger/tech-oriented, innovative, initially lower awareness, improving consideration |
| Mosaic | Mid-market | Balanced, good value/service, limited differentiation |
| Lumen | Premium niche | Quality/premium/innovation, stronger among affluent and tech-oriented consumers |
| Harbour | Declining incumbent | Large older installed base, high awareness, weakening acquisition and relevance |

Brand names are fictional and must not be calibrated to represent named real operators.

## 4. Respondent latent state

Generate correlated latent respondent factors before survey responses. Continuous factors use approximately standard-normal marginals with a positive-definite correlation matrix defined in generator config.

### Core latent factors

- `price_sensitivity`
- `quality_orientation`
- `tech_affinity`
- `service_sensitivity`
- `brand_loyalty`
- `ad_receptivity`
- `switching_propensity`

### Structural respondent variables

- age band: 18–24, 25–34, 35–44, 45–54, 55–64, 65+
- gender: man, woman, non-binary/another identity, prefer not to say
- nation/region: London, South East, South West, East, Midlands, North, Wales, Scotland, Northern Ireland
- urbanicity: urban/suburban/rural
- household income band
- employment status
- contract type: SIM-only / handset contract / PAYG / other
- tenure with provider
- decision involvement

Structural variables influence latent factors. Example: younger respondents have higher expected tech affinity and switching propensity; higher-income respondents have somewhat lower price sensitivity and higher quality orientation. These are simulation mechanics, not claims about real UK consumers.

## 5. Brand utility model

For respondent `i`, brand `b`, wave `w`, define latent brand utility:

`U[i,b,w] = intercept[b,w] + respondent_factor_loadings[b]·z[i] + brand_image_fit[i,b,w] + incumbent_bonus[i,b] + campaign_effect[i,b,w] + service_event_effect[i,b,w] + epsilon`

Use separate but correlated latent scores for:

- awareness propensity;
- familiarity;
- consideration utility;
- current-provider choice;
- preference;
- image-attribute endorsement;
- satisfaction/recommendation among current users.

The implementation must avoid deterministic funnels. Awareness strongly gates familiarity/consideration, but realistic inconsistencies/noise are permitted where survey respondents plausibly produce them.

## 6. Questionnaire contract

### S — Screener / respondent profile

- `S1_age`
- `S2_gender`
- `S3_region`
- `S4_employment`
- `S5_income`
- `S6_decision_role`
- `S7_contract_type`
- `S8_current_provider`
- `S9_provider_tenure`

Eligibility: `S6_decision_role` must indicate sole/shared involvement. Ineligible generated panel members exist in population simulation but are not survey completes.

### A — Brand awareness

- `A1_spontaneous_awareness` — multi-response, open-coded to brands + other.
- `A2_prompted_awareness_[brand]` — yes/no grid for all brands.

### F — Funnel

Asked for prompted-aware brands unless specified:

- `F1_familiarity_[brand]` — 1–5 familiarity.
- `F2_consideration_[brand]` — would seriously consider, yes/no.
- `F3_preference` — single preferred brand among aware brands.

Current usage comes from `S8_current_provider`; do not derive it from preference.

### I — Brand image battery

For sufficiently familiar brands (`F1 >= 3`):

- reliable network
- good value
- innovative
- trustworthy
- good customer service
- premium
- environmentally responsible
- for people like me

Represent raw export as a repeated brand × attribute grid. Response: applies / does not apply / don't know.

### E — Current-customer experience

Asked only about current provider:

- overall satisfaction 0–10
- likelihood to recommend 0–10
- experienced service/network problem in past 3 months
- contacted customer service in past 3 months
- satisfaction with customer service if contacted

### M — Marketing

- unprompted recent mobile advertising recall — multi-response/open-code
- prompted advertising awareness by brand
- Pulse campaign recognition from Wave 3 onward
- channels recalled for recognised campaign — multi-response

### O — Open end

- reason for preferred provider (synthetic text optional in v1; categorical latent reason is mandatory and text rendering can be added later).

## 7. Missingness and routing

The raw survey must distinguish:

- structural not-asked;
- respondent don't know;
- respondent prefer-not-to-answer/refused where appropriate;
- system missing caused by export representation.

Recommended raw codes:

- `97` = not applicable / structurally not asked where numeric export requires a code;
- `98` = don't know;
- `99` = prefer not to say/refused;
- actual system NULL for selected export cases.

The codebook and processing truth must specify which values are user-missing by variable. The generator must not globally treat 97/98/99 identically.

## 8. Weighting design

Define stable population targets for age × gender × broad region. Deliberately perturb recruitment probabilities by wave so unweighted composition changes.

Weight construction truth:

1. known target cells;
2. inverse realised sample share relative to target;
3. iterative calibration/raking or direct post-stratification in v1 depending on sparsity;
4. trim to configured bounds (initial candidate `0.35–3.0`);
5. rescale mean weight to 1.

Export both `wt_final` and hidden pre-trim/calibration diagnostics. The analysis-ready reference uses `wt_final`.

At least one planted trap must rely on unweighted/weighted divergence.

## 9. Wave storyline

### Wave 1 — baseline

Establish category structure. Northstar leads awareness/usage; Harbour retains older installed base; Pulse is smaller but stronger among younger/high-tech-affinity respondents; Lumen is premium niche; Mosaic is balanced.

### Wave 2 — natural evolution

Small background movements only. Harbour begins a gradual decline in younger consideration. Pulse improves slightly without a major campaign. This wave establishes that not every movement deserves a story.

### Wave 3 — Pulse campaign + sample composition trap

Exogenous event `pulse_campaign_launch`:

- strong increase in Pulse prompted ad awareness;
- increase in spontaneous/prompted brand awareness;
- stronger innovation image;
- consideration improvement concentrated among 18–34/high-tech-affinity respondents;
- modest preference/usage lag because behavioural conversion is slower.

Sampling perturbation deliberately over-represents younger respondents. Therefore Pulse's **unweighted** overall change is larger than the weighted change.

Research truth: campaign momentum is real, but a naive unweighted narrative overstates its magnitude.

### Wave 4 — Northstar service incident

Exogenous event `northstar_service_incident` affecting current Northstar customers:

- increased reported recent problems;
- lower reliability image among customers/familiar consumers;
- lower satisfaction and NPS;
- limited immediate effect on total awareness;
- modest/lagged consideration effect among non-customers.

Research truth: category leadership masks a customer-experience vulnerability. Mechanical awareness-first reporting should under-prioritise this.

Pulse campaign recognition decays but part of awareness/consideration uplift persists.

### Wave 5 — recovery, plateau and long-run Harbour decline

- Northstar operational experience partially recovers; satisfaction improves but does not necessarily fully return to W3.
- Pulse campaign effects plateau; avoid claiming continued acceleration when metrics are flat.
- Harbour's multi-wave decline among younger consumers becomes clearly material despite no single spectacular one-wave change.
- Mosaic receives a deliberate low-base subgroup fluctuation that should not be headlined.

## 10. Planted traps

Every trap receives a hidden ID and expected failure modes.

### `TRAP_WEIGHT_01` — compositional Pulse surge

Wave 3 unweighted Pulse consideration shows a larger increase than weighted analysis. Correct reporting uses the approved weight and may mention composition only if relevant.

### `TRAP_LOWBASE_01` — Mosaic subgroup spike

Create a ~5–8 point apparent jump in a small subgroup with low unweighted base and unstable uncertainty. It must be discoverable but editorially demoted/flagged.

### `TRAP_MULTICOMP_01` — attribute battery noise

Provide enough brand × attribute × subgroup comparisons that nominal p<.05 false positives occur. Reference analysis must distinguish planned comparisons and/or correction policy from exploratory noise.

### `TRAP_NONSIG_STABLE_01`

Create a moderate movement with wide uncertainty such that the test is non-significant. Gold language is 'no clear evidence of change' rather than an automatic 'stable'.

### `TRAP_ROUTING_01`

Customer-service satisfaction is asked only of customers who contacted service. A naive denominator using all customers must be wrong.

### `TRAP_GRIDBASE_01`

Brand-image items are asked only for sufficiently familiar respondents. Gold analysis preserves the familiar-brand base rather than total sample.

### `TRAP_FUNNEL_01`

Do not infer current usage from consideration/preference. Some incumbent users prefer a competitor and some preferred brands are not current providers.

### `TRAP_TREND_01`

Harbour's strategically meaningful decline is gradual. Systems focusing only on adjacent-wave significance should under-detect it.

## 11. Research briefs for later turns

Turn 2 need not generate gold decks, but the world must support at least these future briefs:

### `BRIEF_PULSE_CMO`

Assess whether Pulse's Wave 3 campaign materially changed competitive position, especially among younger consumers, without overstating early conversion.

### `BRIEF_NORTHSTAR_CX`

Identify emerging customer-experience risks and whether they threaten wider brand health.

### `BRIEF_CATEGORY_BOARD`

Provide an executive category readout prioritising the most decision-relevant changes across all five brands.

The same realised dataset must support different good story hierarchies depending on brief.

## 12. Generator outputs

Turn 2 implementation should produce:

```text
evals/research_quality/projects/synthetic/SBT-001/
  manifest.json
  questionnaire.md
  codebook.json
  research_briefs/
    pulse_cmo.md
    northstar_cx.md
    category_board.md
  raw/
    wave_01.csv
    ...
    wave_05.csv
  reference/
    variable_semantics.json
    weighting_targets.json
    processing_recipe.json
    population_summary.json
  hidden/
    generator_config.json
    generation_truth.json
    planted_events.json
    traps.json
    validation_report.json
```

SAV export is desirable for product realism. CSV is the canonical generator output; SAV should be generated deterministically from the same data and metadata rather than becoming a second source of truth.

## 13. Reproducibility

- Root seed is explicit in `generator_config.json`.
- Use named child RNG streams for population, sampling, measurement noise, events and text so changes in one component do not silently perturb all outputs.
- Generator version is recorded in every manifest.
- Hidden truth files are immutable for a frozen project version.
- A regenerated project with the same generator version/config/seed must match content hashes.

## 14. Validation gates for Turn 2

The generator is not accepted merely because files are produced.

### Structural gates

- exactly configured achieved completes per wave;
- unique respondent IDs within/across repeated cross-sectional waves;
- all questionnaire variables represented in codebook;
- routing invariants hold;
- multi-response/grid structures match metadata;
- missing codes occur only where permitted;
- weights finite, positive and within configured trim bounds.

### Distribution gates

- no accidental near-deterministic demographic/brand relationships;
- brand shares/awareness remain plausible and non-degenerate;
- sufficient bases exist for core analyses;
- effective sample size remains reasonable after weighting.

### Storyline gates

Use pre-specified tolerance bands rather than exact target values. Initial candidates:

- Pulse W2→W3 weighted consideration: positive and materially smaller than its unweighted movement;
- Pulse W3 campaign recognition strongest among intended target segment;
- Northstar W3→W4 customer NPS/satisfaction decline is detectable and concentrated among current customers;
- Northstar total awareness remains broadly unchanged within a narrow practical band during service incident;
- Harbour younger-consumer consideration W1→W5 declines materially;
- Pulse W4→W5 does not falsely appear to continue accelerating;
- Mosaic low-base trap remains low-base and unstable.

If a sampled seed fails a required storyline gate, Turn 2 may search a bounded sequence of child seeds. The selected seed and rejected-seed reasons must be recorded to avoid hidden cherry-picking.

### Statistical gates

- weighted reference estimates recompute exactly from exported data within numeric tolerance;
- denominators match routing/familiarity rules;
- trap conditions are verified rather than assumed;
- all future hidden findings can point to executable reference analyses.

## 15. Difficulty taxonomy

SBT-001 is `intermediate` overall but contains task-level difficulty labels:

- **basic:** identify demographics, weight, straightforward awareness/funnel;
- **intermediate:** grids, routed bases, campaign segment story, weighted trends;
- **hard:** cross-wave editorial prioritisation, gradual Harbour trend, customer-vs-market distinction;
- **adversarial:** unweighted composition trap, low-base spike, multiple-comparison noise, non-significance/stability wording.

Future project families should vary mechanisms, not just coefficients.

## 16. What remains deliberately unfrozen until Turn 2

The design fixes semantics and qualitative event direction, but the following should be calibrated empirically during implementation:

- exact latent correlation matrix;
- exact brand-factor loadings;
- exact population demographic shares;
- exact initial brand shares/awareness levels;
- event coefficient magnitudes;
- measurement-noise parameters;
- weight trim bounds if the initial range produces poor ESS;
- exact significance/equivalence thresholds used by later E4 graders.

Those numerical choices must be written into `generator_config.json` and validated against this contract before SBT-001 v1 is frozen.
