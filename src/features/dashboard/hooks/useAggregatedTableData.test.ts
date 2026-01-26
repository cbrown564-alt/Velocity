import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAggregatedTableData } from './useAggregatedTableData';
import { mockNominalVariable, mockOrdinalVariable } from '../../../test/fixtures/variables';
import { AggregatedRow } from '../../../types';

describe('useAggregatedTableData', () => {
    const mockData: AggregatedRow[] = [
        {
            rowKeys: ['1'], // Male
            colKey: 'Total',
            count: 10,
            weightedCount: 10,
        },
        {
            rowKeys: ['2'], // Female
            colKey: 'Total',
            count: 20,
            weightedCount: 20,
        }
    ];

    it('aggregates simple frequency table correctly', () => {
        const { result } = renderHook(() => useAggregatedTableData({
            data: mockData,
            rowVariables: [mockNominalVariable],
            colVariable: null,
        }));

        const tableData = result.current;
        expect(tableData).not.toBeNull();
        if (!tableData) return;

        expect(tableData.rows).toHaveLength(3);
        // Sort logic: Nominal sorts by frequency descending.
        // Female (20) should be first, Male (10) second, Non-binary (0) third.
        expect(tableData.rows[0].label).toBe('Female');
        expect(tableData.rows[0].total).toBe(20);
        expect(tableData.rows[1].label).toBe('Male');
        expect(tableData.rows[1].total).toBe(10);
        expect(tableData.rows[2].label).toBe('Non-binary');
        expect(tableData.rows[2].total).toBe(0);

        expect(tableData.grandTotal).toBe(30);
    });

    it('handles gap filling for ordinal variables', () => {
        // missing '3' (Neutral)
        const gapData: AggregatedRow[] = [
            { rowKeys: ['1'], colKey: 'Total', count: 5 }, // Very Dissatisfied
            { rowKeys: ['2'], colKey: 'Total', count: 5 }, // Dissatisfied
            // 3 missing
            { rowKeys: ['4'], colKey: 'Total', count: 5 }, // Satisfied
            { rowKeys: ['5'], colKey: 'Total', count: 5 }, // Very Satisfied
        ];

        const { result } = renderHook(() => useAggregatedTableData({
            data: gapData,
            rowVariables: [mockOrdinalVariable],
            colVariable: null,
            isMultipleResponse: false
        }));

        const tableData = result.current;
        expect(tableData).not.toBeNull();
        if (!tableData) return;

        // Should fill 1 to 5.
        // However, mockOrdinalVariable label values are 1..5.
        // Logic fills gap between min and max if "ordinal" type.
        // min=1, max=5. So 3 should be filled.
        const labels = tableData.rows.map(r => r.label);
        expect(labels).toContain('Neutral');
        // Or whatever label is for 3.
        const neutralRow = tableData.rows.find(r => r.rawValue === '3');
        expect(neutralRow).toBeDefined();
        expect(neutralRow?.total).toBe(0);
    });
});
