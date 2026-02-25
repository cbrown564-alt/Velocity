import type { AggregatedRow } from '../../types';

export const mapCrosstabRows = (rows: any[], isWeighted: boolean): AggregatedRow[] => {
  return rows.map((row) => {
    const rowKeys = Object.keys(row)
      .filter((k) => k.startsWith('rowKey_'))
      .sort()
      .map((k) => row[k]);
    const count = Number(row.count ?? row.validCount ?? 0);
    const weightedCount =
      row.weightedCount !== undefined
        ? Number(row.weightedCount)
        : (isWeighted ? Number(row.count ?? 0) : undefined);

    return {
      rowKeys,
      colKey: row.colKey,
      count,
      weightedCount,
      sumSqWeights: row.sumSqWeights !== undefined ? Number(row.sumSqWeights) : undefined,
      sumXW: row.sumXW !== undefined ? Number(row.sumXW) : undefined,
      sumX2W: row.sumX2W !== undefined ? Number(row.sumX2W) : undefined,
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
