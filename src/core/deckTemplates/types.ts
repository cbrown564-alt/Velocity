import type { ChartType } from '../../types/charts';

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
  slides: import('../../types/slides').Slide[];
  sections: import('../../types/slides').SlideSection[];
  activeSlideId: string;
  activeCellId: string | null;
  unresolvedBindings: string[];
}
