export interface CrosstabMatrixCell {
  count: number;
  percent: number;
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

export type CrosstabLongRow = Record<string, unknown>;

interface FormatCrosstabMatrixOptions {
  isWeighted?: boolean;
}

const getEffectiveCount = (row: CrosstabLongRow, isWeighted: boolean): number => {
  if (isWeighted && row.weightedCount !== undefined) {
    return Number(row.weightedCount);
  }
  return Number(row.count ?? row.validCount ?? 0);
};

const getRowLabel = (row: CrosstabLongRow): string => {
  const rowKeys = Object.keys(row)
    .filter((key) => key.startsWith('rowKey_'))
    .sort()
    .map((key) => String(row[key] ?? ''));

  return rowKeys.join(' / ');
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
