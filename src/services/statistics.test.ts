
import { describe, it, expect } from 'vitest';
import { calculateZScore, calculateTScore, calculateESS } from './statistics';

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
});
