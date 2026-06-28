export { exportPptx } from './pptxExporter';
export { exportXlsx } from './xlsxExporter';
export { resolveExportBranding, resolveExportPalette } from './resolveThemeColors';
export { buildPresentationChartOptions, resolveChartColorsForExport } from './pptxChartStyle';
export type { ExportConfig, AnalysisExportItem, ExportBranding } from './types';
export { ExportError } from './types';
export {
  assessDatasetReplacement,
  buildDatasetReplacementReview,
  buildExportReview,
  slideToRecipe,
  slidesToRecipes,
} from './slideRecipe';
export type {
  DatasetReplacementAssessment,
  DatasetReplacementReview,
  DatasetReplacementSlideReview,
  ExportReview,
  SlideRecipe,
  SlideRecipeIssue,
} from './slideRecipe';
export {
  applyTemplateBindingsToPptx,
  buildDefaultTemplateMapping,
  buildTemplateApplicabilityReview,
  canApplyTemplate,
  extractTemplateMetadata,
  extractTemplateMetadataFromPptxBinary,
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
