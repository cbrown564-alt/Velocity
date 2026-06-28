/**
 * Worker-driven ingest progress state updates.
 */

import type { EngineResponseByType } from '../../../types/engineWorker';
import type { DataSlice, LoadProgressState } from './types';
import type { DataSliceSet } from './sliceContext';

export function applyLoadProgressMessage(set: DataSliceSet, msg: EngineResponseByType<'engine.loadProgress'>): void {
  if (msg.phase === 'complete') {
    set({ loadProgress: null });
  } else {
    set({
      loadProgress: {
        phase: msg.phase,
        progress: msg.progress,
        message: msg.message,
        rowsProcessed: msg.rowsProcessed,
        totalRows: msg.totalRows,
      },
    });
  }
}

export function createSetLoadProgress(set: DataSliceSet): (progress: LoadProgressState | null) => void {
  return (progress) => set({ loadProgress: progress });
}
