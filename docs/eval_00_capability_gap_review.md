# Agent Eval Capability Gap Review

## Purpose

This document is a companion to:

- [eval_00_agent_interface_validation.md](/Users/cobro/Code/Velocity/docs/eval_00_agent_interface_validation.md)
- [eval_00_outcome_decision_framework.md](/Users/cobro/Code/Velocity/docs/eval_00_outcome_decision_framework.md)

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
