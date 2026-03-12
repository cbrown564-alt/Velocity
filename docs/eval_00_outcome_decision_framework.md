# Agent Eval Outcome Framework

## Purpose

This document explains how to interpret agent eval results and what kinds of product decisions they should drive.

It is a companion to [eval_00_agent_interface_validation.md](/Users/cobro/Code/Velocity/docs/eval_00_agent_interface_validation.md), which explains the broader purpose of the eval program.

The main idea is simple:

**An eval is only useful if its outcome changes what we choose to build next.**

---

## The decision question

After every meaningful eval, we should be able to answer:

1. What layer failed or succeeded?
2. What does that imply about the product thesis?
3. What should we prioritize next?

If an eval result does not help us answer those questions, the eval is underspecified.

---

## The layers an eval can inform

Most outcomes map to one or more of these layers:

| Layer | What it covers |
|---|---|
| Engine | Correctness, state model, provenance, execution surface |
| MCP / workflow | Tool ergonomics, interaction loop, agent-operability |
| Semantic layer | Search, annotation quality, discovery support, suggestions |
| Browser convergence | Whether humans and agents share the same real capabilities |
| Deliverable layer | Deck/session/export quality, reviewability, presentation readiness |
| Agent guidance | Docs, defaults, examples, prompting assumptions |

The point of post-eval interpretation is to locate the main bottleneck correctly.

---

## Outcome Patterns And What They Mean

### Pattern 1: Good analysis, bad artifact

**Symptoms**

- Findings are sensible
- Variable selection is reasonable
- Weighting and caveats are mostly correct
- The exported deliverable looks poor, cluttered, or unpresentable

**What it means**

The engine may be working, but the system is still weak at the deliverable layer.

This usually means the product is acting more like an analysis backend than a full agent-facing interface.

**What to do next**

- Improve chart-first authoring
- Improve export defaults
- Add presentation-layer cleanup
- Reduce raw survey plumbing in outputs

### Pattern 2: Good insight, painful workflow

**Symptoms**

- The agent eventually gets to good findings
- But it requires scripts, tool probing, undocumented conventions, or repeated retries

**What it means**

The underlying capability may be there, but the MCP/workflow thesis is not yet validated.

This is a product-interface failure more than an analysis failure.

**What to do next**

- Simplify tool setup and discovery
- Improve API consistency
- Remove unnecessary ceremony from common flows
- Strengthen agent-facing docs and examples

### Pattern 3: Strong browser output, weak agent output

**Symptoms**

- A human can get better charts, cleaner slides, or smoother workflows in the browser
- The agent path produces visibly worse outputs from the same core data

**What it means**

Browser convergence is not yet real.

The agent is not operating on the same effective product surface as the human.

**What to do next**

- Identify hidden browser-only affordances
- Move those affordances into shared engine/deck/session abstractions
- Close parity gaps before adding new differentiated features

### Pattern 4: Agent gets lost in dataset discovery

**Symptoms**

- The agent struggles to find the right variables
- Search results are weak or noisy
- Discovery requires brute-force inspection or name-guessing

**What it means**

The semantic-layer thesis is not yet validated for that class of dataset.

Velocity still understands the data too syntactically.

**What to do next**

- Improve annotations
- Improve semantic search ranking
- Add category-aware or intent-aware search affordances
- Improve analysis suggestions once relevant variables are found

### Pattern 5: Correct computations, weak analytical judgment

**Symptoms**

- The agent uses the tools correctly
- But selects poor breaks, redundant variables, or weak narratives
- The resulting artifact is technically valid but strategically shallow

**What it means**

The bottleneck may be guidance, defaults, or prompt framing rather than core engine capability.

It may also indicate that the semantic/discovery tools are not structuring the task well enough.

**What to do next**

- Improve playbooks and examples
- Improve deck-authoring guidance
- Add higher-level recommendations and safer defaults
- Refine eval prompts so they test the intended behavior more cleanly

### Pattern 6: Agent cannot complete the task through the intended path

**Symptoms**

- The agent must escape to external code or unsupported workflows
- Core steps fail or are too awkward to perform through Velocity itself

**What it means**

This is a failure of the interface thesis, not just a rough edge.

Velocity has not yet become the natural operating environment for the task.

**What to do next**

- Identify the exact missing affordance
- Treat it as a product blocker
- Avoid calling the eval a success just because the agent worked around the issue

### Pattern 7: End-to-end success with minimal scaffolding

**Symptoms**

- The agent uses the intended interface
- Discovers relevant variables efficiently
- Produces a strong artifact
- Leaves behind inspectable state

**What it means**

The relevant architectural thesis is working for that task shape.

This is the point where the eval can become a true benchmark baseline rather than an exploratory report.

**What to do next**

- Freeze the run as a baseline
- Add scoring and regression checks
- Expand to harder datasets or more demanding deliverables

---

## Decision Matrix

| Observed outcome | Primary interpretation | Next priority |
|---|---|---|
| Good findings, ugly deck | Deliverable layer weak | Export, charting, presentation cleanup |
| Good results, lots of workarounds | Workflow weak | MCP ergonomics, docs, API consistency |
| Browser stronger than agent path | Convergence weak | Shared abstractions, parity work |
| Discovery poor on large datasets | Semantic layer weak | Search, annotation, suggestions |
| Correct but shallow analysis | Guidance/defaults weak | Playbooks, recommendations, prompts |
| Task only possible via escape hatches | Interface thesis not validated | Product blocker work |
| Clean end-to-end success | Thesis validated for this task | Freeze baseline, scale eval program |

---

## What should count as a real success

For planning purposes, a real success should mean more than "the agent eventually got an answer."

A strong eval success usually means:

- the intended interface was used
- the analysis was methodologically sound
- the output was useful to a human
- the workflow was not unusually fragile
- the artifact or session could be inspected and refined afterward

Anything weaker than that may still be promising, but it should not be mistaken for full validation.

---

## What should count as a meaningful failure

A meaningful failure is one that reveals a broken assumption in the product architecture or workflow.

Examples:

- the agent cannot navigate the dataset at all
- the best available output is still not human-usable
- browser and agent paths diverge materially
- provenance/handoff breaks at the end
- the interface requires recurring workarounds for standard tasks

These are not "just implementation details." They tell us where the thesis is not yet true.

---

## How this should guide future planning

Use eval outcomes to choose the next layer of investment.

### Invest in the engine when

- correctness is weak
- provenance is missing
- state handling is unreliable
- exports are wrong because the underlying structured data is wrong

### Invest in MCP/workflow when

- the agent can succeed only through awkward tool usage
- setup is fragile
- the execution model is too inconsistent to trust

### Invest in the semantic layer when

- discovery dominates run time
- variable selection is the main failure mode
- the dataset is too large or too domain-specific for naive navigation

### Invest in convergence when

- browser users can do important things agents cannot
- the same conceptual operation is implemented differently across surfaces

### Invest in deliverable quality when

- the analysis is good but the artifact is poor
- outputs are reviewable in theory but unusable in practice

### Invest in guidance/defaults when

- the product technically supports the right move, but agents do the wrong thing by default

---

## Recommended use in planning docs

Future benchmark plans should explicitly include:

1. Which architectural claims the eval is trying to test
2. Which outcome patterns are most likely
3. Which product decisions will follow from each major outcome

That prevents evals from becoming retrospective narratives with no operational consequence.

---

## Summary

The job of an eval is not just to produce a result.

Its job is to reduce uncertainty about where the product is strong, where the interface thesis is still weak, and what should be built next.

This document answers:

**How should eval outcomes change our decisions?**

For the broader question —

**What are these evals fundamentally for?**

see [eval_00_agent_interface_validation.md](/Users/cobro/Code/Velocity/docs/eval_00_agent_interface_validation.md).
