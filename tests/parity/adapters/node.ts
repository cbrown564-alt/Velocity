import { DuckDBNodeAdapter } from '../../../src/adapters/DuckDBNodeAdapter';
import { DatabaseAdapter } from '../../../src/core/DatabaseAdapter';

export async function createNodeAdapter(): Promise<DatabaseAdapter> {
  return await DuckDBNodeAdapter.create();
}
