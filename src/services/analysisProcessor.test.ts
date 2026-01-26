
import { processAnalysisData } from './analysisProcessor';
import { AggregatedRow, Variable } from '../types';

describe('analysisProcessor', () => {
    const mockRowVariable: Variable = {
        id: 'gender',
        name: 'Gender',
        label: 'Gender',
        type: 'nominal',
        valueLabels: [
            { value: 1, label: 'Male' },
            { value: 2, label: 'Female' }
        ],
        missingValues: {}
    };

    const mockData: AggregatedRow[] = [
        {
            rowKeys: ['1'],
            colKey: 'Total',
            count: 40,
            weightedCount: 40
        },
        {
            rowKeys: ['2'],
            colKey: 'Total',
            count: 60,
            weightedCount: 60
        }
    ];

    it('processes simple frequency data correctly', () => {
        const result = processAnalysisData({
            data: mockData,
            rowVariables: [mockRowVariable],
            colVariable: null
        });

        expect(result).not.toBeNull();
        if (!result) return;

        // Check Columns
        expect(result.columns).toHaveLength(1);
        expect(result.columns[0].key).toBe('Total');
        expect(result.grandTotal).toBe(100);

        // Check Rows
        expect(result.rows).toHaveLength(2);
        // Verify label resolution
        const maleRow = result.rows.find(r => r.rawValue === '1');
        const femaleRow = result.rows.find(r => r.rawValue === '2');

        expect(maleRow).toBeDefined();
        expect(maleRow?.label).toBe('Male');
        expect(maleRow?.total).toBe(40);

        expect(femaleRow).toBeDefined();
        expect(femaleRow?.label).toBe('Female');
        expect(femaleRow?.total).toBe(60);

        // Check Series
        expect(result.series).toHaveLength(1);
        expect(result.series[0].key).toBe('Total');
        expect(result.series[0].data).toHaveLength(2);
    });

    it('handles crosstab data correctly', () => {
        const mockColVariable: Variable = {
            id: 'brand',
            name: 'Brand',
            label: 'Brand',
            type: 'nominal',
            valueLabels: [
                { value: 101, label: 'Brand A' },
                { value: 102, label: 'Brand B' }
            ],
            missingValues: {}
        };

        const crosstabData: AggregatedRow[] = [
            // Male (1) x Brand A (101)
            { rowKeys: ['1'], colKey: '101', count: 10 },
            // Male (1) x Brand B (102)
            { rowKeys: ['1'], colKey: '102', count: 30 },
            // Female (2) x Brand A (101)
            { rowKeys: ['2'], colKey: '101', count: 40 },
            // Female (2) x Brand B (102)
            { rowKeys: ['2'], colKey: '102', count: 20 },
        ];

        const result = processAnalysisData({
            data: crosstabData,
            rowVariables: [mockRowVariable],
            colVariable: mockColVariable
        });

        expect(result).not.toBeNull();
        if (!result) return;

        // Columns should be resolved
        expect(result.columns).toHaveLength(2);
        expect(result.columns.map(c => c.key).sort()).toEqual(['101', '102']);

        // Rows should be created with correct cells
        const maleRow = result.rows.find(r => r.rawValue === '1');
        expect(maleRow).toBeDefined();

        // Access cell by column key
        expect(maleRow?.cells['101']?.count).toBe(10);
        expect(maleRow?.cells['102']?.count).toBe(30);

        // Check Totals
        // Male Total = 40
        expect(maleRow?.total).toBe(40);

        // Grand Total = 10 + 30 + 40 + 20 = 100
        expect(result.grandTotal).toBe(100);
    });
});
