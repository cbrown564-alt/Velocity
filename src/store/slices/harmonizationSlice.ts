/**
 * Harmonization Store Slice
 *
 * Manages state for the cross-wave variable harmonization workspace.
 */

import type { StateCreator } from 'zustand';
import type {
  HarmonizationSession,
  VariableMapping,
  ValueMapping,
  SankeyData,
  MatchingWeights,
} from '../../types/harmonization';
import type { Variable } from '../../types/index';
// WorkerRequest/WorkerResponse no longer used — migrated to EngineProxy
import { autoMatchVariables } from '../../core/harmonization/matchEngine';
import { buildSankeyData } from '../../core/harmonization/sankeyBuilder';
import type { DataSlice } from './dataSlice';

// ============================================================================
// Slice Interface
// ============================================================================

export interface HarmonizationSlice {
  harmonization: {
    isOpen: boolean;
    session: HarmonizationSession | null;
    matchingInProgress: boolean;
    sankeyData: SankeyData | null;
    selectedMappingId: string | null;
  };
  openHarmonization: (sourceDatasetId: string, targetDatasetId: string) => void;
  closeHarmonization: () => void;
  runAutoMatch: (sourceVars: Variable[], targetVars: Variable[], weights?: MatchingWeights, threshold?: number) => void;
  updateMapping: (mappingId: string, updates: Partial<VariableMapping>) => void;
  confirmMapping: (mappingId: string) => void;
  confirmAllMappings: () => void;
  selectMapping: (mappingId: string | null) => void;
  updateValueMapping: (mappingId: string, valueMappings: ValueMapping[]) => void;
  refreshSankeyData: (
    sourceVars: Variable[],
    targetVars: Variable[],
    sourceCounts: Record<string, number>,
    targetCounts: Record<string, number>
  ) => void;
  applyHarmonization: (params: {
    sourceTable: string;
    targetTable: string;
    sourceVars: Variable[];
    targetVars: Variable[];
    outputTableName?: string;
    onlyConfirmed?: boolean;
  }) => Promise<{ tableName: string; rowCount: number; durationMs: number } | null>;
  resetHarmonizationSession: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialHarmonizationState = {
  isOpen: false,
  session: null as HarmonizationSession | null,
  matchingInProgress: false,
  sankeyData: null as SankeyData | null,
  selectedMappingId: null as string | null,
};

// ============================================================================
// Slice Factory
// ============================================================================

export const createHarmonizationSlice: StateCreator<
  HarmonizationSlice & Pick<DataSlice, 'engineProxy'>,
  [],
  [],
  HarmonizationSlice
> = (set, get) => ({
  harmonization: { ...initialHarmonizationState },

  openHarmonization: (sourceDatasetId, targetDatasetId) => {
    const existing = get().harmonization.session;

    // Reuse existing session if same datasets
    if (
      existing &&
      existing.sourceDatasetId === sourceDatasetId &&
      existing.targetDatasetId === targetDatasetId
    ) {
      set(state => ({ harmonization: { ...state.harmonization, isOpen: true } }));
      return;
    }

    // Create new session
    const session: HarmonizationSession = {
      id: `harm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceDatasetId,
      targetDatasetId,
      mappings: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      outputTableName: null,
    };

    set({
      harmonization: {
        isOpen: true,
        session,
        matchingInProgress: false,
        sankeyData: null,
        selectedMappingId: null,
      },
    });
  },

  closeHarmonization: () => {
    set(state => ({
      harmonization: {
        ...state.harmonization,
        isOpen: false,
        sankeyData: null,
        selectedMappingId: null,
      },
    }));
  },

  runAutoMatch: (sourceVars, targetVars, weights, threshold) => {
    const session = get().harmonization.session;
    if (!session) return;

    set(state => ({
      harmonization: { ...state.harmonization, matchingInProgress: true },
    }));

    const mappings = autoMatchVariables(sourceVars, targetVars, weights, threshold);

    const updatedSession: HarmonizationSession = {
      ...session,
      mappings,
      updatedAt: Date.now(),
    };

    set(state => ({
      harmonization: {
        ...state.harmonization,
        session: updatedSession,
        matchingInProgress: false,
      },
    }));
  },

  updateMapping: (mappingId, updates) => {
    const session = get().harmonization.session;
    if (!session) return;

    const updatedMappings = session.mappings.map(m =>
      m.id === mappingId ? { ...m, ...updates } : m
    );

    set(state => ({
      harmonization: {
        ...state.harmonization,
        session: {
          ...session,
          mappings: updatedMappings,
          updatedAt: Date.now(),
        },
      },
    }));
  },

  confirmMapping: (mappingId) => {
    get().updateMapping(mappingId, { confirmed: true, status: 'manual' });
  },

  confirmAllMappings: () => {
    const session = get().harmonization.session;
    if (!session) return;

    const updatedMappings = session.mappings.map(m =>
      m.targetVariableId !== null
        ? { ...m, confirmed: true, status: 'manual' as const }
        : m
    );

    set(state => ({
      harmonization: {
        ...state.harmonization,
        session: {
          ...session,
          mappings: updatedMappings,
          updatedAt: Date.now(),
        },
      },
    }));
  },

  selectMapping: (mappingId) => {
    set(state => ({
      harmonization: { ...state.harmonization, selectedMappingId: mappingId },
    }));
  },

  updateValueMapping: (mappingId, valueMappings) => {
    get().updateMapping(mappingId, { valueMappings });
  },

  refreshSankeyData: (sourceVars, targetVars, sourceCounts, targetCounts) => {
    const session = get().harmonization.session;
    if (!session) return;

    const sankeyData = buildSankeyData(session, sourceVars, targetVars, sourceCounts, targetCounts);

    set(state => ({
      harmonization: { ...state.harmonization, sankeyData },
    }));
  },

  applyHarmonization: async ({
    sourceTable,
    targetTable,
    sourceVars,
    targetVars,
    outputTableName,
    onlyConfirmed = true,
  }) => {
    const engineProxy = get().engineProxy;
    if (!engineProxy) throw new Error('Engine not initialized');

    const session = get().harmonization.session;
    if (!session) return null;

    const eligibleMappings = session.mappings.filter(m => {
      if (m.targetVariableId === null || m.status === 'excluded') return false;
      if (onlyConfirmed) return m.confirmed;
      return true;
    });

    if (eligibleMappings.length === 0) {
      throw new Error('No eligible mappings to apply');
    }

    const sourceVarNames = Object.fromEntries(sourceVars.map(v => [v.id, v.name]));
    const targetVarNames = Object.fromEntries(targetVars.map(v => [v.id, v.name]));
    const resolvedOutputTable = outputTableName ?? `harmonized_${session.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    const response = await engineProxy.buildHarmonizedTable(
      sourceTable,
      targetTable,
      eligibleMappings,
      resolvedOutputTable,
      sourceVarNames,
      targetVarNames,
    );

    set(state => ({
      harmonization: {
        ...state.harmonization,
        session: state.harmonization.session
          ? {
            ...state.harmonization.session,
            outputTableName: response.tableName,
            updatedAt: Date.now(),
          }
          : null,
      },
    }));

    return {
      tableName: response.tableName,
      rowCount: response.rowCount,
      durationMs: response.durationMs,
    };
  },

  resetHarmonizationSession: () => {
    set({
      harmonization: { ...initialHarmonizationState },
    });
  },
});
