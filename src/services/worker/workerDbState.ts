import type * as duckdb from '@duckdb/duckdb-wasm';
import type { DuckDBWasmAdapter } from '../../adapters/DuckDBWasmAdapter';

export const OPFS_BASE_NAME = 'velocity_data';
export const OPFS_SCHEMA_VERSION = 1;
export const META_TABLE = 'velocity_meta';

export type PersistenceMode = 'opfs' | 'memory' | 'disabled';

export type PersistenceContext = {
  datasetId?: string;
  schemaVersion: number;
};

export const ENABLE_DUCKDB_OPFS_PERSISTENCE = true;
export const MIN_DUCKDB_VERSION_FOR_OPFS_PERSISTENCE: [number, number, number] = [1, 3, 2];

export const workerDbState = {
  db: null as duckdb.AsyncDuckDB | null,
  conn: null as duckdb.AsyncDuckDBConnection | null,
  adapter: null as DuckDBWasmAdapter | null,
  persistenceMode: 'memory' as PersistenceMode,
  persistenceError: null as string | null,
  activeDbPath: ':memory:',
  persistenceContext: { schemaVersion: OPFS_SCHEMA_VERSION } as PersistenceContext,
  opfsAvailable: false,
  keepaliveInterval: null as ReturnType<typeof setInterval> | null,
  fatalRecoveryPromise: null as Promise<void> | null,
};
