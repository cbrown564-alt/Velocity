import type { DeckSpec } from './types';
import { VelocityError } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidDeckSpec(message: string, details?: Record<string, unknown>): never {
  throw new VelocityError('INVALID_DECK_SPEC', message, details);
}

function assertStringArray(value: unknown, message: string, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    invalidDeckSpec(message, { path });
  }
}

function assertOptionalStringOrNull(value: unknown, message: string, path: string): void {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    invalidDeckSpec(message, { path });
  }
}

export function assertValidDeckSpec(spec: unknown): asserts spec is DeckSpec {
  if (!isRecord(spec)) {
    invalidDeckSpec('Deck spec must be an object.', { path: 'spec' });
  }

  if (typeof spec.title !== 'string') {
    invalidDeckSpec('Deck spec must include a title string.', { path: 'spec.title' });
  }

  if (!Array.isArray(spec.sections)) {
    invalidDeckSpec('Deck spec must include a sections array.', { path: 'spec.sections' });
  }

  spec.sections.forEach((section, sectionIndex) => {
    const sectionNumber = sectionIndex + 1;
    if (!isRecord(section)) {
      invalidDeckSpec(`Deck spec section ${sectionNumber} must be an object.`, {
        path: `spec.sections.${sectionIndex}`,
      });
    }

    if (typeof section.title !== 'string') {
      invalidDeckSpec(`Deck spec section ${sectionNumber} must include a title string.`, {
        path: `spec.sections.${sectionIndex}.title`,
      });
    }

    if (!Array.isArray(section.slides)) {
      invalidDeckSpec(`Deck spec section ${sectionNumber} must include a slides array.`, {
        path: `spec.sections.${sectionIndex}.slides`,
      });
    }

    section.slides.forEach((slide, slideIndex) => {
      const slideNumber = slideIndex + 1;
      const slidePath = `spec.sections.${sectionIndex}.slides.${slideIndex}`;
      if (!isRecord(slide)) {
        invalidDeckSpec(`Deck spec section ${sectionNumber} slide ${slideNumber} must be an object.`, {
          path: slidePath,
        });
      }

      assertStringArray(
        slide.rowVars,
        `Deck spec section ${sectionNumber} slide ${slideNumber} must include a rowVars string array.`,
        `${slidePath}.rowVars`
      );
      assertOptionalStringOrNull(
        slide.colVar,
        `Deck spec section ${sectionNumber} slide ${slideNumber} colVar must be a string or null.`,
        `${slidePath}.colVar`
      );
      assertOptionalStringOrNull(
        slide.weightVar,
        `Deck spec section ${sectionNumber} slide ${slideNumber} weightVar must be a string or null.`,
        `${slidePath}.weightVar`
      );

      if (slide.filters !== undefined) {
        if (!Array.isArray(slide.filters)) {
          invalidDeckSpec(
            `Deck spec section ${sectionNumber} slide ${slideNumber} filters must be an array.`,
            { path: `${slidePath}.filters` }
          );
        }

        slide.filters.forEach((filter, filterIndex) => {
          if (!isRecord(filter) || typeof filter.variableId !== 'string') {
            invalidDeckSpec(
              `Deck spec section ${sectionNumber} slide ${slideNumber} filter ${filterIndex + 1} must include a variableId string.`,
              { path: `${slidePath}.filters.${filterIndex}.variableId` }
            );
          }
        });
      }
    });
  });
}
