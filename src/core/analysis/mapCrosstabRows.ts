import type { AggregatedRow } from '../../types';

export const mapCrosstabRows = (rows: any[], isWeighted: boolean): AggregatedRow[] => {
  return rows.map((row) => {
    const rowKeys = Object.keys(row)
      .filter((k) => k.startsWith('rowKey_'))
      .sort()
      .map((k) => row[k]);

    return {
      rowKeys,
      colKey: row.colKey,
      count: isWeighted ? 0 : Number(row.count ?? row.validCount ?? 0),
      weightedCount: isWeighted ? Number(row.count) : undefined,
      mean: row.mean,
      median: row.median,
      stdDev: row.stdDev,
      min: row.min,
      max: row.max,
      q1: row.q1,
      q3: row.q3,
      validCount: row.validCount !== undefined ? Number(row.validCount) : undefined,
      histogramBins: row.histogramBins,
      sig: row.sig,
      stats: row.stats,
      ci95: row.ci95,
      ci80: row.ci80,
      sigLetters: row.sigLetters,
      columnLetter: row.columnLetter,
    };
  });
};
