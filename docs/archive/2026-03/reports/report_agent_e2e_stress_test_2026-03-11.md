# Agent E2E Stress Test Report — sleep.sav
**Date:** 2026-03-11
**Tester:** Claude Sonnet 4.6 (acting as agent)
**Dataset:** `test_data/sleep.sav` — 271 respondents, 59 variables, Australian sleep health survey
**Scope:** Full Phase 3 critical path exercised headlessly: load → describe → annotate → search → suggest → crosstab → deck build → PPTX export → session export
**Artefacts:** `scripts/agent-demo.ts`, `scripts/agent-demo-output.txt`, `scripts/sleep-report.pptx`, `src/engine/__tests__/agent-demo-pptx.test.ts`

---

## 1. Executive Summary

The Phase 3 engine is structurally sound. Every major subsystem executed without a crash. The data pipeline (load → SQL → crosstab → export) is fast and reliable. The PPTX exporter produced a valid 139 KB file in 421ms end-to-end, which is genuinely impressive for a headless local-first tool.

The weak points are concentrated in the intelligence layer: semantic annotation coverage is too shallow for real-world domain data, the suggestion engine produces noise rather than signal, and the headless output loses the value-label resolution that the browser UI does correctly. None of these are architectural failures — they are depth gaps that can be addressed iteratively. The foundation is solid.

---

## 2. What Worked

### 2.1 Data Ingestion
- `loadFile('sleep.sav')` completed in ~130ms on second run (first run ~270ms including DuckDB cold start).
- ReadStat-WASM fallback triggered correctly when the DuckDB `read_stat` extension returned 404. No crash, no data loss. The fallback path is resilient.
- All 59 variables and 44 variable sets were parsed correctly, including type inference (numeric, categorical, ordered).
- Variable labels and value labels were fully preserved from the SAV metadata.

### 2.2 Dataset Description
- `describe()` returns a well-structured object: full variable list with types, value labels, missing value definitions, and variable set groupings.
- The variable type inference was meaningful: `healthrate`, `fitrate`, `weightrate` came through as `ordered`; `sex`, `marital`, `smoke` as `categorical`; continuous measures as `numeric`. These distinctions drive the right downstream behaviour.

### 2.3 Cross-tabulation Engine
- `runAnalysis('crosstab', { rowVars, colVar })` executed in 4–8ms for this 271-row dataset.
- The output structure (`rowKey_0`, `colKey`, `count`, `stats`, `ci95`, `ci80`) was complete and consistent.
- Significance testing config (`significanceLevel: 0.05`) was accepted without error.
- The `ess × marital` crosstab ran without issue.
- Raw SQL via `engine.query()` also worked: the avg sleep hours query returned clean structured rows.

### 2.4 Deck Builder
- `buildDeck()` with a 2-section, 3-slide spec completed in ~16ms.
- Zero build errors across all slides.
- `resolvedTitle`, `resolvedSubtitle`, and `resolvedChartType` all populated correctly.
- Fail-soft behaviour confirmed: the DeckBuilder collects per-slide errors rather than aborting the build.
- The chart recommendation for `qualsleep` returned `diverging-bar` with `stacked-bar`, `grouped-bar`, `grouped-column` as alternatives — semantically correct for a 6-point Likert sleep quality scale.

### 2.5 PPTX Export
- `exportDeck(deck, { format: 'pptx' })` produced a valid binary PPTX.
- File: 139.3 KB, 3 slides, written to disk successfully.
- Ran in ~421ms total end-to-end (load + annotate + build + export).
- The PptxGenJS integration is functional.

### 2.6 Semantic Search
- `searchVariables('sleep quality')` returned `qualsleep`, `qualsleep4gp`, `satissleep`, `troublefallasleep`, `troublestaysleep` — all correct and domain-relevant.
- `searchVariables('demographics gender age')` found `sex`, `age`, `marital`, `edlevel` — also correct.
- The token-based scoring pipeline (label match > name match) works as intended for label-rich SAV files.

### 2.7 Session Export
- `getSession()` returned a valid v2 session with all 59 variables and correct metadata.
- The format version, timestamp, and dataset fingerprint were all populated.

---

## 3. What Didn't Work

### 3.1 Semantic Annotation: 9/59 Variables (15% coverage)

**Observed:** `annotateDataset()` returned `{ annotated: 9, total: 59 }`. Only generic structural variables were annotated: `id`, `sex`, `age`, `marital`, `edlevel`, `weight`, and a handful of others.

**Root cause:** The heuristic annotator (`src/core/semantic/annotator.ts`) fires on name/label patterns matching 9 rules: weight, identifier, temporal, demographic/gender, Likert/NPS attitude, awareness, behavior, open-end, classification. These rules are designed for market research survey nomenclature. The sleep.sav dataset uses clinical/health domain terminology — `ess`, `qualsleep`, `anxiety`, `depress`, `stressmonth`, `troublefallasleep`, `niteshft` — none of which match the annotator's pattern set.

**Impact:** High. The entire semantic intelligence layer degrades with low annotation coverage. Search relevance scores top out at 0.2 (label token match) because no topic or concept enrichment has occurred. The suggestion engine produces only per-variable frequency distributions. Chart recommendations cannot apply semantic overrides.

**Fix required:** The annotator needs either (a) domain vocabulary expansion beyond market research conventions, or (b) a confidence-threshold fallback that annotates by label keyword extraction even when rule confidence is low. For health/clinical datasets: `ess`, `hads`, `sas`, `anxiety`, `depress`, `fatigue` should fire attitude/wellbeing rules. Sleep-specific labels (`qualsleep`, `troublefallasleep`, `hourswkend`) should fire behaviour/attitude rules by label substring.

### 3.2 Analysis Suggestions Are All `variableStats` (Zero Crosstab Suggestions)

**Observed:** `suggestAnalyses([qualsleep.id, sex.id, ess.id, anxiety.id])` returned 4 suggestions, all `variableStats` (frequency distributions), all `priority: low`. No crosstab suggestions were generated despite passing a demographic variable (`sex`) alongside outcome variables.

**Root cause:** The suggestion engine (`src/core/semantic/suggestions.ts`) requires annotated variables with `measurementIntent` to generate cross-variable suggestions. Since only `sex` carried a demographic annotation and `qualsleep`, `ess`, `anxiety` had no annotation, the engine couldn't identify the pattern "demographic × attitude = crosstab".

**Impact:** High for agent workflows. An agent asking "what should I analyse?" gets useless output. The engine can't bootstrap itself into a useful analysis path.

**Fix required:** The suggestion engine should generate crosstab suggestions whenever it sees one categorical/demographic variable alongside at least one other variable, regardless of annotation coverage. Annotation should amplify suggestions, not gate them.

### 3.3 Crosstab Output Uses Raw Codes, Not Value Labels

**Observed:** The crosstab output shows `colKey: 0`, `colKey: 1` for sex (should be "female"/"male") and `rowKey_0: 1–6` for qualsleep (should be "very poor"/"poor"/"fair"/"good"/"very good"/"excellent").

**Root cause:** The headless engine's `runAnalysis('crosstab')` returns raw DuckDB integer codes. Value label resolution is currently done on the React UI side when rendering `DataTable`. The `DeckBuilder.buildSlide()` calls `processAnalysisData()` but that function operates on the raw crosstab output and doesn't have access to the variable's `valueLabels` map.

**Impact:** Medium for the headless path, high for agent legibility. An agent reading crosstab output to reason about findings cannot interpret `colKey: 0` without a separate lookup. The PPTX output with raw codes is also not presentation-ready.

**Fix required:** `DeckBuilder.buildSlide()` already has access to `this.engine.describe().dataset.variables`. It should resolve `rowKey_0` and `colKey` to their human-readable labels before returning `BuiltSlide`. This is a one-pass enrichment after the analysis runs.

### 3.4 `exportDeck` Fails in `tsx`/Node.js Direct Execution

**Observed:** Running `exportDeck` via `npx tsx` throws `TypeError: PptxGenJS is not a constructor`. The same call works correctly inside Vitest.

**Root cause:** `pptxgenjs` is a CJS module. Vite's bundler (used by Vitest and the browser build) correctly handles the CJS default export as a constructor. `tsx`'s Node.js ESM interop does not — it wraps the module differently, making `PptxGenJS` the module namespace object rather than the constructor function.

**Impact:** Low in production (the browser and MCP server both run through the bundler). Moderate for developer tooling — any script or CLI that imports the engine and calls `exportDeck` will fail in raw Node.js. The `mcp-server/` package runs through `tsx` in dev mode (`"dev": "tsx index.ts"`), meaning the MCP server's `velocity_export_deck` tool is likely broken in dev mode.

**Fix required:** In `pptxExporter.ts`, change the import to a dynamic CJS-safe form, or add a runtime guard:
```typescript
// Instead of: import PptxGenJS from 'pptxgenjs';
const PptxGenJSModule = await import('pptxgenjs');
const PptxGenJS = PptxGenJSModule.default ?? PptxGenJSModule;
```
This handles both Vite's bundled ESM context and Node.js CJS interop uniformly.

### 3.5 Session Export Does Not Capture Deck Slides

**Observed:** After `buildDeck()` produced 3 slides, `getSession()` returned `slides: 0`.

**Root cause:** `buildDeck()` is a pure computation — it materialises analysis results from a `DeckSpec` but does not write anything back to the engine's session state. The session's `slides[]` array tracks UI-authored slides (those saved via the Analysis Deck in the browser), not programmatically built ones.

**Impact:** Medium. An agent that builds a deck, exports it to PPTX, and then exports the session has no way to recover the deck structure from the session on reload. The session is incomplete relative to what was produced.

**Fix required:** `buildDeck()` should optionally write the built slides back into the engine's session slides array. Or there should be an explicit `engine.commitDeck(builtDeck)` method. The agent workflow `build → export PPTX → save session → reload session → rebuild` should be a coherent round-trip.

### 3.6 Processed Slide Row Counts Are Misleading

**Observed:** `ess × marital` showed `1 rows` in the processed output. `qualsleep × sex` showed `6 rows`. These don't match the raw crosstab row counts (4 and 12 respectively).

**Root cause:** `processAnalysisData()` in `DeckBuilder.buildSlide()` pivots the flat `(rowKey, colKey, count)` rows into a column-oriented structure. The `processed.rows` count reflects unique row values (after pivot), not raw crosstab cells. This is correct behaviour, but it isn't labelled clearly — a consumer reading `slide.processed.rows.length === 1` for an ESS crosstab would assume something went wrong.

**Impact:** Low functional impact; high legibility impact for agents consuming the deck programmatically.

---

## 4. Observations That Need Attention (Not Failures, But Gaps)

### 4.1 The `read_stat` Extension 404 Is Noisy and Slow

Every engine instantiation that loads a SAV file attempts a network request to `extensions.duckdb.org` for the `read_stat` extension, gets a 404, then falls back to ReadStat-WASM. This adds ~100–150ms on first run and prints a multi-line error to stderr that looks like a failure even when it isn't.

The extension URL failure is a DuckDB version mismatch (`v1.4.4` vs the dev pin `1.33.1-dev18.0`). Since the fallback always succeeds and the DuckDB version is intentionally pinned, this network attempt should be suppressed or short-circuited. The warning should be at `debug` level, not `error` level.

### 4.2 Semantic Search Scores Are Uncalibrated (Max 0.2 on Real Data)

The scoring formula weights: concept match (0.4) > topic (0.3) > label (0.2) > name (0.1). With only 15% annotation coverage, the top possible score for domain-relevant variables is 0.2 (label match only). A score of 0.2 is not meaningfully distinguishable from 0.1 (name match). In practice, the results are correctly ordered but the scores communicate nothing useful to a consumer.

The search function should normalise output scores to the range actually achievable given current annotation state, or should clearly document that scores only become meaningful after full annotation. An agent that thresholds results by score (e.g., "only use results with relevance > 0.5") would reject everything from an unannotated dataset.

### 4.3 Chart Recommendation Does Not Use Processed Data Shape

The `recommendChart` call for `qualsleep` returned `diverging-bar`, which is semantically correct for a Likert scale. But this recommendation was made without knowing the actual distribution shape, column count, or whether the data is weighted. It's pure type-based inference. For a dataset where the column break (sex) has only 2 values and the row variable has 6 values, a `stacked-bar` or `horizontal-bar` would render more cleanly than `diverging-bar`. The recommendation engine should factor in cardinality.

### 4.4 No `describeVariable` Was Exercised With Real Stats

The demo didn't call `describeVariable()`, which returns per-variable frequency distributions and percentile stats. For `ess` (Epworth Sleepiness Scale, a sum score 0–24), this would return the actual score distribution — mean, median, percentiles — which is exactly what a clinical researcher needs before choosing an analysis. This capability exists and works; it just wasn't surfaced in the agent flow because there was no obvious decision point that prompted using it.

This is a workflow design issue: the suggestion engine should recommend `describeVariable` for scale variables before recommending crosstabs.

---

## 5. Ideas Generated from End-to-End Testing

### 5.1 Domain Vocabulary Packs for the Annotator

The annotator needs to be extensible beyond its 9 built-in rules. A "domain pack" concept would allow the engine (or an MCP-connected agent) to load vocabulary for a specific survey domain:

- **Health/clinical pack:** Recognises HADS, ESS, SAS, PHQ, GAD, SF-36, WHOQOL constructs by name pattern and label keywords.
- **Market research pack:** Brand awareness, NPS, purchase intent, ad recall, demographic breaks.
- **Academic survey pack:** Likert agreement scales, political efficacy, social trust items.

These packs could ship as JSON files and be loaded at engine creation time. An LLM could also generate a domain pack on-the-fly given a dataset description.

### 5.2 Agent-Assisted Annotation Bootstrap

When annotation coverage is low, the engine could emit a structured prompt that an LLM agent (the MCP client) could respond to with annotations. Flow:

1. `annotateDataset()` runs heuristics, returns `{ annotated: 9, total: 59, unannotated: [list of variable summaries] }`.
2. Agent receives the unannotated list with name + label + value labels.
3. Agent calls `velocity_annotate` for each with LLM-inferred topic and intent.
4. Full annotation achieved without hard-coded rules.

This would make the semantic layer genuinely powerful: the LLM provides the domain knowledge, the engine provides the structure and persistence.

### 5.3 Session as Agent Memory

The current session format is designed for human UI persistence (reopening a file where you left off). For agent workflows, it should also serve as memory across invocations. Specifically:

- Store the agent's completed analyses as `DeckSlide` entries in the session.
- Store the agent's concept definitions and manual annotations.
- On reload, the agent picks up from where it left off without re-running everything.

This is mostly a workflow convention issue: `buildDeck()` should write back to the session, and the agent should call `exportSession()` as its final step. The infrastructure is there; the convention is missing.

### 5.4 Crosstab-First Suggestion Strategy

The suggestion engine generates suggestions bottom-up (per variable). It should instead reason top-down: "given these variables, what is the most informative analysis?"

For a dataset with one demographic variable (sex) and several outcome variables (qualsleep, ess, anxiety, depress), the highest-value analysis is always a crosstab of outcomes by demographic. The suggestion engine should emit:
- `priority: high` — "sex × qualsleep, ess, anxiety (demographic breakdown of outcomes)"
- `priority: medium` — "qualsleep × anxiety (within-domain correlation exploration)"
- `priority: low` — "frequency distributions for each variable"

The framework for this exists; the logic inside `suggestions.ts` needs a crosstab-first heuristic that fires when it detects the demographic + outcome variable pattern regardless of full annotation.

### 5.5 Value Label Resolution as a First-Class Engine Output

Currently, value label resolution happens in the browser UI layer. Any headless consumer (MCP agent, CLI, test) gets raw integer codes. This is a leaky abstraction: the engine knows the value labels (they're in `variable.valueLabels`) but doesn't apply them to query output.

A clean fix: add a `resolveLabels: boolean` option to `runAnalysis` and `query`. When true, the engine post-processes the result set and replaces coded values with their labels. This would make headless output immediately human-readable without requiring the consumer to maintain a separate label lookup.

### 5.6 Streaming Deck Build for Large Decks

The current `buildDeck()` executes slides sequentially and returns the full `BuiltDeck` at the end. For a large deck (20+ slides), this means waiting for all analyses before getting any result. An async generator pattern would let the agent stream slide results as they complete:

```typescript
for await (const slide of engine.buildDeckStream(spec)) {
  // process each slide as it's ready
}
```

This is a nice-to-have for responsiveness, not a correctness issue.

### 5.7 MCP Tool for Direct Session Round-Trip

There is no MCP tool that combines build-deck + export-pptx + export-session in one atomic call. An agent has to chain three tool calls, and the intermediate state (the `BuiltDeck` object) must be passed from one call to the next — which can be large and awkward over stdio.

A `velocity_produce_report` tool that takes a `DeckSpec` and returns `{ pptxBase64, sessionFile }` would be a more ergonomic agent interface for the common "produce a report" workflow.

### 5.8 Weighted Analysis Was Not Tested

The sleep.sav dataset has a `weight` variable. The demo never called `engine.setWeight()`. The weighted crosstab path (which touches the most complex statistical code — effective sample size, design effects, weighted significance tests) was not exercised. This is a gap in the stress test, not a known bug, but it should be explicitly tested in a follow-up: `setWeight('weight')` → rerun the same crosstabs → verify that weighted counts differ from unweighted and that the `isWeighted: true` flag is set in the envelope metadata.

---

## 6. Summary Scorecard

| Area | Status | Notes |
|------|--------|-------|
| SAV ingestion | ✓ Working | ReadStat-WASM fallback reliable; read_stat 404 warning is noise |
| Dataset description | ✓ Working | Types, labels, variable sets all correct |
| Crosstab engine | ✓ Working | Fast (4–8ms), structurally correct, significance config accepted |
| Raw SQL | ✓ Working | Full DuckDB SQL surface exposed correctly |
| Deck builder | ✓ Working | Fail-soft, spec-driven, fast |
| PPTX export | ✓ Working (Vite only) | CJS interop bug breaks tsx/Node direct execution |
| Chart recommendation | ✓ Working | Correct type inference; cardinality-blind |
| Semantic search | △ Shallow | Correct results, uncalibrated scores due to low annotation |
| Semantic annotation | ✗ Insufficient | 15% coverage on domain data; rules too narrow |
| Analysis suggestions | ✗ Not useful | All `variableStats`/`low` due to annotation gap |
| Value label resolution | ✗ Missing in headless | Raw codes in engine output; labels only in browser |
| Session round-trip | △ Incomplete | Doesn't capture deck slides; no agent memory pattern |
| Weighted analysis | ? Untested | Path exists, not exercised in this test |

---

## 7. Recommended Next Actions (Prioritised)

1. **[P0] Fix value label resolution in headless output.** Add a post-processing pass in `DeckBuilder.buildSlide()` to map coded values to labels. Required for agent-legible output and presentation-ready PPTX.

2. **[P0] Fix pptxgenjs CJS interop in tsx context.** One-line fix in `pptxExporter.ts`. Unblocks the MCP server's `velocity_export_deck` in dev mode.

3. **[P1] Expand semantic annotator with domain vocabulary.** Add keyword-matching rules for health/clinical terminology. Minimum viable: match `ess`, `hads`, `anxiety`, `depress`, `fatigue`, `stress`, `quality`, `satisfied` in variable labels to attitude/wellbeing intent.

4. **[P1] Add crosstab-first logic to suggestion engine.** Detect demographic + outcome variable pattern, emit `priority: high` crosstab suggestions regardless of annotation coverage.

5. **[P2] Implement `engine.commitDeck()` or write-back from `buildDeck()`.** Close the session round-trip loop for agent workflows.

6. **[P2] Suppress or demote the read_stat 404 warning.** It's not an error; the fallback always succeeds. Should be debug-level logging.

7. **[P3] Add `resolveLabels` option to `runAnalysis` and `query`.** Opt-in label resolution for headless consumers.

8. **[P3] Design and document agent annotation bootstrap workflow.** Define the protocol for LLM-assisted annotation of unannotated variables via MCP.
