import type { VelocityEngine } from '../../src/engine/index.js';
import type { McpToolResponse } from '../responses.js';

export type ToolHandler = (
  engine: VelocityEngine,
  args: Record<string, unknown>
) => Promise<McpToolResponse> | McpToolResponse;
