import { describe, it, expect } from 'vitest';
import { applyCanvasPlacement, applyGridSetDrop, generateSyntheticGridVariables, gridSetToTableConfig, placeVariableSet } from './gridUtils';
import type { VariableSet } from '../types';

describe('gridSetToTableConfig', () => {
    it('maps full mode to scale rows and items column', () => {
        expect(gridSetToTableConfig('grid_test', 'full')).toEqual({
            rowVars: ['grid_test_scale'],
            colVar: 'grid_test_items',
        });
    });

    it('row-scale-col-items mode matches full click-to-analyze layout', () => {
        expect(gridSetToTableConfig('grid_test', 'row-scale-col-items')).toEqual({
            rowVars: ['grid_test_scale'],
            colVar: 'grid_test_items',
        });
    });
});

describe('placeVariableSet', () => {
    const empty = { rowVars: [] as string[], colVar: null as string | null };

    describe('non-grid', () => {
        it('drop-zone-rows appends set id when not already present', () => {
            expect(placeVariableSet('age', 'single', 'drop-zone-rows', empty)).toEqual({
                rowVars: ['age'],
            });
        });

        it('drop-zone-rows is a no-op when set is already in rows', () => {
            expect(
                placeVariableSet('age', 'single', 'drop-zone-rows', { rowVars: ['age'], colVar: null }),
            ).toBeNull();
        });

        it('drop-zone-cols sets column variable', () => {
            expect(placeVariableSet('region', 'multiple', 'drop-zone-cols', empty)).toEqual({
                colVar: 'region',
            });
        });

        it('canvas places first variable on rows', () => {
            expect(placeVariableSet('gender', 'single', 'canvas', empty)).toEqual({
                rowVars: ['gender'],
            });
        });

        it('canvas places second variable on columns', () => {
            expect(
                placeVariableSet('region', 'single', 'canvas', { rowVars: ['gender'], colVar: null }),
            ).toEqual({ colVar: 'region' });
        });
    });

    describe('grid', () => {
        const setId = 'grid_test';

        it('delegates drop-zone-rows to applyGridSetDrop', () => {
            expect(
                placeVariableSet(setId, 'grid', 'drop-zone-rows', { rowVars: ['other'], colVar: null }),
            ).toEqual(applyGridSetDrop(setId, 'drop-zone-rows', { rowVars: ['other'], colVar: null }));
        });

        it('delegates canvas to full grid layout', () => {
            expect(placeVariableSet(setId, 'grid', 'canvas', empty)).toEqual(
                gridSetToTableConfig(setId, 'full'),
            );
        });
    });
});

describe('applyCanvasPlacement', () => {
    it('matches placeVariableSet canvas intent for non-grid', () => {
        expect(applyCanvasPlacement('gender', 'single', { rowVars: [], colVar: null })).toEqual({
            rowVars: ['gender'],
        });
    });

    it('matches placeVariableSet canvas intent for grid', () => {
        expect(applyCanvasPlacement('grid_test', 'grid', { rowVars: [], colVar: null })).toEqual(
            gridSetToTableConfig('grid_test', 'full'),
        );
    });
});

describe('applyGridSetDrop', () => {
    const setId = 'grid_test';
    const scaleId = 'grid_test_scale';
    const itemsId = 'grid_test_items';

    it('drop-zone-rows appends scale and sets items column', () => {
        expect(
            applyGridSetDrop(setId, 'drop-zone-rows', { rowVars: ['other_var'], colVar: null }),
        ).toEqual({
            rowVars: ['other_var', scaleId],
            colVar: itemsId,
        });
    });

    it('drop-zone-rows is a no-op when scale is already in rows', () => {
        const current = { rowVars: [scaleId, 'other_var'], colVar: 'existing_col' };
        expect(applyGridSetDrop(setId, 'drop-zone-rows', current)).toBe(current);
    });

    it('drop-zone-cols sets scale column and appends items to rows', () => {
        expect(
            applyGridSetDrop(setId, 'drop-zone-cols', { rowVars: ['other_var'], colVar: null }),
        ).toEqual({
            rowVars: ['other_var', itemsId],
            colVar: scaleId,
        });
    });

    it('drop-zone-cols keeps rows unchanged when items already present', () => {
        const current = { rowVars: [itemsId, 'other_var'], colVar: null };
        expect(applyGridSetDrop(setId, 'drop-zone-cols', current)).toEqual({
            rowVars: [itemsId, 'other_var'],
            colVar: scaleId,
        });
    });

    it('canvas delegates to gridSetToTableConfig full mode', () => {
        expect(
            applyGridSetDrop(setId, 'canvas', { rowVars: ['other_var'], colVar: 'other_col' }),
        ).toEqual(gridSetToTableConfig(setId, 'full'));
    });
});

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
        expect(scaleVar.type).toBe('ordered');
        expect(scaleVar.synthetic).toBe(true);

        // Verify Value Labels are populated (KEY FIX)
        expect(scaleVar.valueLabels).toHaveLength(3);
        expect(scaleVar.valueLabels).toContainEqual({ value: 1, label: 'Not at all' });
        expect(scaleVar.valueLabels).toContainEqual({ value: 3, label: 'Very much' });

        // Check Items Variable (should remain nominal with item labels)
        expect(itemsVar.id).toBe('grid_test_items');
        expect(itemsVar.type).toBe('categorical');
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
        expect(variables[0].type).toBe('ordered');
    });
});
