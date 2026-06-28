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
    const sexVar = result.variables.find((v) => v.id.toLowerCase() === 'sex');
    expect(sexVar).toBeDefined();
    expect(sexVar?.label).toBe('sex');
    expect(['categorical', 'ordered']).toContain(sexVar?.type as any);
    expect(sexVar?.valueLabels).toEqual([
      { value: 0, label: 'female' },
      { value: 1, label: 'male' },
    ]);

    const ageVar = result.variables.find((v) => v.id.toLowerCase() === 'age');
    expect(ageVar).toBeDefined();
    expect(ageVar?.type).toBe('numeric');
    expect(ageVar?.valueLabels).toEqual([]);

    // 3. Verify Data Integrity via DuckDB
    const data = await adapter.query('SELECT sex AS sex_value, COUNT(*) as cnt FROM main GROUP BY sex ORDER BY sex');
    expect(data.rows).toEqual([
      { sex_value: 0, cnt: 150 },
      { sex_value: 1, cnt: 121 },
    ]);

    // 4. Verify Variable Sets (Heuristics)
    // There should be a set for SEX
    const sexSet = result.variableSets.find((vs) => vs.variableIds.some((id) => id.toLowerCase() === 'sex'));
    expect(sexSet).toBeDefined();
    expect(sexSet?.structure).toBe('single');

    await adapter.close();
  });
});
