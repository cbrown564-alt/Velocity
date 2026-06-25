import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { SlideRecipe } from './slideRecipe';
import {
  applyTemplateBindingsToPptx,
  buildDefaultTemplateMapping,
  buildTemplateApplicabilityReview,
  canApplyTemplate,
  extractTemplateMetadata,
  extractTemplateMetadataFromPptxBinary,
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
  {
    slideId: 'slide-2',
    title: 'Gender by Wave',
    subtitle: 'Wave 2',
    notes: 'Refresh wave placeholders',
    analysisState: {
      rowVars: ['gender'],
      colVar: 'wave',
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

  it('uses slideIndex to resolve bindings per recipe for wave refresh', () => {
    const mapping: TemplateMapping = {
      templateId: 'tmpl-1',
      bindings: [{ placeholderId: 'placeholder-2', slot: 'slide.title' }],
    };

    const applied = mapTemplatePlaceholders(
      {
        id: 'tmpl-1',
        filename: 'client-template.pptx',
        placeholders: [
          { id: 'placeholder-2', token: '{{slide.title}}', slideIndex: 2 },
        ],
        diagnostics: [],
      },
      mapping,
      recipes
    );

    expect(applied.bindings).toEqual([
      expect.objectContaining({
        placeholderId: 'placeholder-2',
        recipeId: 'slide-2',
        resolvedValue: 'Gender by Wave',
      }),
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

describe('buildTemplateApplicabilityReview', () => {
  it('warns when template mode is enabled without a configured template', () => {
    const issues = buildTemplateApplicabilityReview({
      recipes,
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'template_missing',
        severity: 'warn',
      }),
    ]);
  });

  it('returns blocking issues when a mapping is provided without template binary', () => {
    const issues = buildTemplateApplicabilityReview({
      mapping: {
        templateId: 'tmpl-1',
        bindings: [{ placeholderId: 'placeholder-1', slot: 'slide.title' }],
      },
      recipes,
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'template_missing',
        severity: 'block',
      }),
    ]);
  });
});

describe('template binary wiring', () => {
  it('extracts placeholders and builds default mapping from PPTX binary', async () => {
    const zip = new JSZip();
    zip.file(
      'ppt/slides/slide1.xml',
      '<p:sld><a:t>{{slide.title}}</a:t><a:t>{{slide.subtitle}}</a:t></p:sld>'
    );
    const baseTemplate = await zip.generateAsync({ type: 'uint8array' });
    const template = await extractTemplateMetadataFromPptxBinary('client.pptx', baseTemplate);
    const mapping = buildDefaultTemplateMapping(template);

    expect(template.placeholders.map((entry) => entry.token)).toEqual([
      '{{slide.title}}',
      '{{slide.subtitle}}',
    ]);
    expect(mapping.bindings).toEqual([
      { placeholderId: 'placeholder-1', slot: 'slide.title' },
      { placeholderId: 'placeholder-2', slot: 'slide.subtitle' },
    ]);
  });

  it('applies resolved template bindings to PPTX slide XML', async () => {
    const zip = new JSZip();
    zip.file(
      'ppt/slides/slide1.xml',
      '<p:sld><a:t>{{slide.title}}</a:t><a:t>{{slide.subtitle}}</a:t></p:sld>'
    );
    const baseTemplate = await zip.generateAsync({ type: 'uint8array' });
    const output = await applyTemplateBindingsToPptx({
      baseTemplate,
      bindings: [
        {
          placeholderId: 'placeholder-1',
          token: '{{slide.title}}',
          slot: 'slide.title',
          resolvedValue: 'Wave 4 Summary',
          recipeId: 'slide-1',
        },
        {
          placeholderId: 'placeholder-2',
          token: '{{slide.subtitle}}',
          slot: 'slide.subtitle',
          resolvedValue: 'Weighted adults 18+',
          recipeId: 'slide-1',
        },
      ],
    });

    const nextZip = await JSZip.loadAsync(output);
    const slideXml = await nextZip.file('ppt/slides/slide1.xml')!.async('string');
    expect(slideXml).toContain('Wave 4 Summary');
    expect(slideXml).toContain('Weighted adults 18+');
    expect(slideXml).not.toContain('{{slide.title}}');
  });
});
