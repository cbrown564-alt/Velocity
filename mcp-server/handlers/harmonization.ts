/**
 * Harmonization tool handlers — cross-wave mapping and table SQL.
 */

import type { VariableMapping } from '../../src/types/harmonization.js';
import { successResponse } from '../responses.js';
import type { ToolHandler } from './types.js';

export const harmonizationHandlers: Record<string, ToolHandler> = {
  velocity_propose_mappings: async (engine, a) => {
    const wave1VarIds = Array.isArray(a.wave1VarIds) ? (a.wave1VarIds as string[]) : [];
    const wave2VarIds = Array.isArray(a.wave2VarIds) ? (a.wave2VarIds as string[]) : [];
    const result = await engine.proposeMappings(wave1VarIds, wave2VarIds);
    return successResponse(result);
  },

  velocity_build_harmonized_table: async (engine, a) => {
    const result = await engine.buildHarmonizedTable(
      String(a.sourceTable),
      String(a.targetTable),
      a.mappings as VariableMapping[],
      a.sourceVarNames as Record<string, string>,
      a.targetVarNames as Record<string, string>,
    );
    return successResponse(result);
  },
};
