import {
  calculateTScore,
  calculateESS,
  calculatePValue,
  calculateMeanCI,
  calculateProportionCI,
  ColumnStats,
  calculateDependentProportionsTest,
} from '../../stats/statistics';
import { getColKeyString } from './rowKeys';
import type { CrosstabSqlRow } from './types';

export interface CellVsRestContext {
  row: CrosstabSqlRow;
  totalRow: CrosstabSqlRow;
  cellN: number;
  cellESS: number;
  totalN: number;
  totalESS: number;
  restN: number;
  restESS: number;
  colStats: Map<string, { n: number; ess: number }>;
}

export interface PairwiseColumnStats {
  colA: ColumnStats;
  colB: ColumnStats;
  rowKey: string;
  totalN: number;
  totalESS: number;
  baseNForDependentTest: number;
  cellNByColKey: Map<string, number>;
  overlapMap: Map<string, { overlapN: number }>;
  isColumnMultipleResponse: boolean;
}

export interface CrosstabSignificanceStrategy {
  readonly isMeans: boolean;
  computeCellVsRestTScore(ctx: CellVsRestContext): number;
  applyConfidenceIntervals(row: CrosstabSqlRow, ctx: CellVsRestContext): void;
  buildColumnStats(rowCells: CrosstabSqlRow[], colStats: Map<string, { n: number; ess: number }>): ColumnStats[];
  computePairwiseTest(
    params: PairwiseColumnStats,
    pairKey: (rowKey: string, a: string, b: string) => string,
  ): { tScore: number; pValue: number };
}

class MeansSignificanceStrategy implements CrosstabSignificanceStrategy {
  readonly isMeans = true;

  computeCellVsRestTScore(ctx: CellVsRestContext): number {
    const { row, totalRow, cellN, cellESS, totalN, restN, restESS } = ctx;

    if (cellESS <= 2 || restESS <= 2) return 0;

    const m1 = Number(row.mean);
    const s1 = Number(row.stdDev);
    const n1 = cellESS;

    const cellSumXW = row.sumXW ?? (row.mean ?? 0) * cellN;
    const cellSumX2W = row.sumX2W ?? ((row.stdDev ?? 0) ** 2 + (row.mean ?? 0) ** 2) * cellN;
    const totalSumXW = totalRow.sumXW ?? (totalRow.mean ?? 0) * totalN;
    const totalSumX2W = totalRow.sumX2W ?? ((totalRow.stdDev ?? 0) ** 2 + (totalRow.mean ?? 0) ** 2) * totalN;

    const restSumXW = totalSumXW - cellSumXW;
    const restSumX2W = totalSumX2W - cellSumX2W;

    let m2 = 0;
    let s2 = 0;
    if (restN > 0) {
      m2 = restSumXW / restN;
      const restVariance = Math.max(0, restSumX2W / restN - m2 * m2);
      s2 = Math.sqrt(restVariance);
    }
    const n2 = restESS;

    return calculateTScore(m1, s1, n1, m2, s2, n2);
  }

  applyConfidenceIntervals(row: CrosstabSqlRow, ctx: CellVsRestContext): void {
    if (row.mean !== undefined && row.stdDev !== undefined) {
      row.ci95 = calculateMeanCI(Number(row.mean), Number(row.stdDev), ctx.cellESS, 0.95);
      row.ci80 = calculateMeanCI(Number(row.mean), Number(row.stdDev), ctx.cellESS, 0.8);
    }
  }

  buildColumnStats(rowCells: CrosstabSqlRow[], _colStats: Map<string, { n: number; ess: number }>): ColumnStats[] {
    void _colStats;
    return rowCells.map((cell) => {
      const cellN = cell.weightedCount ?? cell.count;
      const cellESS = calculateESS(cellN, cell.sumSqWeights ?? cellN);
      const colKey = getColKeyString(cell);

      return {
        key: colKey,
        mean: Number(cell.mean),
        stdDev: Number(cell.stdDev),
        ess: cellESS,
      };
    });
  }

  computePairwiseTest(
    params: PairwiseColumnStats,
    _pairKey: (rowKey: string, a: string, b: string) => string,
  ): { tScore: number; pValue: number } {
    void _pairKey;
    const { colA, colB } = params;

    if (colA.mean !== undefined && colB.mean !== undefined && colA.stdDev !== undefined && colB.stdDev !== undefined) {
      const tScore = calculateTScore(colA.mean, colA.stdDev, colA.ess, colB.mean, colB.stdDev, colB.ess);
      return { tScore, pValue: calculatePValue(tScore) };
    }

    return { tScore: 0, pValue: 1 };
  }
}

class ProportionsSignificanceStrategy implements CrosstabSignificanceStrategy {
  readonly isMeans = false;

  computeCellVsRestTScore(ctx: CellVsRestContext): number {
    const { row, cellN, cellESS, totalN, totalESS, colStats } = ctx;

    if (cellESS <= 2 || ctx.restESS <= 2) return 0;

    const colKey = getColKeyString(row);
    const colBase = colStats.get(colKey);
    const colN = colBase?.n || 0;

    if (colN <= 0) return 0;

    const p1 = cellN / colN;
    const s1 = Math.sqrt(p1 * (1 - p1));
    const n1 = cellESS;

    let grandCurrent = 0;
    for (const v of colStats.values()) grandCurrent += v.n;

    const restCount = totalN - cellN;
    const restBase = grandCurrent - colN;

    if (restBase <= 0) return 0;

    const p2 = restCount / restBase;
    const s2 = Math.sqrt(p2 * (1 - p2));

    const eff = totalESS / totalN;
    const n2 = restBase * eff;

    return calculateTScore(p1, s1, n1, p2, s2, n2);
  }

  applyConfidenceIntervals(row: CrosstabSqlRow, ctx: CellVsRestContext): void {
    const colKey = getColKeyString(row);
    const colBase = ctx.colStats.get(colKey);
    const colN = colBase?.n || 0;
    if (colN > 0) {
      const proportion = ctx.cellN / colN;
      row.ci95 = calculateProportionCI(proportion, ctx.cellESS, 0.95);
      row.ci80 = calculateProportionCI(proportion, ctx.cellESS, 0.8);
    }
  }

  buildColumnStats(rowCells: CrosstabSqlRow[], colStats: Map<string, { n: number; ess: number }>): ColumnStats[] {
    return rowCells.map((cell) => {
      const cellN = cell.weightedCount ?? cell.count;
      const cellESS = calculateESS(cellN, cell.sumSqWeights ?? cellN);
      const colKey = getColKeyString(cell);
      const colBase = colStats.get(colKey);
      const colN = colBase?.n || 0;

      return {
        key: colKey,
        proportion: colN > 0 ? cellN / colN : undefined,
        ess: cellESS,
      };
    });
  }

  computePairwiseTest(
    params: PairwiseColumnStats,
    pairKey: (rowKey: string, a: string, b: string) => string,
  ): { tScore: number; pValue: number } {
    const { colA, colB, rowKey, totalN, baseNForDependentTest, cellNByColKey, overlapMap, isColumnMultipleResponse } =
      params;

    const overlapCorrected = isColumnMultipleResponse && baseNForDependentTest > 2;
    if (overlapCorrected) {
      const nA = Number(cellNByColKey.get(colA.key) ?? 0);
      const nB = Number(cellNByColKey.get(colB.key) ?? 0);
      if (totalN > 0) {
        const pA = nA / totalN;
        const pB = nB / totalN;
        const overlap = overlapMap.get(pairKey(rowKey, colA.key, colB.key));
        const pAB = Number(overlap?.overlapN ?? 0) / totalN;
        const dependentResult = calculateDependentProportionsTest(pA, pB, pAB, baseNForDependentTest);
        return { tScore: dependentResult.tScore, pValue: dependentResult.pValue };
      }
      return { tScore: 0, pValue: 1 };
    }

    if (colA.proportion !== undefined && colB.proportion !== undefined) {
      const s1 = Math.sqrt(colA.proportion * (1 - colA.proportion));
      const s2 = Math.sqrt(colB.proportion * (1 - colB.proportion));
      const tScore = calculateTScore(colA.proportion, s1, colA.ess, colB.proportion, s2, colB.ess);
      return { tScore, pValue: calculatePValue(tScore) };
    }

    return { tScore: 0, pValue: 1 };
  }
}

export function createSignificanceStrategy(isMeans: boolean): CrosstabSignificanceStrategy {
  return isMeans ? new MeansSignificanceStrategy() : new ProportionsSignificanceStrategy();
}
