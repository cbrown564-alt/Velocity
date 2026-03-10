/**
 * Harmonization Slice Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createHarmonizationSlice, type HarmonizationSlice } from './harmonizationSlice';
import { wave1Variables, wave2Variables } from '../../test/fixtures/harmonization';

function createTestStore() {
  return create<HarmonizationSlice & { worker: Worker | null; engineProxy: any }>()((...args) => ({
    ...createHarmonizationSlice(...args),
    worker: null,
    engineProxy: null,
  }));
}

describe('harmonizationSlice', () => {
  describe('openHarmonization', () => {
    it('creates a new session', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');

      const { harmonization } = store.getState();
      expect(harmonization.isOpen).toBe(true);
      expect(harmonization.session).not.toBeNull();
      expect(harmonization.session?.sourceDatasetId).toBe('ds1');
      expect(harmonization.session?.targetDatasetId).toBe('ds2');
    });

    it('reuses existing session for same datasets', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');
      const sessionId = store.getState().harmonization.session?.id;

      store.getState().closeHarmonization();
      store.getState().openHarmonization('ds1', 'ds2');

      // Session ID should be same
      expect(store.getState().harmonization.session?.id).toBe(sessionId);
    });

    it('creates fresh session for different datasets', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');
      const sessionId1 = store.getState().harmonization.session?.id;

      store.getState().openHarmonization('ds3', 'ds4');
      const sessionId2 = store.getState().harmonization.session?.id;

      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('closeHarmonization', () => {
    it('sets isOpen to false but keeps session', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');
      store.getState().closeHarmonization();

      const { harmonization } = store.getState();
      expect(harmonization.isOpen).toBe(false);
      expect(harmonization.session).not.toBeNull(); // session preserved
    });
  });

  describe('runAutoMatch', () => {
    it('populates mappings in session', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');
      store.getState().runAutoMatch(wave1Variables, wave2Variables);

      const { session } = store.getState().harmonization;
      expect(session?.mappings.length).toBeGreaterThan(0);
    });

    it('includes both matched and unmapped entries', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');
      // Use threshold 0.9 so Q4 (NPS, no labels) can't match Q5 (CES, Likert labels)
      store.getState().runAutoMatch(wave1Variables, wave2Variables, undefined, 0.9);

      const { session } = store.getState().harmonization;
      const statuses = session?.mappings.map(m => m.status) ?? [];
      expect(statuses).toContain('auto_matched');
      expect(statuses).toContain('unmapped');
    });
  });

  describe('confirmMapping', () => {
    it('sets confirmed=true on the mapping', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');
      store.getState().runAutoMatch(wave1Variables, wave2Variables);

      const { session } = store.getState().harmonization;
      const firstMatchedId = session?.mappings.find(m => m.status === 'auto_matched')?.id;
      expect(firstMatchedId).toBeDefined();

      store.getState().confirmMapping(firstMatchedId!);

      const updated = store.getState().harmonization.session?.mappings.find(
        m => m.id === firstMatchedId
      );
      expect(updated?.confirmed).toBe(true);
    });
  });

  describe('confirmAllMappings', () => {
    it('confirms all mapped variables', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');
      store.getState().runAutoMatch(wave1Variables, wave2Variables);
      store.getState().confirmAllMappings();

      const { session } = store.getState().harmonization;
      const mappedOnes = session?.mappings.filter(m => m.targetVariableId !== null) ?? [];
      for (const m of mappedOnes) {
        expect(m.confirmed).toBe(true);
      }
    });
  });

  describe('selectMapping', () => {
    it('sets selectedMappingId', () => {
      const store = createTestStore();
      store.getState().selectMapping('mapping-123');
      expect(store.getState().harmonization.selectedMappingId).toBe('mapping-123');
    });

    it('can be cleared with null', () => {
      const store = createTestStore();
      store.getState().selectMapping('mapping-123');
      store.getState().selectMapping(null);
      expect(store.getState().harmonization.selectedMappingId).toBeNull();
    });
  });

  describe('updateValueMapping', () => {
    it('updates value mappings for a specific mapping', () => {
      const store = createTestStore();
      store.getState().openHarmonization('ds1', 'ds2');
      store.getState().runAutoMatch(wave1Variables, wave2Variables);

      const { session } = store.getState().harmonization;
      const mappingId = session?.mappings[0]?.id;
      expect(mappingId).toBeDefined();

      const newValueMappings = [
        { sourceValue: 1, sourceLabel: 'Test', targetValue: 2, targetLabel: 'Test2' },
      ];
      store.getState().updateValueMapping(mappingId!, newValueMappings);

      const updated = store.getState().harmonization.session?.mappings[0];
      expect(updated?.valueMappings).toEqual(newValueMappings);
    });
  });

  describe('applyHarmonization', () => {
    it('calls engineProxy.buildHarmonizedTable with id->name lookups and stores output table name', async () => {
      const mockBuildHarmonizedTable = vi.fn().mockResolvedValue({
        tableName: 'harm_test_table',
        rowCount: 42,
        durationMs: 12,
      });

      const mockEngineProxy = {
        buildHarmonizedTable: mockBuildHarmonizedTable,
      } as any;

      const store = createTestStore();
      store.setState({ engineProxy: mockEngineProxy });
      store.getState().openHarmonization('wave1', 'wave2');
      store.getState().runAutoMatch(wave1Variables, wave2Variables);
      store.getState().confirmAllMappings();

      const result = await store.getState().applyHarmonization({
        sourceTable: 'wave1_table',
        targetTable: 'wave2_table',
        sourceVars: wave1Variables,
        targetVars: wave2Variables,
      });

      // Verify buildHarmonizedTable was called with correct args
      expect(mockBuildHarmonizedTable).toHaveBeenCalledTimes(1);
      const callArgs = mockBuildHarmonizedTable.mock.calls[0];
      const [sourceTable, targetTable, mappings, outputTableName, sourceVarNames, targetVarNames] = callArgs;

      expect(sourceTable).toBe('wave1_table');
      expect(targetTable).toBe('wave2_table');
      expect(sourceVarNames).toBeDefined();
      expect(targetVarNames).toBeDefined();

      // Verify name lookups
      const sample = store.getState().harmonization.session?.mappings.find(m => m.targetVariableId !== null);
      expect(sample).toBeDefined();
      if (sample?.targetVariableId) {
        const srcVar = wave1Variables.find(v => v.id === sample.sourceVariableId)!;
        const tgtVar = wave2Variables.find(v => v.id === sample.targetVariableId)!;
        expect(sourceVarNames[sample.sourceVariableId]).toBe(srcVar.name);
        expect(targetVarNames[sample.targetVariableId]).toBe(tgtVar.name);
      }

      expect(result?.tableName).toBe('harm_test_table');
      expect(store.getState().harmonization.session?.outputTableName).toBe('harm_test_table');
    });
  });
});
