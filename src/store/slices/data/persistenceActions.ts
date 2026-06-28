/**
 * OPFS persistence and session restore actions.
 */

import * as opfsFileManager from '../../../services/opfsFileManager';
import { rehydrateDatasetFromOpfsSource } from '../../workspaceDatasetLifecycle';
import type { Variable, VariableSet } from '../../../types/dataset';
import type { DataSlice } from './types';
import type { DataSliceGet, DataSliceSet } from './sliceContext';
import { getRunAnalysis as resolveRunAnalysis } from './sliceContext';

export function createPersistenceActions(
  set: DataSliceSet,
  get: DataSliceGet,
): Pick<
  DataSlice,
  | 'checkPersistedData'
  | 'clearPersistedData'
  | 'flushPersistedData'
  | 'restoreFromPersistence'
  | 'discardPersistedData'
  | 'rehydrateDatasetFromOpfs'
> {
  return {
    checkPersistedData: async () => {
      const { browserEngine } = get();
      if (!browserEngine) throw new Error('Engine not initialized');

      set({ persistenceState: 'checking' });

      try {
        const response = await browserEngine.checkPersistedData();
        if (response.type === 'engine.persistedDataFound') {
          set({
            persistenceState: 'found',
            persistedDataInfo: {
              schema: response.schema,
              rowCount: response.rowCount,
              metadata: response.metadata,
            },
          });
          console.log(`[DataSlice] Found persisted data: ${response.rowCount} rows, ${response.schema.length} columns`);
        } else {
          set({ persistenceState: 'ready', persistedDataInfo: null });
          console.log('[DataSlice] No persisted data found');
        }
      } catch (error: unknown) {
        if (get().persistenceState !== 'corrupt') {
          set({ persistenceState: 'ready' });
        }
        throw error;
      }
    },

    clearPersistedData: async () => {
      const { browserEngine } = get();
      if (!browserEngine) throw new Error('Engine not initialized');

      await browserEngine.clearPersistedData();
      set({ persistedDataInfo: null });
      console.log('[DataSlice] Persisted data cleared');
    },

    flushPersistedData: async () => {
      const { browserEngine, opfsAvailable } = get();
      if (!browserEngine || !opfsAvailable) return;

      try {
        const response = await browserEngine.flushPersistedData();
        if (!response.ok) {
          console.warn('[DataSlice] OPFS flush failed:', response.error);
          set({ persistenceError: response.error || 'OPFS flush failed' });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[DataSlice] OPFS flush error:', message);
        set({ persistenceError: message });
      }
    },

    rehydrateDatasetFromOpfs: async (options?: { forceReload?: boolean }) => {
      const { browserEngine, dataset, transformLog } = get();
      if (!browserEngine) throw new Error('Engine not initialized');
      if (!dataset) throw new Error('Dataset has no OPFS source key');

      const runAnalysis = resolveRunAnalysis(get);

      await rehydrateDatasetFromOpfsSource(
        {
          browserEngine,
          dataset,
          transformLog,
          runAnalysis,
          flushPersistedData: () => get().flushPersistedData(),
        },
        options,
      );
    },

    restoreFromPersistence: () => {
      const { persistedDataInfo, dataset } = get();

      if (!persistedDataInfo) {
        console.warn('[DataSlice] No persisted data info to restore from');
        set({ persistenceState: 'ready' });
        return;
      }

      if (dataset) {
        console.log('[DataSlice] Restoring with existing dataset metadata');
        set({ persistenceState: 'ready' });
        const runAnalysis = resolveRunAnalysis(get);
        if (runAnalysis) {
          void runAnalysis().catch((error) => {
            console.warn('[DataSlice] Analysis replay failed after persistence restore:', error);
          });
        }
      } else {
        console.log('[DataSlice] Reconstructing dataset from OPFS schema');
        const variables: Variable[] = persistedDataInfo.schema.map((col) => ({
          id: col.name,
          name: col.name,
          label: col.name.replace(/_/g, ' '),
          type: col.type.includes('VARCHAR') || col.type.includes('UTF') ? 'categorical' : 'numeric',
          valueLabels: [],
          missingValues: {},
        }));

        const variableSets: VariableSet[] = variables.map((v) => ({
          id: crypto.randomUUID(),
          name: v.label || v.name,
          variableIds: [v.id],
          structure: 'single',
          type: v.type,
        }));

        set({
          dataset: {
            id: crypto.randomUUID(),
            name: 'Restored Session',
            rowCount: persistedDataInfo.rowCount,
            variables,
            source: 'sav',
            loadDiagnostics: {
              isPartial: true,
              reason: 'unknown',
              message:
                'Session restored from schema metadata only. Value labels are unavailable until you rebuild from source.',
              createdAt: Date.now(),
            },
          },
          variableSets,
          persistenceState: 'ready',
        });
        const runAnalysis = resolveRunAnalysis(get);
        if (runAnalysis) {
          void runAnalysis().catch((error) => {
            console.warn('[DataSlice] Analysis replay failed after schema-only restore:', error);
          });
        }
      }
    },

    discardPersistedData: async () => {
      const opfsKey = get().dataset?.opfsFileKey;
      const activeDbPath = get().activeDbPath;

      if (activeDbPath?.startsWith('opfs://')) {
        get().terminateWorker();
        try {
          const dbFiles = await opfsFileManager.listDbFiles();
          await Promise.all(dbFiles.map((file) => opfsFileManager.deleteDbFile(file.name)));
        } catch (error) {
          console.warn('[DataSlice] Failed to purge OPFS DB files during discard:', error);
        }
        await get().respawnWorker(false);
      } else {
        await get().clearPersistedData();
      }

      if (opfsKey) {
        await opfsFileManager.deleteFile(opfsKey).catch(() => {});
      }
      set({
        persistenceState: 'ready',
        persistedDataInfo: null,
        dataset: null,
        variableSets: [],
        folders: [],
        transformLog: [],
      });
    },
  };
}
