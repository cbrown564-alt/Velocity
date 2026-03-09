# Design Brief: Phase 4 — Semantic Layer

**Author:** Architect (Claude Opus)
**Date:** 2026-03-09
**Status:** Proposal
**Scope:** Enrich variables with semantic annotations. Add concept entities for cross-dataset linking. Enable semantic search and domain-aware suggestions.
**Ref:** `docs/arch_07_agent_architecture.md` §10 Phase 4
**Depends on:** Phase 3 (Browser Convergence) complete — engine is the single source of truth

---

## 0. Executive Summary & Reality Check

Phase 4 transforms Velocity from a tool that understands variables syntactically (column names, value labels, types) to one that understands them semantically (topics, measurement intent, concept families). This is what makes agent-generated analysis meaningfully better than rule-following.

| Component | Current State | Work Required |
|:---|:---|:---|
| Variable `semanticType` field | **Defined in type** (`src/types/index.ts`: `SemanticType = "text" \| "entity" \| "sentiment" \| "location" \| "temporal"`) | Extend taxonomy, populate on load |
| Concept entity | **Does not exist** | New type + storage + linking logic |
| Semantic search | **Does not exist** | New engine method + indexing |
| Domain-aware suggestions | **Partially exists** (chartRecommender, matchEngine heuristics) | Extend with semantic awareness |
| Harmonization semantic matching | **Exists** (matchEngine uses name + value label similarity) | Enhance with concept-level matching |

**Bottom line:** Phase 4 is the most research-oriented phase. It introduces new abstractions (Concept, SemanticAnnotation) that require design iteration. The approach should be incremental — ship basic annotations first, validate with real datasets, then expand.

---

## 1. Approach

### 1.1 Extended Semantic Annotations

Expand the `Variable` type with richer semantic metadata:

```typescript
interface SemanticAnnotation {
  // Classification
  topic: string;                    // e.g., "brand_perception", "demographics", "media_consumption"
  measurementIntent: MeasurementIntent;
  conceptFamily?: string;           // Links to a Concept entity (e.g., "satisfaction")

  // Provenance
  source: 'auto' | 'manual' | 'agent';  // How was this annotation created?
  confidence: number;               // 0-1 for auto-detected annotations

  // Relationships
  relatedVariables?: string[];      // IDs of semantically related variables
  temporalRole?: 'wave_id' | 'timestamp' | 'period' | null;
}

type MeasurementIntent =
  | 'attitude'          // Likert scales, satisfaction, NPS
  | 'behavior'          // Frequency, purchase, usage
  | 'awareness'         // Aided/unaided awareness, recall
  | 'demographic'       // Age, gender, income, region
  | 'classification'    // Brand, product, category
  | 'outcome'           // Dependent variables, KPIs
  | 'weight'            // Sampling weights
  | 'identifier'        // Respondent ID, case number
  | 'open_end'          // Free-text responses
  | 'other';            // Uncategorized

// Extended Variable type
interface Variable {
  // ... existing fields ...
  semantic?: SemanticAnnotation;    // Optional, populated incrementally
}
```

### 1.2 Auto-Detection Pipeline

On dataset load, after metadata extraction, run a lightweight heuristic classifier:

```typescript
// src/core/semantic/annotator.ts
function autoAnnotate(
  variables: Variable[],
  variableSets: VariableSet[]
): SemanticAnnotation[] {
  // Heuristic rules (fast, no ML):
  // 1. Name patterns: "weight", "wt_*" → intent: weight
  // 2. Name patterns: "resp_id", "caseid" → intent: identifier
  // 3. Value labels containing "Male/Female", "M/F" → intent: demographic, topic: gender
  // 4. Likert-scale value labels (Strongly Agree → Strongly Disagree) → intent: attitude
  // 5. Binary value labels (Yes/No, Aware/Not Aware) → intent: awareness or behavior
  // 6. Variable label keywords: "satisfaction" → topic: satisfaction, family: satisfaction
  // 7. Grid sets with rating labels → intent: attitude
  // 8. Open-ended type → intent: open_end
  // 9. Date format variables → temporalRole: timestamp
}
```

**Confidence scoring:** Each rule assigns a confidence (0.5-0.95 depending on signal strength). Multi-signal matches boost confidence. All auto-annotations are `source: 'auto'`.

**No ML dependency.** The annotator is pure heuristics. ML-based classification (NLP on variable labels, embedding-based matching) is a future extension that could use Pyodide/WebR, but the base system works without it.

### 1.3 Concept Entity

A `Concept` links variables across datasets and waves that measure the same underlying construct:

```typescript
interface Concept {
  id: string;
  name: string;                    // e.g., "Overall Satisfaction"
  aliases: string[];               // Alternative names across datasets
  canonicalScale?: {               // Expected measurement properties
    points: number;                // e.g., 5, 7, 10
    direction: 'ascending' | 'descending';
    anchors?: { low: string; high: string };
  };
  variableRefs: ConceptVariableRef[];
}

interface ConceptVariableRef {
  datasetId: string;
  variableId: string;
  waveId?: string;                 // For longitudinal linking
  matchConfidence: number;
}
```

**Concepts are user-facing.** They appear in the Variable Manager as a grouping/linking mechanism. An agent can query "find satisfaction variables" and get back all variables linked to the "satisfaction" concept, across all loaded datasets.

**Concepts integrate with harmonization.** The existing `matchEngine.ts` uses name/label similarity. With concepts, a variable in Wave 1 called `Q5_satisfaction` and a variable in Wave 2 called `overall_sat` can be linked if they share the `satisfaction` concept. This is a strictly better signal than string matching alone.

### 1.4 Concept Discovery

Two paths to concept creation:

**1. Auto-discovery from annotations:**
```typescript
// After auto-annotation, cluster variables by topic + intent
function discoverConcepts(
  annotations: Map<string, SemanticAnnotation>,
  variableSets: VariableSet[]
): Concept[] {
  // Group by (topic, measurementIntent) pairs
  // Variables in the same group with similar value label structures → same concept
  // e.g., all "satisfaction" + "attitude" variables with 5-point scales → "Satisfaction (5pt)"
}
```

**2. Manual creation by user or agent:**
```typescript
engine.createConcept({
  name: "Overall Satisfaction",
  canonicalScale: { points: 10, direction: 'ascending', anchors: { low: "Not at all satisfied", high: "Extremely satisfied" } }
});

engine.linkVariableToConcept(variableId, conceptId);
```

### 1.5 Semantic Search

Add a search method to the engine that finds variables by meaning, not just name:

```typescript
// Engine method
async searchVariables(query: string, options?: {
  scope?: 'current' | 'all';      // Current dataset or all loaded
  limit?: number;
}): Promise<SemanticSearchResult[]>;

interface SemanticSearchResult {
  variable: Variable;
  datasetId: string;
  relevance: number;               // 0-1 match score
  matchedOn: string[];             // What matched: "topic", "label", "concept", "name"
}
```

**Search algorithm (no embeddings):**

1. **Tokenize query:** "satisfaction variables" → ["satisfaction", "variables"]
2. **Match against:** variable name, label, topic annotation, concept name, concept aliases, value labels
3. **Score:** Weighted combination — concept match (0.4) > topic match (0.3) > label keyword match (0.2) > name match (0.1)
4. **Rank and return** top N results

**Future extension:** Replace token matching with embedding similarity (via Pyodide + sentence-transformers). The API is the same; only the scoring function changes.

### 1.6 Domain-Aware Suggestions

Extend existing recommendation systems with semantic context:

**Chart recommendations:**
```typescript
// Current: purely structural
recommendChart(processedData) → ChartType

// Extended: semantic-aware
recommendChart(processedData, semanticContext?) → ChartRecommendation
// If attitude + Likert scale → prefer diverging-bar
// If demographic breakdown → prefer grouped-bar
// If temporal + continuous → prefer line chart
// If NPS → prefer NPS-specific visualization
```

**Analysis recommendations (new):**
```typescript
engine.suggestAnalyses(variableIds: string[]): AnalysisSuggestion[];

interface AnalysisSuggestion {
  analysisType: string;
  config: unknown;
  rationale: string;               // "These are attitude scales — consider comparing means across demographics"
  priority: 'high' | 'medium' | 'low';
}
```

**Cross-dataset recommendations (new):**
```typescript
engine.suggestHarmonizations(): HarmonizationSuggestion[];

interface HarmonizationSuggestion {
  concept: Concept;
  variables: ConceptVariableRef[];
  confidence: number;
  rationale: string;               // "Q5 in Wave 1 and SAT_OVERALL in Wave 2 both measure 'Overall Satisfaction' on 10-point scales"
}
```

### 1.7 MCP Tool Extensions

New tools for the semantic layer:

| Tool | Engine method | Description |
|:---|:---|:---|
| `velocity_search_variables` | `engine.searchVariables(query)` | Find variables by meaning |
| `velocity_annotate` | `engine.annotateVariable(id, annotation)` | Add/update semantic annotation |
| `velocity_list_concepts` | `engine.listConcepts()` | Get all concepts |
| `velocity_create_concept` | `engine.createConcept(spec)` | Define a new concept |
| `velocity_link_concept` | `engine.linkVariableToConcept(varId, conceptId)` | Link variable to concept |
| `velocity_suggest_analyses` | `engine.suggestAnalyses(varIds)` | Get analysis recommendations |

These tools enable a fundamentally different agent workflow:

```
// Before (Phase 2): Agent must know exact variable names
velocity_crosstab({ rowVars: ["Q5_satisfaction"], colVar: "age_group" })

// After (Phase 4): Agent searches by meaning
velocity_search_variables({ query: "satisfaction" })
→ [{ variable: { id: "Q5_satisfaction", ... }, relevance: 0.95 }]

velocity_suggest_analyses({ variableIds: ["Q5_satisfaction", "age_group"] })
→ [{ type: "crosstab", rationale: "Compare attitude scale across demographic" }]
```

### 1.8 Session Format Extension

Semantic annotations and concepts are persisted in the session file:

```typescript
interface VelocitySessionFile {
  version: 2;  // Bumped from 1
  // ... existing fields ...
  semantic?: {
    annotations: Record<string, SemanticAnnotation>;  // variableId → annotation
    concepts: Concept[];
  };
}
```

**Backward compatibility:** Version 1 sessions import without semantic data. Version 2 sessions degrade gracefully in Version 1 readers (semantic block ignored).

---

## 2. Invariants Touched

| Invariant | Impact | Mitigation |
|:---|:---|:---|
| **Data model integrity** | `Variable` type extended with optional `semantic` field. No breaking change. | Field is optional. All existing code works without it. |
| **Dependency direction** | Semantic annotator in `src/core/semantic/`. No browser deps. | Pure functions, no DOM/React imports. |
| **Session format stability** | Version bump to 2. Backward-compatible. | Migration function converts v1 → v2 on import. |
| **Dual-state principle** | Semantic annotations are metadata, not data. Stored alongside labels. | Annotations don't affect computation. They inform presentation and agent reasoning. |

---

## 3. Risks

| Risk | Severity | Mitigation |
|:---|:---|:---|
| **Annotation accuracy** | **High** | Heuristic annotator will misclassify. Mitigation: all annotations carry `confidence` and `source`. Agent/user can correct. Corrections persist in session. |
| **Concept proliferation** | Medium | Auto-discovery may create too many concepts. Mitigation: merge threshold (concepts with >80% variable overlap are merged). User can delete/merge manually. |
| **Semantic search quality** | Medium | Token-based search is limited (no synonyms, no fuzzy matching). Mitigation: concept aliases provide synonym expansion. Start simple, improve iteratively. |
| **Scope creep** | **High** | Phase 4 is open-ended — "semantic layer" could grow indefinitely. Mitigation: strict scope gates. Ship annotations + search first. Concepts second. Suggestions third. Each is a separate deliverable with its own validation. |
| **Performance (annotation on load)** | Low | Heuristic annotator is O(n) where n = variable count. For 500 variables, <50ms. No compute-heavy operations. |
| **Session format migration** | Low | v1 → v2 is additive (new optional field). No data loss. |

---

## 4. Test Strategy

### 4.1 Annotator Tests

| Test | Coverage |
|:---|:---|
| `annotator.test.ts` | Weight detection: variables named "weight", "wt_*", "W1" → intent: weight |
| | Demographic detection: value labels with "Male/Female" → intent: demographic |
| | Likert detection: 5-point scale with agree/disagree labels → intent: attitude |
| | Identifier detection: "resp_id", "caseid" → intent: identifier |
| | Open-end detection: text type → intent: open_end |
| | Confidence scoring: single signal (0.5-0.7), multi-signal (0.8-0.95) |
| | Real dataset: load brand tracker .SAV → verify >70% annotation accuracy vs manual coding |

### 4.2 Concept Tests

| Test | Coverage |
|:---|:---|
| `concept.test.ts` | Create concept → link variables → verify refs |
| | Auto-discover concepts from annotations → verify grouping |
| | Cross-dataset concept linking → verify harmonization improvement |
| | Concept merge → verify variable refs consolidated |

### 4.3 Semantic Search Tests

| Test | Coverage |
|:---|:---|
| `search.test.ts` | Search "satisfaction" → returns Q5_satisfaction (label match) |
| | Search "demographics" → returns age, gender, income (topic match) |
| | Search with concept alias → returns linked variables |
| | Search across datasets → returns variables from all loaded datasets |
| | Empty query → returns empty (not all variables) |

### 4.4 Suggestion Tests

| Test | Coverage |
|:---|:---|
| `suggestions.test.ts` | Attitude + demographic → suggests crosstab |
| | Two attitude scales → suggests correlation |
| | Temporal variable + measure → suggests trend analysis |
| | Same concept across datasets → suggests harmonization |

### 4.5 Session Migration Tests

| Test | Coverage |
|:---|:---|
| `sessionMigration.test.ts` | v1 session → import → no semantic data, no errors |
| | v2 session with annotations → import → annotations preserved |
| | v2 session → export → reimport → annotations roundtrip |

---

## 5. Performance Expectations

| Operation | Target | Rationale |
|:---|:---|:---|
| Auto-annotation (500 variables) | <50ms | O(n) heuristics, no ML |
| Concept discovery | <100ms | Clustering on annotation groups, small N |
| Semantic search (500 variables) | <10ms | Token matching against in-memory index |
| Analysis suggestions | <20ms | Rule-based against annotation metadata |
| Session export with semantic data | <60ms | Marginal increase over base session export |

---

## 6. Deliverables

| # | Deliverable | Location | LOC Estimate |
|:---|:---|:---|:---|
| 1 | Semantic types | `src/types/semantic.ts` | ~100 |
| 2 | Variable type extension | `src/types/index.ts` | ~10 (edit) |
| 3 | Heuristic annotator | `src/core/semantic/annotator.ts` | ~250 |
| 4 | Concept entity + storage | `src/core/semantic/concepts.ts` | ~200 |
| 5 | Concept discovery | `src/core/semantic/conceptDiscovery.ts` | ~150 |
| 6 | Semantic search | `src/core/semantic/search.ts` | ~120 |
| 7 | Analysis suggestions | `src/core/semantic/suggestions.ts` | ~150 |
| 8 | Engine semantic methods | `src/engine/VelocityEngine.ts` | ~100 (extension) |
| 9 | Session format v2 migration | `src/core/session/` | ~60 (edit) |
| 10 | MCP semantic tools | `mcp-server/tools.ts` | ~120 (extension) |
| 11 | Chart recommender semantic extension | `src/services/chartRecommender.ts` | ~40 (edit) |
| 12 | Annotator tests | `src/core/semantic/__tests__/annotator.test.ts` | ~300 |
| 13 | Concept tests | `src/core/semantic/__tests__/concepts.test.ts` | ~200 |
| 14 | Search tests | `src/core/semantic/__tests__/search.test.ts` | ~150 |
| 15 | Suggestion tests | `src/core/semantic/__tests__/suggestions.test.ts` | ~150 |
| 16 | Session migration tests | `src/core/session/__tests__/` | ~80 |

**Total:** ~2,180 LOC new code

---

## 7. Sequencing

Phase 4 is structured as three independent deliverable tiers, each validated before proceeding:

### Tier A: Annotations (Weeks 1-3)
```
Week 1:  [1] Semantic types → [2] Heuristic annotator
Week 2:  [3] Engine annotation methods → [4] Annotator tests
Week 3:  [5] MCP annotation tools → [6] Validate with real dataset
```

**Gate:** Run annotator against 3 real survey datasets. Target: >70% annotation accuracy vs manual coding. If below threshold, iterate on heuristics before proceeding.

### Tier B: Concepts + Search (Weeks 4-6)
```
Week 4:  [7] Concept entity → [8] Concept discovery
Week 5:  [9] Semantic search → [10] Session v2 format
Week 6:  [11] MCP search/concept tools → [12] Tests + validation
```

**Gate:** Agent workflow test — agent uses `velocity_search_variables` and `velocity_list_concepts` to build a deck without knowing variable names upfront. Success = correct deck with zero INVALID_VARIABLE errors.

### Tier C: Suggestions (Weeks 7-8)
```
Week 7:  [13] Analysis suggestions → [14] Chart recommender extension
Week 8:  [15] Harmonization suggestions → [16] Full regression pass
```

**Gate:** Agent generates suggested analyses for an unseen dataset. At least 3 of 5 suggestions are meaningful (judged by domain expert).

---

## 8. What Phase 4 Unlocks

Phase 4 is the last phase in the agent architecture spec. With it complete:

- **Agents reason about data in domain terms.** "Analyze satisfaction" instead of "crosstab Q5_satisfaction by age_group".
- **Cross-dataset intelligence.** Concepts link variables across waves, enabling longitudinal analysis without manual mapping.
- **Self-documenting analysis.** Semantic annotations explain why an analysis was chosen, making agent-generated decks more interpretable.
- **Foundation for AI-native features.** Embeddings, NLP on open-ends, and automated insight generation all build on the semantic layer.

The agent architecture is complete when Phase 4 ships. Velocity becomes a tool that an AI can use as naturally as a human analyst — understanding not just the structure of the data, but its meaning.
