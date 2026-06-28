/**
 * Semantic layer tool handlers — annotation, concepts, search, suggestions.
 */

import { successResponse } from '../responses.js';
import type { ToolHandler } from './types.js';

export const semanticHandlers: Record<string, ToolHandler> = {
  velocity_annotate_dataset: async (engine) => {
    const result = await engine.annotateDataset();
    return successResponse(result);
  },

  velocity_annotate: (engine, a) => {
    engine.annotateVariable(String(a.variableId), a.annotation as never);
    return successResponse({ ok: true });
  },

  velocity_search_variables: async (engine, a) => {
    const result = await engine.searchVariables(String(a.query), {
      limit: typeof a.limit === 'number' ? a.limit : undefined,
    });
    return successResponse(result);
  },

  velocity_list_concepts: (engine) => {
    const result = engine.listConcepts();
    return successResponse(result);
  },

  velocity_create_concept: (engine, a) => {
    const result = engine.createConcept({
      name: String(a.name),
      aliases: Array.isArray(a.aliases) ? (a.aliases as string[]) : undefined,
      canonicalScale: a.canonicalScale as never,
    });
    return successResponse(result);
  },

  velocity_link_concept: (engine, a) => {
    engine.linkVariableToConcept(String(a.variableId), String(a.conceptId));
    return successResponse({ ok: true });
  },

  velocity_suggest_analyses: async (engine, a) => {
    const varIds = Array.isArray(a.variableIds) ? (a.variableIds as string[]) : [];
    const result = await engine.suggestAnalyses(varIds);
    return successResponse(result);
  },

  velocity_list_variables_by_category: (engine, a) => {
    const result = engine.listVariablesByCategory(String(a.category) as never, {
      includeUnannotated: true,
      limit: typeof a.limit === 'number' ? a.limit : undefined,
    });
    return successResponse(result);
  },

  velocity_suggest_breaks: (engine, a) => {
    const result = engine.suggestBreaks(String(a.variableId), {
      limit: typeof a.limit === 'number' ? a.limit : undefined,
    });
    return successResponse(result);
  },
};
