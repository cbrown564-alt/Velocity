export { exportPptx } from './pptxExporter';
export { exportXlsx } from './xlsxExporter';
export { resolveExportBranding, resolveExportPalette } from './resolveThemeColors';
export {
  buildPresentationChartOptions,
  resolveChartColorsForExport,
} from './pptxChartStyle';
export type { ExportConfig, AnalysisExportItem, ExportBranding } from './types';
export { ExportError } from './types';
export {
  assessDatasetReplacement,
  buildExportReview,
  slideToRecipe,
  slidesToRecipes,
} from './slideRecipe';
export type {
  DatasetReplacementAssessment,
  ExportReview,
  SlideRecipe,
  SlideRecipeIssue,
} from './slideRecipe';
export {
  buildTemplateApplicabilityReview,
  canApplyTemplate,
  extractTemplateMetadata,
  mapTemplatePlaceholders,
} from './templateMapping';
export type {
  AppliedTemplateBinding,
  AppliedTemplateMapping,
  PptxTemplate,
  TemplateApplicabilityInput,
  TemplateApplyIssue,
  TemplateApplyIssueCode,
  TemplateMapping,
  TemplateMappingBinding,
  TemplatePlaceholder,
  TemplateSlot,
} from './templateMapping';
