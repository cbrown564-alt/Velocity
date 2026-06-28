/**
 * Data slice initial state.
 */

import type { DataSlice } from './types';

export const dataSliceInitialState: Pick<
  DataSlice,
  | 'browserEngine'
  | 'isDbReady'
  | 'initError'
  | 'dataset'
  | 'variableSets'
  | 'folders'
  | 'transformLog'
  | 'variableStats'
  | 'variableStatsLoading'
  | 'opfsAvailable'
  | 'persistenceMode'
  | 'persistenceError'
  | 'activeDbPath'
  | 'persistenceState'
  | 'persistedDataInfo'
  | 'loadProgress'
> = {
  browserEngine: null,
  isDbReady: false,
  initError: null,
  dataset: null,
  variableSets: [],
  folders: [],
  transformLog: [],
  variableStats: {},
  variableStatsLoading: {},
  opfsAvailable: false,
  persistenceMode: 'memory',
  persistenceError: null,
  activeDbPath: null,
  persistenceState: 'idle',
  persistedDataInfo: null,
  loadProgress: null,
};
