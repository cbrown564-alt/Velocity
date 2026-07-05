import type { ProcessedAnalysisData } from '../../types/processedData';
import type { ChartType } from '../../types/charts';
import type { SlideSection } from '../../types/slides';
import type { DeckRecipeSection } from '../deck/deckRecipe';
import type { AnalysisExportItem, ExportBranding, ExportConfig, TemplateExportOptions } from './types';

export interface MaterializedSlideDisplayOptions {
  showSignificance: boolean;
  showPercents: boolean;
  showCounts: boolean;
}

export interface MaterializedSlide {
  slideId: string;
  label: string;
  subtitle?: string;
  notes?: string;
  sectionId?: string;
  result: ProcessedAnalysisData;
  visualizationType: 'table' | 'chart';
  chartType?: ChartType;
  options: MaterializedSlideDisplayOptions;
}

export interface MaterializedDeck {
  title: string;
  subtitle?: string;
  sections: DeckRecipeSection[];
  slides: MaterializedSlide[];
  branding?: ExportBranding;
}

export interface MaterializedDeckExportOptions {
  templateOptions?: TemplateExportOptions;
}

const DEFAULT_DISPLAY_OPTIONS: MaterializedSlideDisplayOptions = {
  showSignificance: true,
  showPercents: true,
  showCounts: false,
};

export function materializedDeckToExportConfig(
  deck: MaterializedDeck,
  options?: MaterializedDeckExportOptions,
): ExportConfig {
  const sectionIdSet = new Set(deck.sections.map((section) => section.id));
  const sections: SlideSection[] = deck.sections.map((section) => ({
    id: section.id,
    title: section.title,
    color: section.color,
  }));
  const analyses: AnalysisExportItem[] = deck.slides.map((slide) => ({
    label: slide.label,
    subtitle: slide.subtitle,
    notes: slide.notes,
    sectionId: slide.sectionId && sectionIdSet.has(slide.sectionId) ? slide.sectionId : undefined,
    result: slide.result,
    visualizationType: slide.visualizationType,
    viewType: slide.visualizationType,
    chartType: slide.chartType,
    options: slide.options,
  }));
  return {
    title: deck.title,
    analyses,
    sections: sections.length > 0 ? sections : undefined,
    branding: deck.branding,
    templateOptions: options?.templateOptions,
  };
}

export function mergeDisplayOptions(
  overrides?: Partial<MaterializedSlideDisplayOptions>,
): MaterializedSlideDisplayOptions {
  return { ...DEFAULT_DISPLAY_OPTIONS, ...overrides };
}
