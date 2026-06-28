/**
 * MCP Tool Registration — Velocity Engine Transport Adapter
 *
 * Thin wiring: list schemas, dispatch tool calls via handler map.
 * Zero business logic here: validate inputs, dispatch to engine, format response.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { VelocityEngine } from '../src/engine/index.js';
import { TOOL_HANDLERS } from './handlers/index.js';
import { errorResponse } from './responses.js';
import { TOOLS } from './schemas.js';

export function registerTools(server: Server, engine: VelocityEngine): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS as unknown as (typeof TOOLS)[number][],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;

    try {
      const handler = TOOL_HANDLERS[name];
      if (!handler) {
        return errorResponse(Object.assign(new Error(`Unknown tool: ${name}`), { code: 'ANALYSIS_NOT_FOUND' }));
      }
      return await handler(engine, a);
    } catch (err) {
      return errorResponse(err);
    }
  });
}
