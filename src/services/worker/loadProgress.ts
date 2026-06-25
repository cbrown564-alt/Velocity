import type { EngineResponseByType } from '../../types/engineWorker';

export type SavLoadProgressUpdate = {
  phase: 'parsing' | 'inserting' | 'complete';
  progress: number;
  rowsProcessed?: number;
  totalRows?: number;
  message: string;
};

export type SavLoadProgressReporter = (update: SavLoadProgressUpdate) => void;

export function toEngineLoadProgress(
  requestId: string,
  update: SavLoadProgressUpdate,
): EngineResponseByType<'engine.loadProgress'> {
  return {
    type: 'engine.loadProgress',
    requestId,
    phase: update.phase,
    progress: update.progress,
    rowsProcessed: update.rowsProcessed,
    totalRows: update.totalRows,
    message: update.message,
  };
}
