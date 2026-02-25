
import { describe, it, expect } from 'vitest';
import { inferVariableType, inferVariableTyping } from './dataHeuristics';

describe('inferVariableType', () => {
    it('should identify Likert scales as ordered', () => {
        const likert = [
            { value: 1, label: 'Strongly Disagree' },
            { value: 2, label: 'Disagree' },
            { value: 3, label: 'Neutral' },
            { value: 4, label: 'Agree' },
            { value: 5, label: 'Strongly Agree' }
        ];
        expect(inferVariableType(likert)).toBe('ordered');
    });

    it('should identify intensity scales as ordered', () => {
        const intensity = [
            { value: 1, label: 'Very Low' },
            { value: 2, label: 'Low' },
            { value: 3, label: 'Moderate' },
            { value: 4, label: 'High' },
            { value: 5, label: 'Very High' }
        ];
        expect(inferVariableType(intensity)).toBe('ordered');
    });

    it('should identify numeric-only labels as ordered', () => {
        const numeric = [
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
            { value: 5, label: '5' }
        ];
        expect(inferVariableType(numeric)).toBe('ordered');
    });

    it('should identify mixed labels (numeric prefix) as ordered', () => {
        const mixed = [
            { value: 1, label: '1 - Poor' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
            { value: 5, label: '5 - Excellent' }
        ];
        expect(inferVariableType(mixed)).toBe('ordered');
    });

    it('should identify Education as ordered (curated sequence dictionary)', () => {
        const education = [
            { value: 1, label: 'Did not complete high school' },
            { value: 2, label: 'High school graduate' },
            { value: 3, label: 'Some college' },
            { value: 4, label: 'College graduate' },
            { value: 5, label: 'Post-graduate' }
        ];
        expect(inferVariableType(education)).toBe('ordered');
    });

    it('should identify sequential-coded demographic categories as categorical', () => {
        const gender = [
            { value: 1, label: 'Male' },
            { value: 2, label: 'Female' },
            { value: 3, label: 'Non-binary' }
        ];
        expect(inferVariableType(gender)).toBe('categorical');
    });

    it('should identify non-sequential categories as categorical', () => {
        const nonSeq = [
            { value: 1, label: 'Apple' },
            { value: 10, label: 'Banana' },
            { value: 50, label: 'Cherry' }
        ];
        expect(inferVariableType(nonSeq)).toBe('categorical');
    });

    it('should identify General Health (1-10) as ordered', () => {
        // This assumes gap filling has happened or labels are explicit
        const health = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
        // Add text to endpoints to mimic real data
        health[0].label = "1 - Poor";
        health[9].label = "10 - Excellent";

        expect(inferVariableType(health)).toBe('ordered');
    });

    it('should identify age bands as ordered via curated dictionaries', () => {
        const ageBands = [
            { value: 1, label: '18-24' },
            { value: 2, label: '25-34' },
            { value: 3, label: '35-44' },
            { value: 4, label: '45-54' },
            { value: 5, label: '55+' }
        ];
        expect(inferVariableType(ageBands)).toBe('ordered');
    });

    it('should allow disabling curated ordered dictionaries', () => {
        const education = [
            { value: 1, label: 'Did not complete high school' },
            { value: 2, label: 'High school graduate' },
            { value: 3, label: 'Some college' },
            { value: 4, label: 'College graduate' },
            { value: 5, label: 'Post-graduate' }
        ];
        expect(inferVariableTyping(education, { useCuratedOrderedDictionaries: false }).type).toBe('categorical');
    });
});
