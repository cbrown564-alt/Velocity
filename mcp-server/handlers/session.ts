/**
 * Session tool handlers — export and import .velocity session files.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serializeSessionFile } from '../../src/core/session/index.js';
import { resolveSessionOutputPath, successResponse } from '../responses.js';
import type { ToolHandler } from './types.js';

export const sessionHandlers: Record<string, ToolHandler> = {
  velocity_export_session: async (engine, a) => {
    const result = await engine.exportSession();
    const outputPath =
      typeof a.outputPath === 'string' && a.outputPath.length > 0 ? resolveSessionOutputPath(a.outputPath) : null;

    if (outputPath) {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serializeSessionFile(result.data), 'utf8');
      return successResponse({
        ...result,
        outputPath,
      });
    }

    return successResponse(result);
  },

  velocity_import_session: async (engine, a) => {
    const result = await engine.importSession(a.session as never);
    return successResponse(result);
  },
};
