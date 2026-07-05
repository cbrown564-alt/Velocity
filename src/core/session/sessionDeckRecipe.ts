import type { Slide, SlideSection } from '../../types/slides';
import { buildDeckRecipe, findStaleDeckRecipeSlideIds, type SessionDeckRecipe } from '../deck/deckRecipe';

export type { SessionDeckRecipe, SessionDeckRecipeSection } from '../deck/deckRecipe';

export function buildSessionDeckRecipe(slides: Slide[], sections: SlideSection[]): SessionDeckRecipe {
  return buildDeckRecipe(slides, sections);
}

export { findStaleDeckRecipeSlideIds };
