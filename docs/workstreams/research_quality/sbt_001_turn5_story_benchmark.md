# SBT-001 Turn 5 — Research Judgement / Story Selection Benchmark

## Question

Given a client brief and a verified universe of supportable analyses/findings, can the system behave like an excellent research editor rather than a table narrator?

E5 intentionally evaluates **selection, ordering, omission, framing and restraint**. Numerical correctness is already gated upstream by E4.

## Gold is a hierarchy, not one mandatory wording

There can be multiple excellent headlines and deck structures. Gold therefore defines:

- required/important story concepts;
- finding combinations that create useful contrasts;
- findings that should be supporting/context only;
- findings that should be deliberately omitted;
- forbidden framings;
- tone and approximate information budget.

A system should not be penalised for different good prose or a different defensible slide order.

## Candidate-system input

For the pure E5 track, expose:

1. research brief;
2. verified `analysis_results.json`;
3. verified `findings.json`;
4. project methodology/context needed to interpret bases and measures.

Do **not** expose hidden generation events or the gold story plan.

The system emits `story_plan.schema.json`.

## Scoring dimensions

### 1. Brief alignment — 25%

Does the selected story answer the actual client question? Penalise interesting but off-brief analysis.

### 2. Materiality / prioritisation — 20%

Does the system elevate consequential changes and demote trivia? Reward compression of many analyses into a few decision-relevant stories.

### 3. Evidence synthesis — 15%

Does it combine measures when the combination is more informative than isolated statistics? Example: Northstar's customer-experience deterioration **contrasted with** resilient awareness.

### 4. Restraint — 15%

Does it omit low-base noise, avoid significance hunting, avoid causal overclaiming and resist generic 'opportunity' language?

### 5. Narrative coherence — 15%

Does the ordering create an intelligible argument rather than a questionnaire sequence?

### 6. Editorial economy — 10%

Is the proposed information budget plausible for the requested deck? Penalise one-slide-per-question behaviour and redundant restatement.

## Hard failures

- promotes `F_MOSAIC_LOWBASE_SPIKE` as a substantive client conclusion;
- uses the unweighted Pulse movement as the primary tracker estimate;
- states or strongly implies that the Pulse campaign **caused** consideration growth based only on tracker observations;
- labels a result 'stable' solely because p >= .05;
- mixes customer-only and total-market bases as if directly interchangeable;
- invents a finding not supported by an analysis reference.

A hard failure caps the E5 outcome regardless of otherwise attractive prose.

## Gold story concepts

### Category board

Required high-level concepts:

1. **Pulse momentum, correctly bounded** — real weighted consideration movement; composition exaggerates raw movement.
2. **Northstar divergence** — market visibility remains strong while customer advocacy/experience deteriorates.
3. **Harbour structural youth problem** — gradual multi-wave erosion rather than a one-wave shock.
4. **Restraint** — Mosaic low-base spike excluded.

The preferred narrative is competitive dynamics, not 'Awareness → Consideration → Usage → NPS → Brand image'.

### Pulse CMO

Required concepts:

1. credible campaign-period upper-funnel/consideration momentum;
2. stronger relevance among younger consumers where supported;
3. campaign recognition/image evidence as support rather than causal proof;
4. weighted result over raw movement;
5. behavioural conversion should not be assumed from upper-funnel change.

### Northstar CX

Required concepts:

1. severe W4 current-customer deterioration;
2. coherence across NPS/satisfaction/problems/reliability where results support it;
3. contrast with broad awareness resilience;
4. W5 recovery assessed separately and not exaggerated;
5. immediate customer-experience diagnosis rather than generic brand-health recap.

## Deliberately poor archetypes

These are evaluation archetypes, not fixed gold outputs.

### `MECHANICAL_QUESTIONNAIRE`

Structure follows questionnaire order. Nearly every available metric gets a section. Titles describe variables rather than findings. Usually correct, rarely useful.

### `SIGNIFICANCE_HUNTER`

Ranks results primarily by p-value or magnitude, promotes low-base/noisy cuts, and ignores the client brief.

### `AI_CONSULTANT_CLICHE`

Uses confident strategic language ('unlock growth', 'transformative opportunity', 'winning formula') that outruns evidence. Often converts association into causality.

### `OVERCAUTIOUS_DATA_DUMP`

Avoids unsupported claims but refuses to prioritise; caveats overwhelm the actual answer.

### `GOOD_RESEARCH_EDITOR`

Selects a small number of consequential stories, combines evidence intelligently, states limits locally, and deliberately omits irrelevant/noisy findings.

## Pairwise evaluation

For expert review, compare story plans blind and ask:

> Which plan would you rather hand to a strong researcher to turn into the client deck?

Secondary prompts:

- Which better answers the brief?
- Which shows better judgement about what **not** to report?
- Which has the stronger story hierarchy?
- Which requires fewer substantive editorial corrections?

Record forced preference plus `tie/neither acceptable`, correction notes and failure tags.

## Automated grader role

Deterministic checks can grade:

- invalid finding IDs;
- low-base trap promotion;
- unweighted-primary misuse;
- required concept coverage via finding IDs;
- excessive section count;
- duplicated finding usage;
- forbidden causal phrases as a high-recall warning.

An LLM judge may score semantic brief alignment and narrative quality only after calibration against researcher pairwise labels. It must not replace hard checks.

## Training-data implications

The most valuable future preference examples are not `good prose > bad prose`; they encode editorial decisions:

- relevant finding > statistically interesting off-brief finding;
- coherent contrast > isolated metric;
- restrained bounded headline > causal/exaggerated headline;
- deliberate omission > exhaustive coverage;
- concise hierarchy > questionnaire-order report.

Capture researcher edits as structured operations where possible: `promote`, `demote`, `exclude`, `combine`, `split`, `reorder`, `reframe`, `add_caveat`.
