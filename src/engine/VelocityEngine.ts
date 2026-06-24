import { analysisRegistry } from '../core/analysis/registry';
import { buildCrosstabRequest } from '../core/analysis/buildCrosstabRequest';
import { runCrosstab } from '../core/analysis/crosstabRunner';
import { getVariableStats } from '../core/analysis/variableStatsRunner';
import { buildHarmonizedTableQuery } from '../core/harmonization/harmonizationQueries';
import { buildCaseSql } from '../core/transforms/recodeSql';
import { autoMatchVariables } from '../core/harmonization/matchEngine';
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
import type { ChartRecommendation } from '../types/charts';
import type { Slide, SlideSection } from '../types/slides';
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
import { autoAnnotate } from '../core/semantic/annotator';
import { ConceptStore } from '../core/semantic/concepts';
import { buildConceptsFromAnnotations } from '../core/semantic/conceptDiscovery';
import { buildSearchIndex, listVariablesByCategory, searchVariables } from '../core/semantic/search';
import {
  collectCrosstabWarnings,
  collectTopicGuidanceWarnings,
} from '../core/semantic/analysisGuardrails';
import { suggestAnalyses, suggestBreaks, suggestHarmonizations } from '../core/semantic/suggestions';
import { recommendChart } from '../services/chartRecommender';
import { DeckBuilder } from './DeckBuilder';
import type {
  AnalysisDescriptor,
  BuiltDeck,
  DatasetDescription,
  DatasetSummary,
  DeckExportOptions,
  DeckSpec,
  EngineOptions,
  EngineRecodeConfig,
  ResultEnvelope,
  VariableDetail,
  WorkspaceDatasetSummary,
} from './types';
import { VelocityError } from './types';

type EngineAnalysisSettings = {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.90 | 0.80;
};

type SemanticStateSnapshot = {
  annotations: Record<string, SemanticAnnotation>;
  concepts: Concept[];
};

type LoadableNodeAdapter = DatabaseAdapter & {
  loadCSV?: (filePath: string, tableName?: string) => Promise<number>;
  loadSav?: (
    filePath: string,
    tableName?: string
  ) => Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number }>;
};

const METADATA_FIRST_THRESHOLD_BYTES = 50 * 1024 * 1024;

interface WorkspaceDatasetEntry {
  id: string;
  name: string;
  tableName: string;
  rowCount: number;
  variables: Variable[];
  variableSets: VariableSet[];
  source: Dataset['source'];
  metadataOnly: boolean;
  filePath: string;
  waveNumber?: number;
}

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

export class VelocityEngine {
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
  private workspaceDatasets = new Map<string, WorkspaceDatasetEntry>();
  private activeWorkspaceDatasetId: string | null = null;
  private pendingFullLoadPath: string | null = null;

  // Phase 4: Semantic Layer
  private semanticAnnotations: Map<string, SemanticAnnotation> = new Map();
  private conceptStore: ConceptStore = new ConceptStore();

  private constructor(
    private readonly adapter: DatabaseAdapter,
    private readonly runtime: 'node' | 'wasm',
    private readonly engineVersion: string,
    private readonly dataDir: string | null = null
  ) {}

  async loadFile(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    return this.wrap('loadFile', { path, runtime: this.runtime }, async () => {
      const resolvedPath = this.resolveSafePath(path);
      const source = inferDatasetSource(resolvedPath);
      const fileName = getBasename(resolvedPath);
      const nodeAdapter = this.adapter as LoadableNodeAdapter;

      try {
        if (source === 'sav') {
          if (!nodeAdapter.loadSav) {
            throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support SAV file loading.');
          }

          const result = await nodeAdapter.loadSav(resolvedPath, 'main');
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

          const rowCount = await nodeAdapter.loadCSV(resolvedPath, 'main');
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

        this.pendingFullLoadPath = null;
        this.dataset.metadataOnly = false;
        this.resetSessionState();

        return this.buildDatasetSummary(this.dataset);
      } catch (error) {
        if (error instanceof VelocityError) throw error;
        throw new VelocityError('FILE_LOAD_FAILED', `Failed to load file: ${resolvedPath}`, error);
      }
    });
  }

  async loadFileMetadata(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    const resolvedPath = this.resolveSafePath(path);
    const fileSizeBytes = await this.getFileSizeBytes(resolvedPath);
    const warnings: string[] = [];
    if (fileSizeBytes >= METADATA_FIRST_THRESHOLD_BYTES) {
      warnings.push(
        `File is ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB. Metadata loaded; call velocity_load_full when ready to analyze rows.`
      );
    }

    return this.wrap(
      'loadFileMetadata',
      { path, runtime: this.runtime },
      async () => {
        const source = inferDatasetSource(resolvedPath);
        if (source !== 'sav') {
          throw new VelocityError(
            'UNSUPPORTED_FORMAT',
            'Metadata-only load is supported for SAV files. Use velocity_load for CSV.'
          );
        }

        const fileName = getBasename(resolvedPath);
        const { loadSavMetadata } = await import('../core/ingestion/savIngestion');
        const result = await loadSavMetadata(resolvedPath);

        this.dataset = {
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
        this.variableSets = result.variableSets.map((variableSet) => ({ ...variableSet }));
        this.pendingFullLoadPath = resolvedPath;
        this.resetSessionState();

        return this.buildDatasetSummary(this.dataset, { fileSizeBytes });
      },
      warnings
    );
  }

  async loadFileFull(path: string): Promise<ResultEnvelope<DatasetSummary>> {
    const resolvedPath = this.resolveSafePath(path);
    const pendingPath = this.pendingFullLoadPath;
    const metadataOnly = this.dataset?.metadataOnly === true;

    if (!metadataOnly && !pendingPath) {
      return this.loadFile(path);
    }

    if (pendingPath && pendingPath !== resolvedPath) {
      throw new VelocityError(
        'FILE_LOAD_FAILED',
        `Expected full load for ${pendingPath}, received ${resolvedPath}.`
      );
    }

    return this.loadFile(resolvedPath);
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

  describe(): ResultEnvelope<DatasetDescription> {
    return this.wrapSync('describe', {}, () => ({
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
    }));
  }

  async describeVariable(id: string): Promise<ResultEnvelope<VariableDetail>> {
    this.requireDataset();
    const variable = this.requireVariable(id);
    const warnings = collectTopicGuidanceWarnings(
      variable,
      this.semanticAnnotations.get(id)
    );

    if (this.dataset?.metadataOnly) {
      warnings.push('Variable statistics require full row data. Call velocity_load_full first.');
    }

    return this.wrap(
      'describeVariable',
      { id },
      async () => {
        if (this.dataset?.metadataOnly) {
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
    return this.wrapSync('getSession', {}, () => this.buildSessionFile());
  }

  private buildSessionFile(): VelocitySessionFile {
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
      semantic: this.readSemanticState(),
      velocityVersion: this.engineVersion,
    });
  }

  async runAnalysis(id: string, config: unknown): Promise<ResultEnvelope<unknown>> {
    const configRecord = this.toRecord(config);
    let crosstabWarnings: string[] = [];

    if (id === 'crosstab') {
      const rowVarIds = Array.isArray(configRecord.rowVars) ? (configRecord.rowVars as string[]) : [];
      const colVarId = (configRecord.colVar as string | null | undefined) ?? null;
      const weightVarId =
        (configRecord.weightVar as string | null | undefined) ??
        this.dataset?.weightVariable ??
        null;

      crosstabWarnings = collectCrosstabWarnings({
        rowVars: rowVarIds.map((varId) => this.requireVariable(varId)),
        colVar: colVarId ? this.requireVariable(colVarId) : null,
        weightVar: weightVarId ? this.requireVariable(weightVarId) : null,
        getAnnotation: (varId) => this.semanticAnnotations.get(varId),
      });
    }

    return this.wrap(
      `runAnalysis:${id}`,
      { id, config: configRecord },
      async () => {
      this.requireDatasetWithRows();

      try {
        if (id === 'crosstab') {
          const crosstabConfig = configRecord;
          const analysisSettings = crosstabConfig.analysisSettings as Partial<EngineAnalysisSettings> | undefined;
          const rowVarIds = Array.isArray(crosstabConfig.rowVars) ? (crosstabConfig.rowVars as string[]) : [];
          const colVarId = (crosstabConfig.colVar as string | null | undefined) ?? null;
          const request = buildCrosstabRequest({
            dataset: this.requireDataset(),
            variableSets: this.variableSets,
            rowVars: rowVarIds,
            colVar: colVarId,
            filters: (crosstabConfig.filters as Filter[] | undefined) ?? this.activeFilters,
            weightVar: (crosstabConfig.weightVar as string | null | undefined) ?? this.dataset?.weightVariable ?? null,
            analysisSettings: isCompleteAnalysisSettings(analysisSettings) ? analysisSettings : undefined,
          });

          const result = await runCrosstab(this.adapter, {
            ...request.options,
            significanceOptions: request.analysisSettings
              ? {
                  comparisonMethod: request.analysisSettings.comparisonMethod,
                  correctionType: request.analysisSettings.correctionType,
                  significanceLevel: request.analysisSettings.significanceLevel,
                }
              : undefined,
          }, request.context);

          if (crosstabConfig.resolveLabels === true && result && typeof result === 'object' && 'rows' in result) {
            const { rowVariables, colVariable } = this.resolveCrosstabLabelAxes(rowVarIds, colVarId);
            return {
              ...(result as unknown as Record<string, unknown>),
              rows: this.resolveValueLabelsInRows(
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

        const raw = await runner.run(this.adapter, config as never);
        // Guard: if a runner wraps its own result in a ResultEnvelope, unwrap it so
        // the outer wrap() call doesn't produce a nested envelope.
        return isResultEnvelope(raw) ? (raw as ResultEnvelope<unknown>).data : raw;
      } catch (error) {
        if (error instanceof VelocityError) throw error;
        throw new VelocityError('ANALYSIS_FAILED', `Analysis failed: ${id}`, error);
      }
    },
      crosstabWarnings
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

  getActiveFilters(): ResultEnvelope<Filter[]> {
    return this.wrapSync('getActiveFilters', {}, () => this.activeFilters.map(cloneFilter));
  }

  async exportSession(): Promise<ResultEnvelope<VelocitySessionFile>> {
    return this.wrap('exportSession', {}, async () => this.buildSessionFile());
  }

  // ============================================================================
  // Deck Building (Phase 2)
  // ============================================================================

  async buildDeck(spec: DeckSpec): Promise<ResultEnvelope<BuiltDeck>> {
    this.requireDatasetWithRows();
    const builder = new DeckBuilder(this);
    const envelope = await builder.build(spec);
    // Enrich with engine-level metadata (accurate filter count, weight state, version)
    return {
      ...envelope,
      metadata: {
        datasetName: this.dataset?.name ?? 'unloaded',
        rowCount: this.dataset?.rowCount ?? 0,
        filtersApplied: this.activeFilters.length,
        isWeighted: !!this.dataset?.weightVariable,
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

  /**
   * Write a BuiltDeck back into the engine's session slides array so that
   * getSession() / exportSession() captures the deck structure.
   *
   * buildDeck() is deliberately pure (no side effects). Call commitDeck() explicitly
   * when you want the agent workflow build → export PPTX → save session to round-trip.
   * Appends to existing slides/sections rather than replacing them.
   */
  commitDeck(deck: BuiltDeck): void {
    const now = Date.now();
    const sectionMap = new Map<string, string>(); // sectionTitle → sectionId

    const newSections: SlideSection[] = deck.spec.sections.map((sec, i) => {
      const id = `deck-section-${i}-${now}`;
      sectionMap.set(sec.title, id);
      return { id, title: sec.title };
    });

    const newSlides: Slide[] = deck.slides.map((builtSlide, i) => ({
      id: `deck-slide-${i}-${now}`,
      title: builtSlide.resolvedTitle,
      subtitle: builtSlide.resolvedSubtitle,
      notes: builtSlide.spec.notes,
      analysisState: {
        rowVars: builtSlide.spec.rowVars,
        colVar: builtSlide.spec.colVar ?? null,
        filters: builtSlide.spec.filters ?? [],
        weightVar: builtSlide.spec.weightVar ?? null,
      },
      visualizationType: builtSlide.spec.visualizationType ?? 'table',
      chartType: builtSlide.resolvedChartType,
      layoutMode: 'focus' as const,
      cells: [],
      sectionId: sectionMap.get(builtSlide.sectionTitle),
      createdAt: now,
      updatedAt: now,
    }));

    this.slides = [...this.slides, ...newSlides];
    this.sections = [...this.sections, ...newSections];
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

  // ============================================================================
  // Harmonization (Phase 2)
  // ============================================================================

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
    return this.wrap('loadWorkspaceDataset', { path, ...options }, async () => {
      const resolvedPath = this.resolveSafePath(path);
      const source = inferDatasetSource(resolvedPath);
      const fileName = getBasename(resolvedPath);
      const datasetId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tableName = this.workspaceTableName(datasetId);
      const metadataOnly = options?.metadataOnly === true && source === 'sav';
      const nodeAdapter = this.adapter as LoadableNodeAdapter;

      let variables: Variable[];
      let variableSets: VariableSet[];
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
        const schema = await this.adapter.query(`PRAGMA table_info('${tableName.replace(/'/g, "''")}')`);
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
      this.workspaceDatasets.set(datasetId, entry);

      if (options?.makeActive === true) {
        this.activateWorkspaceEntry(entry);
      }

      return this.toWorkspaceSummary(entry);
    });
  }

  listWorkspaceDatasets(): ResultEnvelope<WorkspaceDatasetSummary[]> {
    return this.wrapSync('listWorkspaceDatasets', {}, () =>
      Array.from(this.workspaceDatasets.values()).map((entry) => this.toWorkspaceSummary(entry))
    );
  }

  setActiveWorkspaceDataset(datasetId: string): ResultEnvelope<WorkspaceDatasetSummary> {
    return this.wrapSync('setActiveWorkspaceDataset', { datasetId }, () => {
      const entry = this.workspaceDatasets.get(datasetId);
      if (!entry) {
        throw new VelocityError('WORKSPACE_DATASET_NOT_FOUND', `Unknown workspace dataset: ${datasetId}`, {
          available: Array.from(this.workspaceDatasets.keys()),
        });
      }
      this.activateWorkspaceEntry(entry);
      return this.toWorkspaceSummary(entry);
    });
  }

  async loadWorkspaceDatasetFull(datasetId: string): Promise<ResultEnvelope<WorkspaceDatasetSummary>> {
    return this.wrap('loadWorkspaceDatasetFull', { datasetId }, async () => {
      const entry = this.requireWorkspaceEntry(datasetId);
      if (!entry.metadataOnly) {
        return this.toWorkspaceSummary(entry);
      }
      if (entry.source !== 'sav') {
        throw new VelocityError('UNSUPPORTED_FORMAT', 'Full workspace reload is only supported for SAV datasets.');
      }

      const nodeAdapter = this.adapter as LoadableNodeAdapter;
      if (!nodeAdapter.loadSav) {
        throw new VelocityError('FILE_LOAD_FAILED', 'Current adapter does not support SAV file loading.');
      }

      const loaded = await nodeAdapter.loadSav(entry.filePath, entry.tableName);
      entry.variables = loaded.variables.map((variable) => ({ ...variable }));
      entry.variableSets = loaded.variableSets.map((variableSet) => ({ ...variableSet }));
      entry.rowCount = loaded.rowCount;
      entry.metadataOnly = false;
      this.workspaceDatasets.set(entry.id, entry);

      if (this.activeWorkspaceDatasetId === entry.id) {
        this.activateWorkspaceEntry(entry);
      }

      return this.toWorkspaceSummary(entry);
    });
  }

  proposeWorkspaceMappings(
    sourceDatasetId: string,
    targetDatasetId: string
  ): Promise<ResultEnvelope<VariableMapping[]>> {
    return this.wrap(
      'proposeWorkspaceMappings',
      { sourceDatasetId, targetDatasetId },
      async () => {
        const source = this.requireWorkspaceEntry(sourceDatasetId);
        const target = this.requireWorkspaceEntry(targetDatasetId);
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
    return this.wrap('harmonizeWorkspaceDatasets', params, async () => {
      const source = this.requireWorkspaceEntry(params.sourceDatasetId);
      const target = this.requireWorkspaceEntry(params.targetDatasetId);

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
      await this.adapter.execute(`CREATE OR REPLACE TABLE "${safeOutput}" AS (${sql})`);
      const count = await this.adapter.query(`SELECT COUNT(*) AS cnt FROM "${safeOutput}"`);
      const rowCount = Number(count.rows[0]?.cnt ?? 0);

      return { tableName: params.outputTableName, rowCount, sql };
    });
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
        this.restoreSemanticState(session.semantic ?? { annotations: {}, concepts: [] });
        return result.diagnostics;
      } catch (error) {
        if (error instanceof VelocityError) throw error;
        throw new VelocityError('SESSION_INVALID', 'Failed to import session.', error);
      }
    });
  }

  // ============================================================================
  // Semantic Layer (Phase 4)
  // ============================================================================

  /**
   * Run heuristic auto-annotation over all variables in the loaded dataset.
   * Annotations are stored in-engine and written to the variable objects.
   */
  async annotateDataset(): Promise<ResultEnvelope<{ annotated: number; total: number }>> {
    return this.wrap('annotateDataset', {}, async () => {
      const dataset = this.requireDataset();
      const annotations = autoAnnotate(dataset.variables, this.variableSets);
      this.semanticAnnotations = annotations;

      // Write annotations back to variable objects
      dataset.variables = dataset.variables.map((variable) => {
        const annotation = annotations.get(variable.id);
        return annotation ? { ...variable, semantic: annotation } : variable;
      });

      // Auto-discover concepts from annotations
      buildConceptsFromAnnotations(
        dataset.variables,
        this.variableSets,
        annotations,
        dataset.id,
        this.conceptStore
      );

      return { annotated: annotations.size, total: dataset.variables.length };
    });
  }

  /**
   * Manually add or update a semantic annotation for a variable.
   */
  annotateVariable(
    variableId: string,
    annotation: Partial<SemanticAnnotation> & Pick<SemanticAnnotation, 'topic' | 'measurementIntent'>
  ): void {
    const dataset = this.requireDataset();
    const variable = this.requireVariable(variableId);

    const full: SemanticAnnotation = {
      source: 'manual',
      confidence: 1.0,
      ...annotation,
    };

    this.semanticAnnotations.set(variableId, full);
    dataset.variables = dataset.variables.map((v) =>
      v.id === variableId ? { ...v, semantic: full } : v
    );
    void variable; // used via requireVariable for validation
  }

  /**
   * Get the current semantic annotation for a variable (if any).
   */
  getAnnotation(variableId: string): ResultEnvelope<SemanticAnnotation | undefined> {
    return this.wrapSync('getAnnotation', { variableId }, () => {
      const annotation = this.semanticAnnotations.get(variableId);
      return annotation ? { ...annotation } : undefined;
    });
  }

  /**
   * Search variables by semantic meaning across the loaded dataset.
   */
  async searchVariables(
    query: string,
    options: { limit?: number } = {}
  ): Promise<ResultEnvelope<SemanticSearchResult[]>> {
    return this.wrap('searchVariables', { query, ...options }, async () => {
      const dataset = this.requireDataset();
      const concepts = this.conceptStore.listConcepts();
      const index = buildSearchIndex(
        dataset.variables,
        dataset.id,
        this.semanticAnnotations,
        concepts
      );
      return searchVariables(query, index, options.limit ?? 20);
    });
  }

  /**
   * Get all concepts in the concept store.
   */
  listConcepts(): ResultEnvelope<Concept[]> {
    return this.wrapSync('listConcepts', {}, () => this.cloneConcepts(this.conceptStore.listConcepts()));
  }

  /**
   * Create a new concept entity.
   */
  createConcept(spec: {
    name: string;
    aliases?: string[];
    canonicalScale?: Concept['canonicalScale'];
  }): ResultEnvelope<Concept> {
    return this.wrapSync('createConcept', { name: spec.name }, () => {
      const concept = this.conceptStore.createConcept(spec);
      return this.cloneConcept(concept);
    });
  }

  /**
   * Link a variable to a concept.
   */
  linkVariableToConcept(variableId: string, conceptId: string): void {
    const dataset = this.requireDataset();
    this.requireVariable(variableId);
    const annotation = this.semanticAnnotations.get(variableId);
    this.conceptStore.linkVariable(conceptId, {
      datasetId: dataset.id,
      variableId,
      matchConfidence: annotation?.confidence ?? 1.0,
    });
  }

  /**
   * Suggest analyses for a set of variable IDs based on their semantic annotations.
   */
  async suggestAnalyses(
    variableIds: string[]
  ): Promise<ResultEnvelope<AnalysisSuggestion[]>> {
    return this.wrap('suggestAnalyses', { variableIds }, async () => {
      const dataset = this.requireDataset();
      const annotatedVars = variableIds.map((id) => {
        const variable = dataset.variables.find((v) => v.id === id);
        if (!variable) throw new VelocityError('INVALID_VARIABLE', `Unknown variable: ${id}`);
        return { variable, annotation: this.semanticAnnotations.get(id) };
      });
      return suggestAnalyses(annotatedVars);
    });
  }

  /**
   * Suggest cross-dataset harmonizations based on shared concepts.
   */
  suggestHarmonizations(): ResultEnvelope<HarmonizationSuggestion[]> {
    return this.wrapSync('suggestHarmonizations', {}, () => suggestHarmonizations(this.conceptStore.listConcepts()));
  }

  /**
   * Filter variables by MeasurementIntent category (e.g. 'demographic').
   * Uses annotation-first with type-based fallback for unannotated datasets.
   */
  listVariablesByCategory(
    category: MeasurementIntent,
    options?: { includeUnannotated?: boolean; limit?: number }
  ): ResultEnvelope<SemanticSearchResult[]> {
    return this.wrapSync('listVariablesByCategory', { category, ...options }, () => {
      const dataset = this.requireDataset();
      const concepts = this.conceptStore.listConcepts();
      const index = buildSearchIndex(
        dataset.variables,
        dataset.id,
        this.semanticAnnotations,
        concepts
      );
      return listVariablesByCategory(index.entries, category, options);
    });
  }

  /**
   * Suggest good cross-break variables for a given topic variable.
   */
  suggestBreaks(
    variableId: string,
    options?: { limit?: number }
  ): ResultEnvelope<BreakSuggestion[]> {
    const topicVar = this.requireVariable(variableId);
    const warnings = collectTopicGuidanceWarnings(
      topicVar,
      this.semanticAnnotations.get(variableId)
    );

    return this.wrapSync(
      'suggestBreaks',
      { variableId, ...options },
      () => {
        const dataset = this.requireDataset();
        const topicAnnotated = {
          variable: topicVar,
          annotation: this.semanticAnnotations.get(variableId),
        };
        const allAnnotated = dataset.variables.map((v) => ({
          variable: v,
          annotation: this.semanticAnnotations.get(v.id),
        }));
        return suggestBreaks(topicAnnotated, allAnnotated, options);
      },
      warnings
    );
  }

  /**
   * Get the full semantic state (for session export).
   */
  getSemanticState(): ResultEnvelope<SemanticStateSnapshot> {
    return this.wrapSync('getSemanticState', {}, () => this.readSemanticState());
  }

  private readSemanticState(): SemanticStateSnapshot {
    const annotations: Record<string, SemanticAnnotation> = {};
    for (const [id, ann] of this.semanticAnnotations) {
      annotations[id] = { ...ann };
    }
    return { annotations, concepts: this.cloneConcepts(this.conceptStore.toJSON()) };
  }

  /**
   * Restore semantic state (for session import).
   */
  restoreSemanticState(state: SemanticStateSnapshot): void {
    const mergedAnnotations = new Map(this.semanticAnnotations);
    for (const [id, annotation] of Object.entries(state.annotations)) {
      mergedAnnotations.set(id, { ...annotation });
    }
    this.semanticAnnotations = mergedAnnotations;

    const conceptMap = new Map<string, Concept>();
    for (const concept of this.conceptStore.toJSON()) {
      conceptMap.set(concept.id, this.cloneConcept(concept));
    }
    for (const concept of state.concepts) {
      conceptMap.set(concept.id, this.cloneConcept(concept));
    }
    this.conceptStore.fromJSON([...conceptMap.values()]);

    // Sync back to variable objects
    const dataset = this.dataset;
    if (dataset) {
      dataset.variables = dataset.variables.map((v) => {
        const ann = this.semanticAnnotations.get(v.id);
        return ann ? { ...v, semantic: { ...ann } } : v;
      });
    }
  }

  private resolveSafePath(inputPath: string): string {
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

    // Inline resolution to avoid a Node-only `path.resolve` at the top level
    // (this file must stay platform-portable — no unconditional Node imports).
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

    // Reject paths that are not within dataDir.
    // Must use trailing-slash check to prevent /data2/file from passing when dataDir=/data.
    if (!full.startsWith(this.dataDir + '/')) {
      throw new VelocityError(
        'PATH_TRAVERSAL_DENIED',
        `Path is outside the allowed data directory: ${inputPath}`
      );
    }

    return full;
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
    this.semanticAnnotations = new Map();
    this.conceptStore.clear();
  }

  private requireDataset(): Dataset {
    if (!this.dataset) {
      throw new VelocityError('NO_DATASET_LOADED', 'No dataset is currently loaded.');
    }
    return this.dataset;
  }

  private requireDatasetWithRows(): Dataset {
    const dataset = this.requireDataset();
    if (dataset.metadataOnly) {
      throw new VelocityError(
        'METADATA_ONLY',
        'Full row data is not loaded. Call velocity_load_full (or velocity_workspace_load_full) before running analyses.'
      );
    }
    return dataset;
  }

  private requireWorkspaceEntry(datasetId: string): WorkspaceDatasetEntry {
    const entry = this.workspaceDatasets.get(datasetId);
    if (!entry) {
      throw new VelocityError('WORKSPACE_DATASET_NOT_FOUND', `Unknown workspace dataset: ${datasetId}`, {
        available: Array.from(this.workspaceDatasets.keys()),
      });
    }
    return entry;
  }

  private workspaceTableName(datasetId: string): string {
    return `ws_${datasetId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  }

  private activateWorkspaceEntry(entry: WorkspaceDatasetEntry): void {
    this.activeWorkspaceDatasetId = entry.id;
    this.dataset = {
      id: entry.id,
      name: entry.name,
      rowCount: entry.rowCount,
      variables: entry.variables.map((variable) => ({ ...variable })),
      source: entry.source,
      metadataOnly: entry.metadataOnly,
    };
    this.variableSets = entry.variableSets.map((variableSet) => ({ ...variableSet }));
    this.pendingFullLoadPath = entry.metadataOnly ? entry.filePath : null;
    this.resetSessionState();
  }

  private toWorkspaceSummary(entry: WorkspaceDatasetEntry): WorkspaceDatasetSummary {
    return {
      id: entry.id,
      name: entry.name,
      tableName: entry.tableName,
      rowCount: entry.rowCount,
      variableCount: entry.variables.length,
      source: entry.source,
      metadataOnly: entry.metadataOnly,
      waveNumber: entry.waveNumber,
      isActive: this.activeWorkspaceDatasetId === entry.id,
    };
  }

  private buildDatasetSummary(
    dataset: Dataset,
    extras?: { fileSizeBytes?: number }
  ): DatasetSummary {
    return {
      datasetName: dataset.name,
      rowCount: dataset.rowCount,
      variableCount: dataset.variables.length,
      variableSetCount: this.variableSets.length,
      source: dataset.source,
      metadataOnly: dataset.metadataOnly,
      datasetId: dataset.id,
      fileSizeBytes: extras?.fileSizeBytes,
    };
  }

  private async getFileSizeBytes(filePath: string): Promise<number> {
    const { stat } = await import('node:fs/promises');
    const info = await stat(filePath);
    return info.size;
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
    fn: () => Promise<T>,
    warnings: string[] = []
  ): Promise<ResultEnvelope<T>> {
    const start = performance.now();
    const data = await fn();
    const dataset = this.dataset;

    return {
      data,
      operation,
      inputs,
      durationMs: performance.now() - start,
      warnings,
      metadata: {
        datasetName: dataset?.name ?? 'unloaded',
        rowCount: dataset?.rowCount ?? 0,
        filtersApplied: this.activeFilters.length,
        isWeighted: !!dataset?.weightVariable,
        engineVersion: this.engineVersion,
      },
    };
  }

  private wrapSync<T>(
    operation: string,
    inputs: Record<string, unknown>,
    fn: () => T,
    warnings: string[] = []
  ): ResultEnvelope<T> {
    const start = performance.now();
    const data = fn();
    const dataset = this.dataset;

    return {
      data,
      operation,
      inputs,
      durationMs: performance.now() - start,
      warnings,
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

  /**
   * Replace raw integer codes in crosstab rows with human-readable value labels.
   * Operates on the raw DuckDB format returned by runCrosstab: rows have flat
   * rowKey_0, rowKey_1, ... and colKey fields (not the mapped AggregatedRow format).
   * Falls back to the original code string when no label exists.
   */
  private resolveValueLabelsInRows(
    rows: Record<string, unknown>[],
    rowVariables: Variable[],
    colVariable: Variable | null
  ): Record<string, unknown>[] {
    const buildLabelMap = (variable: Variable): Map<string, string> => {
      const m = new Map<string, string>();
      for (const vl of variable.valueLabels) {
        m.set(String(vl.value), vl.label);
      }
      return m;
    };

    const rowMaps = rowVariables.map(buildLabelMap);
    const colMap = colVariable ? buildLabelMap(colVariable) : null;

    return rows.map((row) => {
      const resolved: Record<string, unknown> = { ...row };
      rowVariables.forEach((_, i) => {
        const key = `rowKey_${i}`;
        if (key in resolved) {
          resolved[key] = rowMaps[i]?.get(String(resolved[key])) ?? resolved[key];
        }
      });
      if (colMap && 'colKey' in resolved) {
        resolved['colKey'] = colMap.get(String(resolved['colKey'])) ?? resolved['colKey'];
      }
      return resolved;
    });
  }

  /**
   * Mirror the crosstab runner's axis-rewrite rules closely enough to resolve
   * value labels on the fields that actually ended up in rowKey_N / colKey.
   */
  private resolveCrosstabLabelAxes(
    rowVarIds: string[],
    colVarId: string | null
  ): { rowVariables: Variable[]; colVariable: Variable | null } {
    const dataset = this.requireDataset();
    let rowVariables = rowVarIds
      .map((id) => dataset.variables.find((v) => v.id === id))
      .filter((v): v is Variable => !!v);
    let colVariable = colVarId
      ? (dataset.variables.find((v) => v.id === colVarId) ?? null)
      : null;

    if (colVariable?.type === 'numeric' && !colVariable.synthetic) {
      colVariable = null;
    }

    const lastRowVariable = rowVariables[rowVariables.length - 1];
    if (lastRowVariable?.type === 'numeric' && !lastRowVariable.synthetic) {
      rowVariables = rowVariables.slice(0, -1);

      if (rowVariables.length === 0 && colVariable) {
        rowVariables = [colVariable];
        colVariable = null;
      }
    }

    return { rowVariables, colVariable };
  }

  private cloneConcept(concept: Concept): Concept {
    return {
      ...concept,
      aliases: [...concept.aliases],
      canonicalScale: concept.canonicalScale
        ? {
            ...concept.canonicalScale,
            anchors: concept.canonicalScale.anchors
              ? { ...concept.canonicalScale.anchors }
              : undefined,
          }
        : undefined,
      variableRefs: concept.variableRefs.map((ref) => ({ ...ref })),
    };
  }

  private cloneConcepts(concepts: Concept[]): Concept[] {
    return concepts.map((concept) => this.cloneConcept(concept));
  }
}

export { VelocityError } from './types';
export type * from './types';
