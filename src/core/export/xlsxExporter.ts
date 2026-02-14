import ExcelJS from 'exceljs';
import { ExportConfig, AnalysisExportItem, ExportError } from './types';
import { ProcessedRow, ProcessedColumn, ProcessedCell } from '../../types/processedData';

const SIG_LETTERS: Record<string, string> = {
  high_95: '▲',
  high_80: '△',
  low_95: '▼',
  low_80: '▽',
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

function addAnalysisSheet(
  workbook: ExcelJS.Workbook,
  item: AnalysisExportItem,
  index: number,
  headerColorArgb: string,
  headerTextArgb: string
): void {
  const showSig = item.options?.showSignificance !== false;
  const sheetName = item.label.slice(0, 31).replace(/[\\/*?[\]:]/g, '_');
  const sheet = workbook.addWorksheet(sheetName || `Analysis ${index + 1}`);

  const columns = item.result.columns;

  // Header row
  const headerValues = ['', ...columns.map(c => c.label), 'Total'];
  const headerRow = sheet.addRow(headerValues);
  headerRow.eachCell(cell => {
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
        const sig = showSig && cell.sig ? ` ${SIG_LETTERS[cell.sig] || ''}` : '';
        values.push(sig ? `${cell.percent.toFixed(1)}%${sig}` : cell.percent);
      }
    }
    values.push(row.total);

    const excelRow = sheet.addRow(values);

    // Format percent cells as percentage
    excelRow.eachCell((cell, colNumber) => {
      if (colNumber > 1 && colNumber <= columns.length + 1 && typeof cell.value === 'number') {
        cell.numFmt = '0.0"%"';
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
      if (cell?.sig) {
        const excelCell = excelRow.getCell(i + 2);
        const isHigh = cell.sig.startsWith('high');
        excelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isHigh ? 'FFE8F5E9' : 'FFFCE4EC' },
        };
      }
    }
  }

  // Auto-width columns
  sheet.columns.forEach(col => {
    col.width = 14;
  });
  if (sheet.columns[0]) {
    sheet.columns[0].width = 30;
  }
}

export async function exportXlsx(config: ExportConfig): Promise<Uint8Array> {
  if (!config.analyses || config.analyses.length === 0) {
    throw new ExportError('No analyses to export.', 'EMPTY_DATA');
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velocity';
    workbook.created = new Date();

    // Resolve theme-aware colors for headers
    const headerHex = config.branding?.headerColor?.replace('#', '') ?? 'E07A5F';
    const headerColorArgb = `FF${headerHex}`;
    const headerTextArgb = 'FFFFFFFF';

    config.analyses.forEach((item, index) => {
      addAnalysisSheet(workbook, item, index, headerColorArgb, headerTextArgb);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    if (error instanceof ExportError) throw error;
    throw new ExportError(
      `Excel generation failed: ${error instanceof Error ? error.message : String(error)}`,
      'GENERATION_FAILED'
    );
  }
}
