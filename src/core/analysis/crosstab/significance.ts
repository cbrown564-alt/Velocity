import { DatabaseAdapter } from '../../DatabaseAdapter';
import { buildCrosstabQuery, buildOverlapQuery } from '../../sql/queryBuilder';
import type { CrosstabQueryOptions } from '../../../types/worker';
import {
  calculateESS,
  calculatePValue,
  applyMultipleTestingCorrection,
  bonferroniAdjustedPValues,
  benjaminiHochbergAdjustedPValues,
} from '../../stats/statistics';
import { getColKeyString, joinRowKeyPath } from './rowKeys';
import {
  createSignificanceStrategy,
  type CellVsRestContext,
  type CrosstabSignificanceStrategy,
} from './significanceStrategies';
import type { CrosstabOverlapSqlRow, CrosstabSqlRow, SignificanceOptions } from './types';

const DEFAULT_SIGNIFICANCE_OPTIONS: Required<SignificanceOptions> = {
  comparisonMethod: 'cell_vs_rest',
  correctionType: 'none',
  significanceLevel: 0.95,
};

function significanceLevelToAlpha(level: 0.95 | 0.9 | 0.8): number {
  // Significance level is confidence (e.g. 0.95), alpha is Type I error (e.g. 0.05)
  return Number((1 - level).toFixed(10));
}

function getAdjustedPValues(pValues: number[], correction: 'none' | 'bonferroni' | 'fdr'): number[] {
  if (correction === 'bonferroni') {
    return bonferroniAdjustedPValues(pValues);
  }
  if (correction === 'fdr') {
    return benjaminiHochbergAdjustedPValues(pValues);
  }
  return [...pValues];
}

function buildColStats(rows: CrosstabSqlRow[]): Map<string, { n: number; ess: number }> {
  const colStats = new Map<string, { n: number; ess: number }>();
  rows.forEach((row) => {
    const colKey = getColKeyString(row);
    const n = row.weightedCount ?? row.count;
    const ess = calculateESS(n, row.sumSqWeights ?? n);

    const current = colStats.get(colKey) || { n: 0, ess: 0 };
    colStats.set(colKey, { n: current.n + n, ess: current.ess + ess });
  });
  return colStats;
}

function applyCellVsRestMarkers(
  cellTestResults: Array<{ row: CrosstabSqlRow; tScore: number; pValue: number }>,
  significanceOptions: Required<SignificanceOptions>,
  alpha: number,
  pairwiseMode: boolean,
): void {
  if (cellTestResults.length === 0) return;

  const rawPValues = cellTestResults.map((test) => test.pValue);
  const adjustedPValues = getAdjustedPValues(rawPValues, significanceOptions.correctionType);
  const primarySig = applyMultipleTestingCorrection(rawPValues, significanceOptions.correctionType, alpha);

  const secondarySig =
    significanceOptions.significanceLevel >= 0.95
      ? applyMultipleTestingCorrection(rawPValues, significanceOptions.correctionType, 0.2)
      : null;

  cellTestResults.forEach((test, idx) => {
    if (!test.row.stats) return;

    test.row.stats.adjustedPValue = adjustedPValues[idx];
    test.row.stats.correctionMethod = significanceOptions.correctionType;

    delete test.row.sig;
    if (pairwiseMode) return;

    const isHigh = test.tScore > 0;
    if (primarySig[idx]) {
      if (significanceOptions.significanceLevel >= 0.95) {
        test.row.sig = isHigh ? 'high_95' : 'low_95';
      } else {
        test.row.sig = isHigh ? 'high_80' : 'low_80';
      }
    } else if (secondarySig?.[idx]) {
      test.row.sig = isHigh ? 'high_80' : 'low_80';
    }
  });
}

async function applyPairwiseComparisons(
  adapter: DatabaseAdapter,
  options: CrosstabQueryOptions,
  rows: CrosstabSqlRow[],
  totalsMap: Map<string, CrosstabSqlRow>,
  colStats: Map<string, { n: number; ess: number }>,
  strategy: CrosstabSignificanceStrategy,
  significanceOptions: Required<SignificanceOptions>,
  alpha: number,
): Promise<void> {
  const isColumnMultipleResponse = !!(options.columnMultipleColumns && options.columnMultipleColumns.length > 0);

  const rowKeyGroups = new Map<string, CrosstabSqlRow[]>();
  rows.forEach((row) => {
    const rowKey = joinRowKeyPath(row);
    if (!rowKeyGroups.has(rowKey)) {
      rowKeyGroups.set(rowKey, []);
    }
    rowKeyGroups.get(rowKey)!.push(row);
  });

  const pairwiseTests: Array<{
    rowKey: string;
    colA: string;
    colB: string;
    letterA: string;
    letterB: string;
    tScore: number;
    pValue: number;
  }> = [];
  const groupResults = new Map<
    string,
    Map<
      string,
      {
        columnLetter: string;
        higherThan: string[];
        lowerThan: string[];
      }
    >
  >();

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const overlapMap = new Map<string, { overlapN: number }>();
  const pairKey = (rowKey: string, a: string, b: string) => {
    const [left, right] = a < b ? [a, b] : [b, a];
    return `${rowKey}|||${left}|||${right}`;
  };

  if (
    isColumnMultipleResponse &&
    !strategy.isMeans &&
    options.columnMultipleColumns &&
    options.columnMultipleColumns.length > 1
  ) {
    const overlapSql = buildOverlapQuery({
      rowVars: options.rowVars,
      columns: options.columnMultipleColumns,
      filters: options.filters,
      additionalWhere: options.additionalWhere,
      weightVar: options.weightVar,
    });
    const overlapResult = await adapter.query(overlapSql);
    (overlapResult.rows as CrosstabOverlapSqlRow[]).forEach((overlapRow) => {
      const rowKey = joinRowKeyPath(overlapRow);
      const overlapN = Number(overlapRow.overlapCount ?? 0);
      overlapMap.set(pairKey(rowKey, String(overlapRow.colKeyA), String(overlapRow.colKeyB)), { overlapN });
    });
  }

  rowKeyGroups.forEach((rowCells, rowKey) => {
    const totalRow = totalsMap.get(rowKey);
    const totalN = Number(totalRow?.weightedCount ?? totalRow?.count ?? 0);
    const totalESS = calculateESS(totalN, Number(totalRow?.sumSqWeights ?? totalN));
    const baseNForDependentTest = options.weightVar ? totalESS : totalN;

    const columnStatsArray = strategy.buildColumnStats(rowCells, colStats);
    const cellNByColKey = new Map<string, number>();
    rowCells.forEach((cell) => {
      const key = String(cell.colKey);
      const n = Number(cell.weightedCount ?? cell.count);
      cellNByColKey.set(key, n);
    });

    const columnLetters = new Map<string, string>();
    const rowResults = new Map<string, { columnLetter: string; higherThan: string[]; lowerThan: string[] }>();

    columnStatsArray.forEach((col, idx) => {
      const letter = letters[idx] || `(${idx + 1})`;
      columnLetters.set(col.key, letter);
      rowResults.set(col.key, {
        columnLetter: letter,
        higherThan: [],
        lowerThan: [],
      });
    });
    groupResults.set(rowKey, rowResults);

    for (let i = 0; i < columnStatsArray.length; i++) {
      for (let j = i + 1; j < columnStatsArray.length; j++) {
        const colA = columnStatsArray[i];
        const colB = columnStatsArray[j];

        if (colA.ess < 2 || colB.ess < 2) continue;

        const { tScore, pValue } = strategy.computePairwiseTest(
          {
            colA,
            colB,
            rowKey,
            totalN,
            totalESS,
            baseNForDependentTest,
            cellNByColKey,
            overlapMap,
            isColumnMultipleResponse,
          },
          pairKey,
        );

        pairwiseTests.push({
          rowKey,
          colA: colA.key,
          colB: colB.key,
          letterA: columnLetters.get(colA.key)!,
          letterB: columnLetters.get(colB.key)!,
          tScore,
          pValue,
        });
      }
    }
  });

  if (pairwiseTests.length > 0) {
    const pairwiseSig = applyMultipleTestingCorrection(
      pairwiseTests.map((test) => test.pValue),
      significanceOptions.correctionType,
      alpha,
    );

    pairwiseTests.forEach((test, idx) => {
      if (!pairwiseSig[idx]) return;
      const rowResults = groupResults.get(test.rowKey);
      if (!rowResults) return;
      if (test.tScore > 0) {
        rowResults.get(test.colA)?.higherThan.push(test.letterB);
        rowResults.get(test.colB)?.lowerThan.push(test.letterA);
      } else if (test.tScore < 0) {
        rowResults.get(test.colB)?.higherThan.push(test.letterA);
        rowResults.get(test.colA)?.lowerThan.push(test.letterB);
      }
    });
  }

  const overlapCorrected = isColumnMultipleResponse && !strategy.isMeans;
  rowKeyGroups.forEach((rowCells, rowKey) => {
    const rowResults = groupResults.get(rowKey);
    rowCells.forEach((cell) => {
      const result = rowResults?.get(getColKeyString(cell));
      if (!result) return;
      result.higherThan.sort();
      cell.sigLetters = result.higherThan.join('');
      cell.columnLetter = result.columnLetter;
      if (overlapCorrected && cell.stats) {
        cell.stats.isOverlapCorrected = true;
      }
    });
  });
}

function clearPairwiseMarkers(rows: CrosstabSqlRow[]): void {
  rows.forEach((row) => {
    delete row.sigLetters;
    delete row.columnLetter;
  });
}

/**
 * Apply cell-vs-rest and optional pairwise significance testing to crosstab rows.
 * Mutates rows in place.
 */
export async function applySignificanceTesting(
  adapter: DatabaseAdapter,
  options: CrosstabQueryOptions & { significanceOptions?: SignificanceOptions },
  rows: CrosstabSqlRow[],
): Promise<void> {
  if (!options.colVar && !(options.columnMultipleColumns && options.columnMultipleColumns.length > 0)) {
    return;
  }

  const significanceOptions: Required<SignificanceOptions> = {
    ...DEFAULT_SIGNIFICANCE_OPTIONS,
    ...options.significanceOptions,
  };
  const alpha = significanceLevelToAlpha(significanceOptions.significanceLevel);
  const pairwiseMode = significanceOptions.comparisonMethod === 'pairwise';
  const strategy = createSignificanceStrategy(options.measureVar !== undefined);

  const totalsOptions = {
    ...options,
    colVar: null,
    columnMultipleColumns: undefined,
  };
  const totalsSql = buildCrosstabQuery(totalsOptions);
  const totalsResult = await adapter.query(totalsSql);
  const totals = totalsResult.rows as CrosstabSqlRow[];

  const totalsMap = new Map<string, CrosstabSqlRow>();
  totals.forEach((t) => {
    totalsMap.set(joinRowKeyPath(t), t);
  });

  const colStats = buildColStats(rows);
  const cellTestResults: Array<{ row: CrosstabSqlRow; tScore: number; pValue: number }> = [];

  rows.forEach((row) => {
    const rowKey = joinRowKeyPath(row);
    const totalRow = totalsMap.get(rowKey);

    if (totalRow) {
      const cellN = row.weightedCount ?? row.count;
      const cellESS = calculateESS(cellN, row.sumSqWeights ?? cellN);

      const totalN = totalRow.weightedCount ?? totalRow.count;
      const totalESS = calculateESS(totalN, totalRow.sumSqWeights ?? totalN);

      const restN = totalN - cellN;
      const restESS = Math.max(0, totalESS - cellESS);

      const ctx: CellVsRestContext = {
        row,
        totalRow,
        cellN,
        cellESS,
        totalN,
        totalESS,
        restN,
        restESS,
        colStats,
      };

      const tScore = strategy.computeCellVsRestTScore(ctx);
      const absT = Math.abs(tScore);
      const pValue = calculatePValue(tScore);

      row.stats = {
        tScore,
        pValue,
        effN: cellESS,
      };
      if (absT > 0) {
        cellTestResults.push({ row, tScore, pValue });
      } else {
        cellTestResults.push({ row, tScore: 0, pValue });
      }

      strategy.applyConfidenceIntervals(row, ctx);
    }
  });

  applyCellVsRestMarkers(cellTestResults, significanceOptions, alpha, pairwiseMode);

  if (pairwiseMode) {
    await applyPairwiseComparisons(adapter, options, rows, totalsMap, colStats, strategy, significanceOptions, alpha);
  } else {
    clearPairwiseMarkers(rows);
  }
}
