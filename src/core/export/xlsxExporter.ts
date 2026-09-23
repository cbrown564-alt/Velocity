import ExcelJS from 'exceljs';
import { ExportConfig, AnalysisExportItem, ExportError } from './types';
import { ProcessedRow } from '../../types/processedData';

const SIGNIFICANCE_NOTES: Record<string, string> = {
  high_95: 'Higher at 95% confidence (▲)',
  high_80: 'Higher at 80% confidence (△)',
  low_95: 'Lower at 95% confidence (▼)',
  low_80: 'Lower at 80% confidence (▽)',
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

function worksheetName(label: string, index: number, usedNames: Set<string>): string {
  const cleaned =
    label
      .replace(/[\\/*?[\]:]/g, '_')
      .replace(/^'+|'+$/g, '')
      .trim() || `Analysis ${index + 1}`;
  let name = cleaned.slice(0, 31).replace(/'+$/g, '').trimEnd();
  let suffix = 2;
  while (usedNames.has(name.toLowerCase())) {
    const ending = `-${suffix++}`;
    name = `${cleaned
      .slice(0, 31 - ending.length)
      .replace(/'+$/g, '')
      .trimEnd()}${ending}`;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function addAnalysisSheet(
  workbook: ExcelJS.Workbook,
  item: AnalysisExportItem,
  index: number,
  headerColorArgb: string,
  headerTextArgb: string,
  usedNames: Set<string>,
): void {
  const showSig = item.options?.showSignificance !== false;
  const sheet = workbook.addWorksheet(worksheetName(item.label, index, usedNames));

  const columns = item.result.columns;
  const lastColumn = columns.length + 2;

  sheet.mergeCells(1, 1, 1, lastColumn);
  const title = sheet.getCell(1, 1);
  title.value = item.label;
  title.font = { bold: true, size: 15, color: { argb: 'FF17212B' } };
  title.alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(1).height = 38;

  sheet.mergeCells(2, 1, 2, lastColumn);
  const context = sheet.getCell(2, 1);
  context.value = item.subtitle || '';
  context.font = { size: 10, color: { argb: 'FF555F68' } };
  context.alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(2).height = item.subtitle ? 30 : 16;
  sheet.getRow(3).height = 12;
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];
  sheet.pageSetup.printTitlesRow = '1:4';

  // Header row
  const headerValues = ['', ...columns.map((c) => c.label), 'Total (count)'];
  const headerRow = sheet.addRow(headerValues);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headerColorArgb },
    };
    cell.font = { bold: true, color: { argb: headerTextArgb }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Data rows
  const flatRows = flattenRows(item.result.rows);
  for (const row of flatRows) {
    const indent = row.depth > 0 ? '  '.repeat(row.depth) : '';
    const values: (string | number)[] = [`${indent}${row.label}`];

    for (const col of columns) {
      const cell = row.cells[col.key];
      if (!cell) {
        values.push('');
      } else {
        values.push(cell.percent);
      }
    }
    values.push(row.total);

    const excelRow = sheet.addRow(values);

    // Format percent cells as percentage
    excelRow.eachCell((cell, colNumber) => {
      if (colNumber > 1 && colNumber <= columns.length + 1 && typeof cell.value === 'number') {
        cell.numFmt = '0.0"%"';
      }
      if (colNumber === columns.length + 2 && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.0';
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
      if (row.depth === 0) {
        cell.font = { bold: true };
      }
    });

    // Significance conditional formatting - highlight sig cells
    for (let i = 0; i < columns.length; i++) {
      const cell = row.cells[columns[i].key];
      if (showSig && cell?.sig) {
        const excelCell = excelRow.getCell(i + 2);
        const isHigh = cell.sig.startsWith('high');
        excelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isHigh ? 'FFE8F5E9' : 'FFFCE4EC' },
        };
        excelCell.note = SIGNIFICANCE_NOTES[cell.sig] || `Significance: ${cell.sig}`;
      }
    }
  }

  // Auto-width columns
  sheet.columns.forEach((col) => {
    col.width = 14;
  });
  if (sheet.columns[0]) {
    sheet.columns[0].width = 38;
  }

  if (showSig && flatRows.some((row) => columns.some((column) => row.cells[column.key]?.sig))) {
    const legendRow = sheet.addRow([]);
    legendRow.height = 10;
    const legend = sheet.addRow(['Green: higher; pink: lower. Open a highlighted cell note for its 95% or 80% level.']);
    sheet.mergeCells(legend.number, 1, legend.number, lastColumn);
    legend.getCell(1).font = { size: 9, color: { argb: 'FF555F68' } };
  }
}

export async function exportXlsx(config: ExportConfig): Promise<Uint8Array> {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velocity';
    workbook.created = new Date();

    // Resolve theme-aware colors for headers
    const headerHex = config.branding?.headerColor?.replace('#', '') ?? '245FA7';
    const headerColorArgb = `FF${headerHex}`;
    const headerTextArgb = 'FFFFFFFF';

    const usedNames = new Set<string>();
    config.analyses.forEach((item, index) => {
      addAnalysisSheet(workbook, item, index, headerColorArgb, headerTextArgb, usedNames);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    if (error instanceof ExportError) throw error;
    throw new ExportError(
      `Excel generation failed: ${error instanceof Error ? error.message : String(error)}`,
      'GENERATION_FAILED',
    );
  }
}
