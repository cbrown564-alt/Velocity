import type { ChartType } from '../../types/charts';
import type { Slide, SlideSection } from '../../types/slides';

export interface DeckTemplateSlideBinding {
  title: string;
  subtitle?: string;
  rowVariableName: string;
  visualizationType?: 'table' | 'chart';
  chartType?: ChartType;
}

export interface DeckTemplateDefinition {
  id: string;
  sectionTitle: string;
  weightVariableName?: string;
  slides: DeckTemplateSlideBinding[];
}

export interface MaterializedDeckTemplate {
  slides: Slide[];
  sections: SlideSection[];
  activeSlideId: string;
  activeCellId: string | null;
  unresolvedBindings: string[];
}
