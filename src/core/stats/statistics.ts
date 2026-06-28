/**
 * Statistical Utility Functions
 */

/**
 * Calculate Z-Score for Independent Proportions
 *
 * Tests if p1 (observed proportion) differs significantly from p2 (expected/reference proportion).
 *
 * Formula: Z = (p1 - p2) / SE
 * where SE = sqrt( p * (1-p) * (1/n1 + 1/n2) )
 * and p (pooled proportion) = (p1*n1 + p2*n2) / (n1 + n2)
 *
 * Note: When comparing a Subgroup vs Total, we treat them as independent samples
 * for the purpose of this standard significance test (p < 0.05).
 *
 * @param p1 Proportion 1 (e.g., Cell Count / Column Total)
 * @param n1 Sample Size 1 (e.g., Column Total)
 * @param p2 Proportion 2 (e.g., Row Total / Grand Total)
 * @param n2 Sample Size 2 (e.g., Grand Total) or (Grand Total - Column Total) for strict independence
 */
export function calculateZScore(p1: number, n1: number, p2: number, n2: number): number {
  if (n1 <= 0 || n2 <= 0) return 0;

  // Pooled proportion
  const p = (p1 * n1 + p2 * n2) / (n1 + n2);

  // Standard Error
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));

  if (se === 0) return 0;

  return (p1 - p2) / se;
}

/**
 * Calculate Welch's T-Test Score
 *
 * Tests if the means of two populations are significantly different.
 * Does not assume equal variance.
 *
 * Can be used for Proportions as well (where s = sqrt(p*(1-p))).
 */
export function calculateTScore(m1: number, s1: number, n1: number, m2: number, s2: number, n2: number): number {
  if (n1 < 2 || n2 < 2) return 0;

  // Variance check: if both zero variance, no difference possible unless means differ (infinity)
  if (s1 === 0 && s2 === 0) {
    return m1 === m2 ? 0 : m1 > m2 ? Infinity : -Infinity;
  }

  // Welch's t-test standard error
  const se = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);

  if (se === 0) {
    return m1 === m2 ? 0 : m1 > m2 ? Infinity : -Infinity;
  }

  return (m1 - m2) / se;
}

/**
 * Calculate Effective Sample Size (Kish's Approximation)
 *
 * ESS = (Sum of Weights)^2 / (Sum of Squared Weights)
 *
 * @param sumWeights Sum of weights (Weighted Count)
 * @param sumSqWeights Sum of squared weights
 */
export function calculateESS(sumWeights: number, sumSqWeights: number): number {
  if (!sumSqWeights || sumSqWeights === 0) return sumWeights; // Fallback / Unweighted
  return (sumWeights * sumWeights) / sumSqWeights;
}

/**
 * Calculate P-Value from Z-Score (Two-tailed)
 *
 * Uses numerical approximation of the Error Function (erf).
 * Valid for standard normal distribution.
 */
export function calculatePValue(z: number): number {
  if (z === 0) return 1;

  // Two-tailed p-value: 2 * (1 - CDF(|z|))
  // CDF(x) = 0.5 * (1 + erf(x / sqrt(2)))
  // So P = 2 * (1 - 0.5 * (1 + erf(|z| / sqrt(2))))
  //      = 2 * (0.5 - 0.5 * erf)
  //      = 1 - erf(|z| / sqrt(2))
  // Or just use the standard approx for Tails

  return 2 * (1 - standardNormalCDF(Math.abs(z)));
}

function standardNormalCDF(x: number): number {
  // Abrahmowitz and Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - prob;
}

/**
 * Chi-Square Test Result
 */
export interface ChiSquareResult {
  chiSquare: number;
  df: number;
  pValue: number;
  cramersV: number;
}

/**
 * Calculate Chi-Square Test for Independence
 *
 * Tests if two categorical variables are independent.
 *
 * @param observed 2D array of observed counts (rows x cols contingency table)
 * @returns Chi-square statistic, degrees of freedom, p-value, and Cramér's V
 */
export function calculateChiSquare(observed: number[][]): ChiSquareResult {
  if (observed.length === 0 || observed[0].length === 0) {
    return { chiSquare: 0, df: 0, pValue: 1, cramersV: 0 };
  }

  const nRows = observed.length;
  const nCols = observed[0].length;

  // Calculate row totals, column totals, and grand total
  const rowTotals = observed.map((row) => row.reduce((sum, val) => sum + val, 0));
  const colTotals: number[] = new Array(nCols).fill(0);
  for (let j = 0; j < nCols; j++) {
    for (let i = 0; i < nRows; i++) {
      colTotals[j] += observed[i][j];
    }
  }
  const grandTotal = rowTotals.reduce((sum, val) => sum + val, 0);

  if (grandTotal === 0) {
    return { chiSquare: 0, df: 0, pValue: 1, cramersV: 0 };
  }

  // Calculate expected values and chi-square
  let chiSquare = 0;
  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / grandTotal;
      if (expected > 0) {
        chiSquare += Math.pow(observed[i][j] - expected, 2) / expected;
      }
    }
  }

  const df = (nRows - 1) * (nCols - 1);
  const pValue = df > 0 ? 1 - chiSquareCDF(chiSquare, df) : 1;

  // Cramér's V: effect size measure
  const minDim = Math.min(nRows - 1, nCols - 1);
  const cramersV = minDim > 0 ? Math.sqrt(chiSquare / (grandTotal * minDim)) : 0;

  return { chiSquare, df, pValue, cramersV };
}

/**
 * Chi-Square Cumulative Distribution Function
 *
 * Approximates P(X <= x) for chi-square distribution with k degrees of freedom.
 * Uses the regularized incomplete gamma function.
 */
export function chiSquareCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  if (k <= 0) return 1;

  // Chi-square CDF = regularized lower incomplete gamma function
  // P(k/2, x/2) where P is the regularized gamma function
  return regularizedGammaP(k / 2, x / 2);
}

/**
 * Regularized Lower Incomplete Gamma Function P(a, x)
 *
 * Uses series expansion for x < a+1, continued fraction otherwise.
 * Based on Numerical Recipes algorithms.
 */
function regularizedGammaP(a: number, x: number): number {
  const EPSILON = 1e-10;
  const MAX_ITERATIONS = 200;

  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;

  const lnGammaA = logGamma(a);

  // Use series expansion for x < a + 1
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < MAX_ITERATIONS; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPSILON) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGammaA);
  }

  // Use continued fraction for x >= a + 1 (Numerical Recipes gcf algorithm)
  const FPMIN = 1e-30;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = Math.abs(b) < FPMIN ? 1 / FPMIN : 1 / b;
  let h = d;

  for (let n = 1; n <= MAX_ITERATIONS; n++) {
    const an = n * (a - n); // = -n*(n-a)
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }

  // Q(a, x) = 1 - P(a, x)
  const Q = Math.exp(-x + a * Math.log(x) - lnGammaA) * h;
  return 1 - Q;
}

/**
 * Confidence Interval Result
 */
export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

/**
 * Z-critical values for common confidence levels
 */
const Z_CRITICAL: Record<number, number> = {
  0.99: 2.576,
  0.95: 1.96,
  0.9: 1.645,
  0.8: 1.282,
};

/**
 * Calculate Confidence Interval for a Mean
 *
 * @param mean The sample mean
 * @param stdDev The sample standard deviation
 * @param n The effective sample size (ESS for weighted data)
 * @param confidence The confidence level (0.95 for 95%, 0.80 for 80%)
 * @returns Confidence interval { lower, upper }
 */
export function calculateMeanCI(
  mean: number,
  stdDev: number,
  n: number,
  confidence: number = 0.95,
): ConfidenceInterval {
  if (n < 2 || stdDev < 0) {
    return { lower: mean, upper: mean };
  }

  const z = Z_CRITICAL[confidence] || 1.96;
  const se = stdDev / Math.sqrt(n);
  const margin = z * se;

  return {
    lower: mean - margin,
    upper: mean + margin,
  };
}

/**
 * Calculate Confidence Interval for a Proportion
 *
 * Uses the Wilson score interval for better accuracy with small samples
 * and proportions near 0 or 1.
 *
 * @param p The sample proportion (0 to 1)
 * @param n The effective sample size
 * @param confidence The confidence level (0.95 for 95%, 0.80 for 80%)
 * @returns Confidence interval { lower, upper }
 */
export function calculateProportionCI(p: number, n: number, confidence: number = 0.95): ConfidenceInterval {
  if (n < 1 || p < 0 || p > 1) {
    return { lower: p, upper: p };
  }

  const z = Z_CRITICAL[confidence] || 1.96;
  const z2 = z * z;

  // Wilson score interval
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

/**
 * Pairwise Comparison Result
 */
export interface PairwiseResult {
  /** Letter code for the column */
  columnLetter: string;
  /** Array of column letters this column is significantly higher than */
  higherThan: string[];
  /** Array of column letters this column is significantly lower than */
  lowerThan: string[];
  /** Combined letters (for display) */
  sigLetters: string;
}

/**
 * Column data for pairwise comparisons
 */
export interface ColumnStats {
  key: string;
  mean?: number;
  stdDev?: number;
  proportion?: number;
  ess: number;
}

/**
 * Correlated Proportions Test (dependent/overlapping samples).
 *
 * Used for pairwise comparisons when the same respondents can appear
 * in multiple columns (e.g., multi-response column banners).
 */
export function calculateDependentProportionsTest(
  pA: number,
  pB: number,
  pAB: number,
  n: number,
): { tScore: number; pValue: number } {
  if (n <= 1) {
    return { tScore: 0, pValue: 1 };
  }

  // Clamp proportions to stable bounds
  const a = Math.min(1, Math.max(0, pA));
  const b = Math.min(1, Math.max(0, pB));
  const ab = Math.min(1, Math.max(0, pAB));

  const variance = (a * (1 - a) + b * (1 - b) - 2 * (ab - a * b)) / n;
  if (!Number.isFinite(variance) || variance <= 0) {
    return { tScore: 0, pValue: 1 };
  }

  const tScore = (a - b) / Math.sqrt(variance);
  const pValue = calculatePValue(tScore);
  return { tScore, pValue };
}

/**
 * Calculate Pairwise Column Comparisons
 *
 * Performs O(N²) pairwise t-tests between all columns and returns
 * letter codes indicating significant differences.
 *
 * @param columns Array of column statistics
 * @param isMetric Whether comparing means (true) or proportions (false)
 * @param alpha Significance level (0.05 for 95% confidence)
 * @returns Map of column key to pairwise result
 */
export function calculatePairwiseComparisons(
  columns: ColumnStats[],
  isMetric: boolean,
  alpha: number = 0.05,
  correction: 'none' | 'bonferroni' | 'fdr' = 'none',
): Map<string, PairwiseResult> {
  const results = new Map<string, PairwiseResult>();
  const comparisons: Array<{ colA: string; colB: string; tScore: number; pValue: number }> = [];

  // Assign letters A, B, C, ... to columns
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const columnLetters = new Map<string, string>();
  columns.forEach((col, i) => {
    columnLetters.set(col.key, letters[i] || `(${i + 1})`);
  });

  // Initialize results for each column
  columns.forEach((col) => {
    results.set(col.key, {
      columnLetter: columnLetters.get(col.key) || '',
      higherThan: [],
      lowerThan: [],
      sigLetters: '',
    });
  });

  // Perform pairwise comparisons
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const colA = columns[i];
      const colB = columns[j];

      // Skip if either has insufficient sample size
      if (colA.ess < 2 || colB.ess < 2) continue;

      let tScore = 0;

      if (isMetric) {
        // Compare means
        if (
          colA.mean !== undefined &&
          colB.mean !== undefined &&
          colA.stdDev !== undefined &&
          colB.stdDev !== undefined
        ) {
          tScore = calculateTScore(colA.mean, colA.stdDev, colA.ess, colB.mean, colB.stdDev, colB.ess);
        }
      } else {
        // Compare proportions
        if (colA.proportion !== undefined && colB.proportion !== undefined) {
          const s1 = Math.sqrt(colA.proportion * (1 - colA.proportion));
          const s2 = Math.sqrt(colB.proportion * (1 - colB.proportion));
          tScore = calculateTScore(colA.proportion, s1, colA.ess, colB.proportion, s2, colB.ess);
        }
      }

      comparisons.push({
        colA: colA.key,
        colB: colB.key,
        tScore,
        pValue: calculatePValue(tScore),
      });
    }
  }

  if (comparisons.length === 0) {
    return results;
  }

  const pValues = comparisons.map((c) => c.pValue);
  const isSignificant = applyMultipleTestingCorrection(pValues, correction, alpha);

  comparisons.forEach((comparison, index) => {
    if (!isSignificant[index]) return;

    const letterA = columnLetters.get(comparison.colA)!;
    const letterB = columnLetters.get(comparison.colB)!;

    if (comparison.tScore > 0) {
      // A is significantly higher than B
      results.get(comparison.colA)!.higherThan.push(letterB);
      results.get(comparison.colB)!.lowerThan.push(letterA);
    } else if (comparison.tScore < 0) {
      // B is significantly higher than A
      results.get(comparison.colB)!.higherThan.push(letterA);
      results.get(comparison.colA)!.lowerThan.push(letterB);
    }
  });

  // Build sigLetters string for each column
  results.forEach((result, key) => {
    // Sort letters and combine (showing columns this is higher than)
    result.higherThan.sort();
    result.sigLetters = result.higherThan.join('');
  });

  return results;
}

// ============================================================================
// Multiple Comparison Corrections
// ============================================================================

/**
 * Bonferroni Correction
 *
 * The most conservative correction for multiple comparisons.
 * Controls the family-wise error rate (FWER).
 *
 * @param pValues Array of p-values from multiple tests
 * @param alpha Desired significance level (default 0.05)
 * @returns Array of booleans indicating which tests are significant after correction
 */
export function bonferroniCorrection(pValues: number[], alpha: number = 0.05): boolean[] {
  if (pValues.length === 0) return [];

  const adjustedAlpha = alpha / pValues.length;
  return pValues.map((p) => p < adjustedAlpha);
}

/**
 * Bonferroni Adjusted P-Values
 *
 * Returns adjusted p-values rather than just significant/not.
 * Adjusted p-value = original p-value × number of tests
 *
 * @param pValues Array of p-values from multiple tests
 * @returns Array of adjusted p-values (capped at 1.0)
 */
export function bonferroniAdjustedPValues(pValues: number[]): number[] {
  if (pValues.length === 0) return [];

  const m = pValues.length;
  return pValues.map((p) => Math.min(1.0, p * m));
}

/**
 * Benjamini-Hochberg FDR Correction
 *
 * Less conservative than Bonferroni. Controls the expected proportion
 * of false discoveries (False Discovery Rate) rather than FWER.
 *
 * Algorithm:
 * 1. Sort p-values ascending with original indices
 * 2. For each p-value at rank k (1-indexed), compute threshold: (k/m) × alpha
 * 3. Find the largest k where p(k) <= threshold
 * 4. All tests with rank <= k are significant
 *
 * @param pValues Array of p-values from multiple tests
 * @param alpha Desired FDR level (default 0.05)
 * @returns Array of booleans indicating which tests are significant after correction
 */
export function benjaminiHochbergFDR(pValues: number[], alpha: number = 0.05): boolean[] {
  if (pValues.length === 0) return [];

  const m = pValues.length;

  // Create array of {index, pValue, rank} and sort by pValue
  const sorted = pValues.map((p, i) => ({ originalIndex: i, pValue: p })).sort((a, b) => a.pValue - b.pValue);

  // Find the largest rank k where p(k) <= (k/m) × alpha
  let maxK = 0;
  for (let k = 0; k < m; k++) {
    const threshold = ((k + 1) / m) * alpha;
    if (sorted[k].pValue <= threshold) {
      maxK = k + 1; // k+1 because we want inclusive count
    }
  }

  // Mark all tests with rank <= maxK as significant
  const significant = new Array(m).fill(false);
  for (let k = 0; k < maxK; k++) {
    significant[sorted[k].originalIndex] = true;
  }

  return significant;
}

/**
 * Benjamini-Hochberg Adjusted P-Values
 *
 * Returns adjusted p-values (q-values) rather than just significant/not.
 * Uses step-up procedure with monotonicity enforcement.
 *
 * @param pValues Array of p-values from multiple tests
 * @returns Array of adjusted p-values (q-values)
 */
export function benjaminiHochbergAdjustedPValues(pValues: number[]): number[] {
  if (pValues.length === 0) return [];

  const m = pValues.length;

  // Create sorted array with original indices
  const sorted = pValues.map((p, i) => ({ originalIndex: i, pValue: p })).sort((a, b) => a.pValue - b.pValue);

  // Calculate adjusted p-values (step-up)
  const adjustedSorted = new Array(m);

  // Start from the largest p-value
  adjustedSorted[m - 1] = sorted[m - 1].pValue;

  // Work backwards, enforcing monotonicity
  for (let k = m - 2; k >= 0; k--) {
    const adjustedP = (m / (k + 1)) * sorted[k].pValue;
    adjustedSorted[k] = Math.min(adjustedP, adjustedSorted[k + 1]);
  }

  // Cap at 1.0 and restore original order
  const result = new Array(m);
  for (let k = 0; k < m; k++) {
    result[sorted[k].originalIndex] = Math.min(1.0, adjustedSorted[k]);
  }

  return result;
}

/**
 * Apply Correction to Significance Results
 *
 * Helper function that takes raw p-values and applies the specified correction.
 *
 * @param pValues Array of p-values
 * @param correction Correction method: 'none' | 'bonferroni' | 'fdr'
 * @param alpha Significance level
 * @returns Array of booleans indicating significance after correction
 */
export function applyMultipleTestingCorrection(
  pValues: number[],
  correction: 'none' | 'bonferroni' | 'fdr',
  alpha: number = 0.05,
): boolean[] {
  switch (correction) {
    case 'bonferroni':
      return bonferroniCorrection(pValues, alpha);
    case 'fdr':
      return benjaminiHochbergFDR(pValues, alpha);
    case 'none':
    default:
      return pValues.map((p) => p < alpha);
  }
}

/**
 * Log Gamma Function (Lanczos Approximation)
 */
function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    // Reflection formula
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }

  x -= 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }

  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
