import { describe, expect, it } from 'vitest';
import type { Slide } from '../../types/slides';
import {
  applyAnalysisStateOverrides,
  buildDeckRecipe,
  deckRecipeToDeckSpec,
  deckSpecToDeckRecipe,
  filterDeckRecipe,
  findStaleDeckRecipeSlideIds,
  slideRecipeToSlideSpec,
  slideSpecToSlideRecipe,
} from './deckRecipe';

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  const now = Date.now();
  return {
    id: 'slide-1',
    title: 'Age by Sex',
    subtitle: 'N = 100',
    analysisState: { rowVars: ['vs_age'], colVar: 'vs_sex', filters: [], weightVar: null },
    visualizationType: 'table',
    layoutMode: 'focus',
    cells: [{ id: 'cell-1', content: { type: 'table' } }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('buildDeckRecipe', () => {
  it('captures slide content and section metadata', () => {
    const recipe = buildDeckRecipe(
      [makeSlide({ sectionId: 'section-main' })],
      [{ id: 'section-main', title: 'Main' }],
      { title: 'Tracker Wave 4' },
    );
    expect(recipe.recipeVersion).toBe(1);
    expect(recipe.slideRecipes[0].sectionId).toBe('section-main');
  });
});

describe('deckRecipeToDeckSpec', () => {
  it('groups slide recipes under section titles', () => {
    const recipe = buildDeckRecipe(
      [makeSlide({ id: 'slide-a', sectionId: 'section-main' }), makeSlide({ id: 'slide-b' })],
      [{ id: 'section-main', title: 'Main findings' }],
    );
    const spec = deckRecipeToDeckSpec(recipe);
    expect(spec.sections[0].title).toBe('Main findings');
    expect(spec.sections[1].title).toBe('Slides');
  });
});

describe('filterDeckRecipe', () => {
  it('scopes export to selected slide ids', () => {
    const recipe = buildDeckRecipe([makeSlide({ id: 'slide-a' }), makeSlide({ id: 'slide-b' })], []);
    expect(filterDeckRecipe(recipe, ['slide-b']).slideRecipes.map((s) => s.slideId)).toEqual(['slide-b']);
  });
});

describe('applyAnalysisStateOverrides', () => {
  it('applies live analysis overrides', () => {
    const recipe = buildDeckRecipe([makeSlide({ id: 'slide-a' })], []);
    const updated = applyAnalysisStateOverrides(recipe, {
      'slide-a': { rowVars: ['sex'], colVar: null, filters: [], weightVar: 'wt' },
    });
    expect(updated.slideRecipes[0].analysisState.weightVar).toBe('wt');
  });
});

describe('deckSpecToDeckRecipe', () => {
  it('round-trips sectioned deck specs', () => {
    const recipe = buildDeckRecipe([makeSlide()], [{ id: 'section-main', title: 'Main' }], { title: 'Round trip' });
    const restored = deckSpecToDeckRecipe(deckRecipeToDeckSpec(recipe), ['section-main']);
    expect(restored.slideRecipes[0].analysisState.rowVars).toEqual(['vs_age']);
  });
});

describe('slideRecipeToSlideSpec', () => {
  it('maps slide recipes to engine specs', () => {
    const recipe = buildDeckRecipe([makeSlide({ notes: 'Insight' })], []);
    expect(slideRecipeToSlideSpec(recipe.slideRecipes[0]).notes).toBe('Insight');
  });
});

describe('slideSpecToSlideRecipe', () => {
  it('assigns stable ids when converting engine specs', () => {
    const slideRecipe = slideSpecToSlideRecipe(
      { rowVars: ['vs_age'], colVar: 'vs_sex', title: 'Generated' },
      'generated-slide',
      'section-main',
    );
    expect(slideRecipe.slideId).toBe('generated-slide');
    expect(slideRecipe.sectionId).toBe('section-main');
  });
});

describe('findStaleDeckRecipeSlideIds', () => {
  it('flags slide ids missing from the live deck', () => {
    const recipe = buildDeckRecipe([makeSlide({ id: 'slide-a' })], []);
    expect(findStaleDeckRecipeSlideIds(recipe, [makeSlide({ id: 'slide-b' })])).toEqual(['slide-a']);
  });
});
