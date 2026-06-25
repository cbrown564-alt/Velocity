import { describe, expect, it } from 'vitest';
import type { SlideRecipe } from './slideRecipe';
import {
  canApplyTemplate,
  extractTemplateMetadata,
  mapTemplatePlaceholders,
  type TemplateMapping,
} from './templateMapping';

const recipes: SlideRecipe[] = [
  {
    slideId: 'slide-1',
    title: 'Age by Region',
    subtitle: 'Weighted results',
    notes: 'North over-indexes',
    analysisState: {
      rowVars: ['age'],
      colVar: 'region',
      filters: [],
      weightVar: 'wt',
    },
    visualizationType: 'table',
  },
];

describe('extractTemplateMetadata', () => {
  it('extracts unique placeholders from provided text chunks', async () => {
    const template = await extractTemplateMetadata({
      filename: 'client-template.pptx',
      arrayBuffer: new ArrayBuffer(0),
      extractedTexts: [
        '{{slide.title}}',
        '{{slide.subtitle}} and {{analysis.label}}',
        '{{slide.title}}',
      ],
    });

    expect(template.filename).toBe('client-template.pptx');
    expect(template.placeholders.map((placeholder) => placeholder.token)).toEqual([
      '{{slide.title}}',
      '{{slide.subtitle}}',
      '{{analysis.label}}',
    ]);
  });
});

describe('mapTemplatePlaceholders', () => {
  it('builds slot bindings from template placeholders and mapping config', () => {
    const mapping: TemplateMapping = {
      templateId: 'tmpl-1',
      bindings: [
        { placeholderId: 'placeholder-1', slot: 'slide.title' },
        { placeholderId: 'placeholder-2', slot: 'slide.subtitle' },
      ],
    };
    const applied = mapTemplatePlaceholders(
      {
        id: 'tmpl-1',
        filename: 'client-template.pptx',
        placeholders: [
          { id: 'placeholder-1', token: '{{slide.title}}', slideIndex: 1 },
          { id: 'placeholder-2', token: '{{slide.subtitle}}', slideIndex: 1 },
        ],
      },
      mapping,
      recipes
    );

    expect(applied.bindings).toEqual([
      {
        placeholderId: 'placeholder-1',
        token: '{{slide.title}}',
        slot: 'slide.title',
        resolvedValue: 'Age by Region',
        recipeId: 'slide-1',
      },
      {
        placeholderId: 'placeholder-2',
        token: '{{slide.subtitle}}',
        slot: 'slide.subtitle',
        resolvedValue: 'Weighted results',
        recipeId: 'slide-1',
      },
    ]);
  });
});

describe('canApplyTemplate', () => {
  it('returns applicable=true for complete valid bindings', () => {
    const issues = canApplyTemplate(
      {
        templateId: 'tmpl-1',
        bindings: [{ placeholderId: 'placeholder-1', slot: 'slide.title' }],
      },
      {
        id: 'tmpl-1',
        filename: 'client-template.pptx',
        placeholders: [{ id: 'placeholder-1', token: '{{slide.title}}' }],
      },
      recipes
    );

    expect(issues).toEqual([]);
  });

  it('reports blocking issues for missing placeholder or unresolved slot values', () => {
    const issues = canApplyTemplate(
      {
        templateId: 'tmpl-1',
        bindings: [
          { placeholderId: 'missing-id', slot: 'slide.title' },
          { placeholderId: 'placeholder-1', slot: 'slide.notes' },
        ],
      },
      {
        id: 'tmpl-1',
        filename: 'client-template.pptx',
        placeholders: [{ id: 'placeholder-1', token: '{{slide.notes}}' }],
      },
      [
        {
          ...recipes[0],
          notes: undefined,
        },
      ]
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'placeholder_missing', severity: 'block' }),
        expect.objectContaining({ code: 'slot_unresolved', severity: 'block' }),
      ])
    );
  });
});
