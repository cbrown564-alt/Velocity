/**
 * Data slice initial state.
 */

import type { DataSlice } from './types';

export const dataSliceInitialState: Pick<
  DataSlice,
  | 'browserEngine'
  | 'shellStatus'
  | 'engineStatus'
  | 'isDbReady'
  | 'initError'
  | 'dataset'
  | 'datasetStatus'
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
  shellStatus: 'ready',
  engineStatus: 'idle',
  isDbReady: false,
  initError: null,
  dataset: null,
  datasetStatus: 'idle',
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
