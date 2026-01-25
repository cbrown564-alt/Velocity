import { describe, it, expect } from 'vitest';
import { recommendChart } from './chartRecommender';
import { Variable } from '../types';

describe('chartRecommender', () => {
    it('should recommend diverging-bar for single ordinal variable', () => {
        const ordinalVar: Variable = {
            id: 'v1',
            name: 'v1',
            label: 'Likert Scale',
            type: 'ordinal',
            valueLabels: [],
            missingValues: {}
        };

        const result = recommendChart({
            rowVars: [ordinalVar],
            colVar: null,
            isGrid: false,
            isMultiResponse: false
        });

        expect(result.default).toBe('diverging-bar');
    });

    it('should recommend horizontal-bar for single nominal variable', () => {
        const nominalVar: Variable = {
            id: 'v2',
            name: 'v2',
            label: 'Gender',
            type: 'nominal',
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
});
