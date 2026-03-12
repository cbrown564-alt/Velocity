# Phase 4 Plan: Agent Capability Validation

## Purpose

Phase 4 is a full product-validation phase focused on one question:

**Can an AI agent use Velocity's real shipped product surface as a complete analytical environment, across discovery, analysis, narrative construction, export, handoff, and refinement, at a quality bar a human would actually value?**

This phase is not only about smoothing rough edges.

It exists to determine, with disciplined evidence, whether:

- the current capabilities are already sufficient and mainly need refinement
- substantial new capabilities need to be built
- the agent interface needs to be re-engineered
- parts of the product thesis or scope need to be revised

This phase should be treated as the top product priority before resuming major downstream feature expansion.

Use with:

- [eval_00_agent_interface_validation.md](/Users/cobro/Code/Velocity/docs/eval_00_agent_interface_validation.md)
- [eval_00_outcome_decision_framework.md](/Users/cobro/Code/Velocity/docs/eval_00_outcome_decision_framework.md)
- [eval_00_capability_gap_review.md](/Users/cobro/Code/Velocity/docs/eval_00_capability_gap_review.md)
- [eval_00_task_portfolio.md](/Users/cobro/Code/Velocity/docs/eval_00_task_portfolio.md)
- [eval_00_benchmark_result_template.md](/Users/cobro/Code/Velocity/docs/eval_00_benchmark_result_template.md)
- [eval_00_phase_synthesis_template.md](/Users/cobro/Code/Velocity/docs/eval_00_phase_synthesis_template.md)
- [plan_eval_02_benchmark.md](/Users/cobro/Code/Velocity/docs/plan_eval_02_benchmark.md)
- [eval_02_process_log.md](/Users/cobro/Code/Velocity/docs/eval_02_process_log.md)

---

## Why this is now its own phase

Phases 1-3 established the core substrate:

- `VelocityEngine`
- MCP and deck-building surface
- browser convergence work
- semantic annotations and search
- provenance and session transport
- harmonization workspace baseline

That creates a new obligation.

We should not keep assuming these pieces add up to a strong agent-facing product.

We now need a dedicated phase to test the full app through real agent use, interpret the results honestly, and decide whether the current product direction is actually sufficient.

Without this phase, there is a real risk of:

- building new capabilities on top of weak agent workflows
- mistaking brute-force model effort for product quality
- over-investing in new features before validating the interface thesis
- carrying forward strategic assumptions that have not yet been stress-tested

---

## Phase outcome

Phase 4 is complete only when we can answer, with evidence:

1. Which parts of Velocity are already sufficient for serious agent work.
2. Which parts are rough-edge problems.
3. Which parts require substantial new capability.
4. Which parts likely require interface or architecture changes.
5. Whether any claims about scope or product thesis need to be narrowed or reframed.

The primary output is not just a benchmark score.

It is a product decision package that tells us what to build next and, equally importantly, what not to assume anymore.

---

## Core questions Phase 4 must answer

### Product-thesis questions

- Is Velocity already credible as a first-class analytical interface for agents for at least one important task shape?
- Is the current success level broad enough to justify that claim, or only partial?
- Where is the product acting like a real environment versus merely a capable backend?

### Interface questions

- Is the intended MCP/browser/engine path actually the path an agent would naturally use?
- Are current abstractions high-level enough for research work?
- Are there places where the agent is compensating for a weak interface with excessive reasoning effort?

### Capability questions

- Is semantic discovery sufficient with the current heuristic + token-search approach?
- If not, what level of intervention is justified: better heuristics, TF-IDF/BM25, embeddings, retrieval-augmented workflows, or a redesigned discovery interface?
- Are deck-authoring and deliverable-quality problems mostly defaults and cleanup, or do they reflect a missing authoring model?
- Is session export/handoff genuinely usable for human-agent collaboration?

### Convergence questions

- Are browser and agent users operating on the same effective product surface?
- If not, what specific affordances remain browser-only in practice?
- Are we converging on one product, or just sharing a backend?

### Scope questions

- Which dataset classes can Velocity honestly support for agent-led work today?
- Which deliverable types are realistically in scope?
- What should be deferred until stronger primitives exist?

---

## Non-goals

Phase 4 is not primarily for:

- maximizing one model's benchmark score
- declaring semantic search “done”
- polishing export aesthetics in isolation
- adding downstream AI features before the current agent surface is validated
- treating every eval failure as a small bug fix

Phase 4 is about strategic validation, not cosmetic optimism.

---

## What counts as “full capabilities of the app”

This phase should exercise the app as a whole, not just isolated engine calls.

The evaluation surface includes:

- dataset load and introspection
- semantic annotation and discovery
- weighting, filtering, and analysis
- chart recommendation and deck composition
- deck export quality
- session export and round-trip
- browser-side inspection and refinement
- harmonization and cross-wave workflows where relevant
- provenance and handoff

The goal is to test the real product surface that a serious agent or human-agent workflow would experience.

---

## Workstreams

## 1. Eval Foundations And Contracts

**Goal**

Define exactly what Phase 4 is testing, what outputs every eval must produce, and how those outputs will be judged.

**Questions**

- Which task shapes matter most?
- What artifacts must each run leave behind?
- How do we distinguish benchmark results from strategic interpretations?
- What constitutes pass, fail, and “thesis not yet validated”?

**Deliverables**

- canonical task portfolio (`eval_00_task_portfolio.md`)
- benchmark-result template (`eval_00_benchmark_result_template.md`)
- run artifact contract (defined in §"Required evidence package per eval" below)
- per-layer scoring rubric (`eval_00_outcome_decision_framework.md`)
- capability-gap review template (`eval_00_capability_gap_review.md`)
- phase synthesis template (`eval_00_phase_synthesis_template.md`)

**Done checks**

- every eval in the portfolio that will be run during this phase has a written brief (for S4-EVAL-1, this means the evals with existing datasets and run-ready detail — currently EVAL-01 and EVAL-02; briefs for planned evals in families C–F are written during S4-EVAL-2 as part of intended-path readiness, since those briefs depend on setup and workflow clarity that S4-EVAL-2 delivers)
- the portfolio structure covers all six task families with assigned datasets and difficulty ratings, even where individual briefs are deferred
- reusable templates exist for both benchmark results and capability-gap reviews
- the outcome framework and capability-gap review are used consistently

## 2. Intended-Path Readiness

**Goal**

Make the intended product path testable enough that eval results are interpretable.

**Questions**

- Is the MCP setup path straightforward?
- Is session export/round-trip reliable?
- Are engine/tool return contracts consistent enough for agent use?
- Do docs teach the intended workflow rather than a distorted one?

**Scope**

- setup and configuration friction
- `ResultEnvelope` consistency
- `commitDeck()` / session / export semantics
- quickstart and playbook alignment
- run logging and artifact capture

**Done checks**

- an agent can follow the intended setup path without undocumented detours
- session round-trip is real, not aspirational
- major workflow traps are removed or explicitly documented

## 3. Task Portfolio Execution

**Goal**

Run a deliberately broad set of agent evals that cover the app's real capabilities and pressure points.

**Required task families**

### A. Unfamiliar dataset discovery

Test whether the agent can navigate a large survey with minimal prior context.

Questions:

- can the agent find the right variables?
- can it find appropriate break variables?
- can it distinguish topic search from analytical navigation?

### B. End-to-end analysis deck creation

Test whether the agent can produce a presentation-quality deck, not just correct tables.

Questions:

- are slides chart-first where appropriate?
- are categories cleaned up for presentation?
- are notes, caveats, and narrative structure strong enough for human review?

### C. Session handoff and browser refinement

Test whether the agent can leave behind work a human can meaningfully inspect and continue.

Questions:

- does exported state survive round-trip?
- can a human improve the output in the browser without rebuilding from scratch?
- are provenance and slide specs sufficiently inspectable?

### D. Browser-agent convergence

Test whether a skilled human using the browser gets materially better effective capabilities from the same substrate.

Questions:

- what can the browser user do that the agent effectively cannot?
- are those differences defaults, missing tools, or deeper architectural gaps?

### E. Harmonization and cross-wave work

Test whether the agent can use the newer workspace capabilities beyond single-dataset analysis.

Questions:

- can the agent discover mapping candidates?
- can it interpret and refine harmonization suggestions?
- is the workflow understandable enough for real use?

### F. Stress and edge-case runs

Test whether success is robust or only happens on favorable datasets.

Examples:

- messy labels
- weak metadata
- large variable counts
- high missingness
- split-sample complexity
- multi-response structures

**Done checks**

- each task family has at least one executed eval
- at least one task family is re-run after product changes
- failures are logged as product evidence, not just anecdotes

## 4. Capability Gap Investigation

**Goal**

Use the eval evidence to determine what class of intervention each weakness actually requires.

**Key rule**

Every major gap must be evaluated against four response classes:

- rough-edge fix
- capability expansion
- interface re-engineering
- scope/thesis revision

**Priority investigation areas**

### Semantics and discovery

For each failure mode, explicitly compare:

- heuristic improvements
- lexical/statistical retrieval such as TF-IDF or BM25
- embedding-based retrieval
- retrieval-augmented discovery workflows
- rethinking the discovery interface itself

The goal is not to crown a favorite technique in advance.

It is to determine what class of discovery problem we actually have.

### Workflow surface

Assess whether the MCP/tool model should remain the main interaction primitive or whether some tasks need:

- higher-level composite tools
- guided workflows
- persistent planning state
- a different deck-authoring abstraction

### Deliverables

Assess whether artifact-quality problems are mainly:

- defaults
- cleanup logic
- chart recommendation quality
- missing presentation mode
- deeper authoring-model weakness

### Convergence

Identify hidden browser-only affordances and decide whether they should be:

- exposed to the agent
- moved into shared abstractions
- accepted as intentional non-parity

### Scope

Where the current system is not strong enough, decide whether the right response is:

- more product work
- a narrower claim
- a different sequencing of ambition

**Done checks**

- every major gap is assigned an intervention class
- at least one option-set review exists for semantic discovery
- the team has explicit evidence for why the chosen next bet is the right size

## 5. Strategic Synthesis And Roadmap Reset

**Goal**

Turn Phase 4 findings into a roadmap decision rather than a pile of observations.

**Outputs**

- phase synthesis report
- list of validated claims
- list of unvalidated claims
- ranked product gaps
- recommended next-phase priorities
- explicit “do not assume” list
- canonical benchmark baselines to carry forward

**Done checks**

- roadmap implications are written down
- downstream work is resumed only after this synthesis exists
- future phases inherit concrete validated assumptions rather than optimistic ones

---

## Evaluation method

Every serious eval in Phase 4 should produce two outputs.

### Output A: Benchmark result

Includes:

- task brief
- process log
- artifacts produced
- per-layer scores
- benchmark verdict

### Output B: Capability-gap review

Includes:

- what was sufficient
- what was insufficient
- whether the limitation was local, architectural, or scope-related
- which option classes are plausible next moves
- what evidence would justify the next escalation

This split is mandatory.

Without it, the team will confuse benchmark quality with product sufficiency.

---

## Required evidence package per eval

Each major eval should leave behind:

- eval brief
- process log
- run artifact(s)
- structured scorecard
- capability-gap review memo
- recommended next action

Where relevant, also include:

- exported session
- browser refinement notes
- side-by-side browser vs agent comparison
- issue list with severity and layer attribution

---

## Scoring dimensions

Use the existing per-layer 1-5 rubric from the outcome framework and score each eval on:

- engine adequacy
- workflow/MCP adequacy
- semantic/discovery adequacy
- browser-convergence adequacy
- deliverable quality
- product-default quality
- agent-prompting adequacy

Also score the task-level outcome on:

- methodological correctness
- discovery quality
- workflow smoothness
- artifact quality
- handoff quality
- resilience on messy or unfamiliar data

---

## Decision gates

Phase 4 should include explicit gates instead of rolling straight from evals into feature work.

## Gate 1: Intended path viability

Before broad eval execution:

- MCP/browser/engine path is runnable
- artifact capture is defined
- session round-trip is testable

If this gate fails, treat it as a product blocker.

## Gate 2: Benchmark honesty

After the first major runs:

- identify where results came from product strength versus model brute force
- separate local rough edges from deeper capability gaps

If this gate fails, do not claim benchmark success yet.

## Gate 3: Strategic sufficiency

After the task portfolio:

- decide whether the current design is strong enough to refine
- or whether one or more areas require capability expansion or re-engineering

If this gate fails, the roadmap must change.

## Gate 4: Thesis statement

At phase end, write the honest product claim that current evidence supports.

Examples:

- “Velocity is already credible for agent-led descriptive survey deck creation on well-labeled datasets.”
- “Velocity is a strong analytical backend with partial agent-facing workflow support, but not yet a complete agent interface.”

This final statement matters more than a vanity benchmark result.

---

## Sequencing

## Stage 0: Set the contract

- finalize the Phase 4 plan
- define task portfolio
- define required outputs
- define scoring sheets

## Stage 1: Make the intended path testable

- fix setup and session blockers
- align docs and workflow semantics
- capture instrumentation and logging

## Stage 2: Run the first benchmark-class evals

- rerun Eval 02 through the intended path
- run at least one additional task family beyond deck creation
- record artifacts and scorecards

## Stage 3: Investigate ceilings, not just failures

- run capability-gap reviews
- compare intervention classes
- identify where current design may be near its ceiling

## Stage 4: Compare browser and agent realities

- do side-by-side parity review
- identify hidden affordances
- determine whether parity gaps are local or structural

## Stage 5: Write the synthesis and reset the roadmap

- freeze benchmark baselines
- write validated and unvalidated claims
- rank next investments
- shift future feature work accordingly

---

## Immediate next actions

1. ~~Adopt this document as the active Phase 4 plan.~~ Done.
2. ~~Treat Eval 02 as the first benchmark, not the whole phase.~~ Done — `plan_eval_02_benchmark.md` positions it as one benchmark within the portfolio.
3. ~~Define the broader task portfolio that covers discovery, decking, handoff, convergence, and harmonization.~~ Done — `eval_00_task_portfolio.md` covers all six families (A–F) with datasets and difficulty ratings.
4. ~~Create the standard output template for benchmark result plus capability-gap review.~~ Done — `eval_00_benchmark_result_template.md` (benchmark result) and `eval_00_phase_synthesis_template.md` (synthesis). Capability-gap review structure is in `eval_00_capability_gap_review.md`.
5. Identify the minimum intended-path blockers that must be removed before running the full portfolio. **This is S4-EVAL-2.**

---

## Definition of done

Phase 4 is done when all of the following are true:

- the app has been exercised through a real agent-led task portfolio, not just one benchmark
- each major run produced both benchmark and capability-review outputs
- the team can say which current capabilities are sufficient and which are not
- the team has explicit judgments on rough-edge fixes versus substantial new capability versus interface re-engineering versus scope revision
- at least one benchmark baseline has been frozen for future comparison
- the implementation tracker and roadmap priorities reflect the Phase 4 conclusions

Until then, major downstream feature expansion should be considered provisional.
