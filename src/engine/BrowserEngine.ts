/**
 * BrowserEngine — main-thread facade over EngineProxy with VelocityEngine-aligned methods.
 *
 * Store slices and hooks should depend on BrowserEngine (not EngineProxy directly) so browser
 * flows converge on the same engine contract as MCP/CLI. Transport stays in EngineProxy;
 * orchestration helpers live here or in src/core/.
 */

import { buildCrosstabRequest } from '../core/analysis/buildCrosstabRequest';
import type { EngineProxy } from '../services/EngineProxy';
import type { EngineResponseByType, PersistedMetadata } from '../types/engineWorker';
import type {
  AggregatedRow,
  Dataset,
  Filter,
  MissingValueDef,
  RecodeConfig,
  TableStats,
  Variable,
  VariableSet,
} from '../types';
import type { ChartType } from '../types/charts';
import type { OrderedScoring, VariableType } from '../types';
import type { CrosstabQueryOptions } from '../core/sql/queryBuilder';
import type { ProcessedAnalysisData } from '../types/processedData';
import type { WorkerAnalysisContext, WorkerAnalysisSettings } from '../types/worker';
import type { VariableMapping } from '../types/harmonization';
import type { VariableStatsResult } from '../types/worker';
import type {
  DatasetSummary,
  EngineRecodeConfig,
  ResultEnvelope,
} from './types';
import { VelocityError } from './types';

export interface BrowserEngineContext {
  dataset: Dataset;
  variableSets: VariableSet[];
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function isCompleteAnalysisSettings(
  value: Partial<WorkerAnalysisSettings> | undefined,
): value is WorkerAnalysisSettings {
  return !!value
    && !!value.comparisonMethod
    && !!value.correctionType
    && !!value.significanceLevel;
}

export class BrowserEngine {
  constructor(private readonly proxy: EngineProxy) {}

  /** Underlying transport adapter (escape hatch during incremental migration). */
  getProxy(): EngineProxy {
    return this.proxy;
  }

  // ==========================================================================
  // VelocityEngine-aligned (MCP parity)
  // ==========================================================================

  /**
   * Run a registered analysis. Crosstab requires `BrowserEngineContext` because browser
   * session state still lives in the Zustand store (worker-hosted VelocityEngine is future work).
   */
  async runAnalysis(
    id: string,
    config: unknown,
    ctx?: BrowserEngineContext,
  ): Promise<ResultEnvelope<unknown>> {
    if (id === 'crosstab') {
      if (!ctx) {
        throw new VelocityError(
          'NO_DATASET_LOADED',
          'Crosstab analysis requires dataset context in the browser.',
        );
      }

      const configRecord = toRecord(config);
      const analysisSettings = configRecord.analysisSettings as
        | Partial<WorkerAnalysisSettings>
        | undefined;

      const request = buildCrosstabRequest({
        dataset: ctx.dataset,
        variableSets: ctx.variableSets,
        rowVars: Array.isArray(configRecord.rowVars) ? (configRecord.rowVars as string[]) : [],
        colVar: (configRecord.colVar as string | null | undefined) ?? null,
        filters: (configRecord.filters as Filter[] | undefined) ?? [],
        weightVar:
          (configRecord.weightVar as string | null | undefined)
          ?? ctx.dataset.weightVariable
          ?? null,
        analysisSettings: isCompleteAnalysisSettings(analysisSettings)
          ? analysisSettings
          : undefined,
      });

      return this.proxy.runCrosstab(
        request.options,
        request.context,
        request.analysisSettings,
      );
    }

    if (id === 'variableStats') {
      const configRecord = toRecord(config);
      const column = String(configRecord.column ?? '');
      if (!column) {
        throw new VelocityError(
          'INVALID_VARIABLE',
          'variableStats requires a "column" config value.',
        );
      }

      return this.proxy.getVariableStats(
        column,
        configRecord.variableType as VariableType | undefined,
        undefined,
        Number(configRecord.binCount ?? 10),
        configRecord.missingValues as MissingValueDef | undefined,
      );
    }

    throw new VelocityError('ANALYSIS_NOT_FOUND', `Analysis runner not found: ${id}`);
  }

  /** Raw SQL query — returns worker response shape (drill-down, workspace orchestration). */
  async query(sql: string): Promise<EngineResponseByType<'engine.queryResult'>> {
    return this.proxy.query(sql);
  }

  async loadBuffer(
    name: string,
    buffer: ArrayBuffer,
    format: 'sav' | 'csv',
  ): Promise<ResultEnvelope<DatasetSummary>> {
    const t0 = performance.now();

    if (format === 'sav') {
      const loaded = await this.proxy.loadSAV(buffer);
      this.proxy.setDatasetContext(name, loaded.rowCount);
      return {
        data: {
          datasetName: name,
          rowCount: loaded.rowCount,
          variableCount: loaded.variables.length,
          variableSetCount: loaded.variableSets.length,
          source: 'sav',
        },
        operation: 'loadBuffer',
        inputs: { name, format },
        durationMs: performance.now() - t0,
        warnings: [],
        metadata: {
          datasetName: name,
          rowCount: loaded.rowCount,
          filtersApplied: 0,
          isWeighted: false,
          engineVersion: 'browser-wasm',
        },
      };
    }

    const content = new TextDecoder().decode(buffer);
    const loaded = await this.proxy.loadCSV(name, content);
    this.proxy.setDatasetContext(name, loaded.rowCount);
    return {
      data: {
        datasetName: name,
        rowCount: loaded.rowCount,
        variableCount: loaded.schema.length,
        variableSetCount: loaded.schema.length,
        source: 'csv',
      },
      operation: 'loadBuffer',
      inputs: { name, format },
      durationMs: performance.now() - t0,
      warnings: [],
      metadata: {
        datasetName: name,
        rowCount: loaded.rowCount,
        filtersApplied: 0,
        isWeighted: false,
        engineVersion: 'browser-wasm',
      },
    };
  }

  async recode(
    sourceVar: string,
    config: EngineRecodeConfig,
  ): Promise<ResultEnvelope<{ column: string }>> {
    const safeTargetName = (config.targetVariableName ?? `${sourceVar}_recode`)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1');

    const t0 = performance.now();
    await this.proxy.recodeVariable(sourceVar, safeTargetName, config);
    return {
      data: { column: safeTargetName },
      operation: 'recode',
      inputs: { sourceVar, config: toRecord(config) },
      durationMs: performance.now() - t0,
      warnings: [],
      metadata: {
        datasetName: 'browser',
        rowCount: 0,
        filtersApplied: 0,
        isWeighted: false,
        engineVersion: 'browser-wasm',
      },
    };
  }

  // ==========================================================================
  // EngineProxy delegation (transport — migrate slices incrementally)
  // ==========================================================================

  async init(
    opts?: { forceCleanStart?: boolean; datasetId?: string; schemaVersion?: number },
  ): Promise<EngineResponseByType<'engine.ready'>> {
    return this.proxy.init(opts);
  }

  async ping(): Promise<EngineResponseByType<'engine.pong'>> {
    return this.proxy.ping();
  }

  async checkPersistedData(): Promise<
    EngineResponseByType<'engine.persistedDataFound'> | EngineResponseByType<'engine.noPersistedData'>
  > {
    return this.proxy.checkPersistedData();
  }

  async clearPersistedData(): Promise<void> {
    return this.proxy.clearPersistedData();
  }

  async flushPersistedData(): Promise<EngineResponseByType<'engine.flushComplete'>> {
    return this.proxy.flushPersistedData();
  }

  updatePersistenceMetadata(metadata: PersistedMetadata): void {
    this.proxy.updatePersistenceMetadata(metadata);
  }

  async loadCSV(fileName: string, content: string): Promise<EngineResponseByType<'engine.csvLoaded'>> {
    return this.proxy.loadCSV(fileName, content);
  }

  async loadSAV(
    buffer: ArrayBuffer,
    forceChunked?: boolean,
  ): Promise<EngineResponseByType<'engine.savLoaded'>> {
    return this.proxy.loadSAV(buffer, forceChunked);
  }

  async loadSAVMetadata(buffer: ArrayBuffer): Promise<EngineResponseByType<'engine.savMetadataLoaded'>> {
    return this.proxy.loadSAVMetadata(buffer);
  }

  async loadSAVSample(
    buffer: ArrayBuffer,
    rowLimit: number,
    strategy?: 'sequential' | 'spread',
  ): Promise<EngineResponseByType<'engine.savSampleLoaded'>> {
    return this.proxy.loadSAVSample(buffer, rowLimit, strategy);
  }

  async getSchema(): Promise<EngineResponseByType<'engine.schema'>> {
    return this.proxy.getSchema();
  }

  async getUniqueValues(column: string): Promise<EngineResponseByType<'engine.uniqueValues'>> {
    return this.proxy.getUniqueValues(column);
  }

  async getVariableStats(
    column: string,
    variableType?: VariableType,
    orderedScoring?: OrderedScoring,
    binCount?: number,
    missingValues?: MissingValueDef,
  ): Promise<ResultEnvelope<VariableStatsResult>> {
    return this.proxy.getVariableStats(column, variableType, orderedScoring, binCount, missingValues);
  }

  async runCrosstab(
    options: CrosstabQueryOptions & { includeDistributions?: boolean },
    context: WorkerAnalysisContext,
    analysisSettings?: WorkerAnalysisSettings,
  ): Promise<ResultEnvelope<{ rows: AggregatedRow[]; tableStats: TableStats | null }>> {
    return this.proxy.runCrosstab(options, context, analysisSettings);
  }

  async processData(
    data: AggregatedRow[],
    options: {
      rowVariables: Variable[];
      colVariable: Variable | null;
      isWeighted?: boolean;
      isMultipleResponse?: boolean;
    },
    chartType?: ChartType,
  ): Promise<EngineResponseByType<'engine.processedData'>> {
    return this.proxy.processData(data, options, chartType);
  }

  async recodeVariable(
    sourceCol: string,
    newColName: string,
    config: RecodeConfig,
  ): Promise<EngineResponseByType<'engine.recodeComplete'>> {
    return this.proxy.recodeVariable(sourceCol, newColName, config);
  }

  async dropColumn(column: string): Promise<EngineResponseByType<'engine.columnDropped'>> {
    return this.proxy.dropColumn(column);
  }

  async updateColumn(
    sourceCol: string,
    targetCol: string,
    config: RecodeConfig,
  ): Promise<EngineResponseByType<'engine.columnUpdated'>> {
    return this.proxy.updateColumn(sourceCol, targetCol, config);
  }

  async fillSystemMissing(
    column: string,
    value: number | string,
  ): Promise<EngineResponseByType<'engine.fillSystemMissingComplete'>> {
    return this.proxy.fillSystemMissing(column, value);
  }

  async exportArrow(sql: string, columns?: string[]): Promise<EngineResponseByType<'engine.arrowExported'>> {
    return this.proxy.exportArrow(sql, columns);
  }

  async getValueFrequencies(
    tableName: string,
    columnName: string,
  ): Promise<EngineResponseByType<'engine.valueFrequencies'>> {
    return this.proxy.getValueFrequencies(tableName, columnName);
  }

  async buildHarmonizedTable(
    sourceTable: string,
    targetTable: string,
    mappings: VariableMapping[],
    outputTableName: string,
    sourceVarNames?: Record<string, string>,
    targetVarNames?: Record<string, string>,
  ): Promise<EngineResponseByType<'engine.harmonizedTableCreated'>> {
    return this.proxy.buildHarmonizedTable(
      sourceTable,
      targetTable,
      mappings,
      outputTableName,
      sourceVarNames,
      targetVarNames,
    );
  }

  async getRespondentOverlap(
    sourceTable: string,
    targetTable: string,
    keyColumn: string,
  ): Promise<EngineResponseByType<'engine.respondentOverlap'>> {
    return this.proxy.getRespondentOverlap(sourceTable, targetTable, keyColumn);
  }

  dispose(): void {
    this.proxy.dispose();
  }

  terminate(): void {
    this.proxy.terminate();
  }

  getWorker(): Worker {
    return this.proxy.getWorker();
  }

  setDatasetContext(datasetName: string, rowCount: number): void {
    this.proxy.setDatasetContext(datasetName, rowCount);
  }
}

export function createBrowserEngine(proxy: EngineProxy): BrowserEngine {
  return new BrowserEngine(proxy);
}
