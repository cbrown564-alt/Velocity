import { autoMatchVariables } from '../core/harmonization/matchEngine';
import { buildHarmonizedTableQuery } from '../core/harmonization/harmonizationQueries';
import type { VariableMapping } from '../types/harmonization';
import type { ResultEnvelope, WorkspaceDatasetSummary } from './types';
import { VelocityError } from './types';
import {
  buildCsvVariables,
  buildDefaultVariableSets,
  getBasename,
  inferDatasetSource,
} from './datasetLoading';
import type {
  LoadableNodeAdapter,
  VelocityEngineHost,
  WorkspaceDatasetEntry,
} from './velocityEngineTypes';

function workspaceTableName(datasetId: string): string {
  return `ws_${datasetId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function toWorkspaceSummary(
  entry: WorkspaceDatasetEntry,
  activeWorkspaceDatasetId: string | null
): WorkspaceDatasetSummary {
  return {
    id: entry.id,
    name: entry.name,
    tableName: entry.tableName,
    rowCount: entry.rowCount,
    variableCount: entry.variables.length,
    source: entry.source,
    metadataOnly: entry.metadataOnly,
    waveNumber: entry.waveNumber,
    isActive: activeWorkspaceDatasetId === entry.id,
  };
}

function requireWorkspaceEntry(
  host: VelocityEngineHost,
  datasetId: string
): WorkspaceDatasetEntry {
  const entry = host.state.workspaceDatasets.get(datasetId);
  if (!entry) {
    throw new VelocityError('WORKSPACE_DATASET_NOT_FOUND', `Unknown workspace dataset: ${datasetId}`, {
      available: Array.from(host.state.workspaceDatasets.keys()),
    });
  }
  return entry;
}

function activateWorkspaceEntry(host: VelocityEngineHost, entry: WorkspaceDatasetEntry): void {
  const { state } = host;
  state.activeWorkspaceDatasetId = entry.id;
  state.dataset = {
    id: entry.id,
    name: entry.name,
    rowCount: entry.rowCount,
    variables: entry.variables.map((variable) => ({ ...variable })),
    source: entry.source,
    metadataOnly: entry.metadataOnly,
  };
  state.variableSets = entry.variableSets.map((variableSet) => ({ ...variableSet }));
  state.pendingFullLoadPath = entry.metadataOnly ? entry.filePath : null;
  host.resetSessionState();
}

export class WorkspaceManager {
  constructor(private readonly host: VelocityEngineHost) {}

  async loadWorkspaceDataset(
    path: string,
    options?: { metadataOnly?: boolean; waveNumber?: number; makeActive?: boolean }
  ): Promise<ResultEnvelope<WorkspaceDatasetSummary>> {
    return this.host.wrap('loadWorkspaceDataset', { path, ...options }, async () => {
      const resolvedPath = this.host.resolveSafePath(path);
      const source = inferDatasetSource(resolvedPath);
      const fileName = getBasename(resolvedPath);
      const datasetId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tableName = workspaceTableName(datasetId);
      const metadataOnly = options?.metadataOnly === true && source === 'sav';
      const nodeAdapter = this.host.adapter as LoadableNodeAdapter;

      let variables;
      let variableSets;
      let rowCount: number;

      if (metadataOnly) {
        const { loadSavMetadata } = await import('../core/ingestion/savIngestion');
        const parsed = await loadSavMetadata(resolvedPath);
        variables = parsed.variables.map((variable) => ({ ...variable }));
        variableSets = parsed.variableSets.map((variableSet) => ({ ...variableSet }));
        rowCount = parsed.rowCount;
      } else if (source === 'sav') {
        if (!nodeAdapter.loadSav) {
          throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support SAV file loading.');
        }
        const loaded = await nodeAdapter.loadSav(resolvedPath, tableName);
        variables = loaded.variables.map((variable) => ({ ...variable }));
        variableSets = loaded.variableSets.map((variableSet) => ({ ...variableSet }));
        rowCount = loaded.rowCount;
      } else {
        if (!nodeAdapter.loadCSV) {
          throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support CSV file loading.');
        }
        rowCount = await nodeAdapter.loadCSV(resolvedPath, tableName);
        const schema = await this.host.adapter.query(
          `PRAGMA table_info('${tableName.replace(/'/g, "''")}')`
        );
        variables = buildCsvVariables(schema.rows);
        variableSets = buildDefaultVariableSets(variables);
      }

      const entry: WorkspaceDatasetEntry = {
        id: datasetId,
        name: fileName,
        tableName,
        rowCount,
        variables,
        variableSets,
        source,
        metadataOnly,
        filePath: resolvedPath,
        waveNumber: options?.waveNumber,
      };
      this.host.state.workspaceDatasets.set(datasetId, entry);

      if (options?.makeActive === true) {
        activateWorkspaceEntry(this.host, entry);
      }

      return toWorkspaceSummary(entry, this.host.state.activeWorkspaceDatasetId);
    });
  }

  listWorkspaceDatasets(): ResultEnvelope<WorkspaceDatasetSummary[]> {
    return this.host.wrapSync('listWorkspaceDatasets', {}, () =>
      Array.from(this.host.state.workspaceDatasets.values()).map((entry) =>
        toWorkspaceSummary(entry, this.host.state.activeWorkspaceDatasetId)
      )
    );
  }

  setActiveWorkspaceDataset(datasetId: string): ResultEnvelope<WorkspaceDatasetSummary> {
    return this.host.wrapSync('setActiveWorkspaceDataset', { datasetId }, () => {
      const entry = requireWorkspaceEntry(this.host, datasetId);
      activateWorkspaceEntry(this.host, entry);
      return toWorkspaceSummary(entry, this.host.state.activeWorkspaceDatasetId);
    });
  }

  async loadWorkspaceDatasetFull(datasetId: string): Promise<ResultEnvelope<WorkspaceDatasetSummary>> {
    return this.host.wrap('loadWorkspaceDatasetFull', { datasetId }, async () => {
      const entry = requireWorkspaceEntry(this.host, datasetId);
      if (!entry.metadataOnly) {
        return toWorkspaceSummary(entry, this.host.state.activeWorkspaceDatasetId);
      }
      if (entry.source !== 'sav') {
        throw new VelocityError('UNSUPPORTED_FORMAT', 'Full workspace reload is only supported for SAV datasets.');
      }

      const nodeAdapter = this.host.adapter as LoadableNodeAdapter;
      if (!nodeAdapter.loadSav) {
        throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support SAV file loading.');
      }

      const loaded = await nodeAdapter.loadSav(entry.filePath, entry.tableName);
      entry.variables = loaded.variables.map((variable) => ({ ...variable }));
      entry.variableSets = loaded.variableSets.map((variableSet) => ({ ...variableSet }));
      entry.rowCount = loaded.rowCount;
      entry.metadataOnly = false;
      this.host.state.workspaceDatasets.set(entry.id, entry);

      if (this.host.state.activeWorkspaceDatasetId === entry.id) {
        activateWorkspaceEntry(this.host, entry);
      }

      return toWorkspaceSummary(entry, this.host.state.activeWorkspaceDatasetId);
    });
  }

  proposeWorkspaceMappings(
    sourceDatasetId: string,
    targetDatasetId: string
  ): Promise<ResultEnvelope<VariableMapping[]>> {
    return this.host.wrap(
      'proposeWorkspaceMappings',
      { sourceDatasetId, targetDatasetId },
      async () => {
        const source = requireWorkspaceEntry(this.host, sourceDatasetId);
        const target = requireWorkspaceEntry(this.host, targetDatasetId);
        return autoMatchVariables(source.variables, target.variables);
      }
    );
  }

  async harmonizeWorkspaceDatasets(params: {
    sourceDatasetId: string;
    targetDatasetId: string;
    mappings: VariableMapping[];
    outputTableName: string;
    onlyConfirmed?: boolean;
  }): Promise<ResultEnvelope<{ tableName: string; rowCount: number; sql: string }>> {
    return this.host.wrap('harmonizeWorkspaceDatasets', params, async () => {
      const source = requireWorkspaceEntry(this.host, params.sourceDatasetId);
      const target = requireWorkspaceEntry(this.host, params.targetDatasetId);

      if (source.metadataOnly || target.metadataOnly) {
        throw new VelocityError(
          'METADATA_ONLY',
          'Both workspace datasets must have full row data. Call loadWorkspaceDatasetFull first.'
        );
      }

      const onlyConfirmed = params.onlyConfirmed !== false;
      const eligible = params.mappings.filter((mapping) => {
        if (mapping.targetVariableId === null || mapping.status === 'excluded') return false;
        if (onlyConfirmed) return mapping.confirmed;
        return true;
      });

      if (eligible.length === 0) {
        throw new VelocityError('ANALYSIS_FAILED', 'No eligible mappings to harmonize.');
      }

      const sourceVarNames = Object.fromEntries(source.variables.map((v) => [v.id, v.name]));
      const targetVarNames = Object.fromEntries(target.variables.map((v) => [v.id, v.name]));
      const sql = buildHarmonizedTableQuery(
        source.tableName,
        target.tableName,
        eligible,
        sourceVarNames,
        targetVarNames
      );
      const safeOutput = params.outputTableName.replace(/"/g, '""');
      await this.host.adapter.execute(`CREATE OR REPLACE TABLE "${safeOutput}" AS (${sql})`);
      const count = await this.host.adapter.query(`SELECT COUNT(*) AS cnt FROM "${safeOutput}"`);
      const rowCount = Number(count.rows[0]?.cnt ?? 0);

      return { tableName: params.outputTableName, rowCount, sql };
    });
  }
}
