import type { Filter } from '../../types/analysis';
import type { Slide, SlideAnalysisState, SlideSection } from '../../types/slides';
import type { SlideRecipe } from '../export/slideRecipe';
import type { SessionDeckRecipe, SessionDeckRecipeSection } from './sessionTypes';

function cloneFilter(filter: Filter): Filter {
  return {
    ...filter,
    value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
  };
}

function cloneAnalysisState(analysisState: SlideAnalysisState): SlideAnalysisState {
  return {
    rowVars: [...analysisState.rowVars],
    colVar: analysisState.colVar,
    filters: analysisState.filters.map(cloneFilter),
    weightVar: analysisState.weightVar,
  };
}

function slideToSessionRecipe(slide: Slide): SlideRecipe {
  return {
    slideId: slide.id,
    title: slide.title,
    subtitle: slide.subtitle,
    notes: slide.notes,
    analysisState: cloneAnalysisState(slide.analysisState),
    visualizationType: slide.visualizationType,
    chartType: slide.chartType,
    sectionId: slide.sectionId,
  };
}

function sectionToRecipeSection(section: SlideSection): SessionDeckRecipeSection {
  return {
    id: section.id,
    title: section.title,
    color: section.color,
  };
}

export function buildSessionDeckRecipe(
  slides: Slide[],
  sections: SlideSection[]
): SessionDeckRecipe {
  return {
    recipeVersion: 1,
    sections: sections.map(sectionToRecipeSection),
    slideRecipes: slides.map(slideToSessionRecipe),
  };
}

export function findStaleDeckRecipeSlideIds(
  deckRecipe: SessionDeckRecipe | undefined,
  slides: Slide[]
): string[] {
  if (!deckRecipe) return [];
  const validSlideIds = new Set(slides.map((slide) => slide.id));
  return deckRecipe.slideRecipes
    .map((recipe) => recipe.slideId)
    .filter((slideId) => !validSlideIds.has(slideId));
}
