
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVelocityStore } from '../../store';
import { mockDataset, mockNominalVariable } from '../fixtures/variables';

describe('Integration: Store <-> EngineProxy Analysis Flow', () => {

    beforeEach(() => {
        useVelocityStore.setState({
            worker: null,
            engineProxy: null,
            dataset: null,
            variableSets: [],
            isDbReady: false,
            queryResult: [],
            isQuerying: false,
            tableConfig: { rowVars: [], colVar: null }
        });
        vi.clearAllMocks();
    });

    it('should trigger runCrosstab and update results when TableConfig changes', async () => {
        const mockResult = [
            {
                rowKey_0: 'Male',
                colKey: 'Total',
                count: 50,
                percentage: 50,
                validCount: 50
            },
            {
                rowKey_0: 'Female',
                colKey: 'Total',
                count: 50,
                percentage: 50,
                validCount: 50
            }
        ];

        const mockRunCrosstab = vi.fn().mockResolvedValue({
            data: mockResult,
            tableStats: null,
            durationMs: 50,
        });

        const mockEngineProxy = {
            runCrosstab: mockRunCrosstab,
            getVariableStats: vi.fn().mockResolvedValue({ stats: {} }),
        } as any;

        useVelocityStore.setState({
            engineProxy: mockEngineProxy,
            dataset: mockDataset,
            isDbReady: true,
            variableSets: [{
                id: mockNominalVariable.id,
                name: mockNominalVariable.label,
                variableIds: [mockNominalVariable.id],
                structure: 'single',
                type: 'nominal'
            }]
        });

        // Action: Set Table Config (triggers runAnalysis automatically)
        useVelocityStore.getState().setTableConfig({
            rowVars: [mockNominalVariable.id],
            colVar: null
        });

        // runAnalysis is async — wait for it
        await new Promise(resolve => setTimeout(resolve, 0));

        // Verify runCrosstab was called
        expect(mockRunCrosstab).toHaveBeenCalledWith(
            expect.objectContaining({
                rowVars: [mockNominalVariable.id]
            }),
            expect.any(Object),
            expect.objectContaining({
                comparisonMethod: 'cell_vs_rest',
                correctionType: 'none',
                significanceLevel: 0.95,
            }),
        );

        // Assert Final State
        const finalState = useVelocityStore.getState();
        expect(finalState.isQuerying).toBe(false);
        expect(finalState.queryResult).toHaveLength(2);
        expect(finalState.queryResult[0]).toEqual(expect.objectContaining({
            rowKeys: ['Male'],
            count: 50
        }));
    });
});
