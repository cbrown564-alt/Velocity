import { analysisRegistry } from '../core/analysis/registry';
import { buildCrosstabRequest } from '../core/analysis/buildCrosstabRequest';
import { runCrosstab } from '../core/analysis/crosstabRunner';
import { getVariableStats } from '../core/analysis/variableStatsRunner';
import type { DatabaseAdapter, QueryResult } from '../core/DatabaseAdapter';
import { exportSession as exportSessionFile, importSession as importSessionFile } from '../core/session';
import type {
  ExportSessionInput,
  VelocitySessionFile,
} from '../core/session';
import type {
  Filter,
  RecodeConfig,
  Variable,
  VariableSet,
  Dataset,
  Folder,
} from '../types';
import { normalizeVariableType } from '../types';
import type {
  AnalysisDescriptor,
  DatasetDescription,
  DatasetSummary,
  EngineOptions,
  EngineRecodeConfig,
  ResultEnvelope,
  VariableDetail,
} from './types';
import { VelocityError } from './types';

type EngineAnalysisSettings = {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.90 | 0.80;
};

type LoadableNodeAdapter = DatabaseAdapter & {
  loadCSV?: (filePath: string, tableName?: string) => Promise<number>;
  loadSav?: (
    filePath: string,
    tableName?: string
  ) => Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number }>;
};

function getBasename(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

function getExtension(filePath: string): string {
  const base = getBasename(filePath);
  const lastDot = base.lastIndexOf('.');
  return lastDot >= 0 ? base.slice(lastDot + 1).toLowerCase() : '';
}

function inferDatasetSource(fileName: string): Dataset['source'] {
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

function cloneFilter(filter: Filter): Filter {
  return {
    ...filter,
    value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
  };
}

function buildCaseSql(sourceCol: string, config: RecodeConfig): string {
  let caseSql = 'CASE ';

  if (config.mode === 'categorical' && config.mappings) {
    for (const [oldValue, newValue] of Object.entries(config.mappings)) {
      caseSql += `WHEN "${sourceCol}" = '${oldValue.replace(/'/g, "''")}' THEN '${newValue.replace(/'/g, "''")}' `;
    }
  } else if (config.mode === 'binning' && config.rules) {
    for (const rule of config.rules) {
      const parts: string[] = [];
      if (rule.min !== undefined) parts.push(`"${sourceCol}" >= ${rule.min}`);
      if (rule.max !== undefined) parts.push(`"${sourceCol}" < ${rule.max}`);
      if (parts.length > 0) {
        caseSql += `WHEN ${parts.join(' AND ')} THEN '${rule.label.replace(/'/g, "''")}' `;
      }
    }
  }

  return `${caseSql}ELSE CAST("${sourceCol}" AS VARCHAR) END`;
}

function buildCsvVariables(schemaRows: Array<Record<string, unknown>>): Variable[] {
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

function buildDefaultVariableSets(variables: Variable[]): VariableSet[] {
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

function isCompleteAnalysisSettings(
  value: Partial<EngineAnalysisSettings> | undefined
): value is EngineAnalysisSettings {
  return !!value
    && !!value.comparisonMethod
    && !!value.correctionType
    && !!value.significanceLevel;
}

export class VelocityEngine {
  static async create(options: EngineOptions = {}): Promise<VelocityEngine> {
    const runtime = options.runtime ?? 'node';

    if (options.adapter) {
      return new VelocityEngine(options.adapter as DatabaseAdapter, runtime, options.engineVersion ?? 'dev');
    }

    if (runtime === 'node') {
      const { DuckDBNodeAdapter } = await import('../adapters/DuckDBNodeAdapter');
      const adapter = await DuckDBNodeAdapter.create();
      return new VelocityEngine(adapter, runtime, options.engineVersion ?? 'dev');
    }

    throw new VelocityError(
      'UNSUPPORTED_RUNTIME',
      'VelocityEngine.create() requires an injected adapter for WASM runtime in Phase 1.'
    );
  }

  private dataset: Dataset | null = null;
  private variableSets: VariableSet[] = [];
  private folders: Folder[] = [];
  private transformLog: ExportSessionInput['transformLog'] = [];
  private tableConfig: ExportSessionInput['tableConfig'] = { rowVars: [], colVar: null };
  private activeFilters: Filter[] = [];
  private analysisSettings: Partial<EngineAnalysisSettings> | undefined;
  private slides: ExportSessionInput['slides'] = [];
  private sections: ExportSessionInput['sections'] = [];
  private harmonizationSession: ExportSessionInput['harmonizationSession'] = null;

  private constructor(
    private readonly adapter: DatabaseAdapter,
    private readonly runtime: 'node' | 'wasm',
    private readonly engineVersion: string
  ) {}

  async loadFile(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    return this.wrap('loadFile', { path, runtime: this.runtime }, async () => {
      const source = inferDatasetSource(path);
      const fileName = getBasename(path);
      const nodeAdapter = this.adapter as LoadableNodeAdapter;

      try {
        if (source === 'sav') {
          if (!nodeAdapter.loadSav) {
            throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support SAV file loading.');
          }

          const result = await nodeAdapter.loadSav(path, 'main');
          this.dataset = {
            id: `dataset-${Date.now()}`,
            name: fileName,
            rowCount: result.rowCount,
            variables: result.variables.map((variable) => ({ ...variable })),
            source,
          };
          this.variableSets = result.variableSets.map((variableSet) => ({ ...variableSet }));
        } else {
          if (!nodeAdapter.loadCSV) {
            throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support CSV file loading.');
          }

          const rowCount = await nodeAdapter.loadCSV(path, 'main');
          const schema = await this.adapter.query(`PRAGMA table_info('main')`);
          const variables = buildCsvVariables(schema.rows);

          this.dataset = {
            id: `dataset-${Date.now()}`,
            name: fileName,
            rowCount,
            variables,
            source,
          };
          this.variableSets = buildDefaultVariableSets(variables);
        }

        this.resetSessionState();

        return {
          datasetName: this.dataset.name,
          rowCount: this.dataset.rowCount,
          variableCount: this.dataset.variables.length,
          variableSetCount: this.variableSets.length,
          source: this.dataset.source,
        };
      } catch (error) {
        if (error instanceof VelocityError) throw error;
        throw new VelocityError('FILE_LOAD_FAILED', `Failed to load file: ${path}`, error);
      }
    });
  }

  async loadBuffer(
    name: string,
    buffer: ArrayBuffer,
    format: 'sav' | 'csv'
  ): Promise<ResultEnvelope<DatasetSummary>> {
    if (this.runtime !== 'node') {
      throw new VelocityError(
        'UNSUPPORTED_RUNTIME',
        'loadBuffer() is only wired for the Node runtime in Phase 1.'
      );
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

  async close(): Promise<void> {
    await this.adapter.close();
  }

  describe(): DatasetDescription {
    return {
      dataset: this.dataset
        ? {
            ...this.dataset,
            variables: this.dataset.variables.map((variable) => ({ ...variable })),
          }
        : null,
      variableSets: this.variableSets.map((variableSet) => ({ ...variableSet, variableIds: [...variableSet.variableIds] })),
      folders: this.folders.map((folder) => ({ ...folder })),
      activeFilters: this.activeFilters.map(cloneFilter),
      weightVariable: this.dataset?.weightVariable ?? null,
    };
  }

  async describeVariable(id: string): Promise<ResultEnvelope<VariableDetail>> {
    return this.wrap('describeVariable', { id }, async () => {
      const dataset = this.requireDataset();
      const variable = dataset.variables.find((entry) => entry.id === id);
      if (!variable) {
        throw new VelocityError('INVALID_VARIABLE', `Unknown variable: ${id}`, {
          available: dataset.variables.map((entry) => entry.id),
        });
      }

      const stats = await getVariableStats(
        this.adapter,
        variable.id,
        variable.type,
        variable.orderedScoring,
        10,
        variable.missingValues
      );

      return {
        variable: { ...variable },
        stats,
      };
    });
  }

  listAnalyses(): AnalysisDescriptor[] {
    return analysisRegistry.list().map((descriptor) => ({
      id: descriptor.id,
      label: descriptor.label,
      configSchema: descriptor.configSchema,
    }));
  }

  getSession(): VelocitySessionFile {
    const dataset = this.requireDataset();
    return exportSessionFile({
      dataset,
      variableSets: this.variableSets,
      folders: this.folders,
      transformLog: this.transformLog,
      tableConfig: this.tableConfig,
      activeFilters: this.activeFilters,
      analysisSettings: this.analysisSettings,
      slides: this.slides,
      sections: this.sections,
      harmonizationSession: this.harmonizationSession,
      velocityVersion: this.engineVersion,
    });
  }

  async runAnalysis(id: string, config: unknown): Promise<ResultEnvelope<unknown>> {
    return this.wrap(`runAnalysis:${id}`, { id, config: this.toRecord(config) }, async () => {
      this.requireDataset();

      try {
        if (id === 'crosstab') {
          const crosstabConfig = this.toRecord(config);
          const analysisSettings = crosstabConfig.analysisSettings as Partial<EngineAnalysisSettings> | undefined;
          const request = buildCrosstabRequest({
            dataset: this.requireDataset(),
            variableSets: this.variableSets,
            rowVars: Array.isArray(crosstabConfig.rowVars) ? (crosstabConfig.rowVars as string[]) : [],
            colVar: (crosstabConfig.colVar as string | null | undefined) ?? null,
            filters: (crosstabConfig.filters as Filter[] | undefined) ?? this.activeFilters,
            weightVar: (crosstabConfig.weightVar as string | null | undefined) ?? this.dataset?.weightVariable ?? null,
            analysisSettings: isCompleteAnalysisSettings(analysisSettings) ? analysisSettings : undefined,
          });

          return runCrosstab(this.adapter, {
            ...request.options,
            significanceOptions: request.analysisSettings
              ? {
                  comparisonMethod: request.analysisSettings.comparisonMethod,
                  correctionType: request.analysisSettings.correctionType,
                  significanceLevel: request.analysisSettings.significanceLevel,
                }
              : undefined,
          }, request.context);
        }

        if (id === 'variableStats') {
          const variableStatsConfig = this.toRecord(config);
          const column = String(variableStatsConfig.column ?? '');
          if (!column) {
            throw new VelocityError('INVALID_VARIABLE', 'variableStats requires a "column" config value.');
          }
          const variable = this.requireVariable(column);
          return getVariableStats(
            this.adapter,
            column,
            (variableStatsConfig.variableType as Variable['type'] | undefined) ?? variable.type,
            variable.orderedScoring,
            Number(variableStatsConfig.binCount ?? 10),
            variable.missingValues
          );
        }

        const runner = analysisRegistry.get(id);
        if (!runner) {
          throw new VelocityError('ANALYSIS_NOT_FOUND', `Analysis runner not found: ${id}`);
        }

        if (runner.validate) {
          const errors = runner.validate(config as never);
          if (errors.length > 0) {
            throw new VelocityError('ANALYSIS_FAILED', `Invalid analysis config for ${id}`, errors);
          }
        }

        return await runner.run(this.adapter, config as never);
      } catch (error) {
        if (error instanceof VelocityError) throw error;
        throw new VelocityError('ANALYSIS_FAILED', `Analysis failed: ${id}`, error);
      }
    });
  }

  async query(sql: string): Promise<ResultEnvelope<QueryResult>> {
    return this.wrap('query', { sql }, async () => {
      this.requireDataset();
      return this.adapter.query(sql);
    });
  }

  async recode(sourceVar: string, config: EngineRecodeConfig): Promise<ResultEnvelope<Variable>> {
    return this.wrap('recode', { sourceVar, config: this.toRecord(config) }, async () => {
      const dataset = this.requireDataset();
      const sourceVariable = this.requireVariable(sourceVar);
      const safeTargetName = (config.targetVariableName ?? `${sourceVar}_recode`)
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^(\d)/, '_$1');

      await this.adapter.execute(`ALTER TABLE main ADD COLUMN "${safeTargetName}" VARCHAR`);
      await this.adapter.execute(`UPDATE main SET "${safeTargetName}" = ${buildCaseSql(sourceVar, config)}`);

      const variable: Variable = {
        id: safeTargetName,
        name: safeTargetName,
        label: config.label ?? safeTargetName,
        type: normalizeVariableType('nominal'),
        valueLabels: [],
        missingValues: {},
      };

      dataset.variables = [...dataset.variables, variable];
      this.variableSets = [
        ...this.variableSets,
        {
          id: safeTargetName,
          name: variable.label,
          variableIds: [safeTargetName],
          structure: 'single',
          type: variable.type,
        },
      ];
      this.transformLog = [
        ...this.transformLog,
        {
          type: 'recode',
          sourceColId: sourceVariable.id,
          newColId: safeTargetName,
          label: variable.label,
          config,
          createdAt: Date.now(),
        },
      ];

      return variable;
    });
  }

  setWeight(variableId: string | null): void {
    if (variableId !== null) {
      this.requireVariable(variableId);
    }
    const dataset = this.requireDataset();
    dataset.weightVariable = variableId ?? undefined;
  }

  addFilter(filter: Filter): void {
    this.requireVariable(filter.variableId);
    this.activeFilters = [...this.activeFilters, cloneFilter(filter)];
  }

  removeFilter(filterId: string): void {
    this.activeFilters = this.activeFilters.filter((filter) => filter.id !== filterId);
  }

  clearFilters(): void {
    this.activeFilters = [];
  }

  getActiveFilters(): Filter[] {
    return this.activeFilters.map(cloneFilter);
  }

  async exportSession(): Promise<VelocitySessionFile> {
    return this.getSession();
  }

  async importSession(
    session: VelocitySessionFile
  ): Promise<ResultEnvelope<ReturnType<typeof importSessionFile>['diagnostics']>> {
    return this.wrap('importSession', { formatVersion: session.formatVersion }, async () => {
      const dataset = this.requireDataset();

      try {
        const result = importSessionFile(session, dataset);
        this.dataset = result.patch.dataset;
        this.variableSets = result.patch.variableSets;
        this.folders = result.patch.folders;
        this.transformLog = result.patch.transformLog;
        this.tableConfig = result.patch.tableConfig;
        this.activeFilters = result.patch.activeFilters;
        this.analysisSettings = result.patch.analysisSettings;
        this.slides = result.patch.slides;
        this.sections = result.patch.sections;
        this.harmonizationSession = result.patch.harmonizationSession;
        return result.diagnostics;
      } catch (error) {
        if (error instanceof VelocityError) throw error;
        throw new VelocityError('SESSION_INVALID', 'Failed to import session.', error);
      }
    });
  }

  private resetSessionState(): void {
    this.folders = [];
    this.transformLog = [];
    this.tableConfig = { rowVars: [], colVar: null };
    this.activeFilters = [];
    this.analysisSettings = undefined;
    this.slides = [];
    this.sections = [];
    this.harmonizationSession = null;
  }

  private requireDataset(): Dataset {
    if (!this.dataset) {
      throw new VelocityError('NO_DATASET_LOADED', 'No dataset is currently loaded.');
    }
    return this.dataset;
  }

  private requireVariable(id: string): Variable {
    const dataset = this.requireDataset();
    const variable = dataset.variables.find((entry) => entry.id === id);
    if (!variable) {
      throw new VelocityError('INVALID_VARIABLE', `Unknown variable: ${id}`, {
        available: dataset.variables.map((entry) => entry.id),
      });
    }
    return variable;
  }

  private async wrap<T>(
    operation: string,
    inputs: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<ResultEnvelope<T>> {
    const start = performance.now();
    const data = await fn();
    const dataset = this.dataset;

    return {
      data,
      operation,
      inputs,
      durationMs: performance.now() - start,
      warnings: [],
      metadata: {
        datasetName: dataset?.name ?? 'unloaded',
        rowCount: dataset?.rowCount ?? 0,
        filtersApplied: this.activeFilters.length,
        isWeighted: !!dataset?.weightVariable,
        engineVersion: this.engineVersion,
      },
    };
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }
}

export { VelocityError } from './types';
export type * from './types';
