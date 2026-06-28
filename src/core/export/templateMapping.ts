import type { SlideRecipe } from './slideRecipe';
import JSZip from 'jszip';

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export type TemplateSlot = 'slide.title' | 'slide.subtitle' | 'slide.notes' | 'analysis.label';

export interface TemplatePlaceholder {
  id: string;
  token: string;
  key: string;
  slideIndex?: number;
}

export interface PptxTemplate {
  id: string;
  filename: string;
  placeholders: TemplatePlaceholder[];
  diagnostics: string[];
}

export interface TemplateMappingBinding {
  placeholderId: string;
  slot: TemplateSlot;
}

export interface TemplateMapping {
  templateId: string;
  bindings: TemplateMappingBinding[];
}

export type TemplateApplyIssueCode =
  | 'template_mismatch'
  | 'placeholder_missing'
  | 'slot_unresolved'
  | 'template_missing'
  | 'mapping_missing'
  | 'template_diagnostic'
  | 'editable_preservation_off';

export interface TemplateApplyIssue {
  code: TemplateApplyIssueCode;
  severity: 'block' | 'warn';
  message: string;
  placeholderId?: string;
  slot?: TemplateSlot;
}

export interface AppliedTemplateBinding {
  placeholderId: string;
  token: string;
  slot: TemplateSlot;
  resolvedValue: string;
  recipeId: string;
}

export interface AppliedTemplateMapping {
  templateId: string;
  bindings: AppliedTemplateBinding[];
}

export interface TemplateApplicabilityInput {
  template?: PptxTemplate | null;
  mapping?: TemplateMapping | null;
  recipes: SlideRecipe[];
  preserveEditableObjects?: boolean;
}

interface ExtractTemplateMetadataInput {
  filename: string;
  arrayBuffer: ArrayBuffer;
  extractedTexts?: string[];
}

const TEMPLATE_SLOT_BY_KEY: Partial<Record<string, TemplateSlot>> = {
  'slide.title': 'slide.title',
  'slide.subtitle': 'slide.subtitle',
  'slide.notes': 'slide.notes',
  'analysis.label': 'analysis.label',
};

const XML_TEXT_NODE_REGEX = /<a:t>([\s\S]*?)<\/a:t>/g;
const PPTX_SLIDE_PATH_REGEX = /^ppt\/slides\/slide(\d+)\.xml$/;

function extractPlaceholderTokens(text: string): string[] {
  const matches = text.matchAll(PLACEHOLDER_REGEX);
  const tokens: string[] = [];
  for (const match of matches) {
    tokens.push(`{{${match[1]}}}`);
  }
  return tokens;
}

function normalizePlaceholderKey(token: string): string {
  return token.replace('{{', '').replace('}}', '').trim();
}

function decodeXmlText(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function resolveSlotValue(recipe: SlideRecipe, slot: TemplateSlot): string | null {
  switch (slot) {
    case 'slide.title':
    case 'analysis.label':
      return recipe.title?.trim() || null;
    case 'slide.subtitle':
      return recipe.subtitle?.trim() || null;
    case 'slide.notes':
      return recipe.notes?.trim() || null;
    default: {
      const exhaustiveCheck: never = slot;
      return exhaustiveCheck;
    }
  }
}

export async function extractTemplateMetadata(input: ExtractTemplateMetadataInput): Promise<PptxTemplate> {
  // Extension point: when we add zip/xml parsing, this function should populate
  // extractedTexts from the PPTX internals before token extraction.
  const extractedTexts = input.extractedTexts ?? [];
  const uniqueTokens = new Set<string>();

  for (const chunk of extractedTexts) {
    for (const token of extractPlaceholderTokens(chunk)) {
      uniqueTokens.add(token);
    }
  }

  const placeholders: TemplatePlaceholder[] = [...uniqueTokens].map((token, index) => ({
    id: `placeholder-${index + 1}`,
    token,
    key: normalizePlaceholderKey(token),
  }));

  const diagnostics =
    input.extractedTexts === undefined
      ? [
          `Template placeholder extraction currently expects pre-extracted text tokens; received ${input.arrayBuffer.byteLength} bytes from "${input.filename}".`,
        ]
      : [];

  return {
    id: `${input.filename}:${placeholders.length}`,
    filename: input.filename,
    placeholders,
    diagnostics,
  };
}

export async function extractTemplateMetadataFromPptxBinary(
  filename: string,
  baseTemplate: Uint8Array,
): Promise<PptxTemplate> {
  const zip = await JSZip.loadAsync(baseTemplate);
  const placeholders: TemplatePlaceholder[] = [];
  const seenTokens = new Set<string>();
  const diagnostics: string[] = [];

  const slideEntries = Object.keys(zip.files)
    .map((path) => {
      const match = path.match(PPTX_SLIDE_PATH_REGEX);
      if (!match) {
        return null;
      }
      return { path, slideIndex: Number.parseInt(match[1], 10) };
    })
    .filter((entry): entry is { path: string; slideIndex: number } => entry !== null)
    .sort((a, b) => a.slideIndex - b.slideIndex);

  for (const slideEntry of slideEntries) {
    const file = zip.file(slideEntry.path);
    if (!file) {
      continue;
    }
    const xml = await file.async('string');
    const textChunks = [...xml.matchAll(XML_TEXT_NODE_REGEX)].map((match) => decodeXmlText(match[1]));
    for (const chunk of textChunks) {
      for (const token of extractPlaceholderTokens(chunk)) {
        if (seenTokens.has(token)) {
          continue;
        }
        seenTokens.add(token);
        placeholders.push({
          id: `placeholder-${placeholders.length + 1}`,
          token,
          key: normalizePlaceholderKey(token),
          slideIndex: slideEntry.slideIndex,
        });
      }
    }
  }

  if (placeholders.length === 0) {
    diagnostics.push(
      `No placeholders were detected in "${filename}". Add {{slide.title}}, {{slide.subtitle}}, {{slide.notes}}, or {{analysis.label}} tokens to template text boxes before export.`,
    );
  }

  return {
    id: `${filename}:${placeholders.length}`,
    filename,
    placeholders,
    diagnostics,
  };
}

export function buildDefaultTemplateMapping(template: PptxTemplate): TemplateMapping {
  return {
    templateId: template.id,
    bindings: template.placeholders.flatMap((placeholder) => {
      const slot = TEMPLATE_SLOT_BY_KEY[placeholder.key];
      if (!slot) {
        return [];
      }
      return [{ placeholderId: placeholder.id, slot }];
    }),
  };
}

export async function applyTemplateBindingsToPptx(input: {
  baseTemplate: Uint8Array;
  bindings: AppliedTemplateBinding[];
}): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(input.baseTemplate);

  for (const binding of input.bindings) {
    const slideIndex = Number.parseInt(binding.recipeId.replace('slide-', ''), 10);
    const candidates = Number.isFinite(slideIndex) ? [`ppt/slides/slide${slideIndex}.xml`] : [];
    const fallbackCandidates = Object.keys(zip.files).filter((path) => path.match(PPTX_SLIDE_PATH_REGEX));
    const uniqueCandidates = [...new Set([...candidates, ...fallbackCandidates])];

    for (const slidePath of uniqueCandidates) {
      const file = zip.file(slidePath);
      if (!file) {
        continue;
      }
      const xml = await file.async('string');
      if (!xml.includes(binding.token)) {
        continue;
      }
      const nextXml = xml.replaceAll(binding.token, escapeXmlText(binding.resolvedValue));
      zip.file(slidePath, nextXml);
      break;
    }
  }

  const output = await zip.generateAsync({ type: 'uint8array' });
  return output;
}

export function mapTemplatePlaceholders(
  template: PptxTemplate,
  mapping: TemplateMapping,
  recipes: SlideRecipe[],
): AppliedTemplateMapping {
  const fallbackRecipe = recipes[0];
  const bindings: AppliedTemplateBinding[] = mapping.bindings.flatMap((binding) => {
    const placeholder = template.placeholders.find((entry) => entry.id === binding.placeholderId);
    if (!placeholder || !fallbackRecipe) {
      return [];
    }

    const recipeForBinding =
      placeholder.slideIndex && placeholder.slideIndex > 0
        ? (recipes[placeholder.slideIndex - 1] ?? fallbackRecipe)
        : fallbackRecipe;
    const resolvedValue = resolveSlotValue(recipeForBinding, binding.slot) ?? '';
    return [
      {
        placeholderId: placeholder.id,
        token: placeholder.token,
        slot: binding.slot,
        resolvedValue,
        recipeId: recipeForBinding.slideId,
      },
    ];
  });

  return {
    templateId: template.id,
    bindings,
  };
}

export function canApplyTemplate(
  mapping: TemplateMapping,
  template: PptxTemplate,
  recipes: SlideRecipe[],
): TemplateApplyIssue[] {
  const issues: TemplateApplyIssue[] = [];
  const referenceRecipe = recipes[0];

  if (mapping.templateId !== template.id) {
    issues.push({
      code: 'template_mismatch',
      severity: 'block',
      message: `Template mapping references "${mapping.templateId}" but template id is "${template.id}".`,
    });
  }

  for (const binding of mapping.bindings) {
    const placeholder = template.placeholders.find((entry) => entry.id === binding.placeholderId);
    if (!placeholder) {
      issues.push({
        code: 'placeholder_missing',
        severity: 'block',
        placeholderId: binding.placeholderId,
        slot: binding.slot,
        message: `Mapped placeholder "${binding.placeholderId}" is not present in the template.`,
      });
      continue;
    }

    const value = referenceRecipe ? resolveSlotValue(referenceRecipe, binding.slot) : null;
    if (!value) {
      issues.push({
        code: 'slot_unresolved',
        severity: 'block',
        placeholderId: binding.placeholderId,
        slot: binding.slot,
        message: `Slot "${binding.slot}" cannot be resolved from the selected slide recipe.`,
      });
    }
  }

  return issues;
}

export function buildTemplateApplicabilityReview(input: TemplateApplicabilityInput): TemplateApplyIssue[] {
  const issues: TemplateApplyIssue[] = [];
  const template = input.template ?? null;
  const mapping = input.mapping ?? null;

  if (!template && !mapping) {
    issues.push({
      code: 'template_missing',
      severity: 'warn',
      message: 'No client template is configured; export will use the default editable Velocity layout.',
    });
  } else if (!template && mapping) {
    issues.push({
      code: 'template_missing',
      severity: 'block',
      message:
        'Template mapping is present but no template file is available. Re-import the client template before export.',
    });
  } else if (template && !mapping) {
    issues.push({
      code: 'mapping_missing',
      severity: 'warn',
      message: 'Template loaded without placeholder mapping; editable fields may not land in intended template slots.',
    });
  }

  if (template) {
    for (const diagnostic of template.diagnostics) {
      issues.push({
        code: 'template_diagnostic',
        severity: 'warn',
        message: diagnostic,
      });
    }
  }

  if (input.preserveEditableObjects === false) {
    issues.push({
      code: 'editable_preservation_off',
      severity: 'warn',
      message:
        'Editable template-object preservation is disabled; exported content may be flattened by the selected template flow.',
    });
  }

  if (template && mapping) {
    issues.push(...canApplyTemplate(mapping, template, input.recipes));
  }

  return issues;
}
