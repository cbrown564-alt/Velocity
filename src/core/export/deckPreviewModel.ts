import type { MaterializedDeck, MaterializedSlideDisplayOptions } from './materializedDeck';
import { materializedDeckToExportConfig } from './materializedDeck';

export interface DeckPreviewSlide {
  slideId: string;
  title: string;
  subtitle?: string;
  notes?: string;
  sectionId?: string;
  visualizationType: 'table' | 'chart';
  chartType?: string;
  rowCount: number;
  columnCount: number;
  options: MaterializedSlideDisplayOptions;
}

export interface DeckPreviewModel {
  title: string;
  subtitle?: string;
  slideCount: number;
  slides: DeckPreviewSlide[];
}

export function buildDeckPreviewModel(deck: MaterializedDeck): DeckPreviewModel {
  return {
    title: deck.title,
    subtitle: deck.subtitle,
    slideCount: deck.slides.length,
    slides: deck.slides.map((slide) => ({
      slideId: slide.slideId,
      title: slide.label,
      subtitle: slide.subtitle,
      notes: slide.notes,
      sectionId: slide.sectionId,
      visualizationType: slide.visualizationType,
      chartType: slide.chartType,
      rowCount: slide.result.rows.length,
      columnCount: slide.result.columns.length,
      options: slide.options,
    })),
  };
}

export interface DeckExportStructuralSnapshot {
  title: string;
  slideCount: number;
  slides: Array<{
    slideId: string;
    label: string;
    subtitle?: string;
    sectionId?: string;
    visualizationType: 'table' | 'chart';
    chartType?: string;
    options: MaterializedSlideDisplayOptions;
  }>;
}

export function buildDeckExportStructuralSnapshot(deck: MaterializedDeck): DeckExportStructuralSnapshot {
  const exportConfig = materializedDeckToExportConfig(deck);
  return {
    title: exportConfig.title,
    slideCount: exportConfig.analyses.length,
    slides: exportConfig.analyses.map((analysis, index) => ({
      slideId: deck.slides[index]?.slideId ?? `slide-${index}`,
      label: analysis.label,
      subtitle: analysis.subtitle,
      sectionId: analysis.sectionId,
      visualizationType: analysis.visualizationType ?? analysis.viewType ?? 'table',
      chartType: analysis.chartType,
      options: {
        showSignificance: analysis.options?.showSignificance ?? true,
        showPercents: analysis.options?.showPercents ?? true,
        showCounts: analysis.options?.showCounts ?? false,
      },
    })),
  };
}

export function assertPreviewExportStructuralParity(deck: MaterializedDeck): void {
  const preview = buildDeckPreviewModel(deck);
  const exportSnapshot = buildDeckExportStructuralSnapshot(deck);
  if (preview.slideCount !== exportSnapshot.slideCount) {
    throw new Error(`Preview/export slide count mismatch: ${preview.slideCount} vs ${exportSnapshot.slideCount}`);
  }
  for (let index = 0; index < preview.slides.length; index += 1) {
    const previewSlide = preview.slides[index];
    const exportSlide = exportSnapshot.slides[index];
    if (previewSlide.slideId !== exportSlide.slideId) throw new Error(`Slide id mismatch at index ${index}`);
    if (previewSlide.title !== exportSlide.label) throw new Error(`Slide title mismatch at index ${index}`);
    if (previewSlide.subtitle !== exportSlide.subtitle) throw new Error(`Slide subtitle mismatch at index ${index}`);
    if (previewSlide.sectionId !== exportSlide.sectionId) throw new Error(`Slide section mismatch at index ${index}`);
    if (previewSlide.visualizationType !== exportSlide.visualizationType)
      throw new Error(`Slide visualization mismatch at index ${index}`);
    if (previewSlide.chartType !== exportSlide.chartType)
      throw new Error(`Slide chart type mismatch at index ${index}`);
    if (JSON.stringify(previewSlide.options) !== JSON.stringify(exportSlide.options))
      throw new Error(`Slide display options mismatch at index ${index}`);
  }
}
