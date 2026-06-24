/**
 * Workspace per-dataset session snapshot (table, filters, transforms).
 * Shared by workspace registry, data slice open input, and session coordinator.
 */

import type { Filter, TableConfig } from './analysis';
import type { DataTransform } from './dataset';

export interface DatasetSessionState {
  tableConfig: TableConfig;
  activeFilters: Filter[];
  transformLog: DataTransform[];
}
