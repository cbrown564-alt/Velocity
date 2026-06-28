/**
 * MCP response formatting — pure transport helpers, no engine logic.
 */

import path from 'node:path';
import type { VelocityError } from '../src/engine/index.js';
import { SESSION_FILE_EXTENSION } from '../src/core/session/index.js';

export type McpTextContent = { type: 'text'; text: string };

export type McpToolResponse = {
  content: McpTextContent[];
  isError?: true;
};

export function successResponse(data: unknown): McpToolResponse {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function resolveSessionOutputPath(outputPath: string): string {
  const resolved = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);

  return resolved.endsWith(SESSION_FILE_EXTENSION) ? resolved : `${resolved}${SESSION_FILE_EXTENSION}`;
}

export function errorResponse(err: VelocityError | Error | unknown): McpToolResponse {
  const isVelocityError = (e: unknown): e is VelocityError =>
    typeof e === 'object' && e !== null && 'code' in e && 'message' in e;

  if (isVelocityError(err)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: err.code, message: err.message, details: err.details }),
        },
      ],
      isError: true as const,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: 'UNKNOWN_ERROR', message }) }],
    isError: true as const,
  };
}
