/**
 * Analysis Worker
 *
 * Runs DuckDB-WASM in a dedicated Web Worker to keep the main thread responsive.
 * All database operations go through this worker via message passing.
 *
 * Thin shell — implementation lives in src/services/worker/:
 * - duckdbOpfs.ts, duckdbPersistence.ts — OPFS + DuckDB lifecycle
 * - workerIngestion.ts, savChunkedLoader.ts — SAV/CSV loading
 * - workerQueries.ts — SQL query and recode helpers
 * - engineHandlers.ts — handler map (engine protocol)
 * - engineDispatch.ts — message queue bootstrap
 */

export type {
  WorkerRequest,
  WorkerResponse,
  VariableStatsResult,
  VariableStatsFrequency,
  NumericStats,
  PersistedMetadata,
} from '../types/worker';

import './worker/engineDispatch';
