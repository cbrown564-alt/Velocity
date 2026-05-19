# Agent Eval Framework

Single reference for scoring eval runs and classifying capability gaps. Historical Phase 4 philosophy lives in `archive/2026-03/phase4-eval/eval_00_agent_interface_validation.md`.

Run artifacts: `evals/README.md`. Schema: `eval_00_run_summary_schema.ts`. Templates: `evals/templates/`.

---

<a id="part-i-outcomes-and-decisions"></a>
## Part I — Outcomes and decisions


## Purpose

This document explains how to interpret agent eval results and what kinds of product decisions they should drive.

It is a companion to [eval_00_agent_interface_validation.md](archive/2026-03/phase4-eval/eval_00_agent_interface_validation.md), which explains the broader purpose of the eval program.

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

see [eval_00_agent_interface_validation.md](archive/2026-03/phase4-eval/eval_00_agent_interface_validation.md).
---

<a id="part-ii-capability-gaps"></a>
## Part II — Capability gap review


## Purpose

This document is a companion to:

- [eval_00_agent_interface_validation.md](archive/2026-03/phase4-eval/eval_00_agent_interface_validation.md)
- [Part I: Outcomes](#part-i-outcomes-and-decisions)

Those documents explain:

- what the eval program is trying to validate
- how to interpret outcomes and prioritize next work

This document answers a different question:

**When an eval exposes friction or weakness, should we smooth rough edges, build substantial new capabilities, re-engineer the interface, or reconsider the scope of the product thesis itself?**

That question cannot be answered by a benchmark plan alone.

It requires a more blunt strategic assessment of whether the current system is actually strong enough for the goals we claim.

---

## Why this document exists

It is easy to misread an eval in one of two ways:

### Failure mode 1: Under-reacting

We see friction and assume the answer is:

- better docs
- cleaner defaults
- a few more helper tools
- minor UX cleanup

Sometimes that is correct.

But sometimes the eval is telling us the current architecture is fundamentally underpowered for the task.

### Failure mode 2: Over-reacting

We see weak results and assume we need:

- embeddings
- RAG
- a planner
- a new agent surface
- a major rewrite

Sometimes that is correct.

But sometimes the real problem is simply:

- weak prompts
- poor defaults
- missing presentation cleanup
- workflow inconsistency

This document exists to separate those cases.

---

## The core strategic question

After a meaningful real-world eval, we should be able to answer:

1. Are the current capabilities sufficient for this task shape if properly used?
2. If not, is the gap mainly:
   - defaults and guidance
   - missing product capability
   - interface architecture
   - product scope / thesis
3. What class of investment is justified next?

If we cannot answer those questions, the eval has not yet been interpreted at the right level.

---

## The four classes of response

Every major eval finding should eventually land in one of these buckets.

### 1. Rough-edge fix

The core capability is already present, but too awkward, hidden, or poorly surfaced.

Typical response:

- docs
- defaults
- examples
- cleanup
- consistency fixes
- small workflow affordances

### 2. Capability expansion

The current product surface is coherent, but missing something material needed for the task.

Typical response:

- new semantic retrieval method
- new analysis suggestion system
- new deck-authoring mode
- new session/handoff affordance
- stronger export controls

### 3. Interface or architecture re-engineering

The task reveals that the current abstraction boundary is wrong or too weak.

Typical response:

- redesign the MCP surface
- change the agent workflow model
- move browser-only affordances into shared engine abstractions
- replace narrow search tooling with a broader discovery system
- restructure session and artifact generation around a different primitive

### 4. Scope or thesis revision

The task reveals that the product claim itself is too broad, premature, or incorrectly framed.

Typical response:

- narrow supported dataset classes
- narrow supported deliverable types
- state stronger prerequisites for “agent-native” success
- defer certain ambitions until later phases
- revise what “first-class analytical interface” means in practice

---

## A stronger reading of evals

A real-world eval should not only ask:

- did the agent complete the task?
- was the result good?

It should also ask:

- did the task succeed for the reasons we want?
- would a different model succeed only by brute force or external scaffolding?
- would a human using the browser have materially better tools?
- are we missing a crucial capability class?
- are we forcing the agent to compensate for product weaknesses with reasoning effort?
- are we asking the product to do something outside its real design envelope?

This is the level at which evals become strategically useful.

---

## The capability review lens

For each layer, ask the questions below in order.

### 1. Sufficiency

**Is the current approach good enough in principle for this task shape?**

Not:

- perfect
- elegant
- future-proof

Just:

- strong enough that refinement is sensible

### 2. Scalability

**Would this still work on harder datasets, messier labels, larger variable inventories, or weaker models?**

If success depends on a strong model compensating for weak product affordances, the capability is not yet robust.

### 3. Generality

**Is this a one-off success for a friendly dataset, or a reliable pattern we can expect elsewhere?**

### 4. Leverage

**Would incremental fixes meaningfully move outcomes, or are we near the ceiling of the current design?**

### 5. Strategic fit

**If the task requires major new machinery, does that machinery still fit the product thesis, or is it dragging Velocity toward a different product entirely?**

---

## Layer-by-layer strategic questions

## 1. Engine layer

Questions:

- Is `VelocityEngine` actually the right unit of interaction for agents?
- Can agents complete serious work without repeatedly escaping to raw internals?
- Does provenance help the task materially, or is it only decorative?
- Is the session model strong enough for handoff and resumability?

Possible judgments:

- Rough-edge: return-shape inconsistency, missing metadata, weak docs
- Capability gap: missing analysis summaries, missing transformation primitives
- Architecture gap: engine exposes too-low-level operations for normal research workflows
- Scope gap: some task classes may require a more domain-specific workflow than the engine should provide

## 2. Workflow / MCP layer

Questions:

- Is the intended path actually the easiest path?
- Does the tool surface match how agents naturally decompose survey research tasks?
- Are there too many low-level calls for common work?
- Does the interface reward safe but weak outputs?

Possible judgments:

- Rough-edge: setup friction, missing examples, confusing method contracts
- Capability gap: need composite tools, higher-level plans, or stateful deck workflows
- Architecture gap: the call pattern itself is wrong for iterative analysis
- Scope gap: some “agent-native” claims may require a more guided product mode than raw tools alone

## 3. Semantic / discovery layer

Questions:

- Can an agent find the right variables without brute force?
- Does the current semantic layer work only for topic lookup, or also for analytical navigation?
- Is heuristic annotation sufficient, or are we hitting its ceiling?
- Are we missing a richer discovery primitive than “search for variables”?

This is the layer where we should be explicit about option space.

### Semantic option ladder

#### Option A: Better heuristics and product affordances

Examples:

- better rules
- better ranking weights
- category filters
- topic filters
- variable-type filters
- better suggestions once a variable is found

Use when:

- failures are narrow
- labels are fairly good
- discovery mostly works for specific queries
- the main problem is category-level navigation or ranking quality

#### Option B: Classical IR / statistical retrieval

Examples:

- TF-IDF / BM25 over names, labels, value labels, notes, concepts
- query expansion using thesauri or survey-domain lexicons
- clustering or faceting over variable vocabularies

Use when:

- heuristics are too brittle
- lexical similarity matters more than deep semantics
- datasets are large but still textually informative
- we need better ranking before reaching for embeddings

#### Option C: Embedding-based retrieval

Examples:

- vector search over variable labels, value-label summaries, concept descriptions
- hybrid lexical + vector ranking
- nearest-neighbor retrieval for discovery and suggestion seeding

Use when:

- wording varies heavily across datasets
- synonymy is a major problem
- concept drift across studies is blocking discovery
- lexical methods still miss obvious relevant variables

#### Option D: Retrieval-augmented discovery workflows

Examples:

- retrieval over annotations, codebooks, prior deck examples, methodological guidance
- search that returns not just variables, but candidate breaks, caveats, and related analyses
- dataset-aware agent context assembly

Use when:

- finding a variable is only part of the problem
- the real bottleneck is connecting variables to analytical intent
- good analysis depends on background context not present in a single variable label

#### Option E: Re-think the discovery interface

Examples:

- guided “find me demographic breaks” flows
- concept maps
- variable set explorers
- analysis-first navigation instead of variable-first search
- agent-visible recommendations that are closer to browser affordances

Use when:

- even strong retrieval still leaves the agent cognitively overloaded
- the wrong primitive is being optimized
- discovery is less a ranking problem than a workflow-design problem

### What not to do

Do not assume the semantic roadmap is automatically:

heuristics -> embeddings -> RAG

That progression may be wrong.

The right question is:

**What kind of discovery failure are we observing, and what class of capability actually addresses it?**

## 4. Browser convergence layer

Questions:

- Does the browser still have meaningfully better practical power?
- Are agent outputs weaker because the browser has richer affordances that are not shared?
- Are we converging on one product, or merely sharing a backend?

Possible judgments:

- Rough-edge: browser affordances not yet exposed through docs or tools
- Capability gap: missing shared abstractions for charting, curation, cleanup, refinement
- Architecture gap: browser and agent paths still diverge at crucial workflow layers
- Scope gap: full parity may not be worth pursuing for every task class

## 5. Deliverable layer

Questions:

- Can Velocity produce artifacts that humans actually want to review or present?
- Is the artifact quality bottleneck a styling issue, a content-structuring issue, or a missing workflow primitive?
- Are we optimizing analysis correctness while leaving the “last mile” too manual?

Possible judgments:

- Rough-edge: poor defaults, clutter, non-substantive categories, weak chart choices
- Capability gap: missing presentation mode, cleanup pipeline, narrative scaffolding
- Architecture gap: slide specs are too analysis-centric and not authoring-centric enough
- Scope gap: perhaps some presentation-quality ambitions belong outside the current product boundary

## 6. Product-defaults layer

Questions:

- Does the system help the agent make good choices?
- Are we asking the model to supply analytical judgment the product should partly embody?
- Would a weaker model still get somewhere sensible because the product steers it well?

Possible judgments:

- Rough-edge: missing warnings, weak suggestions
- Capability gap: need recommended breaks, significance warnings, narrative templates
- Architecture gap: system has no place to express opinionated guidance cleanly
- Scope gap: some judgment may always remain outside productized defaults

---

## The strategic decision table

Use this table after each serious eval.

| Observation | Likely interpretation | Response class to test first |
|---|---|---|
| Agent succeeds, but only with heavy reasoning and manual probing | Product is under-guiding the task | Rough-edge or capability expansion |
| Agent finds good answers through escape hatches | Intended interface is not sufficient | Interface re-engineering |
| Discovery fails even when labels are decent | Retrieval/ranking layer may be too weak | Capability expansion |
| Discovery fails because agents need analytical pathways, not just search | Search primitive may be wrong | Interface re-engineering |
| Artifact is correct but not usable | Deliverable layer underbuilt | Capability expansion |
| Browser users can do much better from same substrate | Convergence claim not yet real | Architecture re-engineering |
| Success seems dataset-specific and fragile | Thesis not yet validated broadly | Hold benchmark claims; expand evals |
| Solving the gap would require product moves outside intended scope | Product claim may be too broad | Scope revision |

---

## How to use a real-world eval

Each serious eval should produce two outputs:

### Output A: Benchmark result

This is the normal eval output:

- artifact quality
- workflow quality
- methodological quality
- per-layer scores
- pass/fail against the benchmark contract

### Output B: Capability gap review

This is the strategic output:

- what the eval suggests is sufficient today
- what appears insufficient
- whether the limitation looks local or architectural
- what option classes are on the table
- what evidence would justify the next level of investment

Without Output B, the team risks reading every failure as a backlog item instead of a thesis test.

---

## Recommended structure for post-eval capability reviews

After a major eval, write a short companion memo with these sections:

### 1. Task shape

- dataset type
- variable inventory complexity
- deliverable type
- human-quality bar
- intended workflow

### 2. What worked with current capabilities

- where the current product seems sufficient
- where incremental improvement looks viable

### 3. Where the current system may be at its ceiling

- parts that look fundamentally underpowered
- places where agent effort is masking product weakness

### 4. Option space

For each major gap:

- small fix path
- substantial feature path
- re-engineering path
- scope-reduction path

### 5. Recommended next bet

- what to try next
- why this is the right level of intervention
- what outcome would falsify that choice

---

## Applying this to Eval 02

Eval 02 should not only ask whether BSA 2017 can produce a better deck.

It should ask questions like:

### Semantics

- Is heuristic annotation plus search fundamentally enough for large survey discovery?
- If not, is the next step better ranking, TF-IDF/BM25, embeddings, RAG, or a different discovery interface entirely?
- Are demographic-break failures mainly search failures or “wrong primitive” failures?

### Workflow

- Is the MCP/tool surface the right operating model for a multi-step survey project?
- Would composite tools or a different deck-building workflow materially reduce agent flailing?

### Deliverables

- Can deck quality be fixed with better defaults and cleanup?
- Or do we need a more opinionated presentation-authoring mode?

### Convergence

- Is the agent really using the same effective product as the browser user?
- If not, what exact missing affordances are preventing parity?

### Thesis

- Is “first-class analytical interface for agents” already plausible for this task shape?
- Or is the honest conclusion that Velocity is currently a strong analytical backend with partial agent affordances?

Those questions are uncomfortable, but they are exactly what a real eval should help answer.

---

## Decision discipline

The point of this document is not to encourage rewrites.

It is to create a disciplined escalation path:

1. Confirm whether the current approach is actually insufficient.
2. Identify the smallest intervention class that could plausibly change the outcome.
3. Be willing to escalate to larger interventions when the eval evidence justifies it.
4. Be equally willing to narrow claims or scope when the needed intervention no longer fits the product thesis.

That is how the eval program stays strategically honest.

---

## Bottom line

The eval program should do two jobs at once:

1. Measure how well Velocity performs on real analytical tasks.
2. Force an honest judgment about whether the current product direction is sufficient, or whether stronger changes are required.

If we only do the first, we get better benchmarks.

If we also do the second, we get better product strategy.