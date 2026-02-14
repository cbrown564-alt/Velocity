import PptxGenJS from 'pptxgenjs';
import { ExportConfig, AnalysisExportItem, ExportError } from './types';
import { ProcessedRow, ProcessedColumn, ProcessedCell } from '../../types/processedData';
import { buildChartSlide, canExportAsChart } from './pptxChartBuilder';

const SIG_LETTERS: Record<string, string> = {
  high_95: '▲',
  high_80: '△',
  low_95: '▼',
  low_80: '▽',
};

const DEFAULTS = {
  primaryColor: '1C1C1C',
  headerColor: 'E07A5F',
  fontFamily: 'Atkinson Hyperlegible',
  fontSize: 9,
  headerFontSize: 10,
};

function flattenRows(rows: ProcessedRow[], result: ProcessedRow[] = []): ProcessedRow[] {
  for (const row of rows) {
    result.push(row);
    if (row.children.length) {
      flattenRows(row.children, result);
    }
  }
  return result;
}

function formatCell(cell: ProcessedCell | undefined, showSig: boolean): string {
  if (!cell) return '';
  const pct = `${cell.percent.toFixed(1)}%`;
  const sig = showSig && cell.sig ? ` ${SIG_LETTERS[cell.sig] || ''}` : '';
  return `${pct}${sig}`;
}

function buildSlideTable(
  item: AnalysisExportItem,
  columns: ProcessedColumn[],
  branding: typeof DEFAULTS
): PptxGenJS.TableRow[] {
  const showSig = item.options?.showSignificance !== false;
  const headerStyle: PptxGenJS.TableCellProps = {
    fill: { color: branding.headerColor },
    color: 'FFFFFF',
    bold: true,
    fontSize: branding.headerFontSize,
    fontFace: branding.fontFamily,
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    valign: 'middle',
  };

  const cellStyle: PptxGenJS.TableCellProps = {
    fontSize: branding.fontSize,
    fontFace: branding.fontFamily,
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    valign: 'middle',
  };

  const tableRows: PptxGenJS.TableRow[] = [];

  // Header row
  const headerRow: PptxGenJS.TableCell[] = [
    { text: '', options: headerStyle },
    ...columns.map(col => ({ text: col.label, options: headerStyle })),
    { text: 'Total', options: headerStyle },
  ];
  tableRows.push(headerRow);

  // Data rows
  const flatRows = flattenRows(item.result.rows);
  for (const row of flatRows) {
    const indent = row.depth > 0 ? '  '.repeat(row.depth) : '';
    const labelStyle: PptxGenJS.TableCellProps = {
      ...cellStyle,
      bold: row.depth === 0,
    };

    const dataRow: PptxGenJS.TableCell[] = [
      { text: `${indent}${row.label}`, options: labelStyle },
      ...columns.map(col => ({
        text: formatCell(row.cells[col.key], showSig),
        options: { ...cellStyle, align: 'right' as const },
      })),
      { text: row.total.toString(), options: { ...cellStyle, align: 'right' as const, bold: true } },
    ];
    tableRows.push(dataRow);
  }

  return tableRows;
}

export async function exportPptx(config: ExportConfig): Promise<Uint8Array> {
  if (!config.analyses || config.analyses.length === 0) {
    throw new ExportError('No analyses to export.', 'EMPTY_DATA');
  }

  try {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    const branding = {
      ...DEFAULTS,
      ...(config.branding?.primaryColor && { primaryColor: config.branding.primaryColor.replace('#', '') }),
      ...(config.branding?.headerColor && { headerColor: config.branding.headerColor.replace('#', '') }),
      ...(config.branding?.fontFamily && { fontFamily: config.branding.fontFamily }),
    };

    const chartBranding = {
      ...branding,
      chartColors: config.branding?.chartColors ?? [],
    };

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(config.title, {
      x: 0.5,
      y: '40%',
      w: '90%',
      fontSize: 28,
      fontFace: branding.fontFamily,
      color: branding.primaryColor,
      bold: true,
    });

    // One slide per analysis
    for (const item of config.analyses) {
      const slide = pptx.addSlide();
      const isChartSlide =
        item.visualizationType === 'chart' &&
        canExportAsChart(item.chartType);

      if (isChartSlide) {
        const chartAdded = buildChartSlide(slide, item, chartBranding);
        if (chartAdded) continue;
        // If chart build failed, fall through to table
      }

      // Table export (default path, or fallback for unsupported chart types)
      slide.addText(item.label, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 18,
        fontFace: branding.fontFamily,
        color: branding.primaryColor,
        bold: true,
      });

      // Add fallback footnote for unsupported chart types
      if (item.visualizationType === 'chart' && !canExportAsChart(item.chartType)) {
        slide.addText(
          `Note: ${item.chartType} charts are not supported in PowerPoint — exported as table.`,
          {
            x: 0.5,
            y: 6.8,
            w: '90%',
            fontSize: 7,
            fontFace: branding.fontFamily,
            color: '999999',
            italic: true,
          }
        );
      }

      const tableRows = buildSlideTable(item, item.result.columns, branding);
      const colCount = item.result.columns.length + 2; // label + cols + total

      slide.addTable(tableRows, {
        x: 0.5,
        y: 1.0,
        w: 12.3,
        colW: Array(colCount).fill(12.3 / colCount),
        rowH: 0.35,
        autoPage: true,
        autoPageRepeatHeader: true,
      });
    }

    const output = await pptx.write({ outputType: 'uint8array' });
    return output as Uint8Array;
  } catch (error) {
    if (error instanceof ExportError) throw error;
    throw new ExportError(
      `PowerPoint generation failed: ${error instanceof Error ? error.message : String(error)}`,
      'GENERATION_FAILED'
    );
  }
}
