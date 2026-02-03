# Statistical Engine Implementation Plan

**Status:** Planning
**Created:** 2026-02-03
**Scope:** Full development of robust, modular statistical testing suite

---

## Executive Summary

This plan compares the documented statistical analysis vision against the current implementation, identifies gaps, and outlines a phased approach to build a production-grade statistical engine. The architecture follows a **plugin model** that starts with fast DuckDB-based calculations and allows future integration of WebR for academic rigor.

---

## 1. Vision vs Current State

### 1.1 What's Working Well

| Capability | Status | Location |
|------------|--------|----------|
| Welch's T-Test | ✅ Implemented | `src/services/statistics.ts:26-45` |
| Effective Sample Size (ESS) | ✅ Implemented | `src/services/statistics.ts:70-73` |
| Cell-vs-Rest Comparison | ✅ Implemented | `src/core/analysis/crosstabRunner.ts:345-406` |
| Significance Arrows (UI) | ✅ Implemented | `src/features/dashboard/components/DataTable.tsx:259-270` |
| 95%/80% CI Thresholds | ✅ Implemented | `src/core/analysis/crosstabRunner.ts:416-420` |
| Weighted Counts | ✅ Implemented | `src/services/queryBuilder.ts:50-52` |
| Export with Sig Markers | ✅ Implemented | `src/core/export/xlsxExporter.ts`, `pptxExporter.ts` |

### 1.2 Critical Gaps (Phase 2 Priority)

| Gap | Impact | Documented In |
|-----|--------|---------------|
| **Weighted Mean Bug** | Metric tables show incorrect values when weighting applied | `arch_04:51` |
| **Weighted StdDev Bug** | Variance calculations incorrect for weighted data | `arch_04:51` |
| **Rest Variance Approximation** | T-scores slightly biased for heterogeneous data | `arch_04:50` |
| **No Validation Suite** | Cannot prove decimal-for-decimal parity with SPSS | `arch_04:65` |

### 1.3 Missing Features (Phase 3+)

| Feature | Priority | Complexity |
|---------|----------|------------|
| Pairwise Column Comparisons (A/B/C letters) | Medium | O(N²) |
| Chi-Square Independence Tests | Medium | Low |
| Confidence Intervals (error bars) | Medium | Low |
| Multiple Comparison Corrections (Bonferroni/FDR) | Low | Medium |
| Dependent Samples (overlapping multi-response) | Low | High |
| ANOVA / Multi-group Comparison | Low | Medium |

### 1.4 Non-Goals (by Design)

Per `arch_04_statistical_engine.md` and `archive/review_statistical_engine_2026_01.md`:

- **Taylor Series Linearization (TSL):** Over-engineering for target persona
- **Complex Strata/PSU Support:** Velocity targets flat panel data
- **Type II Error Control (Power Analysis):** Outside commercial scope

---

## 2. Architecture Principles

### 2.1 Modular Plugin Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Analysis Request                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Analysis Registry                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ CrosstabRun │ │ StatsRunner │ │ ChiSqRunner │   ...      │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   DuckDB Layer   │ │   WebR Layer     │ │  Pyodide Layer   │
│   (Phase 1-2)    │ │   (Phase 3)      │ │   (Phase 4)      │
│   Fast, Basic    │ │   Rigorous       │ │   AI-Native      │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 2.2 Core Design Rules

1. **Pure Functions First:** All statistical primitives in `statistics.ts` must be pure (no side effects, no I/O)
2. **SQL for Aggregation:** DuckDB handles all data reduction; JS handles only final calculations
3. **Headless Core:** `src/core/analysis/` must work without React, DOM, or browser APIs
4. **Decimal Precision:** All internal calculations use full IEEE 754 doubles; rounding only at display
5. **Test-Driven:** Every statistical function requires unit tests with known reference values

---

## 3. Implementation Plan

### Phase 2A: Correctness (Critical Bugs)

**Goal:** Fix all bugs that cause incorrect statistical outputs

#### Task 2A.1: Fix Weighted Mean Calculation

**Problem:** `queryBuilder.ts` computes unweighted means in some contexts.

**Solution:** Two-pass weighted mean via CTE:

```sql
WITH weighted_agg AS (
  SELECT
    SUM(value * weight) as sum_xw,
    SUM(weight) as sum_w,
    SUM(weight * value * value) as sum_xw2,
    SUM(weight * weight) as sum_w2
  FROM data
  WHERE ...
)
SELECT
  sum_xw / sum_w as weighted_mean,
  SQRT((sum_xw2 / sum_w) - POWER(sum_xw / sum_w, 2)) as weighted_stddev,
  POWER(sum_w, 2) / sum_w2 as ess
FROM weighted_agg
```

**Files to Modify:**
- `src/services/queryBuilder.ts` - Update `buildMetricQuery()` functions
- `src/core/analysis/crosstabRunner.ts` - Ensure weighted stats flow through

**Acceptance Criteria:**
- [ ] Weighted mean matches SPSS output for test dataset
- [ ] Weighted stddev matches SPSS output for test dataset
- [ ] Unit tests with known reference values pass

#### Task 2A.2: Fix Rest Variance Calculation

**Problem:** Currently approximates `s_rest ≈ s_total`, which is biased.

**Solution:** Capture `SUM(x²)` per cell and compute exact variance decomposition:

```typescript
// Exact rest variance decomposition
const totalSumX2 = totalRow.sumX2;
const totalSumX = totalRow.weightedMean * totalRow.weightedCount;
const cellSumX2 = cellRow.sumX2;
const cellSumX = cellRow.weightedMean * cellRow.weightedCount;

const restSumX2 = totalSumX2 - cellSumX2;
const restSumX = totalSumX - cellSumX;
const restN = totalN - cellN;
const restMean = restSumX / restN;
const restVariance = (restSumX2 / restN) - (restMean * restMean);
const restStdDev = Math.sqrt(restVariance);
```

**Files to Modify:**
- `src/services/queryBuilder.ts` - Add `SUM(value * value * weight)` to queries
- `src/types/index.ts` - Add `sumX2` to `AggregatedRow`
- `src/core/analysis/crosstabRunner.ts` - Use exact variance in t-test

**Acceptance Criteria:**
- [ ] T-scores match SPSS for heterogeneous test data
- [ ] No approximation warnings in code comments

#### Task 2A.3: Create Validation Test Suite

**Problem:** No automated verification against SPSS reference outputs.

**Solution:** Golden test suite with real survey data:

```
src/core/analysis/__tests__/
├── fixtures/
│   ├── spss_reference_brand_tracker.json    # SPSS outputs
│   ├── spss_reference_weighted_study.json
│   └── test_dataset.parquet                 # Input data
├── crosstab.golden.test.ts
├── weighted_stats.golden.test.ts
└── significance.golden.test.ts
```

**Test Structure:**
```typescript
describe('Weighted Mean Parity', () => {
  it('matches SPSS output for brand tracker Q5', async () => {
    const result = await runCrosstab({
      rows: ['Q5_age'],
      cols: ['Q1_brand'],
      metric: 'Q10_satisfaction',
      weight: 'weight_var'
    });

    // SPSS reference: Brand A, Age 25-34 = 4.237 (stddev: 1.102)
    expect(result.cells['Brand A']['25-34'].mean).toBeCloseTo(4.237, 3);
    expect(result.cells['Brand A']['25-34'].stddev).toBeCloseTo(1.102, 3);
  });
});
```

**Acceptance Criteria:**
- [ ] 10+ golden tests covering weighted/unweighted scenarios
- [ ] Tests run in CI pipeline
- [ ] Decimal-for-decimal match to 3 decimal places

---

### Phase 2B: Trust Signals (UX Polish)

**Goal:** Make statistical rigor visible to users

#### Task 2B.1: Add Statistical Method Tooltips

**What:** Hover tooltips explaining the test methodology.

```tsx
// In DataTable.tsx cell tooltip
<Tooltip>
  <p>Welch's T-Test (Cell vs Rest)</p>
  <p>t = {cell.stats.tScore.toFixed(2)}</p>
  <p>p = {cell.stats.pValue.toFixed(4)}</p>
  <p>ESS = {cell.stats.effN.toFixed(1)} (Kish's Approximation)</p>
  <p className="text-sm text-muted">
    Significantly {cell.sig?.includes('high') ? 'higher' : 'lower'}
    than complement at {cell.sig?.includes('95') ? '95%' : '80%'} confidence
  </p>
</Tooltip>
```

#### Task 2B.2: Add Method Documentation Panel

**What:** "How We Calculate" expandable panel in analysis settings.

**Content:**
- Explanation of Cell-vs-Rest methodology
- ESS formula with visual example
- Link to arch_04 documentation

#### Task 2B.3: Significance Legend in Tables

**What:** Persistent legend explaining arrow meanings.

```
┌─────────────────────────────────────────┐
│ ↑ Significantly higher (95% CI)         │
│ ↓ Significantly lower (95% CI)          │
│ ↑ Moderately higher (80% CI)            │
│ ↓ Moderately lower (80% CI)             │
└─────────────────────────────────────────┘
```

---

### Phase 3A: Feature Expansion (Core Statistics)

**Goal:** Add frequently-requested statistical features

#### Task 3A.1: Chi-Square Independence Test

**Use Case:** Test if two categorical variables are independent.

**Implementation:**
```typescript
// src/services/statistics.ts
export function calculateChiSquare(
  observed: number[][],  // Contingency table
  expected: number[][]   // Under null hypothesis
): { chiSq: number; df: number; pValue: number } {
  let chiSq = 0;
  for (let i = 0; i < observed.length; i++) {
    for (let j = 0; j < observed[i].length; j++) {
      const o = observed[i][j];
      const e = expected[i][j];
      if (e > 0) {
        chiSq += Math.pow(o - e, 2) / e;
      }
    }
  }
  const df = (observed.length - 1) * (observed[0].length - 1);
  const pValue = 1 - chiSquareCDF(chiSq, df);
  return { chiSq, df, pValue };
}
```

**UI:** Show chi-square result in table footer when both row and column are categorical.

#### Task 3A.2: Confidence Intervals

**Use Case:** Show uncertainty bands, not just point estimates.

**Implementation:**
```typescript
// 95% CI for weighted mean
const se = stddev / Math.sqrt(ess);
const ci95 = {
  lower: mean - 1.96 * se,
  upper: mean + 1.96 * se
};
```

**UI Options:**
- Error bars in charts (via Recharts)
- CI columns in table (optional toggle)
- Hover tooltip showing CI range

#### Task 3A.3: Pairwise Column Comparisons (Letters)

**Use Case:** "Is Brand A significantly different from Brand B?" (not just vs Rest)

**Implementation:**
```typescript
// O(N²) pairwise comparisons
const columns = ['A', 'B', 'C', 'D'];
const letters: Map<string, string[]> = new Map();

for (let i = 0; i < columns.length; i++) {
  for (let j = i + 1; j < columns.length; j++) {
    const tScore = calculateTScore(
      cells[i].mean, cells[i].stddev, cells[i].ess,
      cells[j].mean, cells[j].stddev, cells[j].ess
    );
    if (Math.abs(tScore) > 1.96) {
      if (tScore > 0) {
        letters.get(columns[i])?.push(columns[j]);
      } else {
        letters.get(columns[j])?.push(columns[i]);
      }
    }
  }
}

// Result: Cell A shows "BC" (significantly higher than B and C)
```

**UI:** Letter codes appear next to values (e.g., "45% BC").

**Complexity Warning:** O(N²) comparisons. For 10 columns = 45 tests. Consider lazy computation.

---

### Phase 3B: Multiple Comparison Corrections

**Goal:** Control false discovery rate when many tests are run

#### Task 3B.1: Bonferroni Correction

**Use Case:** Conservative correction for family-wise error rate.

```typescript
export function bonferroniCorrection(
  pValues: number[],
  alpha: number = 0.05
): boolean[] {
  const adjustedAlpha = alpha / pValues.length;
  return pValues.map(p => p < adjustedAlpha);
}
```

#### Task 3B.2: Benjamini-Hochberg FDR

**Use Case:** Less conservative, controls expected proportion of false discoveries.

```typescript
export function benjaminiHochbergFDR(
  pValues: number[],
  alpha: number = 0.05
): boolean[] {
  const sorted = pValues
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p - b.p);

  const m = pValues.length;
  let maxK = 0;

  for (let k = 0; k < m; k++) {
    if (sorted[k].p <= ((k + 1) / m) * alpha) {
      maxK = k + 1;
    }
  }

  const significant = new Array(m).fill(false);
  for (let k = 0; k < maxK; k++) {
    significant[sorted[k].i] = true;
  }

  return significant;
}
```

**UI:** Toggle in analysis settings: "Correction: None | Bonferroni | FDR"

---

### Phase 4: WebR Integration (Academic Rigor)

**Goal:** Enable complex statistical methods via R runtime

#### Task 4.1: WebR Lazy Loading

**Architecture:**
```typescript
// src/core/analysis/engines/webREngine.ts
let webRInstance: WebR | null = null;

export async function loadWebR(): Promise<WebR> {
  if (!webRInstance) {
    const { WebR } = await import('webr');
    webRInstance = new WebR();
    await webRInstance.init();
    // Pre-load survey package
    await webRInstance.evalR('library(survey)');
  }
  return webRInstance;
}
```

**Bundle Size:** WebR loads only when user triggers advanced analysis.

#### Task 4.2: Complex Weighting (survey package)

**Use Case:** Design effects, replicate weights, multi-stage sampling.

```r
# R code executed via WebR
design <- svydesign(
  ids = ~1,
  weights = ~weight,
  data = df
)

svymean(~satisfaction, design)
svyby(~satisfaction, ~brand, design, svymean)
```

#### Task 4.3: Mixed Effects Models

**Use Case:** Hierarchical data (respondents nested in regions).

```r
library(lme4)
model <- lmer(satisfaction ~ brand + (1|region), data = df)
summary(model)
```

**UI:** "Advanced Analysis" panel with R code editor for power users.

---

## 4. File Structure (Target State)

```
src/
├── core/
│   └── analysis/
│       ├── runners/
│       │   ├── crosstabRunner.ts       # Existing, refactored
│       │   ├── variableStatsRunner.ts  # Existing
│       │   ├── chiSquareRunner.ts      # New (Phase 3)
│       │   └── pairwiseRunner.ts       # New (Phase 3)
│       ├── engines/
│       │   ├── duckDbEngine.ts         # DuckDB adapter
│       │   └── webREngine.ts           # WebR adapter (Phase 4)
│       ├── corrections/
│       │   ├── bonferroni.ts           # New (Phase 3)
│       │   └── fdr.ts                  # New (Phase 3)
│       ├── registry.ts                 # Plugin registry
│       └── __tests__/
│           ├── fixtures/               # SPSS reference data
│           ├── crosstab.golden.test.ts
│           ├── weighted.golden.test.ts
│           └── significance.golden.test.ts
├── services/
│   ├── statistics.ts                   # Pure math functions
│   ├── queryBuilder.ts                 # SQL generation
│   └── analysisWorker.ts               # Worker orchestration
└── types/
    └── statistics.ts                   # Statistical type definitions
```

---

## 5. Testing Strategy

### 5.1 Unit Tests (statistics.ts)

Every function has isolated tests with known values:

```typescript
describe('calculateTScore', () => {
  it('returns correct t-score for known values', () => {
    // Example from textbook
    const t = calculateTScore(
      10.5, 2.1, 30,  // Group 1: mean=10.5, sd=2.1, n=30
      9.2, 1.8, 25    // Group 2: mean=9.2, sd=1.8, n=25
    );
    expect(t).toBeCloseTo(2.54, 2);
  });
});
```

### 5.2 Integration Tests (crosstabRunner.ts)

End-to-end tests with mock DuckDB:

```typescript
describe('crosstabRunner', () => {
  it('computes weighted significance correctly', async () => {
    const result = await runCrosstab(mockDb, {
      rows: ['gender'],
      cols: ['brand'],
      weight: 'weight'
    });

    expect(result.rows[0].cells[0].sig).toBe('high_95');
    expect(result.rows[0].cells[0].stats.tScore).toBeGreaterThan(1.96);
  });
});
```

### 5.3 Golden Tests (SPSS Parity)

Decimal-for-decimal comparison against SPSS reference outputs:

```typescript
describe('SPSS Parity', () => {
  const spssReference = require('./fixtures/spss_brand_tracker.json');

  it('matches SPSS weighted mean for Q5', async () => {
    const result = await runCrosstab(realData, config);

    for (const [key, expected] of Object.entries(spssReference.means)) {
      expect(result.cells[key].mean).toBeCloseTo(expected, 3);
    }
  });
});
```

---

## 6. Migration Path

### 6.1 Backward Compatibility

- Existing `sig` field format unchanged (`'high_95' | 'high_80' | 'low_95' | 'low_80'`)
- Existing `stats` object fields preserved (`tScore`, `pValue`, `effN`)
- New fields are additive (e.g., `ci95`, `sumX2`)

### 6.2 Feature Flags

```typescript
// src/store/slices/analysisSlice.ts
interface AnalysisSettings {
  significanceLevel: 0.95 | 0.90 | 0.80;
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correction: 'none' | 'bonferroni' | 'fdr';
  showConfidenceIntervals: boolean;
  engine: 'duckdb' | 'webr';  // Phase 4
}
```

### 6.3 Progressive Enhancement

1. **Phase 2:** Fix bugs, add validation (no UI changes)
2. **Phase 3A:** Add chi-square, CIs (opt-in UI toggles)
3. **Phase 3B:** Add corrections (settings panel)
4. **Phase 4:** Add WebR (lazy-loaded, power user panel)

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **SPSS Parity** | 100% for core tests | Golden test suite pass rate |
| **Weighted Accuracy** | ±0.001 vs reference | Automated decimal comparison |
| **Performance** | <100ms for 10k rows | Benchmark suite |
| **Test Coverage** | >90% for statistics.ts | Coverage report |
| **Bundle Size** | <500KB without WebR | Build output |

---

## 8. Timeline & Priorities

### Immediate (This Sprint)

1. **Task 2A.1:** Fix weighted mean calculation
2. **Task 2A.2:** Fix rest variance calculation
3. **Task 2A.3:** Create initial validation suite (5 golden tests)

### Short-Term (Next Sprint)

4. **Task 2B.1-3:** Trust signal UI improvements
5. Expand golden test suite to 15+ tests

### Medium-Term (Phase 3)

6. **Task 3A.1:** Chi-square tests
7. **Task 3A.2:** Confidence intervals
8. **Task 3A.3:** Pairwise comparisons (letters)

### Long-Term (Phase 4)

9. **Task 4.1-3:** WebR integration for academic rigor

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Weighted formula complexity | Implementation errors | Extensive golden tests |
| WebR bundle size | Slow initial load | Lazy loading, code splitting |
| O(N²) pairwise comparisons | Performance regression | Lazy computation, caching |
| Breaking changes to sig format | Export compatibility | Additive-only API changes |

---

## 10. References

- `docs/arch_04_statistical_engine.md` - Core methodology
- `docs/blue_01_unified_roadmap.md` - Phase definitions
- `archive/review_statistical_engine_2026_01.md` - Pragmatic pruning decisions
- `archive/dec_01_stats_engine_r_vs_python.md` - WebR selection rationale
- [Displayr Statistical Methodology](https://www.displayr.com/) - Industry reference
- [Kish's Effective Sample Size](https://en.wikipedia.org/wiki/Design_effect) - ESS formula
