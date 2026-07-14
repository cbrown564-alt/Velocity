/**
 * Engine worker lifecycle actions.
 */

import {
  initializeEngineWorker,
  respawnEngineWorker,
  shutdownEngineWorker,
  createStorePersistenceBridge,
} from '../../../services/workspaceBoot/engineLifecycle';
import type { EngineResponseByType } from '../../../types/engineWorker';
import type { DataSlice } from './types';
import type { DataSliceGet, DataSliceSet } from './sliceContext';
import { applyLoadProgressMessage } from './loadProgress';

export function createEngineActions(
  set: DataSliceSet,
  get: DataSliceGet,
): Pick<DataSlice, 'initWorker' | 'terminateWorker' | 'shutdownWorker' | 'respawnWorker' | 'setLoadProgress'> {
  const bridge = () => createStorePersistenceBridge((partial) => set(partial));

  const handleLoadProgress = (msg: EngineResponseByType<'engine.loadProgress'>) => {
    applyLoadProgressMessage(set, msg);
  };

  return {
    initWorker: async () => {
      await initializeEngineWorker({
        getExistingEngine: () => get().browserEngine,
        getDatasetId: () => get().dataset?.id,
        getOpfsFileKey: () => get().dataset?.opfsFileKey,
        getOpfsAvailable: () => get().opfsAvailable,
        getPersistenceState: () => get().persistenceState,
        bridge: bridge(),
        setWorkerRuntimeError: (message) =>
          set({
            initError: message,
            persistenceState: 'error',
            browserEngine: null,
            isDbReady: false,
          }),
        assignBrowserEngine: (engine) => set({ browserEngine: engine }),
        setInitSuccess: (opfsAvailable) => set({ isDbReady: true, opfsAvailable }),
        setPersistenceReady: () => set({ persistenceState: 'ready' }),
        setInitError: (message) =>
          set({
            initError: message,
            persistenceState: 'error',
            browserEngine: null,
            isDbReady: false,
          }),
        checkPersistedData: () => get().checkPersistedData(),
        onLoadProgress: handleLoadProgress,
      });
    },

    terminateWorker: () => {
      const { browserEngine } = get();
      if (browserEngine) {
        browserEngine.terminate();
        console.log('[DataSlice] Engine terminated');
      }
      set({
        browserEngine: null,
        isDbReady: false,
        initError: null,
      });
    },

    shutdownWorker: async () => {
      await shutdownEngineWorker({
        getExistingEngine: () => get().browserEngine,
        clearEngineState: () => set({ browserEngine: null, isDbReady: false, initError: null }),
      });
      console.log('[DataSlice] Engine shut down');
    },

    respawnWorker: async (cleanStart: boolean = false, datasetIdOverride?: string) => {
      await respawnEngineWorker({
        getExistingEngine: () => get().browserEngine,
        clearEngineState: () => set({ browserEngine: null, isDbReady: false, initError: null }),
        getDatasetId: () => get().dataset?.id,
        getOpfsFileKey: () => get().dataset?.opfsFileKey,
        bridge: bridge(),
        setBrowserEngine: (engine) => set({ browserEngine: engine }),
        setRespawnSuccess: (opfsAvailable) =>
          set({
            isDbReady: true,
            opfsAvailable,
            persistenceState: 'ready',
          }),
        setRespawnError: (message) =>
          set({
            initError: message,
            persistenceState: 'error',
            browserEngine: null,
            isDbReady: false,
          }),
        setWorkerRuntimeError: (message) => set({ initError: message }),
        cleanStart,
        datasetIdOverride,
        onLoadProgress: handleLoadProgress,
      });
    },

    setLoadProgress: (progress) => set({ loadProgress: progress }),
  };
}
