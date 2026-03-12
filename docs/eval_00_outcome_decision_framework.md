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
| Product defaults | Built-in recommendations, safer defaults, suggestion quality, analysis templates |
| Agent prompting | Eval prompt framing, playbook quality, example coverage, docs clarity |

**Note on the guidance split:** The former "Agent guidance" layer has been separated into **product defaults** (what Velocity itself offers to steer agents toward good choices) and **agent prompting** (what the eval harness, docs, or playbooks tell the agent to do). This distinction matters because the fix for each is different: product defaults are engineering work inside Velocity; agent prompting is documentation and eval-design work outside it. When Pattern 5 appears, locate which side is the real bottleneck before investing.

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

### Pattern 5a: Correct computations, weak analytical judgment — product defaults

**Symptoms**

- The agent uses the tools correctly
- But selects poor breaks, redundant variables, or weak narratives
- Velocity offered no recommendations, suggestions, or guardrails that would have steered the agent toward better choices
- A human using the browser would have been guided by UI affordances the agent path lacks

**What it means**

The product itself is not opinionated enough. The agent is left to make analytical decisions that the system should help with.

**What to do next**

- Add higher-level recommendations (e.g., suggested breaks, recommended demographic splits)
- Improve analysis suggestion quality from the semantic layer
- Add safer defaults for common analysis patterns
- Surface warnings when the agent makes statistically questionable choices (e.g., small cell sizes, redundant variables)

### Pattern 5b: Correct computations, weak analytical judgment — agent prompting

**Symptoms**

- The agent uses the tools correctly
- But selects poor breaks, redundant variables, or weak narratives
- Velocity does offer relevant defaults or suggestions, but the agent ignores or never discovers them
- The eval prompt or playbook does not frame the task well enough to elicit good judgment

**What it means**

The product may already support better choices, but the agent-facing documentation, examples, or eval prompt framing is not surfacing them effectively.

**What to do next**

- Improve playbooks and examples so agents know what good analysis looks like for this task shape
- Improve deck-authoring guidance
- Refine eval prompts so they test the intended behavior more cleanly
- Ensure tool descriptions and discovery flows surface the product's built-in recommendations

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
| Correct but shallow — no product guidance available | Product defaults weak | Recommendations, suggestions, guardrails |
| Correct but shallow — product guidance available but unused | Agent prompting weak | Playbooks, docs, eval prompt framing |
| Task only possible via escape hatches | Interface thesis not validated | Product blocker work |
| Clean end-to-end success | Thesis validated for this task | Freeze baseline, scale eval program |

---

## Scoring Rubric

Every eval should produce a per-layer score so results can be compared across runs and tracked over time. Use a 1–5 scale for each layer the eval touches.

| Score | Label | Meaning |
|---|---|---|
| 5 | Strong | Layer worked as intended with no issues. Agent used it naturally. |
| 4 | Adequate | Layer worked but with minor friction or suboptimal results. |
| 3 | Weak | Layer was usable but required workarounds or produced mediocre output. |
| 2 | Poor | Layer was a significant obstacle. Agent struggled or produced bad results. |
| 1 | Failed | Layer blocked the task or was not usable at all. |

### Applying the rubric

Score every layer the eval is designed to test. Layers not tested by a given eval should be marked N/A, not scored.

Example scorecard for an eval:

| Layer | Score | Notes |
|---|---|---|
| Engine | 5 | Crosstab computation correct, provenance intact |
| MCP / workflow | 3 | Agent needed two retries to discover filter syntax |
| Semantic layer | 4 | Found key variables, missed one relevant demographic |
| Browser convergence | N/A | Not tested in this eval |
| Deliverable layer | 2 | Deck exported but charts were cluttered and unlabeled |
| Product defaults | 3 | No suggestions surfaced for demographic breaks |
| Agent prompting | 4 | Playbook was clear, agent followed it |

**Regression tracking:** Once an eval reaches Pattern 7 (end-to-end success) and is frozen as a baseline, subsequent runs should maintain or improve scores. Any layer dropping by 2+ points is a regression that warrants investigation.

---

## Failure Severity and Expected Difficulty

Not all failures are equally meaningful. A discovery failure on a 2,000-variable dataset with cryptic naming is qualitatively different from the same failure on a clean 40-variable dataset. Eval results should be interpreted relative to the expected difficulty of the task.

### Difficulty dimensions

When defining an eval, tag it with expected difficulty along these dimensions:

| Dimension | Low | Medium | High |
|---|---|---|---|
| Dataset size | < 50 variables | 50–500 variables | 500+ variables |
| Naming quality | Clear, labeled variables | Mixed (some labeled, some cryptic) | Mostly raw codes or abbreviations |
| Domain specificity | General-purpose data | Some domain knowledge needed | Deep domain expertise required |
| Analysis complexity | Single crosstab | Multi-table with filters/weights | Longitudinal, multi-dataset, or custom statistics |
| Deliverable expectations | Raw findings | Formatted tables/charts | Presentation-ready deck with narrative |

### Interpreting failures relative to difficulty

- A failure at **low difficulty** is alarming — it indicates a fundamental gap in the layer.
- A failure at **medium difficulty** is informative — it shows where the current ceiling is.
- A failure at **high difficulty** is expected early in the eval program — it sets an aspirational target.

When reporting eval outcomes, always note the difficulty level. A Pattern 4 (discovery failure) at high dataset complexity is a different signal than the same pattern at low complexity. The former suggests the semantic layer needs to scale; the latter suggests it is fundamentally broken.

### Severity classification

After scoring, classify the overall eval outcome:

| Severity | Criteria | Response |
|---|---|---|
| Critical | Any layer scores 1, or task could not be completed at all | Treat as product blocker. Fix before next eval cycle. |
| Significant | Multiple layers score 2, or one layer scores 2 on a low-difficulty eval | Prioritize in next sprint. Investigate root cause. |
| Moderate | Layers score 3 on medium-difficulty eval | Track and improve. Not a blocker. |
| Minor | Layers score 3–4 on high-difficulty eval | Note for future improvement. Expected at this stage. |
| Passing | All tested layers score 4+, or 5 on low/medium difficulty | Candidate for baseline freeze. |

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

### Invest in product defaults when

- the product technically supports the right move, but offers no recommendations or guardrails
- agents make analytically weak choices that better defaults would prevent
- the browser path has richer guidance than the agent path

### Invest in agent prompting when

- the product offers good defaults, but agents do not discover or use them
- eval prompts are too vague to elicit the intended behavior
- playbooks and docs are missing or unclear for the task shape

---

## Recommended use in planning docs

Future benchmark plans should explicitly include:

1. Which architectural claims the eval is trying to test
2. Expected difficulty ratings across the five dimensions (dataset size, naming quality, domain specificity, analysis complexity, deliverable expectations)
3. Which outcome patterns are most likely
4. Which product decisions will follow from each major outcome
5. A completed scorecard for every layer the eval tests

Post-eval reports should include:

1. The per-layer scorecard with notes
2. The severity classification
3. Whether difficulty was as expected or surprising
4. Comparison to baseline scores if this eval has been run before

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
