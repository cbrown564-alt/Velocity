/**
 * Analysis tool handlers — crosstab, stats, SQL, recode, filters, weight.
 */

import type { Filter } from '../../src/types/index.js';
import { successResponse } from '../responses.js';
import type { ToolHandler } from './types.js';

export const analysisHandlers: Record<string, ToolHandler> = {
  velocity_crosstab: async (engine, a) => {
    const result = await engine.runAnalysis('crosstab', {
      rowVars: a.rowVars,
      colVar: a.colVar ?? null,
      filters: a.filters,
      weightVar: a.weightVar ?? null,
      resolveLabels: a.resolveLabels ?? undefined,
      analysisSettings: a.analysisSettings,
      format: a.format,
    });
    return successResponse(result);
  },

  velocity_stats: async (engine, a) => {
    const result = await engine.runAnalysis('variableStats', {
      column: a.column,
      variableType: a.variableType,
      binCount: a.binCount,
    });
    return successResponse(result);
  },

  velocity_sql: async (engine, a) => {
    const result = await engine.query(String(a.sql));
    return successResponse(result);
  },

  velocity_recode: async (engine, a) => {
    const result = await engine.recode(String(a.sourceVar), a.config as never);
    return successResponse(result);
  },

  velocity_filter: (engine, a) => {
    engine.addFilter(a.filter as Filter);
    return successResponse({ ok: true });
  },

  velocity_clear_filters: (engine) => {
    engine.clearFilters();
    return successResponse({ ok: true });
  },

  velocity_set_weight: (engine, a) => {
    engine.setWeight(a.variableId as string | null);
    return successResponse({ ok: true });
  },
};
