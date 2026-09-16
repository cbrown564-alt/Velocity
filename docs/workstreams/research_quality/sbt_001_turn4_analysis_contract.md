# SBT-001 Turn 4 — Reference Analysis and Finding Contract

## Purpose

Turn 4 moves SBT-001 from preparation truth to **analysis truth**. It must create an executable reference layer that can grade whether a model chose the right analysis and whether its findings are supported.

The key separation is:

1. `analysis_spec` — what computation should run;
2. `analysis_result` — deterministic output from the canonical prepared data;
3. `finding` — a bounded claim supported by one or more results;
4. `editorial_relevance` — whether that finding matters for a particular brief.

A result can be correct without being interesting. A finding can be supported without deserving a slide.

## Analysis families

### A. Brand funnel levels

For each brand × wave:
- prompted awareness, total base;
- familiarity among aware;
- consideration among aware and, separately where requested, total-sample incidence;
- current usage, total base;
- preference, total base.

Never silently switch denominators. Every result records `unweighted_base`, `weighted_base`, `universe`, `weight`, and source variables.

### B. Wave changes

Predeclared comparisons:
- adjacent wave changes W1→W2, W2→W3, W3→W4, W4→W5;
- selected long-horizon W1→W5 comparisons;
- Pulse campaign comparison W2→W3;
- Northstar incident comparison W3→W4 and recovery W4→W5.

For proportions use the survey-engine/reference proportion comparison with explicit variance/ESS assumptions. Store estimate, difference, standard error/interval where available, p-value and test identifier. `p >= .05` does not imply equivalence/stability.

### C. Segment comparisons

Priority segments:
- age: 18–34 vs 35+;
- current customer vs non-customer where meaningful;
- income: £60k+ vs other disclosed income;
- contract type;
- broad region where bases permit.

Segment analysis is only eligible for editorial promotion when the unweighted base clears the configured reporting threshold. Low-base results remain computable and can become deliberate traps.

### D. Brand image

For each brand × wave × attribute:
- `% applies` among `F1_brand >= 3` only;
- DK excluded from valid percentage but reported in diagnostics;
- base is familiar-brand respondents, never total sample.

Planned event-linked image analyses:
- Pulse innovation W2→W3;
- Northstar reliability W3→W4 and W4→W5.

Exploratory full battery results are retained to support multiple-comparison/noise evaluation.

### E. Customer experience

Among current customers only:
- mean satisfaction;
- NPS score;
- recent problem incidence;
- service-contact incidence.

Customer-service satisfaction uses the narrower `current customer AND contacted service` universe.

Planned comparisons:
- Northstar W3→W4 incident;
- Northstar W4→W5 recovery.

### F. Marketing

- prompted advertising awareness by brand/wave;
- Pulse campaign recognition W3–W5;
- Pulse recognition 18–34 vs 35+;
- campaign recognition decay W3→W4→W5.

### G. Weighting diagnostic

For Pulse W2→W3 consideration compute both weighted and unweighted change. The difference is a first-class diagnostic finding, not an alternate valid headline metric.

### H. Long-run trend

Harbour consideration among 18–34 from W1 through W5. Preserve the full trajectory so an analysis planner can detect a gradual multi-wave decline rather than relying solely on adjacent significance tests.

## Finding inventory rules

Every finding has:

- stable `findingId`;
- `claimType`;
- one or more `analysisRefs`;
- natural-language bounded statement;
- numerical evidence;
- universe/base and weight;
- statistical status;
- materiality annotation;
- brief-specific relevance map;
- caveats;
- source variables;
- `promotionStatus`: `headline_candidate`, `supporting`, `context`, `caveat`, `do_not_promote`.

### Hard rules

- No causal language for campaign effects: the synthetic world has causal truth, but the survey analysis only establishes observed association/change unless an evaluation explicitly exposes intervention truth.
- Non-significance is rendered `no clear evidence of change`, not `stable`, unless a future equivalence/materiality rule is explicitly met.
- Low-base Mosaic trap is `do_not_promote` even if its point estimate is dramatic.
- Unweighted Pulse W3 movement is diagnostic only; weighted result is the approved tracker estimate.
- Northstar awareness resilience does not cancel its customer-experience deterioration; these are distinct universes/measures.
- Harbour's long-run youth decline can be material even if not every adjacent pair is significant.

## Brief relevance

### BRIEF_PULSE_CMO

Highest relevance:
- weighted Pulse W2→W3 consideration movement;
- 18–34 concentration;
- ad/campaign recognition;
- innovation image movement;
- lag between upper-funnel movement and current usage/preference;
- weighting-composition caution.

### BRIEF_NORTHSTAR_CX

Highest relevance:
- W4 NPS/satisfaction deterioration among current customers;
- problem incidence;
- reliability perception;
- W5 recovery;
- contrast with resilient total awareness.

### BRIEF_CATEGORY_BOARD

Highest relevance:
- Pulse campaign-era competitive momentum, appropriately bounded;
- Northstar customer-experience vulnerability despite market strength;
- Harbour long-run youth decline;
- category/funnel context necessary to size those stories;
- exclude Mosaic low-base noise from executive narrative.

## Turn 4 acceptance

- all reference analyses execute from canonical data without manual values;
- every numeric finding is reproducible from an `analysis_spec`;
- every result records universe/base/weight;
- all planted event/trap observations are represented in the inventory;
- unsupported/low-base/noisy results are explicitly labelled rather than deleted;
- brief relevance is stored separately from statistical correctness;
- analysis/finding files are deterministic and suitable for E3/E4 grading.
