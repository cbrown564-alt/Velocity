import { describe, it, expect } from 'vitest';
import { DuckDBNodeAdapter } from '../adapters/DuckDBNodeAdapter';
import path from 'path';

describe('SAV Ingestion Golden Test (CLI Path)', () => {
    it('should match expected metadata and data for sleep.sav', async () => {
        const adapter = await DuckDBNodeAdapter.create();
        const filePath = path.resolve(process.cwd(), 'test_data/sleep.sav');

        // Test loadSav which uses the hybrid/fallback logic
        const result = await adapter.loadSav(filePath);

        // 1. Verify Row Count
        expect(result.rowCount).toBe(271);

        // 2. Verify Metadata (Variables)
        const sexVar = result.variables.find(v => v.id === 'SEX');
        expect(sexVar).toBeDefined();
        expect(sexVar?.label).toBe('sex');
        expect(sexVar?.type).toBe('ordinal');
        expect(sexVar?.valueLabels).toEqual([
            { value: 0, label: 'female' },
            { value: 1, label: 'male' }
        ]);

        const ageVar = result.variables.find(v => v.id === 'AGE');
        expect(ageVar).toBeDefined();
        expect(ageVar?.type).toBe('numeric');
        expect(ageVar?.valueLabels).toEqual([]);

        // 3. Verify Data Integrity via DuckDB
        const data = await adapter.query('SELECT SEX, COUNT(*) as cnt FROM main GROUP BY SEX ORDER BY SEX');
        expect(data.rows).toEqual([
            { SEX: 0, cnt: 150 },
            { SEX: 1, cnt: 121 }
        ]);

        // 4. Verify Variable Sets (Heuristics)
        // There should be a set for SEX
        const sexSet = result.variableSets.find(vs => vs.variableIds.includes('SEX'));
        expect(sexSet).toBeDefined();
        expect(sexSet?.structure).toBe('single');

        await adapter.close();
    });
});
