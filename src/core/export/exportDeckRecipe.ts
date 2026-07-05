import { exportPptx } from './pptxExporter';
import { exportXlsx } from './xlsxExporter';
import type { MaterializeDeckRecipeInput } from './materializeDeckRecipe';
import { materializeDeckRecipe } from './materializeDeckRecipe';
import {
  materializedDeckToExportConfig,
  type MaterializedDeck,
  type MaterializedDeckExportOptions,
} from './materializedDeck';

export type ExportDeckRecipeFormat = 'pptx' | 'xlsx';

export interface ExportDeckRecipeInput extends MaterializeDeckRecipeInput {
  format: ExportDeckRecipeFormat;
  exportOptions?: MaterializedDeckExportOptions;
}

export async function exportMaterializedDeck(
  deck: MaterializedDeck,
  format: ExportDeckRecipeFormat,
  exportOptions?: MaterializedDeckExportOptions,
): Promise<Uint8Array> {
  const config = materializedDeckToExportConfig(deck, exportOptions);
  return format === 'xlsx' ? exportXlsx(config) : exportPptx(config);
}

export async function exportDeckRecipe(input: ExportDeckRecipeInput): Promise<Uint8Array> {
  const materialized = await materializeDeckRecipe(input);
  if (materialized.slides.length === 0) return new Uint8Array();
  return exportMaterializedDeck(materialized, input.format, input.exportOptions);
}
