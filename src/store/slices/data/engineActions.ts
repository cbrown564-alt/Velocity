/**
 * Engine worker lifecycle actions.
 */

import {
    initializeEngineWorker,
    respawnEngineWorker,
    createStorePersistenceBridge,
} from '../../enginePersistenceBridge';
import type { EngineResponseByType } from '../../../types/engineWorker';
import type { DataSlice } from './types';
import type { DataSliceGet, DataSliceSet } from './sliceContext';
import { applyLoadProgressMessage } from './loadProgress';

export function createEngineActions(
    set: DataSliceSet,
    get: DataSliceGet,
): Pick<DataSlice, 'initWorker' | 'terminateWorker' | 'respawnWorker' | 'setLoadProgress'> {
    const bridge = () => createStorePersistenceBridge((partial) => set(partial));

    const handleLoadProgress = (msg: EngineResponseByType<'engine.loadProgress'>) => {
        applyLoadProgressMessage(set, msg);
    };

    return {
        initWorker: async () => {
            await initializeEngineWorker({
                getExistingProxy: () => get().engineProxy,
                getDatasetId: () => get().dataset?.id,
                getOpfsAvailable: () => get().opfsAvailable,
                getPersistenceState: () => get().persistenceState,
                bridge: bridge(),
                setWorkerRuntimeError: (message) => set({ initError: message }),
                assignEngineProxy: (proxy) => set({ engineProxy: proxy, persistenceState: 'checking' }),
                setInitSuccess: (opfsAvailable) => set({ isDbReady: true, opfsAvailable }),
                setPersistenceReady: () => set({ persistenceState: 'ready' }),
                setInitError: (message) => set({ initError: message, persistenceState: 'error' }),
                checkPersistedData: () => get().checkPersistedData(),
                onLoadProgress: handleLoadProgress,
            });
        },

        terminateWorker: () => {
            const { engineProxy } = get();
            if (engineProxy) {
                engineProxy.terminate();
                console.log('[DataSlice] Engine terminated');
            }
            set({
                engineProxy: null,
                isDbReady: false,
                initError: null,
            });
        },

        respawnWorker: async (cleanStart: boolean = false, datasetIdOverride?: string) => {
            await respawnEngineWorker({
                terminateWorker: () => get().terminateWorker(),
                getDatasetId: () => get().dataset?.id,
                bridge: bridge(),
                setEngineProxy: (proxy) => set({ engineProxy: proxy }),
                setRespawnSuccess: (opfsAvailable) => set({
                    isDbReady: true,
                    opfsAvailable,
                    persistenceState: 'ready',
                }),
                setRespawnError: (message) => set({
                    initError: message,
                    persistenceState: 'error',
                }),
                cleanStart,
                datasetIdOverride,
                onLoadProgress: handleLoadProgress,
            });
        },

        setLoadProgress: (progress) => set({ loadProgress: progress }),
    };
}
