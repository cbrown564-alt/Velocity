# Statistical Engine Architecture Review (January 2026)

**Document Status:** Critical Analysis
**Review Date:** 2026-01-24
**Scope:** `arch_04_statistical_engine.md` implementation vs. design intent
**Reviewer Context:** Market Assessment, MVP PRD, Visionary PRD alignment

---

## Executive Summary

The `arch_04_statistical_engine.md` document describes a **Survey-Native** statistical methodology that is partially implemented but contains some over-engineering for the current product stage. Given the anchoring documents (MVP PRD's "Friday 4PM Test" and the Market Assessment's positioning against Displayr/SPSS), I recommend a **pragmatic pruning** of the statistical roadmap.

**Key Findings:**
- ✅ Core methodology (ESS, Welch's T-Test) is correctly implemented
- ⚠️ Weighted mean/stddev calculation has unimplemented TODO (correctness bug)
- 🔴 Proposed Phase 2 features (pairwise letters, FDR, TSL) are premature for MVP positioning
- 📊 Missing validation suite to prove accuracy parity with SPSS (critical for market trust)

---

## 1. Implementation Gap Analysis

### ✅ Fully Implemented & Correct

| Feature | Location | Implementation Notes |
|---------|----------|---------------------|
| **Welch's T-Test** | `src/services/statistics.ts:44-60` | Handles unequal variance correctly with `se = √(s₁²/n₁ + s₂²/n₂)` |
| **Effective Sample Size** | `src/services/statistics.ts:70-73` | Kish's approximation: `(∑w)² / ∑w²` |
| **Z-Score (Proportions)** | `src/services/statistics.ts:22-34` | Pooled proportion method for independent samples |
| **P-Value Calculation** | `src/services/statistics.ts:81-100` | Two-tailed using Abrahmowitz-Stegun (7.1.26) approximation |
| **SQL ESS Aggregation** | `src/services/queryBuilder.ts:190-192` | Captures `SUM(w * w)` for weighted queries |
| **Significance Thresholds** | `src/services/analysisWorker.ts:1361-1365` | 95% CI (±1.96) and 80% CI (±1.28) correctly applied |

### 🔶 Partially Implemented (Has Approximations)

| Feature | Architecture Spec | Current Reality | Gap Description |
|---------|------------------|-----------------|-----------------|
| **Cell vs. Rest Comparison** | "Mathematically remove cell from total before comparing" | `analysisWorker.ts:1243-1346` attempts this | **Proportions**: Approximates Rest ESS using efficiency factor (line 1340: `n2 = restBase * eff`)<br>**Means**: Falls back to Cell-vs-Total instead of Cell-vs-Rest (lines 1256-1283) due to variance decomposition complexity |
| **Rest Standard Deviation** | Exact pooled calculation | Uses `s₂ ≈ sT` approximation | Lines 1273-1274: *"Approx: Just use Total SD as proxy for Rest SD if rest is large"* - acceptable for large samples but not exact |

### ❌ Not Implemented (Documented as Future)

| Feature | Document Reference | Status | Phase |
|---------|-------------------|--------|-------|
| **Pairwise Column Comparisons** | `arch_04_statistical_engine.md` §4 | Not implemented | Phase 2 (M2.7) |
| **False Discovery Rate (FDR)** | `arch_04_statistical_engine.md` §4 | Not implemented | Phase 2 (M2.7) |
| **Dependent Samples T-Test** | `arch_04_statistical_engine.md` §4 | Not implemented | Phase 2 (M2.7) |
| **Taylor Series Linearization** | `tracker_00_implementation_status.md` M2.7 | Not implemented | Phase 2 (M2.7) |

---

## 2. Critical Evaluation of Architecture Design

### What the Document Gets Right ✅

#### 1. Survey-Native Philosophy
The distinction between survey data and Simple Random Sampling (SRS) is **Velocity's methodological moat**:

> "Weighting represents information density, not just frequency."

This is correct. Generic BI tools (Tableau, Excel) treat weighted counts as raw frequencies, which inflates Type I errors. The ESS correction is industry-standard (Displayr, Q Research, SPSS Complex Samples module all use variants of Kish's approximation).

**Verdict**: This philosophical stance is critical. It positions Velocity as "professional-grade" vs. "toy analytics."

#### 2. Effective Sample Size as Foundation
Using ESS everywhere (not just in significance tests but also for displaying "Effective N" to users) is correct. Market researchers understand this concept.

**Verdict**: Keep this. It's a trust signal.

#### 3. Cell vs. Rest Methodology
The architecture correctly identifies that Part-vs-Whole comparisons are biased:

> "Comparing a subgroup to a total that *contains* it artificially lowers significance."

Example: Testing "Brand A awareness among Males" against "Total Brand A awareness" (which includes Males) is circular. The Rest-based approach is methodologically superior.

**Verdict**: The *intent* is correct. The implementation has acceptable approximations for proportions, but means testing needs work.

---

### What the Document Over-Engineers ⚠️

#### 1. Rest-Derivation Complexity for Means
The document proposes algebraically decomposing Total statistics into Cell + Rest:

```
m₂ = (mT × nT - m₁ × n₁) / n₂     ← Mathematically correct
s₂ ≈ sT                            ← Approximation (variance decomposition is complex)
```

The implementation at `analysisWorker.ts:1270-1283` **acknowledges this is risky**:

```typescript
// Pooled Variance Calculation to recover s2 is complex without sumSq.
// Approx: Just use Total SD as proxy for Rest SD if rest is large.
// ...
// Taking a safe path: Compare Cell vs Total (Part-Whole) for Means
```

**Analysis**: To compute exact Rest variance, you need:
```
Var(Rest) = [ ∑(x²)_Total - ∑(x²)_Cell ] / n_Rest - mean_Rest²
```

This requires tracking `SUM(col * col)` (sum of squared values) per cell, not just `SUM(col)` and `STDDEV(col)`. The query complexity explodes.

**Verdict**: For means testing, comparing **Cell vs. Total** (current implementation) is defensible for Phase 1. True Cell-vs-Rest for means is a Phase 2 optimization—not a blocker.

**Recommendation**: Document this as a known approximation. Add a validation test comparing results to SPSS to quantify error margins.

---

#### 2. Pairwise Column Comparisons (Letters A/B/C)

The document proposes:

> "Full O(N²) column comparison matrix (A vs B, A vs C, etc.)"

**Complexity Analysis**:
- Table with 10 columns → 45 comparisons per row
- Typical crosstab: 20 rows × 10 columns → **900 significance tests** per table
- With Bonferroni correction (p-value threshold = 0.05 / 900 = 0.000056), almost nothing will be significant

**Market Position Analysis**:
From `research_07_velocity_market_assessment.md`:

> "Displayr has spent 10+ years building specific MR features (MaxDiff, TURF, Driver Analysis)."

Pairwise letters are a **premium feature** that Displayr charges for. Implementing this in MVP dilutes positioning.

**MVP PRD Alignment**:
The "Friday 4PM Test" scenario is:
> "She wants to... drag 'Gender' to columns, 'Satisfaction' to rows, and screenshot the result."

No mention of pairwise comparisons. The user wants to see "this number is red/green" at a glance.

**Verdict**: **Defer to Phase 3+** or **Feature Flag for Pro Tier**. This is a power-user feature that conflicts with "Speed > Power" philosophy.

---

#### 3. False Discovery Rate (FDR) & Bonferroni

FDR only makes sense when performing hundreds of tests simultaneously (i.e., with pairwise letters). For single-test-per-cell (current arrows), FDR is overkill.

**Verdict**: **Defer**. This follows from deferring pairwise comparisons.

---

#### 4. Taylor Series Linearization (TSL)

TSL is used for complex multi-stage sampling designs (e.g., NHANES, government surveys with stratification + clustering). It requires:
- Sampling strata metadata
- PSU (Primary Sampling Unit) identifiers
- Finite population corrections

**Target Audience Analysis**:
From `ref_2_mvp_prd.md`:

> **User Persona**: "Sarah the Strategist" at a boutique agency

Boutique agencies rarely deal with complex sampling. They buy panels from vendors (Dynata, Lucid) that deliver "flat" datasets.

**Verdict**: **Avoid entirely**. This feature is for government statisticians, not the "Friday 4PM" user. Implementing this would require UI for strata/PSU definition—massive scope creep.

---

## 3. Specific Code Gaps to Address

### 🔴 Gap 1: Weighted Mean Calculation (Correctness Bug)

**Location**: `src/services/queryBuilder.ts:176-186`

**Current Code**:
```typescript
statsExpr = `
    AVG(${col}) as mean,          // ← UNWEIGHTED!
    STDDEV(${col}) as stdDev,     // ← UNWEIGHTED!
    MIN(${col}) as min,
    MAX(${col}) as max,
    ...
`;
```

**Problem**: When `weightVar` is defined, this computes the **unweighted** mean. For weighted data, `AVG(age)` ≠ correct weighted average.

**Expected Behavior**:
```sql
-- Weighted Mean
SUM(weight * age) / SUM(weight) as mean

-- Weighted Variance (biased estimator, sufficient for survey data)
SUM(weight * POW(age - weighted_mean, 2)) / SUM(weight) as variance

-- Weighted StdDev
SQRT(variance) as stdDev
```

**Note**: This requires a **two-pass query** or a subquery to compute `weighted_mean` first. DuckDB supports CTEs (Common Table Expressions):

```sql
WITH weighted_stats AS (
  SELECT
    SUM(weight * age) / SUM(weight) as wmean,
    SUM(weight) as sum_w
  FROM main
  WHERE ...
)
SELECT
  wmean as mean,
  SQRT(SUM(weight * POW(age - wmean, 2)) / sum_w) as stdDev
FROM main, weighted_stats
WHERE ...
```

**Priority**: **High** - This is a correctness issue, not an optimization.

---

### 🟡 Gap 2: Means Testing Methodology (Approximation)

**Location**: `src/services/analysisWorker.ts:1256-1283`

**Current Code**:
```typescript
if (isMeans) {
    // T-Test for Means (Welch's)
    const m1 = Number(row.mean);
    const s1 = Number(row.stdDev);
    const n1 = cellESS;

    const mT = Number(totalRow.mean);
    const sT = Number(totalRow.stdDev);
    const nT = totalESS;

    // Falls back to Cell vs. Total
    tScore = calculateTScore(m1, s1, n1, mT, sT, nT);
}
```

**Problem**: This compares Cell vs. Total (Part-vs-Whole), not Cell vs. Rest (Part-vs-Complement).

**Root Cause**: To compute Rest variance, you need `SUM(x²)` (sum of squared values), not just `STDDEV(x)`. The query doesn't capture this.

**Solution Path**:
1. Extend `queryBuilder.ts` to capture `SUM(col * col) as sumSq` when `measureVar` is present.
2. In worker, derive Rest variance:
   ```typescript
   const sumSqTotal = totalRow.sumSq;
   const sumSqCell = row.sumSq;
   const sumSqRest = sumSqTotal - sumSqCell;

   const varRest = (sumSqRest / restN) - (m2 * m2);
   const s2 = Math.sqrt(varRest);
   ```

**Priority**: **Medium** - Current approximation is acceptable for large samples. This is an accuracy improvement, not a blocker.

---

### 🟢 Gap 3: Significance Arrow Display Verification

**Status**: Unknown - Need UI inspection

**Action Required**: Verify that `row.sig = 'high_95'` from worker is actually rendered as visual indicators in:
- `src/features/dashboard/components/DataTable.tsx`
- Chart renderers (if significance is shown on bars)

**Expected Behavior**: Green/Red arrows or color coding next to cell values.

**Priority**: **High** - This is the "magic moment" for users. If indicators don't render, the entire statistical engine is invisible.

---

## 4. Alignment with Vision Documents

| Document | Key Requirement | Statistical Engine Alignment | Gap / Action |
|----------|-----------------|------------------------------|--------------|
| **MVP PRD** (`ref_2_mvp_prd.md`) | "Automatic Sig Testing" with "subtle superscript letters" (§3.C) | ✅ Worker computes significance<br>⚠️ Uses arrows not letters | Letters = pairwise comparisons (Phase 2 feature). Current arrows satisfy "subtle" requirement. |
| **MVP PRD** | "Speed > Power" philosophy (§1) | ⚠️ Complex features (TSL, FDR) violate this | **Action**: Prune roadmap. Remove TSL entirely. Defer pairwise/FDR to Phase 3. |
| **Visionary PRD** (`ref_1_visionary_prd.md`) | AI agents finding anomalies (§2.A) | ✅ Statistical foundations (ESS, T-tests) enable this | No changes needed. Agent layer can query `row.sig` field. |
| **Market Assessment** (`research_07_velocity_market_assessment.md`) | "The Trust Barrier" - validation whitepapers (§5.3) | ❌ No validation suite | **Action**: Create SPSS comparison tests. Critical for enterprise adoption. |
| **Market Assessment** | "SPSS power in a Chrome tab" positioning (§5.4) | ✅ Core methodology matches SPSS Complex Samples module | Weighted stats bug undermines this claim. Fix Gap 1. |

---

## 5. Recommended Immediate Actions

### Priority 1: Weighted Statistics (Correctness) 🔴

**Task**: Implement weighted mean/stddev in `queryBuilder.ts` when `measureVar` and `weightVar` are both present.

**Impact**: **Correctness bug**. Current implementation returns wrong results for weighted data.

**Effort**: Medium (requires CTE or two-pass query logic).

**Acceptance Criteria**:
- Load a weighted SAV file
- Create crosstab with scale variable (e.g., Age) as measure
- Apply weight
- Verify mean matches SPSS `CTABLES` output

---

### Priority 2: Validation Suite (Trust) 📊

**Task**: Create test fixtures with known SPSS outputs and verify Velocity matches.

**Rationale**: From Market Assessment:

> "Velocity must publish 'validation whitepapers' comparing its results decimal-for-decimal against SPSS to build trust."

**Scope**:
1. Create 3 test datasets:
   - Unweighted crosstab (nominal × nominal)
   - Weighted crosstab with significance
   - Scale variable summary stats
2. Run identical analyses in SPSS Statistics
3. Export SPSS results to CSV
4. Write Vitest tests that compare Velocity output to SPSS CSV (within floating-point tolerance)

**Effort**: High (requires SPSS license + manual setup), but critical for market credibility.

**Deliverable**: `docs/validation_spss_parity.md` showing test results.

---

### Priority 3: UI Polish (User Experience) 🎨

**Task**: Ensure significance indicators (`sig: 'high_95'` etc.) render visibly in:
- DataTable cells (arrows/colors)
- Chart bars (green/red highlighting)

**Acceptance Criteria**: User can visually identify significant differences without reading numbers.

**Effort**: Low (mostly CSS/conditional rendering).

---

### Priority 4: Simplify Documentation (Scope Control) 📝

**Task**: Update `arch_04_statistical_engine.md` to reflect pragmatic roadmap.

**Changes**:
1. Move **Pairwise Comparisons** from "Phase 2" (§4) to new "Phase 3+ (Premium Features)" section
2. Move **FDR/Bonferroni** to same section
3. **Remove** Taylor Series Linearization entirely (mark as "Not Planned")
4. Add **Known Approximations** section documenting:
   - Rest variance approximation for means
   - Rest ESS efficiency-factor approximation for proportions

**Rationale**: Prevents scope creep. The "Friday 4PM Test" user doesn't need these features.

---

## 6. Long-Term Strategic Recommendations

### Recommended: Validation as Competitive Advantage

**Opportunity**: No competitor (including Displayr) publishes decimal-for-decimal validation against SPSS.

**Strategy**: Create a public **"Validation Report"** page showing:
- Test datasets (downloadable)
- SPSS syntax files
- Side-by-side comparisons
- Maximum error margins (e.g., "±0.001 for means, ±0.0001 for p-values")

**Impact**: Positions Velocity as **more trustworthy** than Displayr despite being newer. This directly addresses the Market Assessment's "Trust Barrier."

---

### Recommended: Premium Feature Segmentation

**Observation**: Pairwise letters, FDR, and advanced features are **differentiation opportunities** for paid tiers.

**Freemium Model**:
- **Free**: Arrows (Cell-vs-Rest, 95% CI only)
- **Pro**: Letters (pairwise comparisons), 80% CI weak indicators, FDR corrections

**Rationale**: From Market Assessment:

> "Follow the standard PLG model: Free for individuals (local-only), Paid for Teams."

Advanced statistics are a natural upsell for professional users.

---

### Avoid: Feature Creep into Government/Academic Territory

**Anti-Pattern**: Implementing TSL, complex sampling, or strata-based variance estimation.

**Why**: This repositions Velocity from "The Figma of Analytics" (MVP PRD) to "Academic Survey Software," which is a crowded, low-margin market (Stata, SAS, R).

**Market Positioning**: Stay in the **commercial MR** lane (boutique agencies, brand trackers, ad-hoc research). Leave government statistics to legacy tools.

---

## 7. Summary & Verdict

### The Good ✅
The statistical engine has **sound foundations**:
- Methodology (ESS, Welch's T-Test, Cell-vs-Rest) is industry-correct
- Implementation architecture (pure functions in `statistics.ts`, worker orchestration) is clean
- Philosophy (Survey-Native vs. SRS) is the right positioning

### The Bugs 🔴
- Weighted mean/stddev not implemented (Gap 1)
- Significance indicators may not render in UI (Gap 3)

### The Over-Engineering ⚠️
- Pairwise letters (defer to Phase 3+)
- FDR/Bonferroni (defer)
- Taylor Series Linearization (**remove from roadmap**)

### The Missing Piece 📊
- No validation against SPSS (critical for trust)

---

## Final Recommendation

**Ship Phase 1 with:**
1. ✅ Current arrow-based significance (high_95/low_95)
2. 🔧 Fixed weighted statistics (Gap 1)
3. 📊 Validation suite proving SPSS parity

**Defer to Phase 3+:**
- Pairwise column letters
- FDR corrections
- Exact Cell-vs-Rest for means (current approximation is acceptable)

**Remove from Roadmap:**
- Taylor Series Linearization
- Complex sampling features

This keeps Velocity focused on the **"Friday 4PM Test"** - fast, accurate, trustworthy crosstabs that "just work" for the boutique agency user.

---

**Document End**
