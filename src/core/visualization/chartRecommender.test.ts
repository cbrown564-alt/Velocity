import { describe, it, expect } from 'vitest';
import { recommendChart } from './chartRecommender';
import { Variable } from '../../types';

describe('chartRecommender', () => {
    it('should recommend horizontal-bar for single ordered sequence variable', () => {
        const ordinalVar: Variable = {
            id: 'v1',
            name: 'v1',
            label: 'Likert Scale',
            type: 'ordered',
            orderedStyle: 'sequence',
            valueLabels: [],
            missingValues: {}
        };

        const result = recommendChart({
            rowVars: [ordinalVar],
            colVar: null,
            isGrid: false,
            isMultiResponse: false
        });

        expect(result.default).toBe('horizontal-bar');
    });

    it('should recommend diverging-bar for single ordered rating variable', () => {
        const scaleVar: Variable = {
            id: 'v1',
            name: 'v1',
            label: 'Likert Scale',
            type: 'ordered',
            orderedStyle: 'rating',
            valueLabels: [],
            missingValues: {}
        };

        const result = recommendChart({
            rowVars: [scaleVar],
            colVar: null,
            isGrid: false,
            isMultiResponse: false
        });

        expect(result.default).toBe('diverging-bar');
    });

    it('should recommend diverging-bar with grouped-bar alternative for Grid', () => {
        const scaleVar: Variable = {
            id: 'v1',
            name: 'v1',
            label: 'Likert Grid',
            type: 'ordered',
            orderedStyle: 'rating',
            valueLabels: [],
            missingValues: {}
        };

        const result = recommendChart({
            rowVars: [scaleVar], // ProcessedData might produce 1 rowVar if flattened or just context
            colVar: null,
            isGrid: true,
            isMultiResponse: false
        });

        expect(result.default).toBe('diverging-bar');
        expect(result.alternatives).toContain('grouped-bar');
        expect(result.alternatives).not.toContain('vertical-bar');
        expect(result.alternatives).not.toContain('stacked-bar');
    });

    it('should recommend horizontal-bar for single categorical variable', () => {
        const nominalVar: Variable = {
            id: 'v2',
            name: 'v2',
            label: 'Gender',
            type: 'categorical',
            valueLabels: [],
            missingValues: {}
        };

        const result = recommendChart({
            rowVars: [nominalVar],
            colVar: null,
            isGrid: false,
            isMultiResponse: false
        });

        expect(result.default).toBe('horizontal-bar');
    });

    it('should recommend grouped-box-plot for Numeric x Categorical (symmetric)', () => {
        const numVar: Variable = { id: 'num', name: 'age', label: 'Age', type: 'numeric', valueLabels: [], missingValues: {} };
        const catVar: Variable = { id: 'cat', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} };

        // Row: Numeric, Col: Categorical
        const res1 = recommendChart({
            rowVars: [numVar],
            colVar: catVar,
        });
        expect(res1.default).toBe('grouped-box-plot');

        // Row: Categorical, Col: Numeric
        const res2 = recommendChart({
            rowVars: [catVar],
            colVar: numVar,
        });
        expect(res2.default).toBe('grouped-box-plot');
    });
});
