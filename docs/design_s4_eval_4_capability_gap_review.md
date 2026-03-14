# S4-EVAL-4 Design Brief: Capability Gap Review

## 1. Scope and Objective

S4-EVAL-4 takes the six executed eval evidence packages from S4-EVAL-3 and produces the strategic assessments required by the Phase 4 plan §4 ("Capability Gap Investigation"):

- Per-layer cross-cutting gap classification across all six evals
- A semantic/discovery option study
- Workflow surface assessment
- Deliverable and convergence assessments
- Per-gap intervention class assignment (rough-edge / capability expansion / interface re-engineering / scope revision)

The output is not a backlog. It is a product decision package that tells S4-EVAL-5 what to synthesize and the roadmap what to prioritize.

**Done checks** (from Phase 4 plan §4):
- Every major gap is assigned an intervention class
- At least one option-set review exists for semantic discovery
- The team has explicit evidence for why the chosen next bet is the right size

---

## 2. Evidence Summary

### 2.1 Cross-Eval Layer Scores

| Layer | EVAL-01 | EVAL-02 | EVAL-03 | EVAL-04 | EVAL-05 | EVAL-06 | Mean | Assessment |
|---|---|---|---|---|---|---|---|---|
| Engine | 4 | 5 | 4 | 5 | 5 | 5 | 4.7 | **Validated.** |
| MCP / workflow | 2 | 4 | 4 | 4 | 2 | 2 | 3.0 | **Weak.** Access-path asymmetry. |
| Semantic / discovery | 3 | 2 | 4 | N/A | 3 | 3 | 3.0 | **Weak.** Central bottleneck. |
| Browser convergence | N/A | N/A | 4 | 4 | 4 | 4 | 4.0 | **Adequate.** Narrow parity proven. |
| Deliverable quality | 4 | 5 | 4 | 5 | 4 | 4 | 4.3 | **Adequate.** |
| Product defaults | 3 | 3 | 3 | 4 | 4 | 4 | 3.5 | **Weak.** Too passive. |
| Agent prompting | 3 | 4 | 4 | 4 | 4 | 4 | 3.8 | **Adequate.** Not the bottleneck. |

### 2.2 Outcome Patterns

| Eval | Pattern | Dataset difficulty |
|---|---|---|
| EVAL-01 | Pattern 2: good insight, painful workflow | Low–Medium |
| EVAL-02 | Pattern 4: agent lost in discovery | High |
| EVAL-03 | Pattern 2: good insight, painful workflow | Low |
| EVAL-04 | Pattern 7: end-to-end success | Low |
| EVAL-05 | Pattern 7: end-to-end success | High (bounded) |
| EVAL-06 | Pattern 7: end-to-end success | High (bounded) |

### 2.3 Key Observation

The three Pattern 7 successes (EVAL-04, 05, 06) all share a characteristic: the task was deliberately bounded to avoid the two weakest layers (semantic discovery and MCP workflow breadth). When the task requires open-ended discovery on a large dataset (EVAL-02) or exercises the full MCP lifecycle on a richer deck (EVAL-01), the product drops to Pattern 2 or Pattern 4.

This is the central strategic insight: **the engine and export substrate is strong, but the layers that guide agent behavior — discovery, workflow breadth, and product defaults — are the ceiling.**

---

## 3. Approach: Seven Gap Assessments

S4-EVAL-4 will produce seven gap assessments, one per scored layer. Each assessment follows the structure from `eval_00_capability_gap_review.md` §"Recommended structure for post-eval capability reviews":

1. **Task shapes where the layer was tested** — which evals, which datasets, which difficulty levels
2. **What worked with current capabilities** — where the layer is already sufficient
3. **Where the current system may be at its ceiling** — where agent effort masks product weakness
4. **Option space** — for each gap: small fix path / substantial feature path / re-engineering path / scope-reduction path
5. **Recommended intervention class** — rough-edge / capability expansion / interface re-engineering / scope revision
6. **Recommended next bet** — what to try next, why it is the right size, and what outcome would falsify it

The seven assessments will be written into a single document: `docs/eval_s4_eval_4_cross_cutting_gap_review.md`.

In addition, the semantic discovery layer gets a dedicated option study as required by the Phase 4 plan §4.

### 3.1 Preliminary Gap Classifications

Based on the evidence, the following preliminary classifications will be tested and refined during execution:

#### Engine (mean 4.7) — No gap to classify

The engine thesis is validated for all six task families. No intervention required at this phase.

#### MCP / Workflow (mean 3.0) — Capability expansion + rough-edge

Three of six evals scored 2 (EVAL-01, EVAL-05, EVAL-06). All three share the same root cause: the MCP surface covers the single-dataset deck workflow but does not yet cover harmonization, stress/large-file workflows, or richer deck construction without hitting transport limits.

- **Rough-edge component:** EVAL-01's missing `velocity_commit_deck` was fixed mid-flight; similar small omissions may remain.
- **Capability expansion component:** Multi-dataset workspace operations and large-payload resilience need real MCP surface, not just browser-native paths.
- **Not interface re-engineering:** The MCP model itself (tool calls dispatching to engine) is not the wrong abstraction. The problem is coverage breadth, not design direction.

#### Semantic / Discovery (mean 3.0) — Capability expansion

The central weakness. EVAL-02 scored 2 (the lowest non-N/A score in the entire portfolio). Demographic and category-level navigation fails even when variable labels are decent. Topic-level search works for known terms but not for analytical navigation ("find me the demographic breaks").

This gets the dedicated option study (§4 below).

#### Browser Convergence (mean 4.0) — Rough-edge

Narrow parity is proven (EVAL-04). The remaining gaps are:
- Top-level working-state divergence in session exports
- Browser has richer last-mile editability
- Harmonization and stress paths are browser-first

These are rough-edge and coverage issues, not architectural divergence.

#### Deliverable Quality (mean 4.3) — Rough-edge

Decks and sessions are usable. The remaining issues are polish:
- Chart clutter on richer specs
- No first-class harmonization export format
- No stress-report export

#### Product Defaults (mean 3.5) — Capability expansion

The product is too passive once the agent has found variables. Missing:
- Recommended demographic breaks after topic selection
- Warnings about common false positives (body-weight variables, high-cardinality variables)
- Significance guardrails for small cell sizes
- Theme-narrowing guidance on large surveys

This is a real capability gap, not just a defaults problem. The system needs to be more opinionated.

#### Agent Prompting (mean 3.8) — Rough-edge

Playbooks and briefs are adequate. The remaining issues are narrow:
- MCP workflow docs initially omitted deck-commit (fixed)
- Stats-object field naming confusion (fixed)
- No harm in continued docs improvement, but this is not the bottleneck

---

## 4. Semantic Discovery Option Study

Per Phase 4 plan §4, the semantic layer gets a dedicated option-set review. This study will be a section within the cross-cutting review, structured against the option ladder from `eval_00_capability_gap_review.md` §"Semantic option ladder":

### 4.1 Evidence to Interpret

| Eval | Discovery score | Key failure mode |
|---|---|---|
| EVAL-01 | 3 | Demographics query returned stress/impact variables instead of sex/age/marital/education |
| EVAL-02 | 2 | NHS, trust, and demographics queries returned wrong top-ranked variables on 654-var survey |
| EVAL-03 | 4 | Not a discovery eval; semantic state preservation was the test |
| EVAL-05 | 3 | Discovery was viable only because adjacent IFS files had strong naming continuity |
| EVAL-06 | 3 | Bounded label-level orientation worked, but broader exploratory discovery untested |

### 4.2 Failure Mode Analysis

Two distinct failure modes emerge:

1. **Category-level navigation failure:** The agent asks "find me demographic breaks" and the system returns topically-scored variables instead. This is not a synonym problem or a label-quality problem. It is a missing navigational primitive — the system does not understand "demographic" as a variable category, only as a text token to match.

2. **Ranking quality on large inventories:** When the variable count exceeds ~100, top-ranked results from topic queries become unreliable. The scoring model (concept 0.4 > topic 0.3 > label 0.2 > name 0.1) works for exact-match topic queries but degrades when the query is analytical ("NHS satisfaction") rather than lexical ("NHSSat").

### 4.3 Options to Evaluate

| Option | What it addresses | Estimated effort | Risk |
|---|---|---|---|
| **A. Better heuristics + category filters** | Failure mode 1: add annotation-type filters ("show me all demographic variables") and improve the annotator's demographic/break detection rules | Small (days) | May not improve ranking quality at all |
| **B. TF-IDF / BM25 over variable metadata** | Failure mode 2: replace or augment token-scoring with proper term-frequency weighting over names, labels, value labels, and concept descriptions | Medium (1–2 weeks) | Requires building an index; may still miss category-level navigation |
| **C. Embedding-based retrieval** | Both failure modes if synonym/concept drift is the real issue | Large (weeks+) | Heavy dependency; may be overkill if the real problem is navigational primitives |
| **D. Retrieval-augmented discovery** | Neither failure mode directly — this addresses "what to analyze" rather than "which variable" | Large | Wrong level of abstraction for the current bottleneck |
| **E. Re-think the discovery interface** | Failure mode 1 directly: guided "show me demographics" / "suggest breaks for this topic" flows | Medium | Requires product design, not just retrieval engineering |

### 4.4 Preliminary Recommendation

The evidence suggests the right first intervention is **A + E combined**: improve the annotator's category detection (so "demographic" actually matches demographic variables) and add a discovery affordance that lets agents ask for variables by annotation category rather than only by text search.

**Why not B or C first:** The primary failure mode is not lexical mismatch or synonym drift. It is that the system has no concept of "demographic" as a navigable variable category. Better ranking will not fix a missing navigational primitive.

**What would falsify this:** If after implementing category-aware filtering, EVAL-02 still scores 2 on discovery because the real problem turns out to be ranking quality on large inventories, then Option B (TF-IDF/BM25) becomes the next escalation.

---

## 5. Deliverables

| Deliverable | Format | Purpose |
|---|---|---|
| Cross-cutting gap review | `docs/eval_s4_eval_4_cross_cutting_gap_review.md` | The primary S4-EVAL-4 output: seven layer assessments with gap classifications, option spaces, and recommended interventions |
| Semantic option study | Section within the cross-cutting review | Dedicated option-set analysis for discovery improvements |
| Updated tracker | `docs/tracker_00_implementation_status.md` | Move S4-EVAL-4 to `Done` with evidence links |

No new code, tests, or contract changes are expected from S4-EVAL-4. This is a pure strategic assessment workstream.

---

## 6. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Over-reacting to discovery weakness by proposing embeddings or RAG prematurely | High | The option study structure forces explicit comparison of intervention classes before recommending |
| Under-reacting by calling everything a "rough-edge fix" | High | The cross-eval scoring table makes it hard to dismiss layers scoring 2–3 across multiple evals |
| Scope creep into S4-EVAL-5 synthesis territory | Medium | S4-EVAL-4 classifies gaps and recommends interventions; it does NOT write the roadmap reset or freeze baselines — that is S4-EVAL-5 |
| Missing a gap because it only surfaced in one eval | Low | The seven-layer structure forces every scored layer to be assessed even if only one eval tested it |

---

## 7. Invariants Touched

- **No code changes.** S4-EVAL-4 is a strategic assessment, not an implementation stream. If the review reveals an urgent blocker, it should be flagged for S4-EVAL-5 or post-Phase-4 work, not fixed inline.
- **Interpretation discipline.** Every gap must be classified into exactly one of the four response classes. "Needs more investigation" is not a valid classification — it must at least state a preliminary class and name what evidence would change it.
- **Engine boundary respected.** Recommendations must not propose moving business logic into transport layers or breaking the core/engine/MCP seam.

---

## 8. Definition of Done

S4-EVAL-4 is complete when:

1. `docs/eval_s4_eval_4_cross_cutting_gap_review.md` exists and covers all seven layers
2. Every layer with mean score < 4.0 has an explicit gap classification with option space
3. The semantic discovery section contains a structured option study comparing at least Options A through E
4. Each recommended intervention names what outcome would falsify it
5. `docs/tracker_00_implementation_status.md` can move S4-EVAL-4 from `Not started` to `Done` with evidence links

---

## 9. Recommended Immediate Next Action

**Write `docs/eval_s4_eval_4_cross_cutting_gap_review.md`.**

The design brief is done. The evidence is read. The preliminary classifications are set. The next step is to execute the seven gap assessments and finalize the semantic option study into the cross-cutting review document.
