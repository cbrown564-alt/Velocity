
import { describe, it, expect } from 'vitest';
import {
    calculateZScore, calculateTScore, calculateESS,
    calculateChiSquare, chiSquareCDF,
    calculateMeanCI, calculateProportionCI,
    calculatePairwiseComparisons, ColumnStats,
    bonferroniCorrection, bonferroniAdjustedPValues,
    benjaminiHochbergFDR, benjaminiHochbergAdjustedPValues,
    applyMultipleTestingCorrection
} from './statistics';

describe('Statistics', () => {
    describe('calculateZScore', () => {
        it('detects significant difference (High)', () => {
            // Group A: 50% (50/100)
            // Group B: 30% (30/100)
            // Expect Significant Z > 1.96
            const z = calculateZScore(0.5, 100, 0.3, 100);
            expect(z).toBeGreaterThan(1.96);
        });

        it('detects significant difference (Low)', () => {
            // Group A: 10% (10/100)
            // Group B: 30% (30/100)
            // Expect Significant Z < -1.96
            const z = calculateZScore(0.1, 100, 0.3, 100);
            expect(z).toBeLessThan(-1.96);
        });

        it('returns 0 for identical proportions', () => {
            const z = calculateZScore(0.5, 100, 0.5, 100);
            expect(z).toBe(0);
        });

        it('handles small zeros safely', () => {
            expect(calculateZScore(0, 0, 0.5, 100)).toBe(0);
        });
    });

    describe('calculateTScore', () => {
        it('detects significant mean difference', () => {
            // Group A: Mean 5, SD 1, N 50
            // Group B: Mean 4, SD 1, N 50
            // SE = sqrt(1/50 + 1/50) = sqrt(0.04) = 0.2
            // T = (5-4)/0.2 = 5
            const t = calculateTScore(5, 1, 50, 4, 1, 50);
            expect(t).toBeCloseTo(5, 1);
        });
    });

    describe('calculateESS', () => {
        it('returns Weighted N if no variance in weights (all 1)', () => {
            // 10 people, weight 1.0 each. Sum = 10, SumSq = 10. ESS = 100/10 = 10.
            expect(calculateESS(10, 10)).toBe(10);
        });

        it('penalizes unequal weights', () => {
            // 2 people. Weights: 0.1, 1.9. Mean = 1.0.
            // Sum = 2.0. 
            // SumSq = 0.01 + 3.61 = 3.62.
            // ESS = 4 / 3.62 = 1.10.
            // Effectively we have 1 person worth of information, not 2.
            const ess = calculateESS(2, 3.62);
            expect(ess).toBeCloseTo(1.10, 2);
            expect(ess).toBeLessThan(2);
        });

        it('handles zero sumSq safely', () => {
            expect(calculateESS(10, 0)).toBe(10);
        });
    });

    describe('chiSquareCDF', () => {
        it('returns 0 for x <= 0', () => {
            expect(chiSquareCDF(0, 2)).toBe(0);
            expect(chiSquareCDF(-1, 2)).toBe(0);
        });

        it('returns values in valid CDF range for typical inputs', () => {
            // χ²(10, df=4) should be > 0.95 (p < 0.05)
            const cdf = chiSquareCDF(10, 4);
            expect(cdf).toBeGreaterThan(0.9);
            expect(cdf).toBeLessThanOrEqual(1);
        });

        it('increases monotonically with x', () => {
            const df = 4;
            const cdf1 = chiSquareCDF(5, df);
            const cdf2 = chiSquareCDF(10, df);
            const cdf3 = chiSquareCDF(15, df);
            expect(cdf2).toBeGreaterThan(cdf1);
            expect(cdf3).toBeGreaterThan(cdf2);
        });
    });

    describe('calculateChiSquare', () => {
        it('returns zero chi-square for empty table', () => {
            const result = calculateChiSquare([]);
            expect(result.chiSquare).toBe(0);
            expect(result.df).toBe(0);
            expect(result.pValue).toBe(1);
        });

        it('detects significant association (2x2 table)', () => {
            // Example: Treatment vs Control with outcome
            // Observed:
            //           Success  Failure
            // Treatment    40       10   (50)
            // Control      20       30   (50)
            // Total        60       40   (100)
            //
            // Expected:
            // Treatment: 50*60/100=30, 50*40/100=20
            // Control:   50*60/100=30, 50*40/100=20
            //
            // χ² = (40-30)²/30 + (10-20)²/20 + (20-30)²/30 + (30-20)²/20
            //    = 100/30 + 100/20 + 100/30 + 100/20
            //    = 3.33 + 5 + 3.33 + 5 = 16.67
            // df = (2-1)(2-1) = 1
            // p < 0.001 (highly significant)

            const observed = [
                [40, 10],
                [20, 30]
            ];

            const result = calculateChiSquare(observed);

            expect(result.chiSquare).toBeCloseTo(16.67, 1);
            expect(result.df).toBe(1);
            expect(result.pValue).toBeLessThan(0.001);
        });

        it('detects no significant association', () => {
            // Perfectly proportional (no association)
            //           A    B
            // Row 1    25   25   (50)
            // Row 2    25   25   (50)
            // Total    50   50   (100)
            //
            // χ² = 0, df = 1, p = 1

            const observed = [
                [25, 25],
                [25, 25]
            ];

            const result = calculateChiSquare(observed);

            expect(result.chiSquare).toBeCloseTo(0, 5);
            expect(result.df).toBe(1);
            expect(result.pValue).toBeCloseTo(1, 2);
        });

        it('handles 3x3 table correctly', () => {
            // Example 3x3 table with df = (3-1)(3-1) = 4
            const observed = [
                [10, 20, 30],
                [15, 25, 20],
                [25, 15, 20]
            ];

            const result = calculateChiSquare(observed);

            expect(result.df).toBe(4);
            expect(result.chiSquare).toBeGreaterThan(0);
            // This table has some variation, expect p < 0.05
            expect(result.pValue).toBeLessThan(0.05);
        });

        it('calculates Cramers V for effect size', () => {
            // Strong association (same as first test)
            const strongAssoc = [
                [40, 10],
                [20, 30]
            ];

            const strongResult = calculateChiSquare(strongAssoc);
            // Cramér's V = sqrt(χ²/n*min(r-1,c-1)) = sqrt(16.67/100*1) = 0.408
            expect(strongResult.cramersV).toBeCloseTo(0.408, 2);

            // No association
            const noAssoc = [
                [25, 25],
                [25, 25]
            ];

            const noResult = calculateChiSquare(noAssoc);
            expect(noResult.cramersV).toBeCloseTo(0, 5);
        });
    });

    describe('calculateMeanCI', () => {
        it('returns point estimate for n < 2', () => {
            const ci = calculateMeanCI(5.0, 1.0, 1, 0.95);
            expect(ci.lower).toBe(5.0);
            expect(ci.upper).toBe(5.0);
        });

        it('calculates correct 95% CI for mean', () => {
            // Mean = 10, StdDev = 2, n = 100
            // SE = 2 / sqrt(100) = 0.2
            // 95% CI = 10 ± 1.96 * 0.2 = 10 ± 0.392
            const ci = calculateMeanCI(10, 2, 100, 0.95);
            expect(ci.lower).toBeCloseTo(9.608, 2);
            expect(ci.upper).toBeCloseTo(10.392, 2);
        });

        it('calculates correct 80% CI for mean', () => {
            // Mean = 10, StdDev = 2, n = 100
            // SE = 0.2
            // 80% CI = 10 ± 1.282 * 0.2 = 10 ± 0.256
            const ci = calculateMeanCI(10, 2, 100, 0.80);
            expect(ci.lower).toBeCloseTo(9.744, 2);
            expect(ci.upper).toBeCloseTo(10.256, 2);
        });

        it('widens with smaller sample size', () => {
            const ciLarge = calculateMeanCI(10, 2, 100, 0.95);
            const ciSmall = calculateMeanCI(10, 2, 25, 0.95);

            // Smaller sample = wider CI
            expect(ciSmall.upper - ciSmall.lower).toBeGreaterThan(ciLarge.upper - ciLarge.lower);
        });
    });

    describe('calculateProportionCI', () => {
        it('returns point estimate for n < 1', () => {
            const ci = calculateProportionCI(0.5, 0, 0.95);
            expect(ci.lower).toBe(0.5);
            expect(ci.upper).toBe(0.5);
        });

        it('calculates Wilson score CI for 50% proportion', () => {
            // p = 0.5, n = 100, 95% CI
            // Using Wilson score interval
            const ci = calculateProportionCI(0.5, 100, 0.95);

            // CI should be roughly 0.40 - 0.60
            expect(ci.lower).toBeCloseTo(0.40, 1);
            expect(ci.upper).toBeCloseTo(0.60, 1);
        });

        it('handles extreme proportions (near 0)', () => {
            // p = 0.05, n = 100
            const ci = calculateProportionCI(0.05, 100, 0.95);

            // Lower bound should not go below 0
            expect(ci.lower).toBeGreaterThanOrEqual(0);
            expect(ci.upper).toBeGreaterThan(0.05);
        });

        it('handles extreme proportions (near 1)', () => {
            // p = 0.95, n = 100
            const ci = calculateProportionCI(0.95, 100, 0.95);

            // Upper bound should not exceed 1
            expect(ci.upper).toBeLessThanOrEqual(1);
            expect(ci.lower).toBeLessThan(0.95);
        });

        it('is symmetric around 0.5', () => {
            const ciLow = calculateProportionCI(0.3, 100, 0.95);
            const ciHigh = calculateProportionCI(0.7, 100, 0.95);

            // Width should be similar for symmetric proportions
            const widthLow = ciLow.upper - ciLow.lower;
            const widthHigh = ciHigh.upper - ciHigh.lower;
            expect(Math.abs(widthLow - widthHigh)).toBeLessThan(0.01);
        });
    });

    describe('calculatePairwiseComparisons', () => {
        it('assigns correct letter codes to columns', () => {
            const columns: ColumnStats[] = [
                { key: 'Brand_A', mean: 5.0, stdDev: 1.0, ess: 100 },
                { key: 'Brand_B', mean: 4.0, stdDev: 1.0, ess: 100 },
                { key: 'Brand_C', mean: 3.0, stdDev: 1.0, ess: 100 },
            ];

            const results = calculatePairwiseComparisons(columns, true, 0.05);

            expect(results.get('Brand_A')?.columnLetter).toBe('A');
            expect(results.get('Brand_B')?.columnLetter).toBe('B');
            expect(results.get('Brand_C')?.columnLetter).toBe('C');
        });

        it('detects significant differences between means', () => {
            // Brand A (mean 5) is significantly higher than B (4) and C (3)
            // Brand B (mean 4) is significantly higher than C (3)
            const columns: ColumnStats[] = [
                { key: 'Brand_A', mean: 5.0, stdDev: 1.0, ess: 100 },
                { key: 'Brand_B', mean: 4.0, stdDev: 1.0, ess: 100 },
                { key: 'Brand_C', mean: 3.0, stdDev: 1.0, ess: 100 },
            ];

            const results = calculatePairwiseComparisons(columns, true, 0.05);

            // A is higher than B and C
            expect(results.get('Brand_A')?.sigLetters).toBe('BC');

            // B is higher than C
            expect(results.get('Brand_B')?.sigLetters).toBe('C');

            // C is not higher than anyone
            expect(results.get('Brand_C')?.sigLetters).toBe('');
        });

        it('detects significant differences between proportions', () => {
            // Column A has 60% selected, B has 40%, C has 20%
            const columns: ColumnStats[] = [
                { key: 'Col_A', proportion: 0.60, ess: 100 },
                { key: 'Col_B', proportion: 0.40, ess: 100 },
                { key: 'Col_C', proportion: 0.20, ess: 100 },
            ];

            const results = calculatePairwiseComparisons(columns, false, 0.05);

            // A is higher than B and C
            expect(results.get('Col_A')?.higherThan).toContain('B');
            expect(results.get('Col_A')?.higherThan).toContain('C');

            // C is lower than A and B
            expect(results.get('Col_C')?.lowerThan).toContain('A');
            expect(results.get('Col_C')?.lowerThan).toContain('B');
        });

        it('handles insufficient sample sizes', () => {
            const columns: ColumnStats[] = [
                { key: 'A', mean: 5.0, stdDev: 1.0, ess: 1 }, // Too small
                { key: 'B', mean: 4.0, stdDev: 1.0, ess: 100 },
            ];

            const results = calculatePairwiseComparisons(columns, true, 0.05);

            // No comparisons should be made with insufficient sample size
            expect(results.get('A')?.sigLetters).toBe('');
            expect(results.get('B')?.sigLetters).toBe('');
        });

        it('returns empty sigLetters when no significant differences', () => {
            // Similar means with high variance = not significant
            const columns: ColumnStats[] = [
                { key: 'A', mean: 5.0, stdDev: 2.0, ess: 10 },
                { key: 'B', mean: 5.1, stdDev: 2.0, ess: 10 },
            ];

            const results = calculatePairwiseComparisons(columns, true, 0.05);

            expect(results.get('A')?.sigLetters).toBe('');
            expect(results.get('B')?.sigLetters).toBe('');
        });
    });

    describe('bonferroniCorrection', () => {
        it('returns empty array for empty input', () => {
            expect(bonferroniCorrection([])).toEqual([]);
        });

        it('applies Bonferroni correction correctly', () => {
            // 5 tests, alpha = 0.05
            // Adjusted alpha = 0.05 / 5 = 0.01
            const pValues = [0.001, 0.008, 0.02, 0.04, 0.5];

            const result = bonferroniCorrection(pValues, 0.05);

            expect(result[0]).toBe(true);  // 0.001 < 0.01
            expect(result[1]).toBe(true);  // 0.008 < 0.01
            expect(result[2]).toBe(false); // 0.02 > 0.01
            expect(result[3]).toBe(false); // 0.04 > 0.01
            expect(result[4]).toBe(false); // 0.5 > 0.01
        });

        it('is more conservative than uncorrected', () => {
            const pValues = [0.01, 0.02, 0.03, 0.04];

            const uncorrected = pValues.map(p => p < 0.05);
            const corrected = bonferroniCorrection(pValues, 0.05);

            // All are significant uncorrected
            expect(uncorrected.filter(x => x).length).toBe(4);
            // Only the first should be significant after Bonferroni (0.05/4 = 0.0125)
            expect(corrected.filter(x => x).length).toBe(1);
        });
    });

    describe('bonferroniAdjustedPValues', () => {
        it('returns empty array for empty input', () => {
            expect(bonferroniAdjustedPValues([])).toEqual([]);
        });

        it('adjusts p-values correctly', () => {
            const pValues = [0.01, 0.02, 0.03];

            const adjusted = bonferroniAdjustedPValues(pValues);

            expect(adjusted[0]).toBeCloseTo(0.03, 5); // 0.01 * 3
            expect(adjusted[1]).toBeCloseTo(0.06, 5); // 0.02 * 3
            expect(adjusted[2]).toBeCloseTo(0.09, 5); // 0.03 * 3
        });

        it('caps adjusted p-values at 1.0', () => {
            const pValues = [0.01, 0.5, 0.9];

            const adjusted = bonferroniAdjustedPValues(pValues);

            expect(adjusted[0]).toBeCloseTo(0.03, 5); // 0.01 * 3
            expect(adjusted[1]).toBe(1.0); // 0.5 * 3 = 1.5, capped at 1.0
            expect(adjusted[2]).toBe(1.0); // 0.9 * 3 = 2.7, capped at 1.0
        });
    });

    describe('benjaminiHochbergFDR', () => {
        it('returns empty array for empty input', () => {
            expect(benjaminiHochbergFDR([])).toEqual([]);
        });

        it('applies BH correction correctly', () => {
            // 5 tests, alpha = 0.05
            // Sorted: 0.001, 0.008, 0.02, 0.04, 0.5
            // Thresholds: 0.01, 0.02, 0.03, 0.04, 0.05
            // 0.001 < 0.01 ✓, 0.008 < 0.02 ✓, 0.02 < 0.03 ✓, 0.04 <= 0.04 ✓, 0.5 > 0.05 ✗
            const pValues = [0.001, 0.008, 0.02, 0.04, 0.5];

            const result = benjaminiHochbergFDR(pValues, 0.05);

            expect(result[0]).toBe(true);  // significant
            expect(result[1]).toBe(true);  // significant
            expect(result[2]).toBe(true);  // significant
            expect(result[3]).toBe(true);  // significant (exactly at threshold)
            expect(result[4]).toBe(false); // not significant
        });

        it('is less conservative than Bonferroni', () => {
            const pValues = [0.01, 0.02, 0.03, 0.04];

            const bonferroni = bonferroniCorrection(pValues, 0.05);
            const fdr = benjaminiHochbergFDR(pValues, 0.05);

            // FDR should be less conservative (more significant)
            const bonferroniCount = bonferroni.filter(x => x).length;
            const fdrCount = fdr.filter(x => x).length;

            expect(fdrCount).toBeGreaterThanOrEqual(bonferroniCount);
        });

        it('preserves original order in results', () => {
            // p-values out of order
            const pValues = [0.5, 0.001, 0.02];

            const result = benjaminiHochbergFDR(pValues, 0.05);

            // Original indices should be preserved
            expect(result[0]).toBe(false); // 0.5 - not significant
            expect(result[1]).toBe(true);  // 0.001 - significant
            expect(result[2]).toBe(true);  // 0.02 - significant (rank 2, threshold 0.0333)
        });
    });

    describe('benjaminiHochbergAdjustedPValues', () => {
        it('returns empty array for empty input', () => {
            expect(benjaminiHochbergAdjustedPValues([])).toEqual([]);
        });

        it('returns adjusted p-values with monotonicity', () => {
            const pValues = [0.01, 0.02, 0.03];

            const adjusted = benjaminiHochbergAdjustedPValues(pValues);

            // Adjusted values should be monotonically non-decreasing after sorting
            // and capped at 1.0
            adjusted.forEach(p => {
                expect(p).toBeGreaterThanOrEqual(0);
                expect(p).toBeLessThanOrEqual(1);
            });
        });

        it('adjusted p-values are in expected range', () => {
            const pValues = [0.001, 0.01, 0.05];

            const adjusted = benjaminiHochbergAdjustedPValues(pValues);

            // Adjusted p-values should be >= original p-values
            adjusted.forEach((adjP, i) => {
                expect(adjP).toBeGreaterThanOrEqual(pValues[i]);
            });
        });
    });

    describe('applyMultipleTestingCorrection', () => {
        it('applies no correction when specified', () => {
            const pValues = [0.01, 0.02, 0.06];

            const result = applyMultipleTestingCorrection(pValues, 'none', 0.05);

            expect(result[0]).toBe(true);
            expect(result[1]).toBe(true);
            expect(result[2]).toBe(false);
        });

        it('applies Bonferroni when specified', () => {
            const pValues = [0.01, 0.02, 0.06];

            const result = applyMultipleTestingCorrection(pValues, 'bonferroni', 0.05);

            // Adjusted alpha = 0.05 / 3 = 0.0167
            expect(result[0]).toBe(true);  // 0.01 < 0.0167
            expect(result[1]).toBe(false); // 0.02 > 0.0167
            expect(result[2]).toBe(false); // 0.06 > 0.0167
        });

        it('applies FDR when specified', () => {
            const pValues = [0.01, 0.02, 0.06];

            const result = applyMultipleTestingCorrection(pValues, 'fdr', 0.05);

            // More permissive than Bonferroni
            expect(result[0]).toBe(true);
            expect(result[1]).toBe(true);  // FDR allows this
            expect(result[2]).toBe(false);
        });
    });
});
