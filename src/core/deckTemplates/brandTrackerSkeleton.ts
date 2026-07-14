/**
 * Brand tracker funnel skeleton (DESIGN-CONV-E).
 */
import type { Slide, SlideAnalysisState, SlideSection } from '../../types/slides';
import type { Variable, VariableSet } from '../../types';
import { findVariableIdByName, findVariableSetIdByVariableName } from './resolveTemplateBindings';
import type { DeckTemplateDefinition, MaterializedDeckTemplate } from './types';

export const BRAND_TRACKER_FUNNEL_TEMPLATE: DeckTemplateDefinition = {
  id: 'brand-tracker-funnel-skeleton',
  sectionTitle: 'The funnel',
  weightVariableName: 'wt',
  slides: [
    {
      title: 'Awareness',
      subtitle: 'Replace variables via the insert palette',
      rowVariableName: 'aware_atlas',
      visualizationType: 'chart',
      chartType: 'horizontal-bar',
    },
    {
      title: 'Consideration',
      subtitle: 'Replace variables via the insert palette',
      rowVariableName: 'consider_atlas',
      visualizationType: 'chart',
      chartType: 'horizontal-bar',
    },
    {
      title: 'Preference',
      subtitle: 'Replace variables via the insert palette',
      rowVariableName: 'brand_pref',
      visualizationType: 'chart',
      chartType: 'horizontal-bar',
    },
  ],
};

function createDefaultAnalysisState(overrides: Partial<SlideAnalysisState> = {}): SlideAnalysisState {
  return { rowVars: [], colVar: null, filters: [], weightVar: null, ...overrides };
}

function createTemplateSlide(
  id: string,
  binding: DeckTemplateDefinition['slides'][number],
  sectionId: string,
  rowSetId: string | null,
  weightVar: string | null,
  createdAt: number,
): Slide {
  return {
    id,
    title: binding.title,
    subtitle: binding.subtitle ?? '',
    analysisState: createDefaultAnalysisState({ rowVars: rowSetId ? [rowSetId] : [], weightVar }),
    visualizationType: binding.visualizationType ?? 'table',
    chartType: binding.chartType,
    layoutMode: 'focus',
    cells: [
      { id: `${id}-cell`, content: { type: binding.visualizationType ?? 'table', chartType: binding.chartType } },
    ],
    sectionId,
    createdAt,
    updatedAt: createdAt,
  };
}

export function materializeDeckTemplate(
  template: DeckTemplateDefinition,
  variableSets: VariableSet[],
  variables: Variable[],
  options?: { now?: number },
): MaterializedDeckTemplate {
  const now = options?.now ?? Date.now();
  const sectionId = `section-${template.id}`;
  const section: SlideSection = { id: sectionId, title: template.sectionTitle };
  const weightVar = template.weightVariableName ? findVariableIdByName(variables, [template.weightVariableName]) : null;
  const unresolvedBindings: string[] = [];
  const slides = template.slides.map((binding, index) => {
    const slideId = `template-slide-${index + 1}`;
    const rowSetId = findVariableSetIdByVariableName(variableSets, variables, [binding.rowVariableName]);
    if (!rowSetId) unresolvedBindings.push(binding.rowVariableName);
    return createTemplateSlide(slideId, binding, sectionId, rowSetId, weightVar, now + index);
  });
  const activeSlide = slides[0];
  return {
    slides,
    sections: [section],
    activeSlideId: activeSlide.id,
    activeCellId: activeSlide.cells[0]?.id ?? null,
    unresolvedBindings,
  };
}

export function materializeBrandTrackerFunnelSkeleton(
  variableSets: VariableSet[],
  variables: Variable[],
  options?: { now?: number },
): MaterializedDeckTemplate {
  return materializeDeckTemplate(BRAND_TRACKER_FUNNEL_TEMPLATE, variableSets, variables, options);
}
