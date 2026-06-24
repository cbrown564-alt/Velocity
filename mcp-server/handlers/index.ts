/**
 * MCP tool handler map — domain handlers merged by tool name.
 */

import { analysisHandlers } from './analysis.js';
import { dataLifecycleHandlers } from './dataLifecycle.js';
import { deckHandlers } from './deck.js';
import { harmonizationHandlers } from './harmonization.js';
import { semanticHandlers } from './semantic.js';
import { sessionHandlers } from './session.js';
import type { ToolHandler } from './types.js';

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  ...dataLifecycleHandlers,
  ...analysisHandlers,
  ...deckHandlers,
  ...harmonizationHandlers,
  ...sessionHandlers,
  ...semanticHandlers,
};
