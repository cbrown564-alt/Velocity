import { describe, expect, it } from 'vitest';
import type { Variable, VariableSet } from '../../types';
import type { Slide } from '../../types/slides';
import {
  assessDatasetReplacement,
  buildExportReview,
  slideToRecipe,
  slidesToRecipes,
} from './slideRecipe';

const variables: Variable[] = [
  { id: 'age', name: 'age', label: 'Age', type: 'numeric', valueLabels: [], missingValues: {} },
  { id: 'sex', name: 'sex', label: 'Sex', type: 'nominal', valueLabels: [], missingValues: {} },
  { id: 'region', name: 'region', label: 'Region', type: 'nominal', valueLabels: [], missingValues: {} },
  { id: 'wt', name: 'wt', label: 'Weight', type: 'numeric', valueLabels: [], missingValues: {} },
];

const variableSets: VariableSet[] = [
  {
    id: 'vs_age',
    name: 'Age',
    variableIds: ['age'],
    structure: 'single',
    type: 'numeric',
  },
  {
    id: 'vs_sex',
    name: 'Sex',
    variableIds: ['sex'],
    structure: 'single',
    type: 'nominal',
  },
  {
    id: 'vs_region',
    name: 'Region',
    variableIds: ['region'],
    structure: 'single',
    type: 'nominal',
  },
];

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  const now = Date.now();
  return {
    id: 'slide-1',
    title: 'Age by Sex',
    subtitle: 'N = 100',
    analysisState: {
      rowVars: ['vs_age'],
      colVar: 'vs_sex',
      filters: [],
      weightVar: null,
    },
    visualizationType: 'table',
    layoutMode: 'focus',
    cells: [{ id: 'cell-1', content: { type: 'table' } }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('slideToRecipe', () => {
  it('captures the persisted analysis recipe for a slide', () => {
    const slide = makeSlide({ notes: 'Key finding' });

    expect(slideToRecipe(slide)).toEqual({
      slideId: 'slide-1',
      title: 'Age by Sex',
      subtitle: 'N = 100',
      notes: 'Key finding',
      analysisState: slide.analysisState,
      visualizationType: 'table',
      chartType: undefined,
      sectionId: undefined,
    });
  });
});

describe('slidesToRecipes', () => {
  it('preserves slide order for deck recipe persistence', () => {
    const slides = [
      makeSlide({ id: 'slide-a', title: 'First' }),
      makeSlide({ id: 'slide-b', title: 'Second' }),
    ];

    expect(slidesToRecipes(slides).map((recipe) => recipe.slideId)).toEqual(['slide-a', 'slide-b']);
  });
});

describe('assessDatasetReplacement', () => {
  it('reports ready when all slide recipe references resolve in the replacement dataset', () => {
    const assessment = assessDatasetReplacement([makeSlide()], variableSets, variables);

    expect(assessment.ready).toBe(true);
    expect(assessment.blockedSlides).toBe(0);
    expect(assessment.issues).toHaveLength(0);
  });

  it('flags missing row variables as blocking for wave replacement', () => {
    const slide = makeSlide({
      analysisState: {
        rowVars: ['vs_missing'],
        colVar: null,
        filters: [],
        weightVar: null,
      },
    });

    const assessment = assessDatasetReplacement([slide], variableSets, variables);

    expect(assessment.ready).toBe(false);
    expect(assessment.blockedSlides).toBe(1);
    expect(assessment.missingReferenceIds).toContain('vs_missing');
    expect(assessment.issues[0]).toMatchObject({
      slideId: 'slide-1',
      code: 'unresolved_row_var',
      severity: 'block',
    });
  });

  it('flags unresolved filters and weights as warnings when rows still resolve', () => {
    const slide = makeSlide({
      analysisState: {
        rowVars: ['vs_age'],
        colVar: null,
        filters: [{ id: 'f1', variableId: 'missing_filter', operator: 'eq', value: 'A' }],
        weightVar: 'missing_weight',
      },
    });

    const assessment = assessDatasetReplacement([slide], variableSets, variables);

    expect(assessment.ready).toBe(true);
    expect(assessment.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unresolved_filter_var', severity: 'warn' }),
        expect.objectContaining({ code: 'unresolved_weight_var', severity: 'warn' }),
      ])
    );
  });
});

describe('buildExportReview', () => {
  it('allows export when every selected slide resolves', () => {
    const review = buildExportReview({
      slides: [makeSlide()],
      slideIds: ['slide-1'],
      variableSets,
      variables,
    });

    expect(review.canExport).toBe(true);
    expect(review.slideCount).toBe(1);
    expect(review.blockedSlideCount).toBe(0);
  });

  it('blocks export when a selected slide has no row variables', () => {
    const slide = makeSlide({
      analysisState: {
        rowVars: [],
        colVar: null,
        filters: [],
        weightVar: null,
      },
    });

    const review = buildExportReview({
      slides: [slide],
      slideIds: ['slide-1'],
      variableSets,
      variables,
    });

    expect(review.canExport).toBe(false);
    expect(review.blockedSlideCount).toBe(1);
    expect(review.issues[0]).toMatchObject({
      code: 'no_row_vars',
      severity: 'block',
    });
  });

  it('blocks export when a selected slide row recipe cannot resolve', () => {
    const slide = makeSlide({
      analysisState: {
        rowVars: ['vs_missing'],
        colVar: null,
        filters: [],
        weightVar: null,
      },
    });

    const review = buildExportReview({
      slides: [slide],
      slideIds: ['slide-1'],
      variableSets,
      variables,
    });

    expect(review.canExport).toBe(false);
    expect(review.issues[0]).toMatchObject({
      code: 'unresolved_row_var',
      referenceId: 'vs_missing',
    });
  });

  it('ignores slides outside the export scope', () => {
    const brokenSlide = makeSlide({
      id: 'slide-broken',
      analysisState: {
        rowVars: ['vs_missing'],
        colVar: null,
        filters: [],
        weightVar: null,
      },
    });

    const review = buildExportReview({
      slides: [makeSlide(), brokenSlide],
      slideIds: ['slide-1'],
      variableSets,
      variables,
    });

    expect(review.canExport).toBe(true);
    expect(review.slideCount).toBe(1);
  });
});
