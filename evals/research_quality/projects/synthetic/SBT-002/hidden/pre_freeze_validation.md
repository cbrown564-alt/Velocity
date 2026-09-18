# SBT-002 pre-freeze DGP validation

## Status: FAIL — tune before dataset freeze

The v0.1 generator was executed independently against its pre-declared truth/trap contract before any model exposure. The major concept hierarchy is good, but three deliberately specified traps are not sufficiently realised. Therefore the generated respondent data must **not** be frozen yet.

## Realised core top-2-box estimates (weighted)

| Measure | Flex | Plus | Simple |
|---|---:|---:|---:|
| Appeal | 60.7% | 56.5% | 41.2% |
| Purchase intent | 53.3% | 51.9% | 40.5% |
| Uniqueness | 48.1% | 83.2% | 34.1% |
| Relevance | 63.1% | 50.0% | 41.1% |
| Credibility | 61.9% | 42.4% | 57.5% |
| Value | 56.4% | 59.2% | 44.3% |
| Understanding | 75.8% | 32.8% | 71.9% |
| Routed premium value | 50.7% | 81.7% | 40.5% |

## Strategic subgroup

Purchase intent top-2-box:

- food explorers: Flex 52.7%, Plus 69.5%, Simple 44.0%;
- non-explorers: Flex 53.5%, Plus 45.2%, Simple 39.2%.

This strongly realises the intended Plus interaction and target-versus-total trade-off.

## Routing

The understanding-qualified premium-value route differs materially by concept:

- Flex: ~94.3% eligible;
- Plus: ~68.6%;
- Simple: ~93.1%.

T9 is therefore strongly realised.

## Trap audit

### Pass

- A broad total-sample development case: PASS.
- B differentiation/uniqueness: PASS.
- B strategic food-explorer opportunity: PASS.
- C credible/understandable but weaker primary case: PASS.
- routed denominator mismatch: PASS.
- diagnostic-causality boundary: structural PASS by DGP design.
- randomisation/subgroup causal boundary: structural PASS.
- multiplicity/subgroup-fishing surface: structural PASS, subject to final realised-noise audit.

### Fail / needs tuning

#### T1 statistically significant but commercially trivial

The current candidate sub-5pp differences are not statistically significant at the realised cell sizes. Examples include Flex–Plus appeal (~4.2pp), Flex–Simple credibility (~4.4pp), Flex–Simple understanding (~3.9pp), and Flex–Plus value (~2.8pp). T1 therefore FAILS its explicit intended mechanism.

**Required tuning:** create a pre-specified sub-5pp difference on a relatively high-prevalence/low-variance diagnostic so it survives the frozen inference rule while remaining below the 5pp materiality threshold. Do not increase the overall sample merely to force this trap.

#### T4 Plus polarisation

On appeal, Plus currently has a similar bottom-2-box rate to Flex (~16.6% vs ~16.5%), so the intended `more 5s and more 1–2s` distributional pattern is not realised strongly enough.

**Required tuning:** increase Plus-specific response variance/polarisation while preserving its overall total-sample purchase profile and strong explorer interaction.

#### T6 weighting effect

Plus purchase intent moves from roughly 53.4% unweighted to 51.9% weighted (~1.5pp), short of the pre-declared ~2pp-or-more target.

**Required tuning:** modestly strengthen the calibration downweighting of younger/food-explorer respondents while checking that the major concept hierarchy is unchanged.

## Benchmark discipline

These are legitimate pre-freeze changes because they are evaluated against constraints declared before any model run. Tuning must be limited to making the pre-declared synthetic mechanisms observable; it must not redefine the target findings after seeing model behaviour.

After tuning, rerun the complete truth/trap audit. Only a passing generator may produce the immutable SBT-002 evaluation dataset.
