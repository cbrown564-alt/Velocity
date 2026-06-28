import { normalizeVariableType } from '../types';
import type { Dataset, Variable, VariableSet } from '../types';
import type { DatasetSummary, ResultEnvelope } from './types';
import { VelocityError } from './types';
import type { LoadableNodeAdapter, VelocityEngineHost } from './velocityEngineTypes';

export const METADATA_FIRST_THRESHOLD_BYTES = 50 * 1024 * 1024;

export function getBasename(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

export function getExtension(filePath: string): string {
  const base = getBasename(filePath);
  const lastDot = base.lastIndexOf('.');
  return lastDot >= 0 ? base.slice(lastDot + 1).toLowerCase() : '';
}

export function inferDatasetSource(fileName: string): Dataset['source'] {
  const extension = getExtension(fileName);
  if (extension === 'sav') return 'sav';
  if (extension === 'csv') return 'csv';
  throw new VelocityError('UNSUPPORTED_FORMAT', `Unsupported file format: ${fileName}`);
}

function inferVariableType(typeName: string) {
  const normalized = typeName.toUpperCase();
  if (
    normalized.includes('INT') ||
    normalized.includes('DECIMAL') ||
    normalized.includes('DOUBLE') ||
    normalized.includes('FLOAT') ||
    normalized.includes('REAL') ||
    normalized.includes('NUMERIC')
  ) {
    return normalizeVariableType('scale');
  }
  return normalizeVariableType('nominal');
}

export function buildCsvVariables(schemaRows: Array<Record<string, unknown>>): Variable[] {
  return schemaRows.map((row) => {
    const id = String(row.name);
    return {
      id,
      name: id,
      label: id,
      type: inferVariableType(String(row.type ?? 'VARCHAR')),
      valueLabels: [],
      missingValues: {},
    };
  });
}

export function buildDefaultVariableSets(variables: Variable[]): VariableSet[] {
  return variables.map((variable) => ({
    id: variable.id,
    name: variable.label || variable.name,
    variableIds: [variable.id],
    structure: 'single',
    type: variable.type,
    orderedStyle: variable.orderedStyle,
    orderedScoring: variable.orderedScoring,
  }));
}

export function buildDatasetSummary(
  dataset: Dataset,
  variableSetCount: number,
  extras?: { fileSizeBytes?: number },
): DatasetSummary {
  return {
    datasetName: dataset.name,
    rowCount: dataset.rowCount,
    variableCount: dataset.variables.length,
    variableSetCount,
    source: dataset.source,
    metadataOnly: dataset.metadataOnly,
    datasetId: dataset.id,
    fileSizeBytes: extras?.fileSizeBytes,
  };
}

async function getFileSizeBytes(filePath: string): Promise<number> {
  const { stat } = await import('node:fs/promises');
  const info = await stat(filePath);
  return info.size;
}

export class DatasetLoading {
  constructor(private readonly host: VelocityEngineHost) {}

  async loadFile(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    return this.host.wrap('loadFile', { path, runtime: this.host.runtime }, async () => {
      const resolvedPath = this.host.resolveSafePath(path);
      const source = inferDatasetSource(resolvedPath);
      const fileName = getBasename(resolvedPath);
      const nodeAdapter = this.host.adapter as LoadableNodeAdapter;
      const { state } = this.host;

      try {
        if (source === 'sav') {
          if (!nodeAdapter.loadSav) {
            throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support SAV file loading.');
          }

          const result = await nodeAdapter.loadSav(resolvedPath, 'main');
          state.dataset = {
            id: `dataset-${Date.now()}`,
            name: fileName,
            rowCount: result.rowCount,
            variables: result.variables.map((variable) => ({ ...variable })),
            source,
          };
          state.variableSets = result.variableSets.map((variableSet) => ({ ...variableSet }));
        } else {
          if (!nodeAdapter.loadCSV) {
            throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support CSV file loading.');
          }

          const rowCount = await nodeAdapter.loadCSV(resolvedPath, 'main');
          const schema = await this.host.adapter.query(`PRAGMA table_info('main')`);
          const variables = buildCsvVariables(schema.rows);

          state.dataset = {
            id: `dataset-${Date.now()}`,
            name: fileName,
            rowCount,
            variables,
            source,
          };
          state.variableSets = buildDefaultVariableSets(variables);
        }

        state.pendingFullLoadPath = null;
        state.dataset.metadataOnly = false;
        this.host.resetSessionState();

        return buildDatasetSummary(state.dataset, state.variableSets.length);
      } catch (error) {
        if (error instanceof VelocityError) throw error;
        throw new VelocityError('FILE_LOAD_FAILED', `Failed to load file: ${resolvedPath}`, error);
      }
    });
  }

  async loadFileMetadata(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    const resolvedPath = this.host.resolveSafePath(path);
    const fileSizeBytes = await getFileSizeBytes(resolvedPath);
    const warnings: string[] = [];
    if (fileSizeBytes >= METADATA_FIRST_THRESHOLD_BYTES) {
      warnings.push(
        `File is ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB. Metadata loaded; call velocity_load_full when ready to analyze rows.`,
      );
    }

    return this.host.wrap(
      'loadFileMetadata',
      { path, runtime: this.host.runtime },
      async () => {
        const source = inferDatasetSource(resolvedPath);
        if (source !== 'sav') {
          throw new VelocityError(
            'UNSUPPORTED_FORMAT',
            'Metadata-only load is supported for SAV files. Use velocity_load for CSV.',
          );
        }

        const fileName = getBasename(resolvedPath);
        const { loadSavMetadata } = await import('../core/ingestion/savIngestion');
        const result = await loadSavMetadata(resolvedPath);
        const { state } = this.host;

        state.dataset = {
          id: `dataset-${Date.now()}`,
          name: fileName,
          rowCount: result.rowCount,
          variables: result.variables.map((variable) => ({ ...variable })),
          source,
          metadataOnly: true,
          loadDiagnostics: {
            isPartial: true,
            reason: 'metadata_only',
            message: 'Loaded metadata only. Call velocity_load_full before running analyses.',
            createdAt: Date.now(),
          },
        };
        state.variableSets = result.variableSets.map((variableSet) => ({ ...variableSet }));
        state.pendingFullLoadPath = resolvedPath;
        this.host.resetSessionState();

        return buildDatasetSummary(state.dataset, state.variableSets.length, { fileSizeBytes });
      },
      warnings,
    );
  }

  async loadFileFull(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    const resolvedPath = this.host.resolveSafePath(path);
    const pendingPath = this.host.state.pendingFullLoadPath;
    const metadataOnly = this.host.state.dataset?.metadataOnly === true;

    if (!metadataOnly && !pendingPath) {
      return this.loadFile(path);
    }

    if (pendingPath && pendingPath !== resolvedPath) {
      throw new VelocityError('FILE_LOAD_FAILED', `Expected full load for ${pendingPath}, received ${resolvedPath}.`);
    }

    return this.loadFile(resolvedPath);
  }

  async loadBuffer(name: string, buffer: ArrayBuffer, format: 'sav' | 'csv'): Promise<ResultEnvelope<DatasetSummary>> {
    if (this.host.runtime !== 'node') {
      throw new VelocityError('UNSUPPORTED_RUNTIME', 'loadBuffer() is only wired for the Node runtime in Phase 1.');
    }

    const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const tempDir = await mkdtemp(join(tmpdir(), 'velocity-engine-'));
    const targetPath = join(tempDir, name.endsWith(`.${format}`) ? name : `${name}.${format}`);

    try {
      await writeFile(targetPath, new Uint8Array(buffer));
      return await this.loadFile(targetPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
