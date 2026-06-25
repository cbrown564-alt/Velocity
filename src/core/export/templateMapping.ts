import type { SlideRecipe } from './slideRecipe';

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export type TemplateSlot =
  | 'slide.title'
  | 'slide.subtitle'
  | 'slide.notes'
  | 'analysis.label';

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
  | 'slot_unresolved';

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

interface ExtractTemplateMetadataInput {
  filename: string;
  arrayBuffer: ArrayBuffer;
  extractedTexts?: string[];
}

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

export async function extractTemplateMetadata(
  input: ExtractTemplateMetadataInput
): Promise<PptxTemplate> {
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

export function mapTemplatePlaceholders(
  template: PptxTemplate,
  mapping: TemplateMapping,
  recipes: SlideRecipe[]
): AppliedTemplateMapping {
  const fallbackRecipe = recipes[0];
  const bindings: AppliedTemplateBinding[] = mapping.bindings.flatMap((binding) => {
    const placeholder = template.placeholders.find((entry) => entry.id === binding.placeholderId);
    if (!placeholder || !fallbackRecipe) {
      return [];
    }

    const resolvedValue = resolveSlotValue(fallbackRecipe, binding.slot) ?? '';
    return [
      {
        placeholderId: placeholder.id,
        token: placeholder.token,
        slot: binding.slot,
        resolvedValue,
        recipeId: fallbackRecipe.slideId,
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
  recipes: SlideRecipe[]
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
