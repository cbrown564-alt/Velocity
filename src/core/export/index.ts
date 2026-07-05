export { exportPptx } from './pptxExporter';
export { exportXlsx } from './xlsxExporter';
export { exportDeckRecipe, exportMaterializedDeck } from './exportDeckRecipe';
export type { ExportDeckRecipeFormat, ExportDeckRecipeInput } from './exportDeckRecipe';
export { materializeDeckRecipe } from './materializeDeckRecipe';
export type { MaterializeDeckRecipeInput } from './materializeDeckRecipe';
export { materializedDeckToExportConfig, mergeDisplayOptions } from './materializedDeck';
export type {
  MaterializedDeck,
  MaterializedDeckExportOptions,
  MaterializedSlide,
  MaterializedSlideDisplayOptions,
} from './materializedDeck';
export {
  assertPreviewExportStructuralParity,
  buildDeckExportStructuralSnapshot,
  buildDeckPreviewModel,
} from './deckPreviewModel';
export type { DeckExportStructuralSnapshot, DeckPreviewModel, DeckPreviewSlide } from './deckPreviewModel';
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
