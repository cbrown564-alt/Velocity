export interface CrosstabMatrixCell {
  count: number;
  percent: number;
  mean?: number;
  stdDev?: number;
  median?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  validCount?: number;
  weightedCount?: number;
  sig?: boolean;
  sigLetters?: string;
}

export interface CrosstabMatrixRow {
  label: string;
  cells: Record<string, CrosstabMatrixCell>;
}

export interface CrosstabMatrixColumn {
  key: string;
  label: string;
  base: number;
}

export interface CrosstabMatrixResult {
  format: 'matrix';
  columns: CrosstabMatrixColumn[];
  rows: CrosstabMatrixRow[];
  grandTotal: number;
}

import { extractRowKeyStrings } from './crosstab/rowKeys';

export type CrosstabLongRow = Record<string, unknown>;

interface FormatCrosstabMatrixOptions {
  isWeighted?: boolean;
}

const isMetricRow = (row: CrosstabLongRow): boolean => row.mean !== undefined || row.validCount !== undefined;

const getEffectiveCount = (row: CrosstabLongRow, isWeighted: boolean): number => {
  if (isWeighted && row.weightedCount !== undefined) {
    return Number(row.weightedCount);
  }
  if (isMetricRow(row) && row.validCount !== undefined) {
    return Number(row.validCount);
  }
  return Number(row.count ?? row.validCount ?? 0);
};

const copyNumericField = (cell: CrosstabMatrixCell, row: CrosstabLongRow, key: keyof CrosstabMatrixCell): void => {
  if (row[key] !== undefined) {
    cell[key] = Number(row[key]) as never;
  }
};

const getRowLabel = (row: CrosstabLongRow): string => {
  return extractRowKeyStrings(row).join(' / ');
};

export const formatCrosstabMatrix = (
  rows: CrosstabLongRow[],
  options: FormatCrosstabMatrixOptions = {},
): CrosstabMatrixResult => {
  const isWeighted = options.isWeighted ?? false;

  if (rows.length === 0) {
    return {
      format: 'matrix',
      columns: [],
      rows: [],
      grandTotal: 0,
    };
  }

  const columnKeys = Array.from(new Set(rows.map((row) => String(row.colKey ?? 'Total')))).sort();
  const columnTotals = new Map<string, number>();
  columnKeys.forEach((key) => columnTotals.set(key, 0));

  const rowMap = new Map<string, Map<string, CrosstabLongRow>>();
  let grandTotal = 0;

  for (const row of rows) {
    const colKey = String(row.colKey ?? 'Total');
    const rowLabel = getRowLabel(row);
    const count = getEffectiveCount(row, isWeighted);

    columnTotals.set(colKey, (columnTotals.get(colKey) ?? 0) + count);
    grandTotal += count;

    if (!rowMap.has(rowLabel)) {
      rowMap.set(rowLabel, new Map());
    }
    rowMap.get(rowLabel)!.set(colKey, row);
  }

  const columns: CrosstabMatrixColumn[] = columnKeys.map((key) => ({
    key,
    label: key,
    base: columnTotals.get(key) ?? 0,
  }));

  const matrixRows: CrosstabMatrixRow[] = Array.from(rowMap.entries()).map(([label, cellsByColumn]) => {
    const cells: Record<string, CrosstabMatrixCell> = {};

    for (const colKey of columnKeys) {
      const sourceRow = cellsByColumn.get(colKey);
      const count = sourceRow ? getEffectiveCount(sourceRow, isWeighted) : 0;
      const base = columnTotals.get(colKey) ?? 0;
      const percent = base > 0 ? Math.round((count / base) * 1000) / 10 : 0;

      cells[colKey] = { count, percent };
      if (sourceRow && isMetricRow(sourceRow)) {
        copyNumericField(cells[colKey], sourceRow, 'mean');
        copyNumericField(cells[colKey], sourceRow, 'stdDev');
        copyNumericField(cells[colKey], sourceRow, 'median');
        copyNumericField(cells[colKey], sourceRow, 'min');
        copyNumericField(cells[colKey], sourceRow, 'max');
        copyNumericField(cells[colKey], sourceRow, 'q1');
        copyNumericField(cells[colKey], sourceRow, 'q3');
        copyNumericField(cells[colKey], sourceRow, 'validCount');
        copyNumericField(cells[colKey], sourceRow, 'weightedCount');
      }
      if (sourceRow?.sig !== undefined) {
        cells[colKey].sig = Boolean(sourceRow.sig);
      }
      if (typeof sourceRow?.sigLetters === 'string') {
        cells[colKey].sigLetters = sourceRow.sigLetters;
      }
    }

    return { label, cells };
  });

  return {
    format: 'matrix',
    columns,
    rows: matrixRows,
    grandTotal,
  };
};
