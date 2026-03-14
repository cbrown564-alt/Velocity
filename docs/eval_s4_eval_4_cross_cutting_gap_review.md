# S4-EVAL-4 Cross-Cutting Capability Gap Review

## Purpose

This document is the primary deliverable of S4-EVAL-4. It synthesizes the six executed eval evidence packages (EVAL-01 through EVAL-06) into per-layer strategic assessments that classify each gap and recommend the right level of intervention.

Use with:

- [design_s4_eval_4_capability_gap_review.md](/Users/cobro/Code/Velocity/docs/design_s4_eval_4_capability_gap_review.md) — the design brief governing this review
- [eval_00_capability_gap_review.md](/Users/cobro/Code/Velocity/docs/eval_00_capability_gap_review.md) — the gap classification framework
- [eval_00_outcome_decision_framework.md](/Users/cobro/Code/Velocity/docs/eval_00_outcome_decision_framework.md) — the scoring rubric and outcome patterns
- [plan_phase4_agent_capability_validation.md](/Users/cobro/Code/Velocity/docs/plan_phase4_agent_capability_validation.md) — the Phase 4 mandate

---

## Executive Summary

The Phase 4 eval portfolio validates the following strategic picture:

**Velocity's analytical engine is strong enough to support agent-led research across all six task families tested.** The engine scored 4–5 on every eval. Computation, provenance, export, and session mechanics work.

**The product is not yet a complete agent-facing interface.** Two layers are consistently weak enough to limit real agent work: semantic discovery (mean 3.0, with one score of 2) and MCP/workflow breadth (mean 3.0, with three scores of 2). A third layer — product defaults (mean 3.5) — is too passive to guide agents toward good analytical choices.

**The honest product claim supported by current evidence is:**

> Velocity is a strong analytical backend with a proven engine, working export, and narrow browser-agent convergence. It is not yet a first-class agent-facing analytical interface, because the layers that guide agent behavior — discovery, workflow coverage, and opinionated defaults — are still materially weaker than the computational substrate.

The gap between "strong backend" and "agent interface" is primarily a **capability expansion** problem, not an architecture rewrite or scope revision. The six recommended interventions below are all within the current product thesis.

---

## Layer 1: Engine

### Score Summary

| Eval | Score | Notes |
|---|---|---|
| EVAL-01 | 4 | Deck build memory pressure on richer specs; no stats error |
| EVAL-02 | 5 | 654-variable weighted survey; all operations correct |
| EVAL-03 | 4 | Session state coherent across import/refinement/re-export |
| EVAL-04 | 5 | Both surfaces produced identical controlled analysis |
| EVAL-05 | 5 | Harmonized table built in 18.6 ms; no correctness issue |
| EVAL-06 | 5 | 176.6 MB WVS loaded via chunked path without failure |
| **Mean** | **4.7** | |

### Assessment

**Gap classification: No gap. Thesis validated.**

The engine is the strongest layer in the product. `VelocityEngine`, `ResultEnvelope` provenance, `DeckBuilder`, session format v2, and the worker-backed chunked load path all performed as designed across small, large, and stress-scale datasets.

The only engine-adjacent issue was EVAL-01's deck build memory/serialization pressure, but that is better attributed to the MCP transport layer (§Layer 2) than to the engine itself.

### What worked

- Crosstab computation with weighting, filtering, and multi-row analysis
- Deck building with chart recommendation, section structure, and PPTX export
- Session commit, export, import, and round-trip
- Chunked large-file ingestion with metadata-first guardrail
- Provenance wrapping via ResultEnvelope

### Recommended intervention

None. Carry forward as a validated baseline.

---

## Layer 2: MCP / Workflow

### Score Summary

| Eval | Score | Notes |
|---|---|---|
| EVAL-01 | 2 | Missing deck-commit tool; OOM on richer deck builds |
| EVAL-02 | 4 | End-to-end MCP path viable; discovery was the bottleneck, not workflow |
| EVAL-03 | 4 | MCP-produced session was a valid browser baseline |
| EVAL-04 | 4 | Agent path completed cleanly; build-commit-export sequence is explicit but workable |
| EVAL-05 | 2 | Harmonization only reachable from browser, not MCP |
| EVAL-06 | 2 | Stress path is browser-real but not MCP-real |
| **Mean** | **3.0** | |

### Assessment

**Gap classification: Capability expansion (primary) + rough-edge (secondary).**

The MCP surface covers single-dataset deck workflows adequately (EVAL-02 and EVAL-04 both scored 4). The weakness is coverage breadth: three major product capabilities — harmonization, large-file stress handling, and multi-dataset workspace operations — are currently browser-only in practice.

This is not an interface re-engineering problem. The MCP dispatch-to-engine model is correct. The problem is that several engine capabilities do not yet have MCP tool wiring.

### What worked with current capabilities

- Single-dataset load → describe → analyze → build deck → export PPTX → commit deck → export session
- Weighted analysis through MCP on 654-variable survey (EVAL-02)
- Session round-trip: MCP-authored sessions importable in browser (EVAL-03, EVAL-04)

### Where the current system is at its ceiling

1. **Multi-dataset / workspace operations have no MCP surface.** The agent quickstart is explicitly single-dataset. Harmonization (EVAL-05) succeeded only through the browser workspace.

2. **Large-file guardrail has no MCP equivalent.** The metadata-first gate and chunked load path (EVAL-06) are browser-native. An MCP agent hitting WVS would need equivalent flow.

3. **Deck build transport limit.** EVAL-01's 9-slide chart-heavy deck caused OOM at the MCP stdio boundary. The engine built the deck correctly, but the transport layer could not serialize the full `BuiltDeck` payload.

### Option space

| Gap | Small fix | Substantial feature | Re-engineering | Scope reduction |
|---|---|---|---|---|
| Missing multi-dataset MCP tools | — | Add `velocity_load_workspace`, `velocity_propose_mappings_workspace`, `velocity_harmonize` MCP tools that dispatch to existing engine methods | Redesign MCP around a workspace-first session model | Accept that harmonization is browser-only for now |
| Missing large-file MCP flow | Add metadata-only load mode to existing `velocity_load_dataset` | Add `velocity_load_metadata` + `velocity_load_full` two-step flow | — | Accept that stress-scale files require browser |
| Deck build transport limit | Increase Node heap default | Stream slide results instead of returning one giant JSON blob | Replace stdio with a chunked artifact protocol | Limit agent deck size to N slides |

### Recommended next bet

**Capability expansion: Add workspace-aware MCP tools and a metadata-first load flow.**

- Priority 1: `velocity_load_metadata` + `velocity_load_full` two-step flow for large files
- Priority 2: Multi-dataset workspace tools dispatching to existing engine harmonization methods
- Priority 3: Stream or chunk `buildDeck` responses to avoid transport-layer OOM

**Why this is the right size:** The engine methods already exist. The work is wiring, not architecture. The three scores of 2 all share the root cause of "browser has the path, MCP does not."

**What would falsify this:** If adding the MCP tools reveals that the engine methods themselves are not suitable for agent-driven orchestration (e.g., they require too much browser-resident state), then the intervention class escalates to interface re-engineering.

---

## Layer 3: Semantic / Discovery

### Score Summary

| Eval | Score | Notes |
|---|---|---|
| EVAL-01 | 3 | Topic search worked; demographic discovery returned wrong variables |
| EVAL-02 | 2 | NHS, trust, and demographics queries returned wrong top-ranked results on 654-var survey |
| EVAL-03 | 4 | Semantic state preservation was the test, not discovery |
| EVAL-05 | 3 | Discovery viable only because adjacent files had strong naming continuity |
| EVAL-06 | 3 | Bounded label-level orientation worked; broader discovery untested |
| **Mean** | **3.0** | |

### Assessment

**Gap classification: Capability expansion.**

This is the central weakness in the product. Two distinct failure modes are present:

**Failure mode 1 — Missing navigational primitive (category-level).** The agent asks "find me demographic breaks" and the system returns topically-scored variables (`stressmonth`, `impact1`) instead of the obvious break variables (`sex`, `age3gp`, `marital`, `edlevel`). The current search model has no concept of "demographic" as a variable category. It only has text-token scoring. This is not a ranking problem — it is a missing abstraction.

**Failure mode 2 — Ranking degradation on large inventories.** When the variable count exceeds ~100, top-ranked search results for analytical queries ("NHS satisfaction", "government trust") become unreliable. The current scoring weights (concept 0.4, topic 0.3, label 0.2, name 0.1) work for exact-match topic queries but degrade on analytical intent queries where the relevant variable name may be abbreviated or indirect.

### Semantic Option Study

Per Phase 4 plan §4 and `eval_00_capability_gap_review.md` §"Semantic option ladder", each option is assessed against the two failure modes.

#### Option A: Better heuristics + category filters

**What it does:** Improve the annotator's category detection rules (the existing 9-rule annotator already classifies demographics, but the search layer does not expose annotation-type as a filterable dimension). Add a `listVariablesByCategory(category)` discovery tool that returns all variables matching a semantic annotation type.

**Addresses:** Failure mode 1 directly. If the agent can say "show me all demographic-annotated variables," the demographic-break problem is solved without better ranking.

**Does not address:** Failure mode 2. Ranking quality on large inventories is unchanged.

**Effort:** Small (days). The annotator already tags demographics. The work is exposing that as a discovery primitive.

**Risk:** Low. This is additive and does not change existing search behavior.

#### Option B: TF-IDF / BM25 over variable metadata

**What it does:** Replace or augment the current token-scoring model with proper term-frequency weighting across variable names, labels, value labels, and concept descriptions. Build an inverted index at dataset load time.

**Addresses:** Failure mode 2. Proper TF-IDF would down-weight common terms and up-weight distinctive terms, improving ranking on large inventories where many variables share similar vocabulary.

**Does not address:** Failure mode 1 directly, though better ranking may incidentally help.

**Effort:** Medium (1–2 weeks). Requires building and maintaining an index, plus integrating it with the existing search API.

**Risk:** Medium. The index must be built inside the worker (main-thread compute constraint). Performance on 600+ variable datasets needs validation.

#### Option C: Embedding-based retrieval

**What it does:** Compute vector embeddings over variable labels and value-label summaries. Enable nearest-neighbor search for discovery.

**Addresses:** Both failure modes if synonym/concept drift is the real issue.

**Does not address:** Category-level navigation (failure mode 1) unless embeddings are fine-tuned on survey metadata, which is unlikely to happen soon.

**Effort:** Large (weeks+). Requires an embedding model (either server-side or WASM), vector storage, and a hybrid ranking strategy.

**Risk:** High. Breaks the local-first constraint if a server-side model is required. May be overkill — the evidence does not show synonym drift as the primary problem.

#### Option D: Retrieval-augmented discovery workflows

**What it does:** Retrieval over annotations, codebooks, prior analyses. Returns not just variables but candidate breaks, caveats, and related analyses.

**Addresses:** A different problem: "what to analyze" rather than "which variable."

**Effort:** Large.

**Risk:** Wrong level of abstraction for the current bottleneck. The evals show agents struggling to find the right variables, not struggling to decide what to do with variables once found.

#### Option E: Re-think the discovery interface

**What it does:** Guided discovery flows: "find me demographic breaks for this topic variable," "suggest good banner variables," "show me variable sets by analytical role."

**Addresses:** Failure mode 1 directly. The problem is not that search returns bad results — it is that "search" is the wrong primitive for category-level analytical navigation.

**Effort:** Medium. Requires product design and new engine/MCP methods.

**Risk:** Medium. Depends on the annotator's category detection being accurate enough to power the guided flows.

#### Recommendation

**Implement A + E as the first intervention. Hold B as the defined escalation. Do not pursue C or D at this time.**

The evidence is clear: the primary discovery failure is not ranking quality or synonym drift. It is a missing navigational primitive. The agent cannot say "show me demographics" because the system does not expose annotation categories as a discoverable dimension.

Option A (expose annotation types as a filter) and Option E (guided category-level discovery) directly address failure mode 1 with proportionate effort. Option B (TF-IDF/BM25) is the defined escalation if, after A+E, failure mode 2 still prevents large-survey discovery from scoring above 3.

**What would falsify A+E:** If after implementing category-aware discovery, EVAL-02 still scores 2 because the annotator's demographic classification is too inaccurate or because the real problem is ranking among 200+ variables within a single category, then Option B becomes necessary.

---

## Layer 4: Browser Convergence

### Score Summary

| Eval | Score | Notes |
|---|---|---|
| EVAL-03 | 4 | Browser import/refinement/re-export works but import diagnostics are rough |
| EVAL-04 | 4 | Browser and MCP outputs materially comparable on bounded 5-slide task |
| EVAL-05 | 4 | Browser workspace path works; MCP cannot reach harmonization yet |
| EVAL-06 | 4 | Browser stress path validated; MCP equivalent not yet tested |
| **Mean** | **4.0** | |

### Assessment

**Gap classification: Rough-edge (primary) + capability expansion (secondary, via MCP coverage — see Layer 2).**

Convergence is better than expected. EVAL-04 proved that on a controlled deck task, browser and MCP outputs are materially comparable. The remaining divergence is:

1. **Top-level working-state semantics.** Browser session exports include the last active table config; MCP session exports do not. This is a rough-edge.
2. **Last-mile editability.** The browser has richer inline editing affordances. This is an intentional asymmetry — different interaction modes, not different powers.
3. **Workflow coverage asymmetry.** Harmonization and stress paths are browser-first. This is the same gap described in Layer 2.

### Recommended intervention

- **Rough-edge:** Align browser and MCP session export semantics so top-level working state is preserved consistently.
- **Capability expansion (cross-referenced to Layer 2):** MCP tools for workspace and large-file workflows will close the most meaningful remaining convergence gap.

**What would falsify this:** If a future eval runs the same task through both paths on a larger or messier dataset and finds that the browser still produces materially better outputs due to hidden analytical affordances (not just editability), then the classification escalates to interface re-engineering.

---

## Layer 5: Deliverable Quality

### Score Summary

| Eval | Score | Notes |
|---|---|---|
| EVAL-01 | 4 | 9-slide PPTX with sections and finding-based titles |
| EVAL-02 | 5 | 13-slide weighted deck with editorial titles and session handoff |
| EVAL-03 | 4 | Refined session is reviewable and portable |
| EVAL-04 | 5 | Both paths exported comparable PPTX decks and sessions |
| EVAL-05 | 4 | Reviewable counts export and browser session; no first-class harmonization export |
| EVAL-06 | 4 | Findings summary and session; no polished stress-report format |
| **Mean** | **4.3** | |

### Assessment

**Gap classification: Rough-edge.**

Deliverable quality is adequate. The product can produce presentation-quality decks with sections, editorial titles, and session handoff. The remaining issues are polish:

1. Chart clutter on richer or multi-variable slides (EVAL-01 narrowed the impact section to avoid this)
2. No first-class export format for harmonization results (EVAL-05 produced a counts CSV, not a polished report)
3. No stress-report format (EVAL-06 produced ad hoc findings markdown)
4. Generic `_wave = 1/2` markers in harmonized output instead of original wave identifiers (EVAL-05)

### Recommended intervention

- Fix chart recommendation for multi-variable slides so clutter is reduced at the product level
- Preserve original wave identifiers in harmonized exports
- Defer first-class harmonization and stress report formats to post-Phase-4 unless S4-EVAL-5 synthesis says otherwise

**What would falsify this:** If a future eval shows that agents consistently produce decks that are correct but unusable because the chart recommendation and slide layout are fundamentally too weak, then the classification escalates to capability expansion (a presentation-authoring mode).

---

## Layer 6: Product Defaults

### Score Summary

| Eval | Score | Notes |
|---|---|---|
| EVAL-01 | 3 | No warning about body-weight variable; over-emphasized sex comparisons |
| EVAL-02 | 3 | Identified WtFactor but no guidance on break variables or theme narrowing |
| EVAL-03 | 3 | Import adjustments surfaced but root cause not explained |
| EVAL-04 | 4 | Shared defaults strong enough for bounded task |
| EVAL-05 | 4 | Auto-match defaults were strong; bounded confirmation discipline worked |
| EVAL-06 | 4 | Large-file guardrail behaved as a product feature |
| **Mean** | **3.5** | |

### Assessment

**Gap classification: Capability expansion.**

The product is too passive once the agent has selected variables. It computes correctly but does not help the agent make good analytical choices. Specific missing capabilities:

1. **Recommended breaks.** After the agent selects a topic variable, the system should suggest demographic or thematic break variables based on annotation types and variable metadata. Currently the agent must guess or search.

2. **False-positive warnings.** The system should warn when a variable name suggests a survey weight but the variable is actually a measurement (e.g., body weight in EVAL-01's `sleep.sav`). The annotator already has weight-detection rules, but they do not surface warnings when a non-weight variable has a weight-like name.

3. **High-cardinality guardrails.** The system should warn when a crosstab will produce an unusably large number of rows (e.g., a metric variable with 30+ unique values used as a row variable).

4. **Theme-narrowing guidance on large surveys.** When the dataset has 600+ variables, the system should help the agent scope its analysis rather than leaving theme selection entirely to operator reasoning.

### Recommended intervention

- **Priority 1:** Recommended break variables surfaced through a new engine method and MCP tool (ties to Layer 3 discovery work)
- **Priority 2:** False-positive warnings for weight-like variable names
- **Priority 3:** High-cardinality row-variable warnings before crosstab execution
- Defer theme-narrowing guidance to post-Phase-4; it depends on stronger discovery (Layer 3)

**What would falsify this:** If after implementing recommended breaks and warnings, agents still make analytically weak choices, then the problem may require a more opinionated analysis-planning mode (capability expansion → interface re-engineering).

---

## Layer 7: Agent Prompting

### Score Summary

| Eval | Score | Notes |
|---|---|---|
| EVAL-01 | 3 | Workflow docs initially omitted deck-commit step |
| EVAL-02 | 4 | Brief and playbook supported disciplined run |
| EVAL-03 | 4 | Brief kept the task bounded |
| EVAL-04 | 4 | Brief isolated interface differences from prompt drift |
| EVAL-05 | 4 | No-improvisation discipline kept run inspectable |
| EVAL-06 | 4 | Tight scope control prevented ad hoc exploration |
| **Mean** | **3.8** | |

### Assessment

**Gap classification: Rough-edge.**

Agent prompting is not the bottleneck. The EVAL-01 score of 3 was caused by a product gap (missing deck-commit tool) that has since been fixed. The remaining prompting issues are minor:

- Stats-object field naming confusion (EVAL-02 gap review; documented and fixed)
- No systematic examples for multi-dataset workflows (will improve naturally as MCP coverage expands)

### Recommended intervention

Continue improving `guide_agent_quickstart.md` and `agent_analysis_workflow.md` as new MCP tools are added. No dedicated intervention needed.

---

## Summary: Intervention Priority Matrix

| Priority | Layer | Gap class | Intervention | Depends on |
|---|---|---|---|---|
| **P1** | Semantic / discovery | Capability expansion | Category-aware discovery: expose annotation types as a filterable dimension; add `listVariablesByCategory` tool; add guided "suggest breaks for topic X" flow | None |
| **P2** | MCP / workflow | Capability expansion | Workspace-aware MCP tools: `velocity_load_metadata` + `velocity_load_full` two-step flow; multi-dataset workspace tools | Engine methods already exist |
| **P3** | Product defaults | Capability expansion | Recommended break variables; false-positive warnings; high-cardinality guardrails | P1 (annotation quality gates the recommendation) |
| **P4** | Browser convergence | Rough-edge | Align session export working-state semantics | P2 (MCP coverage closes the main convergence gap) |
| **P5** | Deliverable quality | Rough-edge | Chart recommendation polish; wave-identifier preservation in harmonized exports | None |
| **P6** | Agent prompting | Rough-edge | Continued docs improvement | P2 (new tools need new docs) |
| — | Engine | No gap | No intervention | — |

### Escalation Triggers

| If this happens... | Escalate to... |
|---|---|
| Category-aware discovery still leaves EVAL-02 at score 2 | Option B: TF-IDF/BM25 for ranking quality |
| MCP workspace tools reveal engine methods need browser-resident state | Interface re-engineering of harmonization engine methods |
| Recommended breaks still lead to weak analysis choices | More opinionated analysis-planning mode |
| Future convergence eval shows hidden analytical affordances, not just editability | Interface re-engineering of browser-only capabilities |

---

## Gate Check: Strategic Sufficiency (Phase 4 Gate 3)

Per Phase 4 plan §"Gate 3: Strategic sufficiency":

> Decide whether the current design is strong enough to refine, or whether one or more areas require capability expansion or re-engineering.

**Answer:** The current design is strong enough to refine. The engine and export substrate are validated. The gaps are in discovery, workflow coverage, and defaults — all of which are capability expansion problems within the current architectural thesis. No layer requires interface re-engineering or scope revision based on current evidence.

The roadmap does not need to change direction. It needs to change emphasis: the next wave of work should focus on the agent-guidance layers (discovery, MCP breadth, defaults) rather than on engine or export capabilities.

---

## Gate Check: Benchmark Honesty (Phase 4 Gate 2)

Per Phase 4 plan §"Gate 2: Benchmark honesty":

> Identify where results came from product strength versus model brute force.

**Answer:** The three Pattern 7 successes (EVAL-04, 05, 06) succeeded partly because they were deliberately bounded to avoid the weakest layers. EVAL-04 pre-assigned slide topics. EVAL-05 used adjacent files with naming continuity. EVAL-06 focused on known query targets. These are real successes, but they should not be mistaken for evidence that open-ended agent work is already smooth.

EVAL-01 and EVAL-02 — the two evals that required open-ended discovery — both dropped to Pattern 2 or Pattern 4. That is where product strength versus model brute force is most visible. The agent got to good results, but it required significant reasoning effort to compensate for weak discovery and passive defaults.

**Benchmark claim that is currently supportable:** Velocity can support agent-authored decks and sessions on well-labeled surveys when the agent can navigate the dataset. It cannot yet support efficient large-survey discovery without significant agent effort.

---

## Independent Review: Correcting Self-Assessment Bias

The layer scores above were produced by the agent evaluating its own work. Independent examination of the actual artifacts reveals several gaps that the self-assessment either missed entirely or classified too generously. These corrections materially change the priority matrix.

### Finding 1: PPTX visual quality is not client-presentable (Deliverable layer downgraded from 4.3 → 2.5)

The agent scored deliverable quality 4–5 because the data was correct and the deck had titles and sections. But "presentation-ready" means something different to a stakeholder who needs to share this with clients or executives.

**What the screenshot actually shows (EVAL-04 agent deck, slide 3):**
- Each bar in a single-series chart gets a **different color** (green, blue, black, salmon). This is the palette cycling bug: `chartColors` in `pptxExporter.ts:206` applies the full 5-color array to every bar in a single series, so PptxGenJS assigns one color per data point rather than one color for the series. A standard bar chart should use a single color for all bars in one series, or a semantically meaningful gradient.
- Massive whitespace gaps between bars — PptxGenJS default `barGapWidthPct` is not configured
- Axis labels are tiny and hard to read at presentation scale
- No gridlines to guide the eye across values
- The overall aesthetic is "default charting library output" rather than "designed presentation"

**What this means:** The deliverable layer was scored as if "structurally correct deck" = "presentation-ready." It is not. A Displayr, Qualtrics, or SPSS user comparing Velocity's PPTX output to their existing tools would see a significant quality regression. This is not a rough-edge — it is a **capability gap** in the export rendering pipeline that affects every chart-based slide across all evals.

**Root cause:** The chart export code (`pptxExporter.ts:198-261`) applies minimal configuration to PptxGenJS. No bar gap control, no gridline styling, no axis tick formatting, no data label positioning, no single-series color handling. The D3 chart renderer in the browser is far more sophisticated, but none of that rendering intelligence carries over to PPTX export.

**Corrected classification:** Capability expansion. The chart rendering defaults need substantive work, not just polish. This should be P2 priority, not P5.

### Finding 2: MCP crosstab return format is fundamentally wrong for agent consumption (new gap, not previously identified)

The agent never flagged this because it can reason over any data shape. But the MCP `velocity_crosstab` tool returns results in **long/tidy format** (one row per cell: `col_value, col_label, row_value, row_label, weighted_count, pct`), not as a standard crosstab matrix.

**Why this matters:**
- Agents must mentally pivot the data to reason about cross-tabulated relationships
- Any CSV artifact the agent produces is in this raw computation format — the `happiness_by_generalized_trust.csv` from EVAL-06 is literally the engine's internal row-per-cell output, not a recognizable crosstab
- A stakeholder receiving this CSV would not recognize it as a crosstab
- The browser performs the pivoting in `analysisProcessor.ts` to display as a matrix, but the MCP surface returns the pre-pivoted raw data

**What this means:** The product has two fundamentally different data surfaces: the browser shows a proper matrix crosstab; the agent gets raw computation output. This is a convergence failure that was never scored because the agent — being a language model — can work with any format. But "can work with it" is not the same as "gets the same effective product." A human reviewing the agent's artifact sees something alien.

**Corrected classification:** Capability expansion (P2). The engine or MCP layer needs a `formatCrosstab()` method that returns matrix-shaped output, or `velocity_crosstab` needs a `format: 'matrix'` parameter.

### Finding 3: EVAL-05 harmonization tested none of the semantic matching capabilities (eval coverage gap)

The agent scored EVAL-05 as Pattern 7 (end-to-end success) and classified harmonization as "benchmark baseline validated." But the eval tested **only exact-name matching** (`srh3_hrs → srh3_hrs` with a composite score of 1.0 and zero warnings).

**What was NOT tested:**
- **Jaro-Winkler fuzzy matching** (`matchEngine.ts:28-76`): handles name drift like `health_satisf_w4 → hsq_final_w5`. Never exercised.
- **Jaccard value-label overlap** (`matchEngine.ts:86-100`): handles partial label remapping. Never exercised.
- **Scale inversion detection** (`matchEngine.ts:137-163`): catches flipped Likert scales between waves. Never exercised.
- **Type compatibility scoring** (`matchEngine.ts:110-127`): handles `nominal → ordinal` drift. Never exercised.
- **Data loss detection** (`matchEngine.ts:172-179`): identifies orphaned value codes. Never exercised.

The auto-match engine scored 433 of 436 variables, but the eval only confirmed one perfect-match variable. This tells us the workflow plumbing works but gives **zero signal** on whether the matching algorithm is actually useful on real-world longitudinal drift — which is the entire point of harmonization.

**What this means:** The semantic option study in the previous version of this review focused entirely on discovery search quality. It missed the harmonization matching quality question entirely. The harmonization matching engine has sophisticated algorithms (Jaro-Winkler + Jaccard + type compat + scale inversion) that have unit test coverage but have never been validated on a real cross-wave scenario with actual naming drift, label remapping, or scale inversions.

**Corrected classification:** The harmonization eval needs a follow-on run with a construct that has naming differences, partial label overlap, or scale inversions. Without this, the claim that "harmonization workspace is execution-real" is only true for the trivial case.

### Finding 4: The "bounded success" pattern inflates the overall picture

Three of six evals (EVAL-04, 05, 06) achieved Pattern 7 specifically because the task was scoped to avoid the weakest areas. This is legitimate for proving plumbing works, but the synthesis should not treat these the same as EVAL-02's Pattern 4 result, which tested the product under realistic conditions.

A more honest severity assessment:
- EVAL-01: **Significant** (MCP workflow scored 2 on a low-difficulty task)
- EVAL-02: **Significant** (discovery scored 2 on the most realistic eval)
- EVAL-03: **Moderate** (handoff works with rough edges)
- EVAL-04: **Passing but narrow** (convergence only on pre-bounded task)
- EVAL-05: **Incomplete** (trivial test case; matching capabilities untested)
- EVAL-06: **Passing but narrow** (browser stress validated; agent path untested)

### Revised Priority Matrix

| Priority | Layer | Gap class | Intervention | Revision note |
|---|---|---|---|---|
| **P1** | Semantic / discovery | Capability expansion | Category-aware discovery (unchanged) | — |
| **P2** | Deliverable quality | Capability expansion | **Chart rendering overhaul:** fix single-series color cycling, add bar gap control, gridlines, axis formatting; close the D3→PPTX quality gap | **Upgraded from P5 rough-edge** |
| **P2** | MCP data format | Capability expansion | **Crosstab matrix format:** add `format: 'matrix'` to `velocity_crosstab` so agents receive standard pivot-shaped output | **New gap — not in original review** |
| **P3** | MCP / workflow | Capability expansion | Workspace-aware MCP tools (unchanged) | — |
| **P4** | Product defaults | Capability expansion | Recommended breaks + warnings (unchanged) | — |
| **P5** | Eval coverage | Follow-on eval | **Harmonization re-run** on a construct with naming drift, partial label overlap, or scale inversions | **New — EVAL-05 result is incomplete** |
| **P5** | Browser convergence | Rough-edge | Align session export semantics (unchanged) | — |

### Cross-cutting theme: computation vs communication

The underlying pattern across findings 1, 2, and 3 is the same: **the product is optimized for computing correct answers, not for communicating them.** The engine is genuinely strong. But every layer between computation and human consumption — chart rendering, data formatting, artifact presentation, harmonization review — shows the same gap: technically correct output that a professional would not share.

This is not a rough-edge problem. It is the central product challenge for Phase 5: closing the "last mile" between correct computation and professional-quality deliverables, across both the agent and browser surfaces.

---

## Appendix: Evidence Index

| Eval | Scorecard | Gap Review | Key evidence |
|---|---|---|---|
| EVAL-01 | `evals/eval-01/runs/run-2026-03-13/scorecard.md` | `evals/eval-01/runs/run-2026-03-13/gap_review.md` | MCP deck + session on sleep.sav; deck-commit blocker fixed |
| EVAL-02 | `evals/eval-02/runs/run-2026-03-13/scorecard.md` | `evals/eval-02/runs/run-2026-03-13/gap_review.md` | Weighted 13-slide deck on BSA 2017; discovery bottleneck |
| EVAL-03 | `evals/eval-03/runs/run-2026-03-13/scorecard.md` | `evals/eval-03/runs/run-2026-03-13/gap_review.md` | Browser handoff round-trip; semantic export fix |
| EVAL-04 | `evals/eval-04/runs/run-2026-03-13/scorecard.md` | `evals/eval-04/runs/run-2026-03-13/gap_review.md` | Controlled browser-vs-MCP convergence baseline |
| EVAL-05 | `evals/eval-05/runs/run-2026-03-13/scorecard.md` | `evals/eval-05/runs/run-2026-03-13/gap_review.md` | Bounded ELSA harmonization baseline |
| EVAL-06 | `evals/eval-06/runs/run-2026-03-13/scorecard.md` | `evals/eval-06/runs/run-2026-03-13/gap_review.md` | WVS stress baseline |
