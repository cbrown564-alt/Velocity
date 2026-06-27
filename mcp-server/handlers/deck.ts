/**
 * Deck building tool handlers — build, export, commit, chart recommendation.
 */

import type { DeckSpec, DeckExportOptions, BuiltDeck } from '../../src/engine/types.js';
import { assertValidDeckSpec } from '../../src/engine/deckSpecValidation.js';
import { formatBuildDeckResponse } from '../deckTransport.js';
import { successResponse } from '../responses.js';
import type { ToolHandler } from './types.js';

export const deckHandlers: Record<string, ToolHandler> = {
  velocity_draft_deck_plan: (engine, a) => {
    assertValidDeckSpec(a.spec);
    const result = engine.draftDeckPlan(a.spec as DeckSpec);
    return successResponse(result);
  },

  velocity_build_deck: async (engine, a) => {
    assertValidDeckSpec(a.spec);
    const result = await engine.buildDeck(a.spec as DeckSpec);
    return formatBuildDeckResponse(result);
  },

  velocity_export_deck: async (engine, a) => {
    const result = await engine.exportDeck(a.deck as BuiltDeck, a.options as DeckExportOptions);
    const bytes = result.data;
    const base64 =
      typeof Buffer !== 'undefined'
        ? Buffer.from(bytes).toString('base64')
        : btoa(String.fromCharCode(...Array.from(bytes)));
    return successResponse({
      ...result,
      data: { format: (a.options as DeckExportOptions).format, base64, byteLength: bytes.length },
    });
  },

  velocity_commit_deck: (engine, a) => {
    const deck = a.deck as BuiltDeck;
    const result = engine.commitDeck(deck);
    return successResponse(result);
  },

  velocity_recommend_chart: async (engine, a) => {
    const rowVarIds = Array.isArray(a.rowVarIds) ? (a.rowVarIds as string[]) : [];
    const result = await engine.recommendChart(rowVarIds, (a.colVarId as string | null) ?? null);
    return successResponse(result);
  },
};
