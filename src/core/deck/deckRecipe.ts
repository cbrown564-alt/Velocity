import type { Filter } from '../../types';
import type { Slide, SlideAnalysisState, SlideSection } from '../../types/slides';
import type { ChartType } from '../../types/charts';
import type { ExportBranding } from '../export/types';
import type { SlideRecipe } from '../export/slideRecipe';
import { slideToRecipe } from '../export/slideRecipe';

export const DECK_RECIPE_VERSION = 1 as const;

export interface DeckRecipeSection {
  id: string;
  title: string;
  color?: string;
}

export interface DeckRecipe {
  recipeVersion: typeof DECK_RECIPE_VERSION;
  title?: string;
  subtitle?: string;
  branding?: ExportBranding;
  sections: DeckRecipeSection[];
  slideRecipes: SlideRecipe[];
}

export type SessionDeckRecipe = DeckRecipe;
export type SessionDeckRecipeSection = DeckRecipeSection;

export interface DeckSlideSpec {
  rowVars: string[];
  colVar?: string | null;
  filters?: Filter[];
  weightVar?: string | null;
  title?: string;
  subtitle?: string;
  notes?: string;
  visualizationType?: 'table' | 'chart';
  chartType?: ChartType;
  displayOptions?: {
    showSignificance?: boolean;
    showPercents?: boolean;
    showCounts?: boolean;
  };
}

export interface DeckSectionSpec {
  title: string;
  slides: DeckSlideSpec[];
}

export interface DeckSpecShape {
  title: string;
  subtitle?: string;
  branding?: ExportBranding;
  sections: DeckSectionSpec[];
}

function cloneFilter(filter: Filter): Filter {
  return { ...filter, value: Array.isArray(filter.value) ? [...filter.value] : filter.value };
}

function cloneAnalysisState(analysisState: SlideAnalysisState): SlideAnalysisState {
  return {
    rowVars: [...analysisState.rowVars],
    colVar: analysisState.colVar,
    filters: analysisState.filters.map(cloneFilter),
    weightVar: analysisState.weightVar,
  };
}

export function slideRecipeToSlideSpec(recipe: SlideRecipe): DeckSlideSpec {
  return {
    rowVars: [...recipe.analysisState.rowVars],
    colVar: recipe.analysisState.colVar,
    filters: recipe.analysisState.filters.map(cloneFilter),
    weightVar: recipe.analysisState.weightVar,
    title: recipe.title,
    subtitle: recipe.subtitle,
    notes: recipe.notes,
    visualizationType: recipe.visualizationType,
    chartType: recipe.chartType,
  };
}

export function slideSpecToSlideRecipe(spec: DeckSlideSpec, slideId: string, sectionId?: string): SlideRecipe {
  return {
    slideId,
    title: spec.title ?? '',
    subtitle: spec.subtitle ?? '',
    notes: spec.notes,
    analysisState: {
      rowVars: [...spec.rowVars],
      colVar: spec.colVar ?? null,
      filters: (spec.filters ?? []).map(cloneFilter),
      weightVar: spec.weightVar ?? null,
    },
    visualizationType: spec.visualizationType ?? 'table',
    chartType: spec.chartType,
    sectionId,
  };
}

export function buildDeckRecipe(
  slides: Slide[],
  sections: SlideSection[],
  metadata?: Pick<DeckRecipe, 'title' | 'subtitle' | 'branding'>,
): DeckRecipe {
  return {
    recipeVersion: DECK_RECIPE_VERSION,
    title: metadata?.title,
    subtitle: metadata?.subtitle,
    branding: metadata?.branding,
    sections: sections.map((section) => ({ id: section.id, title: section.title, color: section.color })),
    slideRecipes: slides.map((slide) => ({
      ...slideToRecipe(slide),
      analysisState: cloneAnalysisState(slide.analysisState),
    })),
  };
}

export function deckRecipeToDeckSpec(recipe: DeckRecipe): DeckSpecShape {
  const sectionSlides = new Map<string, DeckSlideSpec[]>(recipe.sections.map((section) => [section.id, []]));
  const unsectioned: DeckSlideSpec[] = [];
  for (const slideRecipe of recipe.slideRecipes) {
    const slideSpec = slideRecipeToSlideSpec(slideRecipe);
    if (slideRecipe.sectionId && sectionSlides.has(slideRecipe.sectionId)) {
      sectionSlides.get(slideRecipe.sectionId)!.push(slideSpec);
    } else {
      unsectioned.push(slideSpec);
    }
  }
  const sections: DeckSectionSpec[] = recipe.sections.map((section) => ({
    title: section.title,
    slides: sectionSlides.get(section.id) ?? [],
  }));
  if (unsectioned.length > 0) sections.push({ title: 'Slides', slides: unsectioned });
  if (sections.every((section) => section.slides.length === 0) && recipe.slideRecipes.length > 0) {
    return {
      title: recipe.title?.trim() || 'Analysis Report',
      subtitle: recipe.subtitle,
      branding: recipe.branding,
      sections: [{ title: 'Slides', slides: recipe.slideRecipes.map(slideRecipeToSlideSpec) }],
    };
  }
  return {
    title: recipe.title?.trim() || 'Analysis Report',
    subtitle: recipe.subtitle,
    branding: recipe.branding,
    sections,
  };
}

export function deckSpecToDeckRecipe(spec: DeckSpecShape, sectionIds?: string[]): DeckRecipe {
  const sections: DeckRecipeSection[] = spec.sections.map((section, index) => ({
    id: sectionIds?.[index] ?? `section-${index}`,
    title: section.title,
  }));
  const slideRecipes: SlideRecipe[] = [];
  spec.sections.forEach((section, sectionIndex) => {
    const sectionId = sections[sectionIndex]?.id;
    section.slides.forEach((slideSpec, slideIndex) => {
      slideRecipes.push(slideSpecToSlideRecipe(slideSpec, `slide-${sectionIndex}-${slideIndex}`, sectionId));
    });
  });
  return {
    recipeVersion: DECK_RECIPE_VERSION,
    title: spec.title,
    subtitle: spec.subtitle,
    branding: spec.branding,
    sections,
    slideRecipes,
  };
}

export function filterDeckRecipe(recipe: DeckRecipe, slideIds: string[]): DeckRecipe {
  const slideIdSet = new Set(slideIds);
  return { ...recipe, slideRecipes: recipe.slideRecipes.filter((slide) => slideIdSet.has(slide.slideId)) };
}

export function applyAnalysisStateOverrides(
  recipe: DeckRecipe,
  overrides: Record<string, SlideAnalysisState>,
): DeckRecipe {
  if (Object.keys(overrides).length === 0) return recipe;
  return {
    ...recipe,
    slideRecipes: recipe.slideRecipes.map((slide) =>
      overrides[slide.slideId] ? { ...slide, analysisState: cloneAnalysisState(overrides[slide.slideId]) } : slide,
    ),
  };
}

export function findStaleDeckRecipeSlideIds(recipe: DeckRecipe | undefined, slides: Slide[]): string[] {
  if (!recipe) return [];
  const validSlideIds = new Set(slides.map((slide) => slide.id));
  return recipe.slideRecipes.map((slide) => slide.slideId).filter((slideId) => !validSlideIds.has(slideId));
}
