import { analysisRegistry } from '../core/analysis/registry';
import { buildCrosstabRequest } from '../core/analysis/buildCrosstabRequest';
import { runCrosstab } from '../core/analysis/crosstabRunner';
import { getVariableStats } from '../core/analysis/variableStatsRunner';
import { buildHarmonizedTableQuery } from '../core/harmonization/harmonizationQueries';
import { buildCaseSql } from '../core/transforms/recodeSql';
import { autoMatchVariables } from '../core/harmonization/matchEngine';
import type { DatabaseAdapter, QueryResult } from '../core/DatabaseAdapter';
import type { VelocitySessionFile } from '../core/session';
import { importSession as importSessionFile } from '../core/session';
import type { Filter, Variable } from '../types';
import { normalizeVariableType } from '../types';
import type { ChartRecommendation } from '../types/charts';
import type { VariableMapping } from '../types/harmonization';
import type {
  AnalysisSuggestion,
  BreakSuggestion,
  Concept,
  HarmonizationSuggestion,
  MeasurementIntent,
  SemanticAnnotation,
  SemanticSearchResult,
} from '../types/semantic';
import { collectCrosstabWarnings, collectTopicGuidanceWarnings } from '../core/semantic/analysisGuardrails';
import { ConceptStore } from '../core/semantic/concepts';
import { recommendChart } from '../core/visualization/chartRecommender';
import { DeckBuilder } from './DeckBuilder';
import {
  applyCrosstabFormat,
  resolveCrosstabLabelAxes,
  resolveValueLabelsInRows,
} from './crosstabPostProcess';
import { DatasetLoading } from './datasetLoading';
import { wrapEnvelope, wrapEnvelopeSync } from './engineEnvelope';
import { SemanticFacade } from './semanticFacade';
import { SessionState } from './sessionState';
import { WorkspaceManager } from './workspaceManager';
import type {
  AnalysisDescriptor,
  BuiltDeck,
  ClearFiltersResult,
  CommitDeckResult,
  DatasetDescription,
  DatasetSummary,
  DeckExportOptions,
  DeckSpec,
  EngineOptions,
  EngineRecodeConfig,
  FilterMutationResult,
  RemoveFilterResult,
  ResultEnvelope,
  VariableDetail,
  WeightMutationResult,
  WorkspaceDatasetSummary,
} from './types';
import { VelocityError } from './types';
import type {
  EngineAnalysisSettings,
  SemanticStateSnapshot,
  VelocityEngineHost,
  VelocityEngineState,
} from './velocityEngineTypes';

function isResultEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return 'data' in obj && 'operation' in obj && 'durationMs' in obj && 'warnings' in obj && 'metadata' in obj;
}

function isCompleteAnalysisSettings(
  value: Partial<EngineAnalysisSettings> | undefined
): value is EngineAnalysisSettings {
  return !!value
    && !!value.comparisonMethod
    && !!value.correctionType
    && !!value.significanceLevel;
}

export class VelocityEngine implements VelocityEngineHost {
  static async create(options: EngineOptions = {}): Promise<VelocityEngine> {
    const runtime = options.runtime ?? 'node';
    const dataDir = options.dataDir ?? null;

    if (options.adapter) {
      return new VelocityEngine(options.adapter as DatabaseAdapter, runtime, options.engineVersion ?? 'dev', dataDir);
    }

    if (runtime === 'node') {
      const { DuckDBNodeAdapter } = await import('../adapters/DuckDBNodeAdapter');
      const adapter = await DuckDBNodeAdapter.create();
      return new VelocityEngine(adapter, runtime, options.engineVersion ?? 'dev', dataDir);
    }

    throw new VelocityError(
      'UNSUPPORTED_RUNTIME',
      'VelocityEngine.create() requires an injected adapter for WASM runtime in Phase 1.'
    );
  }

  readonly state: VelocityEngineState = {
    dataset: null,
    variableSets: [],
    folders: [],
    transformLog: [],
    tableConfig: { rowVars: [], colVar: null },
    activeFilters: [],
    analysisSettings: undefined,
    slides: [],
    sections: [],
    harmonizationSession: null,
    workspaceDatasets: new Map(),
    activeWorkspaceDatasetId: null,
    pendingFullLoadPath: null,
    semanticAnnotations: new Map(),
    conceptStore: new ConceptStore(),
  };

  private readonly datasetLoading: DatasetLoading;
  private readonly workspaceManager: WorkspaceManager;
  private readonly sessionState: SessionState;
  private readonly semanticFacade: SemanticFacade;

  constructor(
    readonly adapter: DatabaseAdapter,
    readonly runtime: 'node' | 'wasm',
    readonly engineVersion: string,
    readonly dataDir: string | null = null
  ) {
    this.semanticFacade = new SemanticFacade(this);
    this.sessionState = new SessionState(
      this,
      () => this.semanticFacade.readSemanticState(),
      (snapshot) => this.semanticFacade.restoreSemanticState(snapshot)
    );
    this.datasetLoading = new DatasetLoading(this);
    this.workspaceManager = new WorkspaceManager(this);
  }

  async loadFile(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    return this.datasetLoading.loadFile(path);
  }

  async loadFileMetadata(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    return this.datasetLoading.loadFileMetadata(path);
  }

  async loadFileFull(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    return this.datasetLoading.loadFileFull(path);
  }

  async loadBuffer(
    name: string,
    buffer: ArrayBuffer,
    format: 'sav' | 'csv'
  ): Promise<ResultEnvelope<DatasetSummary>> {
    return this.datasetLoading.loadBuffer(name, buffer, format);
  }

  async close(): Promise<void> {
    await this.adapter.close();
  }

  describe(): ResultEnvelope<DatasetDescription> {
    return this.wrapSync('describe', {}, () => ({
      dataset: this.state.dataset
        ? {
            ...this.state.dataset,
            variables: this.state.dataset.variables.map((variable) => ({ ...variable })),
          }
        : null,
      variableSets: this.state.variableSets.map((variableSet) => ({
        ...variableSet,
        variableIds: [...variableSet.variableIds],
      })),
      folders: this.state.folders.map((folder) => ({ ...folder })),
      activeFilters: this.state.activeFilters.map((filter) => ({
        ...filter,
        value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
      })),
      weightVariable: this.state.dataset?.weightVariable ?? null,
    }));
  }

  async describeVariable(id: string): Promise<ResultEnvelope<VariableDetail>> {
    this.requireDataset();
    const variable = this.requireVariable(id);
    const warnings = collectTopicGuidanceWarnings(
      variable,
      this.state.semanticAnnotations.get(id)
    );

    if (this.state.dataset?.metadataOnly) {
      warnings.push('Variable statistics require full row data. Call velocity_load_full first.');
    }

    return this.wrap(
      'describeVariable',
      { id },
      async () => {
        if (this.state.dataset?.metadataOnly) {
          return {
            variable: { ...variable },
            stats: null,
          };
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
      },
      warnings
    );
  }

  listAnalyses(): ResultEnvelope<AnalysisDescriptor[]> {
    return this.wrapSync('listAnalyses', {}, () => analysisRegistry.list().map((descriptor) => ({
      id: descriptor.id,
      label: descriptor.label,
      configSchema: descriptor.configSchema,
    })));
  }

  getSession(): ResultEnvelope<VelocitySessionFile> {
    return this.sessionState.getSession();
  }

  async runAnalysis(id: string, config: unknown): Promise<ResultEnvelope<unknown>> {
    const configRecord = this.toRecord(config);
    let crosstabWarnings: string[] = [];

    if (id === 'crosstab') {
      const rowVarIds = Array.isArray(configRecord.rowVars) ? (configRecord.rowVars as string[]) : [];
      const colVarId = (configRecord.colVar as string | null | undefined) ?? null;
      const weightVarId =
        (configRecord.weightVar as string | null | undefined) ??
        this.state.dataset?.weightVariable ??
        null;

      crosstabWarnings = collectCrosstabWarnings({
        rowVars: rowVarIds.map((varId) => this.requireVariable(varId)),
        colVar: colVarId ? this.requireVariable(colVarId) : null,
        weightVar: weightVarId ? this.requireVariable(weightVarId) : null,
        getAnnotation: (varId) => this.state.semanticAnnotations.get(varId),
      });
    }

    return applyCrosstabFormat(
      await this.wrap(
        `runAnalysis:${id}`,
        { id, config: configRecord },
        async () => {
          this.requireDatasetWithRows();

          try {
            if (id === 'crosstab') {
              const crosstabConfig = configRecord;
              const analysisSettings = crosstabConfig.analysisSettings as
                | Partial<EngineAnalysisSettings>
                | undefined;
              const rowVarIds = Array.isArray(crosstabConfig.rowVars)
                ? (crosstabConfig.rowVars as string[])
                : [];
              const colVarId = (crosstabConfig.colVar as string | null | undefined) ?? null;
              const request = buildCrosstabRequest({
                dataset: this.requireDataset(),
                variableSets: this.state.variableSets,
                rowVars: rowVarIds,
                colVar: colVarId,
                filters: (crosstabConfig.filters as Filter[] | undefined) ?? this.state.activeFilters,
                weightVar:
                  (crosstabConfig.weightVar as string | null | undefined) ??
                  this.state.dataset?.weightVariable ??
                  null,
                analysisSettings: isCompleteAnalysisSettings(analysisSettings)
                  ? analysisSettings
                  : undefined,
              });

              const result = await runCrosstab(
                this.adapter,
                {
                  ...request.options,
                  significanceOptions: request.analysisSettings
                    ? {
                        comparisonMethod: request.analysisSettings.comparisonMethod,
                        correctionType: request.analysisSettings.correctionType,
                        significanceLevel: request.analysisSettings.significanceLevel,
                      }
                    : undefined,
                },
                request.context
              );

              if (
                crosstabConfig.resolveLabels === true &&
                result &&
                typeof result === 'object' &&
                'rows' in result
              ) {
                const { rowVariables, colVariable } = resolveCrosstabLabelAxes(
                  this,
                  rowVarIds,
                  colVarId
                );
                return {
                  ...(result as unknown as Record<string, unknown>),
                  rows: resolveValueLabelsInRows(
                    (result as { rows: Record<string, unknown>[] }).rows,
                    rowVariables,
                    colVariable
                  ),
                };
              }

              return result;
            }

            if (id === 'variableStats') {
              const variableStatsConfig = this.toRecord(config);
              const column = String(variableStatsConfig.column ?? '');
              if (!column) {
                throw new VelocityError(
                  'INVALID_VARIABLE',
                  'variableStats requires a "column" config value.'
                );
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

            const raw = await runner.run(this.adapter, config as never);
            return isResultEnvelope(raw) ? (raw as ResultEnvelope<unknown>).data : raw;
          } catch (error) {
            if (error instanceof VelocityError) throw error;
            throw new VelocityError('ANALYSIS_FAILED', `Analysis failed: ${id}`, error);
          }
        },
        crosstabWarnings
      ),
      id,
      configRecord
    );
  }

  async query(sql: string): Promise<ResultEnvelope<QueryResult>> {
    return this.wrap('query', { sql }, async () => {
      this.requireDatasetWithRows();
      return this.adapter.query(sql);
    });
  }

  async recode(sourceVar: string, config: EngineRecodeConfig): Promise<ResultEnvelope<Variable>> {
    return this.wrap('recode', { sourceVar, config: this.toRecord(config) }, async () => {
      const dataset = this.requireDatasetWithRows();
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
      this.state.variableSets = [
        ...this.state.variableSets,
        {
          id: safeTargetName,
          name: variable.label,
          variableIds: [safeTargetName],
          structure: 'single',
          type: variable.type,
        },
      ];
      this.state.transformLog = [
        ...this.state.transformLog,
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

  setWeight(variableId: string | null): ResultEnvelope<WeightMutationResult> {
    return this.sessionState.setWeight(variableId);
  }

  addFilter(filter: Filter): ResultEnvelope<FilterMutationResult> {
    return this.sessionState.addFilter(filter);
  }

  removeFilter(filterId: string): ResultEnvelope<RemoveFilterResult> {
    return this.sessionState.removeFilter(filterId);
  }

  clearFilters(): ResultEnvelope<ClearFiltersResult> {
    return this.sessionState.clearFilters();
  }

  getActiveFilters(): ResultEnvelope<Filter[]> {
    return this.sessionState.getActiveFilters();
  }

  async exportSession(): Promise<ResultEnvelope<VelocitySessionFile>> {
    return this.sessionState.exportSession();
  }

  async buildDeck(spec: DeckSpec): Promise<ResultEnvelope<BuiltDeck>> {
    this.requireDatasetWithRows();
    const builder = new DeckBuilder(this);
    const envelope = await builder.build(spec);
    return {
      ...envelope,
      metadata: {
        datasetName: this.state.dataset?.name ?? 'unloaded',
        rowCount: this.state.dataset?.rowCount ?? 0,
        filtersApplied: this.state.activeFilters.length,
        isWeighted: !!this.state.dataset?.weightVariable,
        engineVersion: this.engineVersion,
      },
    };
  }

  async exportDeck(deck: BuiltDeck, options: DeckExportOptions): Promise<ResultEnvelope<Uint8Array>> {
    return this.wrap('exportDeck', { format: options.format, slideCount: deck.slides.length }, async () => {
      const builder = new DeckBuilder(this);
      return builder.export(deck, options);
    });
  }

  commitDeck(deck: BuiltDeck): ResultEnvelope<CommitDeckResult> {
    return this.sessionState.commitDeck(deck);
  }

  async recommendChart(
    rowVarIds: string[],
    colVarId?: string | null
  ): Promise<ResultEnvelope<ChartRecommendation>> {
    return this.wrap('recommendChart', { rowVarIds, colVarId: colVarId ?? null }, async () => {
      const dataset = this.requireDataset();
      const rowVars = rowVarIds.map((id) => {
        const v = dataset.variables.find((variable) => variable.id === id);
        if (!v) throw new VelocityError('INVALID_VARIABLE', `Unknown variable: ${id}`);
        return v;
      });
      const colVar = colVarId
        ? (dataset.variables.find((v) => v.id === colVarId) ?? null)
        : null;
      return recommendChart({ rowVars, colVar });
    });
  }

  async proposeMappings(
    wave1VarIds: string[],
    wave2VarIds: string[]
  ): Promise<ResultEnvelope<VariableMapping[]>> {
    return this.wrap('proposeMappings', { wave1Count: wave1VarIds.length, wave2Count: wave2VarIds.length }, async () => {
      const dataset = this.requireDataset();
      const wave1Vars = wave1VarIds.map((id) => {
        const v = dataset.variables.find((variable) => variable.id === id);
        if (!v) throw new VelocityError('INVALID_VARIABLE', `Unknown wave1 variable: ${id}`);
        return v;
      });
      const wave2Vars = wave2VarIds.map((id) => {
        const v = dataset.variables.find((variable) => variable.id === id);
        if (!v) throw new VelocityError('INVALID_VARIABLE', `Unknown wave2 variable: ${id}`);
        return v;
      });
      return autoMatchVariables(wave1Vars, wave2Vars);
    });
  }

  async buildHarmonizedTable(
    sourceTable: string,
    targetTable: string,
    mappings: VariableMapping[],
    sourceVarNames: Record<string, string>,
    targetVarNames: Record<string, string>
  ): Promise<ResultEnvelope<{ sql: string }>> {
    return this.wrap('buildHarmonizedTable', { sourceTable, targetTable, mappingCount: mappings.length }, async () => {
      const sql = buildHarmonizedTableQuery(sourceTable, targetTable, mappings, sourceVarNames, targetVarNames);
      return { sql };
    });
  }

  async applyHarmonizedTable(
    sourceTable: string,
    targetTable: string,
    mappings: VariableMapping[],
    outputTableName: string,
    sourceVarNames: Record<string, string>,
    targetVarNames: Record<string, string>
  ): Promise<ResultEnvelope<{ tableName: string; rowCount: number; sql: string }>> {
    return this.wrap(
      'applyHarmonizedTable',
      { sourceTable, targetTable, outputTableName, mappingCount: mappings.length },
      async () => {
        const sql = buildHarmonizedTableQuery(
          sourceTable,
          targetTable,
          mappings,
          sourceVarNames,
          targetVarNames
        );
        const safeOutput = outputTableName.replace(/"/g, '""');
        await this.adapter.execute(`CREATE OR REPLACE TABLE "${safeOutput}" AS (${sql})`);
        const count = await this.adapter.query(`SELECT COUNT(*) AS cnt FROM "${safeOutput}"`);
        const rowCount = Number(count.rows[0]?.cnt ?? 0);
        return { tableName: outputTableName, rowCount, sql };
      }
    );
  }

  async loadWorkspaceDataset(
    path: string,
    options?: { metadataOnly?: boolean; waveNumber?: number; makeActive?: boolean }
  ): Promise<ResultEnvelope<WorkspaceDatasetSummary>> {
    return this.workspaceManager.loadWorkspaceDataset(path, options);
  }

  listWorkspaceDatasets(): ResultEnvelope<WorkspaceDatasetSummary[]> {
    return this.workspaceManager.listWorkspaceDatasets();
  }

  setActiveWorkspaceDataset(datasetId: string): ResultEnvelope<WorkspaceDatasetSummary> {
    return this.workspaceManager.setActiveWorkspaceDataset(datasetId);
  }

  async loadWorkspaceDatasetFull(datasetId: string): Promise<ResultEnvelope<WorkspaceDatasetSummary>> {
    return this.workspaceManager.loadWorkspaceDatasetFull(datasetId);
  }

  proposeWorkspaceMappings(
    sourceDatasetId: string,
    targetDatasetId: string
  ): Promise<ResultEnvelope<VariableMapping[]>> {
    return this.workspaceManager.proposeWorkspaceMappings(sourceDatasetId, targetDatasetId);
  }

  async harmonizeWorkspaceDatasets(params: {
    sourceDatasetId: string;
    targetDatasetId: string;
    mappings: VariableMapping[];
    outputTableName: string;
    onlyConfirmed?: boolean;
  }): Promise<ResultEnvelope<{ tableName: string; rowCount: number; sql: string }>> {
    return this.workspaceManager.harmonizeWorkspaceDatasets(params);
  }

  async importSession(
    session: VelocitySessionFile
  ): Promise<ResultEnvelope<ReturnType<typeof importSessionFile>['diagnostics']>> {
    return this.sessionState.importSession(session);
  }

  async annotateDataset(): Promise<ResultEnvelope<{ annotated: number; total: number }>> {
    return this.semanticFacade.annotateDataset();
  }

  annotateVariable(
    variableId: string,
    annotation: Partial<SemanticAnnotation> & Pick<SemanticAnnotation, 'topic' | 'measurementIntent'>
  ): void {
    this.semanticFacade.annotateVariable(variableId, annotation);
  }

  getAnnotation(variableId: string): ResultEnvelope<SemanticAnnotation | undefined> {
    return this.semanticFacade.getAnnotation(variableId);
  }

  async searchVariables(
    query: string,
    options: { limit?: number } = {}
  ): Promise<ResultEnvelope<SemanticSearchResult[]>> {
    return this.semanticFacade.searchVariables(query, options);
  }

  listConcepts(): ResultEnvelope<Concept[]> {
    return this.semanticFacade.listConcepts();
  }

  createConcept(spec: {
    name: string;
    aliases?: string[];
    canonicalScale?: Concept['canonicalScale'];
  }): ResultEnvelope<Concept> {
    return this.semanticFacade.createConcept(spec);
  }

  linkVariableToConcept(variableId: string, conceptId: string): void {
    this.semanticFacade.linkVariableToConcept(variableId, conceptId);
  }

  async suggestAnalyses(variableIds: string[]): Promise<ResultEnvelope<AnalysisSuggestion[]>> {
    return this.semanticFacade.suggestAnalyses(variableIds);
  }

  suggestHarmonizations(): ResultEnvelope<HarmonizationSuggestion[]> {
    return this.semanticFacade.suggestHarmonizations();
  }

  listVariablesByCategory(
    category: MeasurementIntent,
    options?: { includeUnannotated?: boolean; limit?: number }
  ): ResultEnvelope<SemanticSearchResult[]> {
    return this.semanticFacade.listVariablesByCategory(category, options);
  }

  suggestBreaks(
    variableId: string,
    options?: { limit?: number }
  ): ResultEnvelope<BreakSuggestion[]> {
    return this.semanticFacade.suggestBreaks(variableId, options);
  }

  getSemanticState(): ResultEnvelope<SemanticStateSnapshot> {
    return this.semanticFacade.getSemanticState();
  }

  restoreSemanticState(state: SemanticStateSnapshot): void {
    this.semanticFacade.restoreSemanticState(state);
  }

  resolveSafePath(inputPath: string): string {
    if (!this.dataDir) {
      return inputPath;
    }

    const normalizedInput = inputPath.replace(/\\/g, '/');
    const normalizedDataDir = this.dataDir.replace(/\\/g, '/');
    if (
      normalizedInput === normalizedDataDir ||
      normalizedInput.startsWith(`${normalizedDataDir}/`)
    ) {
      return normalizedInput;
    }

    const segments = inputPath.split(/[\\/]/);
    const resolved = [this.dataDir];
    for (const seg of segments) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') {
        throw new VelocityError(
          'PATH_TRAVERSAL_DENIED',
          `Path traversal is not allowed: ${inputPath}`
        );
      }
      resolved.push(seg);
    }
    const full = resolved.join('/');

    if (!full.startsWith(this.dataDir + '/')) {
      throw new VelocityError(
        'PATH_TRAVERSAL_DENIED',
        `Path is outside the allowed data directory: ${inputPath}`
      );
    }

    return full;
  }

  resetSessionState(): void {
    this.sessionState.resetSessionState();
  }

  requireDataset() {
    if (!this.state.dataset) {
      throw new VelocityError('NO_DATASET_LOADED', 'No dataset is currently loaded.');
    }
    return this.state.dataset;
  }

  requireDatasetWithRows() {
    const dataset = this.requireDataset();
    if (dataset.metadataOnly) {
      throw new VelocityError(
        'METADATA_ONLY',
        'Full row data is not loaded. Call velocity_load_full (or velocity_workspace_load_full) before running analyses.'
      );
    }
    return dataset;
  }

  requireVariable(id: string): Variable {
    const dataset = this.requireDataset();
    const variable = dataset.variables.find((entry) => entry.id === id);
    if (!variable) {
      throw new VelocityError('INVALID_VARIABLE', `Unknown variable: ${id}`, {
        available: dataset.variables.map((entry) => entry.id),
      });
    }
    return variable;
  }

  wrap<T>(
    operation: string,
    inputs: Record<string, unknown>,
    fn: () => Promise<T>,
    warnings: string[] = []
  ): Promise<ResultEnvelope<T>> {
    return wrapEnvelope(this.state, this.engineVersion, operation, inputs, fn, warnings);
  }

  wrapSync<T>(
    operation: string,
    inputs: Record<string, unknown>,
    fn: () => T,
    warnings: string[] = []
  ): ResultEnvelope<T> {
    return wrapEnvelopeSync(this.state, this.engineVersion, operation, inputs, fn, warnings);
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
