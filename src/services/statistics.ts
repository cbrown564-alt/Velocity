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
        return m1 === m2 ? 0 : (m1 > m2 ? Infinity : -Infinity);
    }

    // Welch's t-test standard error
    const se = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);

    if (se === 0) {
        return m1 === m2 ? 0 : (m1 > m2 ? Infinity : -Infinity);
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
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return 1 - prob;
}
