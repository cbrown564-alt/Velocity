/**
 * Data lifecycle tool handlers — load, workspace, describe.
 */

import type { VariableMapping } from '../../src/types/harmonization.js';
import { successResponse } from '../responses.js';
import type { ToolHandler } from './types.js';

export const dataLifecycleHandlers: Record<string, ToolHandler> = {
  velocity_load: async (engine, a) => {
    const result = await engine.loadFile(String(a.path));
    return successResponse(result);
  },

  velocity_load_metadata: async (engine, a) => {
    const result = await engine.loadFileMetadata(String(a.path));
    return successResponse(result);
  },

  velocity_load_full: async (engine, a) => {
    const result = await engine.loadFileFull(String(a.path));
    return successResponse(result);
  },

  velocity_workspace_load: async (engine, a) => {
    const result = await engine.loadWorkspaceDataset(String(a.path), {
      metadataOnly: a.metadataOnly === true,
      waveNumber: typeof a.waveNumber === 'number' ? a.waveNumber : undefined,
      makeActive: a.makeActive === true,
    });
    return successResponse(result);
  },

  velocity_workspace_list: (engine) => {
    const result = engine.listWorkspaceDatasets();
    return successResponse(result);
  },

  velocity_workspace_set_active: (engine, a) => {
    const result = engine.setActiveWorkspaceDataset(String(a.datasetId));
    return successResponse(result);
  },

  velocity_workspace_load_full: async (engine, a) => {
    const result = await engine.loadWorkspaceDatasetFull(String(a.datasetId));
    return successResponse(result);
  },

  velocity_workspace_propose_mappings: async (engine, a) => {
    const result = await engine.proposeWorkspaceMappings(String(a.sourceDatasetId), String(a.targetDatasetId));
    return successResponse(result);
  },

  velocity_workspace_harmonize: async (engine, a) => {
    const result = await engine.harmonizeWorkspaceDatasets({
      sourceDatasetId: String(a.sourceDatasetId),
      targetDatasetId: String(a.targetDatasetId),
      mappings: (Array.isArray(a.mappings) ? a.mappings : []) as VariableMapping[],
      outputTableName: String(a.outputTableName),
      onlyConfirmed: a.onlyConfirmed !== false,
    });
    return successResponse(result);
  },

  velocity_describe: (engine) => {
    const result = engine.describe();
    return successResponse(result);
  },

  velocity_describe_variable: async (engine, a) => {
    const result = await engine.describeVariable(String(a.id));
    return successResponse(result);
  },

  velocity_list_analyses: (engine) => {
    const result = engine.listAnalyses();
    return successResponse(result);
  },
};
