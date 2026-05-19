# Agent Eval Purpose: Validating the Interface Thesis

## Why these evals exist

Velocity's agent evals are not just tests of statistical correctness.

They exist to validate a larger architectural thesis:

**Velocity can become a first-class analytical interface for AI agents, not merely a collection of computation primitives.**

This is the core bet behind Phases 1-4:

- Phase 1 introduced `VelocityEngine` and provenance so agents could work through a stable, inspectable execution surface.
- Phase 2 introduced MCP tools and `DeckBuilder` so agents could operate declaratively rather than through ad hoc scripting.
- Phase 3 aimed at browser convergence so agent and human workflows would share the same substrate.
- Phase 4 introduced the semantic layer so agents could reason over meaning, not just variable names and schemas.

An eval is therefore a test of whether those phases add up to something real.

---

## The core question

Each eval should help answer this:

**Can an agent use Velocity as a genuine research environment and produce an output a human would want to review, refine, or present?**

That question is broader than:

- Can the engine compute a crosstab?
- Can the agent export a PPTX?
- Can semantic search return something plausible?

Those are necessary capabilities, but not the end goal.

The end goal is a complete analytical interface that supports:

- discovery
- methodologically sound analysis
- narrative construction
- provenance
- export
- human handoff

---

## What an eval is actually validating

Every serious eval should test some combination of the following claims.

### 1. The engine is the right unit of interaction

The eval should tell us whether `VelocityEngine` is a strong enough abstraction boundary for agent work.

This means the agent can:

- load and inspect data
- stage filters and weights
- run analyses
- build artifacts
- export results
- preserve state for review

without dropping down into raw implementation details.

### 2. The MCP interface is expressive enough

The eval should tell us whether the MCP/tool layer lets an agent act effectively without writing bespoke glue code for normal tasks.

This means the agent should not need to escape into:

- raw SQL for common workflows
- external scripting for standard analysis loops
- product-specific workarounds just to produce normal outputs

### 3. Browser and agent capabilities are converging

The eval should reveal whether the agent path and browser path are genuinely moving toward the same product.

If humans can create materially better outputs in the browser only because the browser has hidden or richer capabilities, then convergence is not yet real.

The intended state is:

- same analytical substrate
- same export logic
- same session model
- different interaction modes, not different powers

**How to test convergence honestly:** Convergence is the hardest claim to eval because it is easy to test the agent path in isolation and declare it "good enough." To actually validate convergence, at least one eval in the program should run the same analytical task through both paths and compare outputs side-by-side. Specifically:

1. Define a concrete task (e.g., "produce a 5-slide deck on attitudes toward X, broken by age and region").
2. Have a human complete the task using the browser UI.
3. Have the agent complete the same task using only the MCP/engine path.
4. Compare the outputs on: variable selection, chart quality, export fidelity, total effort, and whether either path required workarounds the other did not.

If the browser output is materially stronger, document exactly which affordances made the difference. Those affordances become the convergence work backlog. If the outputs are comparable, that is genuine evidence of convergence for that task shape.

### 4. The semantic layer makes unfamiliar datasets navigable

The eval should tell us whether semantic annotations, search, and suggestions make large or messy datasets tractable for agents.

This matters especially when:

- variable inventories are large
- naming conventions are inconsistent
- domain knowledge is needed
- discovery is the main bottleneck

If the agent still has to brute-force the dataset manually, the semantic-layer thesis is not yet validated.

### 5. The output is useful as a human-facing artifact

The eval should tell us whether Velocity can help an agent produce not just a correct answer, but a usable artifact.

Depending on the task, that artifact may be:

- a deck
- a session file
- a set of findings
- a structured exploratory workflow a human can inspect

If the artifact is methodologically correct but unusable, then Velocity is still acting more like a backend than a full agent interface.

### 6. Provenance and handoff are real, not decorative

The eval should tell us whether outputs remain inspectable and reviewable after the agent finishes.

That means:

- results carry provenance
- session state can be preserved
- a human can see what the agent did
- the work can be resumed or refined without redoing the whole run

This is essential if Velocity is supposed to support human-agent collaboration rather than isolated one-shot generations.

---

## What these evals are not for

To keep future planning honest, it helps to state the non-goals explicitly.

These evals are not primarily designed to:

- maximize benchmark scores for a single model
- prove that one LLM is smarter than another
- show that raw computations are possible in principle
- replace formal statistical validation suites
- optimize export aesthetics in isolation from workflow

Those things may matter, but they are downstream.

The primary purpose is to test whether the product architecture creates a strong interface for agent work.

---

## The implicit product goals behind the eval program

Taken together, the evals are trying to establish that Velocity can become:

### 1. An agent-native analysis environment

Not just a UI with an API attached, and not just a statistical engine with a wrapper.

### 2. A shared substrate for humans and agents

One system, one analytical core, multiple interaction modes.

### 3. A bridge from computation to deliverable

The system should help agents move from raw data to something presentable, reviewable, and actionable.

### 4. A platform for iterative human-agent collaboration

The agent should not be a disposable front-end to a batch job. It should be able to leave behind structured work that a human can inspect and continue.

### 5. A meaning-aware interface to complex datasets

The system should reduce the cost of understanding unfamiliar data, not just the cost of running computations once understanding already exists.

---

## What a successful eval program would prove

If the eval program works, it should eventually let us say:

- the engine abstraction is correct
- the MCP/tool abstraction is usable
- browser and agent workflows meaningfully converge
- semantic tooling improves dataset navigation
- artifacts are good enough for real review and presentation
- provenance and handoff support genuine collaboration

At that point, Velocity is no longer just "software that can run analyses for an agent."

It becomes a real analytical interface designed for agent participation.

---

## How this document should be used

Use this document when:

- defining new evals
- deciding whether an eval result is strategically important
- reviewing whether a failure is local or architectural
- planning work that is meant to improve agent usability

This document answers:

**What are we fundamentally trying to validate?**

For the next question —

**What should we do when an eval succeeds or fails in different ways?**

see [eval_00_outcome_decision_framework.md](/Users/cobro/Code/Velocity/docs/eval_00_outcome_decision_framework.md).
