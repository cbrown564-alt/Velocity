/**
 * DeckBuilder — Batch deck composition from a declarative DeckSpec.
 *
 * Takes a DeckSpec (pure data — no results, no pixels) and materializes it
 * into a BuiltDeck by executing every slide's analysis sequentially.
 * Slides execute one at a time (DuckDB is single-connection).
 * Fail-soft per slide: errors are recorded but do not abort the build.
 */

import { processAnalysisData } from '../core/analysis/analysisProcessor';
import { resolveSlideTitle, resolveSlideSubtitle } from '../core/export/resolveSlideDefaults';
import { recommendChart } from '../core/visualization/chartRecommender';
import { mapCrosstabRows } from '../core/analysis/mapCrosstabRows';
import type { CrosstabSqlRow } from '../core/analysis/crosstab/types';
import { exportPptx, exportXlsx } from '../core/export';
import type { AnalysisExportItem, ExportConfig } from '../core/export/types';
import type { Filter, Variable } from '../types';
import type {
  BuiltDeck,
  BuiltSlide,
  DatasetDescription,
  DeckBuildError,
  DeckExportOptions,
  DeckSpec,
  ResultEnvelope,
  SlideSpec,
} from './types';
import { VelocityError } from './types';

/**
 * Minimal interface for the engine methods DeckBuilder needs.
 * Structural typing avoids circular import from VelocityEngine.ts.
 */
interface DeckEngineInterface {
  runAnalysis(id: string, config: unknown): Promise<ResultEnvelope<unknown>>;
  describe(): ResultEnvelope<DatasetDescription>;
  getActiveFilters(): ResultEnvelope<Filter[]>;
}

export class DeckBuilder {
  constructor(private readonly engine: DeckEngineInterface) {}

  async build(spec: DeckSpec): Promise<ResultEnvelope<BuiltDeck>> {
    const startTime = performance.now();
    const slides: BuiltSlide[] = [];
    const errors: DeckBuildError[] = [];
    let slideIndex = 0;

    const description = this.engine.describe().data;
    const dataset = description.dataset;
    if (!dataset) {
      throw new VelocityError('NO_DATASET_LOADED', 'Cannot build deck: no dataset loaded.');
    }

    for (const section of spec.sections) {
      for (const slideSpec of section.slides) {
        try {
          const builtSlide = await this.buildSlide(slideSpec, section.title, slideIndex, description);
          slides.push(builtSlide);
        } catch (err) {
          const velocityError =
            err instanceof VelocityError
              ? err
              : new VelocityError('DECK_BUILD_FAILED', `Slide ${slideIndex} failed to build.`, err);
          errors.push({ slideIndex, sectionTitle: section.title, error: velocityError });
        }
        slideIndex++;
      }
    }

    const buildDurationMs = performance.now() - startTime;
    const deck: BuiltDeck = { spec, slides, errors, buildDurationMs };

    return {
      data: deck,
      operation: 'buildDeck',
      inputs: { deckTitle: spec.title, sectionCount: spec.sections.length },
      durationMs: buildDurationMs,
      warnings: errors.map((e) => `Slide ${e.slideIndex} (${e.sectionTitle}): ${e.error.message}`),
      metadata: {
        datasetName: dataset.name,
        rowCount: dataset.rowCount,
        filtersApplied: description.activeFilters.length,
        isWeighted: description.weightVariable !== null,
        engineVersion: 'engine',
      },
    };
  }

  private async buildSlide(
    slideSpec: SlideSpec,
    sectionTitle: string,
    slideIndex: number,
    description: DatasetDescription
  ): Promise<BuiltSlide> {
    const dataset = description.dataset!;

    // Validate row variables exist
    for (const varId of slideSpec.rowVars) {
      if (!dataset.variables.find((v) => v.id === varId)) {
        throw new VelocityError('INVALID_VARIABLE', `Unknown variable: ${varId}`, {
          slideIndex,
          available: dataset.variables.map((v) => v.id),
        });
      }
    }

    // Determine effective filters and weight (per-slide overrides, fall back to engine globals)
    const effectiveFilters: Filter[] =
      slideSpec.filters !== undefined ? slideSpec.filters : this.engine.getActiveFilters().data;
    const effectiveWeightVar: string | null =
      slideSpec.weightVar !== undefined
        ? slideSpec.weightVar
        : (description.weightVariable ?? null);

    // Execute crosstab analysis (passes explicit filters/weight — no engine state mutation)
    const result = await this.engine.runAnalysis('crosstab', {
      rowVars: slideSpec.rowVars,
      colVar: slideSpec.colVar ?? null,
      filters: effectiveFilters,
      weightVar: effectiveWeightVar,
    });

    // Extract rows from the crosstab result and convert from raw DuckDB format
    // (rowKey_0, rowKey_1 ...) to AggregatedRow format (rowKeys: string[]).
    const crosstabData = result.data as { rows: CrosstabSqlRow[]; tableStats?: unknown } | null;
    const rawRows = crosstabData?.rows ?? [];
    const rows = mapCrosstabRows(rawRows, !!effectiveWeightVar);

    // Resolve Variable objects for the slide
    const rowVariables: Variable[] = slideSpec.rowVars
      .map((varId) => dataset.variables.find((v) => v.id === varId))
      .filter((v): v is Variable => v !== undefined);

    const colVariable: Variable | null = slideSpec.colVar
      ? (dataset.variables.find((v) => v.id === slideSpec.colVar!) ?? null)
      : null;

    // Process raw rows into visualization-ready structure
    const processed = processAnalysisData({
      data: rows,
      rowVariables,
      colVariable,
      isWeighted: !!effectiveWeightVar,
      isMultipleResponse: false,
    });

    if (!processed) {
      throw new VelocityError(
        'ANALYSIS_FAILED',
        `Slide ${slideIndex}: analysis returned no data for vars [${slideSpec.rowVars.join(', ')}].`
      );
    }

    // Resolve defaults
    const resolvedTitle = slideSpec.title ?? resolveSlideTitle(rowVariables, colVariable);
    const weightVarObj = effectiveWeightVar
      ? (dataset.variables.find((v) => v.id === effectiveWeightVar) ?? null)
      : null;
    const resolvedSubtitle =
      slideSpec.subtitle ??
      resolveSlideSubtitle(
        effectiveFilters,
        weightVarObj,
        result.metadata.rowCount,
        !!effectiveWeightVar
      );

    const resolvedChartType =
      slideSpec.chartType ??
      (slideSpec.visualizationType === 'chart'
        ? recommendChart({
            rowVars: rowVariables,
            colVar: colVariable,
            isGrid: processed.isGrid,
            isMultiResponse: processed.isMultipleResponse,
          }).default
        : undefined);

    return {
      spec: slideSpec,
      sectionTitle,
      result,
      processed,
      resolvedTitle,
      resolvedSubtitle,
      resolvedChartType,
    };
  }

  async export(deck: BuiltDeck, options: DeckExportOptions): Promise<Uint8Array> {
    // Build sections list from the deck spec
    const sections = deck.spec.sections.map((section, i) => ({
      id: `section-${i}`,
      title: section.title,
    }));

    // Map each BuiltSlide to an AnalysisExportItem
    const analyses: AnalysisExportItem[] = deck.slides.map((slide) => {
      const sectionIndex = deck.spec.sections.findIndex(
        (s) => s.title === slide.sectionTitle
      );
      return {
        label: slide.resolvedTitle,
        subtitle: slide.resolvedSubtitle,
        notes: slide.spec.notes,
        sectionId: sectionIndex >= 0 ? `section-${sectionIndex}` : undefined,
        result: slide.processed,
        visualizationType: slide.spec.visualizationType,
        chartType: slide.resolvedChartType,
        options: {
          showSignificance: slide.spec.displayOptions?.showSignificance,
          showPercents: slide.spec.displayOptions?.showPercents,
          showCounts: slide.spec.displayOptions?.showCounts,
        },
      };
    });

    const config: ExportConfig = {
      title: deck.spec.title,
      analyses,
      sections,
      branding: options.branding ?? deck.spec.branding,
    };

    if (options.format === 'pptx') {
      return exportPptx(config);
    }
    if (options.format === 'xlsx') {
      return exportXlsx(config);
    }

    throw new VelocityError(
      'UNSUPPORTED_FORMAT',
      `Unsupported export format: ${options.format}`
    );
  }
}
