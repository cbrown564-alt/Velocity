# Eval 02 Benchmark Plan

## Purpose

Turn Eval 02 (BSA 2017) into a stable benchmark for agent-facing product quality, not just engine correctness.

This benchmark should answer one clear question:

**Can an agent using Velocity's intended workflow produce a presentation-quality deck from a large survey dataset with minimal manual scaffolding?**

For the broader strategic context behind this benchmark, see:

- [eval_00_agent_interface_validation.md](/Users/cobro/Code/Velocity/docs/eval_00_agent_interface_validation.md)
- [eval_00_outcome_decision_framework.md](/Users/cobro/Code/Velocity/docs/eval_00_outcome_decision_framework.md)

---

## Current State

Eval 02 already proves a few important things:

- The engine can load, weight, analyze, and export a large survey dataset.
- The agent can find a coherent story and write strong editorial notes.
- The exported PPTX can carry section structure and speaker notes.

But the current benchmark is not yet measuring the right outcome cleanly:

- The output deck is analysis-grade, not presentation-grade.
- The CLI workflow steers agents toward tables instead of charts.
- Presentation slides include non-substantive categories like `DK/Refused`, `Don't know`, and split-sample junk.
- The eval flow mixes agent quality, workflow friction, and product gaps into one result.

---

## Benchmark Target

Eval 02 should count as a success only if all of the following are true:

1. The deck is visually presentation-ready.
2. Most analytical slides are chart-first, not raw crosstab tables.
3. Non-substantive survey categories are removed or suppressed from presentation views.
4. Weighting is applied throughout and visible in metadata/subtitles.
5. Speaker notes explain findings, context, and caveats.
6. The run succeeds through the intended agent workflow with minimal custom scripting.
7. Session export/round-trip works in a way an agent can reliably use.

---

## Workstreams

### 1. Agent Guidance

**Owner:** Docs / agent UX

**Problem**

The quickstart and playbook examples bias agents toward `visualizationType: "table"`, which encourages safe but poor-looking decks.

**Changes**

- Update agent-facing docs to recommend `visualizationType: "chart"` by default for presentation decks.
- Add explicit guidance for when tables are still appropriate.
- Add survey-presentation rules:
  - suppress DK/refusal/missing categories in presentation views
  - avoid high-cardinality breaks unless condensed
  - prefer chart types that highlight one clear finding

**Success criteria**

- A new agent following the docs should produce a chart-first spec without being manually coached.

**Done checks**

- [ ] [guide_agent_quickstart.md](/Users/cobro/Code/Velocity/docs/guide_agent_quickstart.md) uses chart-first examples.
- [ ] [agent_analysis_workflow.md](/Users/cobro/Code/Velocity/docs/playbooks/agent_analysis_workflow.md) recommends chart-first presentation decks.
- [ ] Docs include explicit survey cleanup guidance for presentation output.

### 2. Presentation Cleanup

**Owner:** Engine / export

**Problem**

The exported slides surface full coded response structures, including categories that should never appear in a client-facing deck.

**Changes**

- Add a presentation-layer cleanup path for categorical survey outputs.
- Support suppression of non-substantive categories such as:
  - don't know
  - refused
  - prefer not to say
  - not applicable
  - routing/version skips
- Optionally support collapsing very small residual categories into `Other` when appropriate.

**Success criteria**

- A slide like EU vote by age shows the substantive split, not survey plumbing.

**Done checks**

- [ ] Presentation exports can suppress configured non-substantive categories.
- [ ] Eval 02 slide outputs no longer show DK/refusal/skip categories unless explicitly requested.
- [ ] At least one test covers survey-category suppression behavior.

### 3. Chart-First Deck Ergonomics

**Owner:** Engine / deck builder

**Problem**

The system can export charts, but the authoring path makes it too easy to fall back to tables.

**Changes**

- Make chart-first deck authoring easier than table-first authoring.
- Improve chart recommendation defaults for common survey patterns.
- Consider a higher-level presentation mode or slide option that prefers charts unless the data shape is unsuitable.

**Success criteria**

- Agents can get strong visual output without hand-picking chart types for every slide.

**Done checks**

- [ ] Common survey crosstabs render well with `visualizationType: "chart"` and no manual chart type.
- [ ] Eval 02 can be authored with mostly chart slides and minimal per-slide override logic.
- [ ] At least one real export test covers multi-slide chart-first survey output.

### 4. Workflow Reliability

**Owner:** MCP / engine / docs

**Problem**

The eval had to route around the intended product workflow, which makes benchmark results harder to interpret.

**Changes**

- Ensure the intended MCP path is easy to configure and use.
- Clarify session export behavior and `commitDeck()` expectations in agent docs.
- Remove API/documentation ambiguity around what returns a ResultEnvelope and what does not.

**Success criteria**

- An agent can run the benchmark through the intended tool path without avoidable workflow traps.

**Done checks**

- [ ] MCP setup path is documented or automated.
- [ ] Session export guidance reflects actual engine behavior.
- [ ] `commitDeck()` is documented where agent workflows mention session round-trip.
- [ ] Eval 02 rerun does not fail on session export assumptions.

### 5. Benchmark Harness

**Owner:** Eval / tooling

**Problem**

The current eval artifacts are useful, but the benchmark is not yet standardized enough for before/after comparison.

**Changes**

- Define a canonical Eval 02 run path.
- Standardize outputs for every rerun:
  - deck artifact
  - process log
  - structured run summary
  - pass/fail checks
- Record both product-quality and agent-quality metrics.

**Success criteria**

- Future reruns can be compared without reinterpreting the whole thread.

**Done checks**

- [ ] Eval 02 has a canonical runner or documented run recipe.
- [ ] Outputs include a structured summary of visual quality, workflow friction, and methodological correctness.
- [ ] The benchmark can distinguish agent mistakes from product shortcomings.

---

## Scoring Dimensions

Every Eval 02 rerun should be judged on these dimensions:

| Dimension | What good looks like |
|---|---|
| Visual quality | Slides look presentation-ready, not like raw statistical dumps |
| Narrative quality | Clear section structure, editorial titles, useful notes |
| Methodological correctness | Correct weight, reasonable variable selection, split-sample awareness |
| Discovery quality | Relevant variables found efficiently without flailing |
| Workflow smoothness | Minimal scripting, minimal product workarounds |
| Export quality | PPTX charts/tables render cleanly and notes survive export |
| Session round-trip | Built deck and state can be reliably exported for human refinement |

---

## Recommended Sequence

### Phase 1: Fix the benchmark definition

- Update agent guidance.
- Define chart-first success criteria.
- Define presentation cleanup expectations.

### Phase 2: Fix the highest-leverage product gaps

- Add presentation-layer category suppression.
- Improve chart-first authoring defaults.
- Clarify session/export workflow.

### Phase 3: Re-run Eval 02

- Use the same brief and dataset.
- Require chart-first presentation output.
- Capture workflow friction explicitly.

### Phase 4: Freeze the baseline

- Save the rerun artifacts as the canonical benchmark baseline.
- Use future product changes to improve against that baseline, not against memory.

---

## Immediate Next Actions

1. Update the quickstart and playbook so they stop teaching table-first deck authoring.
2. Decide where presentation-category suppression should live: analysis output, deck builder, or export layer.
3. Rework Eval 02 deck authoring to use charts for the primary finding slides.
4. Re-run Eval 02 and compare the new artifact against the current PPTX.

---

## Definition of Done

Eval 02 becomes a stable benchmark when:

- A fresh agent run produces a chart-first deck with clean categories.
- The deck is something you would actually show another person.
- The run follows the intended agent workflow with only minor scaffolding.
- The benchmark result is repeatable and easy to compare across future product iterations.
