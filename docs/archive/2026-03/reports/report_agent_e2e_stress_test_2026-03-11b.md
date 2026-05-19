# Agent E2E Stress Test — Re-run After Fixes
**Date:** 2026-03-11 (re-run)
**Baseline:** `docs/report_agent_e2e_stress_test_2026-03-11.md`
**Commits tested:** `73b987f`, `b73f4d4`
**Dataset:** `test_data/sleep.sav` — 271 respondents, 59 variables
**Runtime:** tsx (Node.js CJS path) + Vitest (Vite/ESM path)

---

## 1. Executive Summary

Three of the four P0/P1 issues from the baseline report are resolved. The most consequential change is annotation coverage: **9/59 → 30/59 variables (15% → 51%)**, which unlocks the suggestion engine. It now produces 8 suggestions (4 `priority: high` crosstabs) where previously it produced only `variableStats/low` noise. The PPTX export from `tsx` is fixed. The `commitDeck()` round-trip is now available.

Two structural gaps remain that were not targeted in this sprint: the `runAnalysis` direct output still returns raw integer codes, and the semantic annotation state is not captured in the session export. Both are bounded, well-understood problems with clear fixes.

---

## 2. Fix-by-Fix Impact

### 2.1 pptxgenjs CJS Interop Fix (§3.4) — ✅ Resolved

**Before:** `TypeError: PptxGenJS is not a constructor` when running via `tsx`.
**After:** PPTX export completes successfully from both paths:

| Path | Status | File size | Duration |
|------|--------|-----------|----------|
| `tsx` (Node CJS) | ✅ Passes | 139.3 KB | ~40ms |
| Vitest (Vite/ESM) | ✅ Passes | 139.3 KB | ~370ms total |

The dynamic `import('pptxgenjs')` with `.default ?? mod` guard works correctly in both execution contexts. No regressions. This unblocks the MCP server's `velocity_export_deck` tool in dev mode.

---

### 2.2 Semantic Annotator — Health/Clinical Vocabulary (§3.1) — ✅ Major improvement

**Before:** 9/59 annotated (15%). Only generic structural variables (id, sex, age, marital, edlevel, weight) were captured.

**After:** 30/59 annotated (51%).

Newly annotated by Rule 10 (health/clinical domain), sampled:
- `qualsleep` → `health_wellbeing / attitude` (label: "quality of sleep" → `/\bsleep\b/i`)
- `qualsleep4gp` → `health_wellbeing / attitude`
- `satissleep` → `health_wellbeing / attitude` (matches both `/satisf/i` and `/\bsleep\b/i`)
- `troublefallasleep` → `health_wellbeing / attitude` (name pattern + label)
- `troublestaysleep` → `health_wellbeing / attitude`
- `hourswkend`, `hourweeknight`, `hourneed` → `health_wellbeing / attitude` (sleep hours labels)
- `ess` → `health_wellbeing / attitude` (name `/\bess\b/i`)
- `anxiety` → `health_wellbeing / attitude` (label `/\banxiet/i`)
- `depress` → `health_wellbeing / attitude` (label `/\bdepress/i`)
- `stressmonth` → `health_wellbeing / attitude` (label `/\bstress/i`)
- `niteshft` → `health_wellbeing / attitude` (name `/^niteshft$/i`)

**Residual gap (29 variables):** Variables with no label keyword and no matching name pattern remain unannotated. Examples: `smoke`, `smokenum`, `alchohol`, `caffeine`, `bmi`, `healthrate` (the label "general health" doesn't match the current keyword set). Rule 10 is strictly keyword-based; these require either a broader vocabulary or label-content inference.

---

### 2.3 Analysis Suggestions — Crosstab-First Fallback (§3.2) — ✅ Resolved

**Before:** 4 suggestions, all `variableStats / low`. No crosstabs.

**After:** 8 suggestions for `[qualsleep, sex, ess, anxiety]`:

| Priority | Type | Rationale |
|----------|------|-----------|
| `high` | crosstab | "quality of sleep" across demographic "sex" |
| `high` | crosstab | "epworth sleepiness scale" across demographic "sex" |
| `high` | crosstab | "HADS Anxiety" across demographic "sex" |
| `high` | crosstab | Compare 3 attitude scales side-by-side |
| `low` | variableStats | Frequency for qualsleep |
| `low` | variableStats | Frequency for sex |
| `low` | variableStats | Frequency for ess |
| `low` | variableStats | Frequency for anxiety |

The annotation-based path (attitudes × demographics) is now firing correctly because `qualsleep`, `ess`, `anxiety` are now annotated as `attitude` and `sex` as `demographic`. The crosstab-first type-based fallback added in `suggestions.ts` is present as a safety net but was not needed for this dataset once annotation coverage improved — which is the correct outcome.

**Root cause confirmed:** The suggestion engine was correct. The problem was annotation depth, not suggestion logic.

---

### 2.4 commitDeck() Session Round-Trip (§3.5) — ✅ Implemented

`engine.commitDeck(deck)` is now available. The demo script does not call it (it was not updated), so Step 12 still shows `Slides: 0`. This is expected — it is an agent workflow convention, not an automatic behaviour.

**Usage for agents:**
```typescript
const deck = (await engine.buildDeck(spec)).data;
await engine.exportDeck(deck, { format: 'pptx' });
engine.commitDeck(deck);  // ← new step
const session = engine.getSession();  // now includes slides
```

Covered by e2e Step 8 test, which passes.

---

## 3. Outstanding Issues (Unchanged)

### 3.1 `runAnalysis` Direct Output — Raw Codes (§3.3) — ✗ Not fixed

The demo crosstab output still shows `rowKey_0: 5`, `colKey: 1` (raw DuckDB integer codes). The **DeckBuilder path** (`buildDeck` → `processed`) does resolve labels — this is correct. The gap is specifically the **direct `runAnalysis()` / `query()` output** used by agents reading raw results.

**Affected workflow:** An agent calling `velocity_crosstab` to reason about findings before deciding which slides to build cannot interpret `colKey: 0` vs `colKey: 1` without a separate lookup of `sex.valueLabels`.

**Fix path:** Add `resolveLabels: boolean` option to `runAnalysis` crosstab config (§5.5 from baseline). Estimated effort: ~45 min. Remains at P2.

---

### 3.2 Semantic Annotations Not Captured in Session — New Finding

**Observed:** Step 12 shows `Semantic state: none` despite 30 variables being annotated in Step 4.

**Root cause:** `VelocityEngine.getSession()` calls `exportSessionFile()` which constructs the session from `this.dataset`, `this.slides`, etc. It does include a `semantic` field, but the engine's `getSemanticState()` must be called and passed explicitly. Looking at `VelocityEngine.getSession()`: it does not call `this.getSemanticState()` or pass semantic data to `exportSessionFile`. The annotations live only in `this.semanticAnnotations` (in-memory Map) and are not written to the session file.

**Impact:** An agent that annotates, exports the session, then reloads it loses all annotations and must re-annotate. For the LLM-assisted annotation bootstrap workflow (§5.2 from baseline), this is a blocking gap — there's no persistence for manual LLM annotations.

**Fix path:** In `VelocityEngine.getSession()`, pass `semanticAnnotations` state to the session exporter. The types exist (`VelocitySessionFile.semantic`, `getSemanticState()`); the wiring is just missing. Estimated effort: ~20 min. Recommend elevating to P1.

---

### 3.3 Search Score Ceiling Unchanged (§4.2) — △ Partial improvement

Search results are ordered correctly (relevant variables rank first), but the maximum score for any variable remains **0.200** (label token match weight). This is because the search scoring formula weights concept match (0.4) > topic (0.3) > label (0.2) > name (0.1), but none of the returned variables have their topic or concept matched against the query term "sleep quality" — the annotator assigns topic `health_wellbeing`, which doesn't match "sleep" or "quality" as tokens.

**Indirect improvement:** With 30 annotated variables, the search index is richer and variables that *do* have matching concept/topic annotations would score higher. But for this dataset, `health_wellbeing` is not matched by the "sleep quality" query, so scores remain at label-match ceiling.

**Outstanding fix:** The search scorer should match annotator topics against query tokens. `health_wellbeing` should match "health", "wellbeing", "sleep", "quality" when those tokens appear in variable labels. Alternatively, annotate `qualsleep` with a more specific topic (`sleep_quality`) rather than the generic `health_wellbeing` bucket.

---

### 3.4 Processed Row Counts Misleading After Pivot (§3.6) — ✗ Not fixed

ESS × marital shows `1 rows` in `slide.processed.rows`. Quality of sleep × sex shows `6 rows`. These are correct post-pivot counts (unique row variable values), but are misleading for agents reading the deck programmatically.

No action taken. Low functional impact; remains a labelling/documentation issue.

---

### 3.5 read_stat 404 Stderr Noise (§4.1) — ✗ Not fixed

The DuckDB extension download attempt still produces a multi-line stderr block on every engine instantiation. This is DuckDB's internal logging and cannot be suppressed via the application layer without intercepting stderr at the process level. The fallback is reliable; the noise is cosmetic.

---

## 4. Scorecard — Before vs After

| Area | Before | After | Notes |
|------|--------|-------|-------|
| SAV ingestion | ✓ | ✓ | Unchanged |
| Dataset description | ✓ | ✓ | Unchanged |
| Crosstab engine | ✓ | ✓ | Unchanged |
| Raw SQL | ✓ | ✓ | Unchanged |
| Deck builder | ✓ | ✓ | Unchanged |
| PPTX export (Vite) | ✓ | ✓ | Unchanged |
| PPTX export (tsx/Node) | ✗ CJS crash | ✓ | **Fixed** |
| Chart recommendation | ✓ | ✓ | Unchanged |
| Semantic search | △ 0.2 ceiling | △ 0.2 ceiling | Results correct; scores uncalibrated |
| Semantic annotation | ✗ 9/59 (15%) | △ 30/59 (51%) | **Improved**; 29 vars still unannotated |
| Analysis suggestions | ✗ All variableStats/low | ✓ 4 high-priority crosstabs | **Fixed** |
| Value labels in raw output | ✗ Raw codes | ✗ Raw codes | Not fixed (P2) |
| Session — deck slides | ✗ 0 | △ commitDeck() available | **Capability added**; demo not updated |
| Session — semantic state | ✗ None | ✗ None | **New finding** — wiring missing |
| Weighted analysis | ? Untested | ? Untested | Still not exercised |

---

## 5. Recommended Next Actions (Updated)

1. **[P1] Wire semantic annotations into session export.** ~20 min. In `VelocityEngine.getSession()`, call `this.getSemanticState()` and pass to `exportSessionFile`. Without this, annotation work is lost on session reload — blocking the LLM-assisted annotation bootstrap workflow.

2. **[P2] Add `resolveLabels` option to `runAnalysis`.** ~45 min. Post-process crosstab rows to replace coded values with value labels. Makes agent-facing raw output human-readable without going through DeckBuilder.

3. **[P2] Refine health/clinical annotator topics.** ~30 min. Replace the generic `health_wellbeing` topic bucket with variable-specific topics (`sleep_quality`, `sleep_behavior`, `mental_health`, `physical_health`). This improves search score relevance — the search query "sleep quality" would match topic `sleep_quality` at 0.3 weight instead of label-only at 0.2.

4. **[P2] Update demo script to call `commitDeck()`.** ~5 min. Add `engine.commitDeck(deck)` before Step 12 so the session export reflects the built deck. Documents the agent workflow convention.

5. **[P3] Add annotator coverage for unlabelled health variables.** `smoke`, `smokenum`, `alchohol`, `caffeine`, `bmi`, `healthrate` remain unannotated. Requires either label keyword expansion ("smoking", "body mass", "alcohol") or a more aggressive label-content inference pass.

6. **[P3] Weighted analysis test.** Still not exercised: `engine.setWeight('weight')` → rerun crosstabs → verify `isWeighted: true` in envelope metadata.
