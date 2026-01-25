import { describe, it, expect } from 'vitest';
import { generateSyntheticGridVariables } from './gridUtils';
import type { VariableSet } from '../types';

describe('generateSyntheticGridVariables', () => {
    it('should generate a scale variable with value labels and correct type', () => {
        const mockVariableSet: VariableSet = {
            id: 'grid_test',
            name: 'Test Grid',
            variableIds: ['v1', 'v2'],
            structure: 'grid',
            gridMetadata: {
                sharedScale: {
                    type: 'scale',
                    valueLabels: {
                        1: 'Not at all',
                        2: 'Somewhat',
                        3: 'Very much'
                    }
                },
                itemLabels: ['Item A', 'Item B'],
                itemMapping: { v1: 0, v2: 1 }
            }
        };

        const variables = generateSyntheticGridVariables(mockVariableSet);

        // Should return 2 variables: Scale and Items
        expect(variables).toHaveLength(2);

        const scaleVar = variables[0];
        const itemsVar = variables[1];

        // Check Scale Variable
        expect(scaleVar.id).toBe('grid_test_scale');
        expect(scaleVar.type).toBe('scale');
        expect(scaleVar.synthetic).toBe(true);

        // Verify Value Labels are populated (KEY FIX)
        expect(scaleVar.valueLabels).toHaveLength(3);
        expect(scaleVar.valueLabels).toContainEqual({ value: 1, label: 'Not at all' });
        expect(scaleVar.valueLabels).toContainEqual({ value: 3, label: 'Very much' });

        // Check Items Variable (should remain nominal with item labels)
        expect(itemsVar.id).toBe('grid_test_items');
        expect(itemsVar.type).toBe('nominal');
        expect(itemsVar.valueLabels).toHaveLength(2);
        expect(itemsVar.valueLabels[0].label).toBe('Item A');
    });

    it('should handle ordinal type correctly', () => {
        const mockVariableSet: VariableSet = {
            id: 'grid_ordinal',
            name: 'Ordinal Grid',
            variableIds: ['v1'],
            structure: 'grid',
            gridMetadata: {
                sharedScale: {
                    type: 'ordinal',
                    valueLabels: { 1: 'Low', 2: 'High' }
                },
                itemLabels: ['Item A'],
                itemMapping: { v1: 0 }
            }
        };

        const variables = generateSyntheticGridVariables(mockVariableSet);
        expect(variables[0].type).toBe('ordinal');
    });
});
