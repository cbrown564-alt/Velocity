import { describe, it, expect, beforeEach } from 'vitest';
import { analysisRegistry } from '../core/analysis/registry';
import { AnalysisRunner } from '../core/analysis/AnalysisRunner';
import { DatabaseAdapter } from '../core/DatabaseAdapter';
import { crosstabRunner } from '../core/analysis/crosstabRunner';
import { variableStatsRunner } from '../core/analysis/variableStatsRunner';

describe('Plugin Architecture', () => {
    it('should have core runners registered', () => {
        const list = analysisRegistry.list();
        expect(list.map(r => r.id)).toContain('crosstab');
        expect(list.map(r => r.id)).toContain('variableStats');
    });

    it('should allow registering a new runner', async () => {
        const dummyRunner: AnalysisRunner<any, any> = {
            id: 'dummy',
            label: 'Dummy Analysis',
            configSchema: {},
            run: async (adapter, config) => {
                return { success: true, config };
            }
        };

        analysisRegistry.register(dummyRunner);

        const runner = analysisRegistry.get('dummy');
        expect(runner).toBeDefined();
        expect(runner?.id).toBe('dummy');

        const result = await runner?.run({} as DatabaseAdapter, { foo: 'bar' });
        expect(result).toEqual({ success: true, config: { foo: 'bar' } });
    });

    it('should resolve and run crosstab via registry', () => {
        const runner = analysisRegistry.get('crosstab');
        expect(runner).toBe(crosstabRunner);
        expect(runner?.id).toBe('crosstab');
    });

    it('should resolve and run variableStats via registry', () => {
        const runner = analysisRegistry.get('variableStats');
        expect(runner).toBe(variableStatsRunner);
        expect(runner?.id).toBe('variableStats');
    });

    it('should return undefined for unknown runners', () => {
        expect(analysisRegistry.get('nonexistent')).toBeUndefined();
    });
});
