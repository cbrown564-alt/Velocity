/**
 * Crosstab Runner
 *
 * Orchestrates crosstab analysis: grid expansion, nested scale detection,
 * histogram computation, and significance testing. Uses DatabaseAdapter
 * for database-agnostic operation.
 *
 * Extracted from analysisWorker.ts for reuse in CLI and testing contexts.
 */

import { Variable, VariableSet, HistogramBin } from '../../types';
import { DatabaseAdapter } from '../DatabaseAdapter';
import {
  buildCrosstabQuery,
  buildGridHistogramQuery,
  CrosstabQueryOptions,
  buildFilterClause,
  escapeIdentifier,
  escapeString,
} from '../../services/queryBuilder';
import {
  calculateTScore,
  calculateESS,
  calculatePValue,
  calculateChiSquare,
  ChiSquareResult,
  calculateMeanCI,
  calculateProportionCI,
  ColumnStats,
  applyMultipleTestingCorrection,
  bonferroniAdjustedPValues,
  benjaminiHochbergAdjustedPValues,
} from '../../services/statistics';
import { AnalysisRunner } from './AnalysisRunner';
import { analysisRegistry } from './registry';

export interface CrosstabContext {
  variables: Record<string, Variable>;
  variableSets: Record<string, VariableSet>;
}

export interface SignificanceOptions {
  comparisonMethod?: 'cell_vs_rest' | 'pairwise';
  correctionType?: 'none' | 'bonferroni' | 'fdr';
  significanceLevel?: 0.95 | 0.90 | 0.80;
}

const DEFAULT_SIGNIFICANCE_OPTIONS: Required<SignificanceOptions> = {
  comparisonMethod: 'cell_vs_rest',
  correctionType: 'none',
  significanceLevel: 0.95,
};

function significanceLevelToAlpha(level: 0.95 | 0.90 | 0.80): number {
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

export type CrosstabConfig = CrosstabQueryOptions & {
  includeDistributions?: boolean;
  significanceOptions?: SignificanceOptions;
  context: CrosstabContext;
};
export interface CrosstabResultData {
  rows: any[];
  tableStats?: {
    chiSquare?: ChiSquareResult;
  };
}

export type CrosstabResult = CrosstabResultData;

export class CrosstabRunner implements AnalysisRunner<CrosstabConfig, CrosstabResult> {
  readonly id = 'crosstab';
  readonly label = 'Crosstab Analysis';
  readonly configSchema = {
    // Basic schema for UI generation
    type: 'object',
    properties: {
      rowVars: { type: 'array', items: { type: 'string' } },
      colVar: { type: 'string', nullable: true },
      filters: { type: 'array' },
      includeDistributions: { type: 'boolean' }
    }
  };

  async run(adapter: DatabaseAdapter, config: CrosstabConfig): Promise<CrosstabResult> {
    const { context, ...options } = config;
    const result = await runCrosstab(adapter, options, context);
    return result;
  }
}

// Singleton instance
export const crosstabRunner = new CrosstabRunner();

// Register with the central registry
analysisRegistry.register(crosstabRunner);

export async function runCrosstab(
  adapter: DatabaseAdapter,
  options: CrosstabQueryOptions & { includeDistributions?: boolean; significanceOptions?: SignificanceOptions },
  context: CrosstabContext
): Promise<CrosstabResultData> {
  const modifiedOptions = { ...options };

  // 0. Synthetic Grid Variable Expansion
  let foundGridVar: Variable | null = null;

  if (modifiedOptions.rowVars.length > 0) {
    const v = context.variables[modifiedOptions.rowVars[0]];
    if (v?.synthetic && v.sourceGridId) foundGridVar = v;
  }

  if (!foundGridVar && modifiedOptions.colVar) {
    const v = context.variables[modifiedOptions.colVar];
    if (v?.synthetic && v.sourceGridId) foundGridVar = v;
  }

  if (foundGridVar) {
    const firstRowVar = foundGridVar;
    const gridSet = context.variableSets[firstRowVar.sourceGridId!];

    if (gridSet && gridSet.structure === 'grid' && gridSet.gridMetadata) {
      modifiedOptions.gridColumns = gridSet.variableIds.map(varId => {
        const itemVar = context.variables[varId];
        return {
          name: varId,
          label: itemVar?.label || varId
        };
      });

      // Sanitize colVar
      if (modifiedOptions.colVar) {
        const v = context.variables[modifiedOptions.colVar];
        if (v?.synthetic && v.sourceGridId === gridSet.id) {
          modifiedOptions.colVar = null;
        }
      }

      // Sanitize Filters
      if (modifiedOptions.filters) {
        modifiedOptions.filters = modifiedOptions.filters.map(f => {
          const v = context.variables[f.variableId];
          if (v?.synthetic && v.sourceGridId === gridSet.id) {
            if (f.variableId.endsWith('_items')) {
              return { ...f, variableId: 'item_index' };
            }
            if (f.variableId.endsWith('_scale')) {
              return { ...f, variableId: '_synthetic_value' };
            }
          }
          return f;
        });
      }

      const isNumericGrid = gridSet.gridMetadata.sharedScale.type === 'numeric';

      if (isNumericGrid) {
        modifiedOptions.gridAggregate = true;
        modifiedOptions.includeDistributions = false;
        modifiedOptions.measureVar = undefined;
        modifiedOptions.measureLabel = undefined;
      } else {
        modifiedOptions.includeDistributions = false;
        modifiedOptions.measureVar = undefined;
        modifiedOptions.measureLabel = undefined;
      }
    }
  }

  // 1. Handle Nested Scale Variables
  if (!modifiedOptions.measureVar && modifiedOptions.colVar) {
    const colVarId = modifiedOptions.colVar;
    const colVar = context.variables[colVarId];

    if (colVar?.type === 'numeric' && !colVar.synthetic) {
      modifiedOptions.measureVar = colVarId;
      if (!modifiedOptions.measureLabel) {
        modifiedOptions.measureLabel = colVar.label || colVar.name;
      }
      modifiedOptions.colVar = null;
    }
  }

  if (!modifiedOptions.measureVar && modifiedOptions.rowVars.length > 0) {
    const lastRowVarId = modifiedOptions.rowVars[modifiedOptions.rowVars.length - 1];
    const lastRowVar = context.variables[lastRowVarId];

    if (lastRowVar?.type === 'numeric' && !lastRowVar.synthetic) {
      modifiedOptions.measureVar = lastRowVarId;
      if (!modifiedOptions.measureLabel) {
        modifiedOptions.measureLabel = lastRowVar.label || lastRowVar.name;
      }
      modifiedOptions.rowVars = modifiedOptions.rowVars.slice(0, -1);
    }
  }

  // 2. Generate and Run Main Query
  const sql = buildCrosstabQuery(modifiedOptions);
  const mainResult = await adapter.query(sql);
  const rows = mainResult.rows as any[];

  // 2.5 Grouped Histogram (for Violin/Ridgeline)
  const shouldComputeHistogram =
    (modifiedOptions.measureVar || (modifiedOptions.gridColumns && modifiedOptions.gridAggregate)) &&
    modifiedOptions.includeDistributions;

  if (shouldComputeHistogram) {
    try {
      const binCount = 20;
      let histSql = '';
      let minVal = 0;
      let maxVal = 0;
      let binWidth = 1;

      // Scenario A: Numeric Grid
      if (modifiedOptions.gridColumns && modifiedOptions.gridAggregate) {
        const validRows = rows.filter(r => r.min !== undefined && r.max !== undefined);

        if (validRows.length > 0) {
          minVal = Math.min(...validRows.map(r => r.min as number));
          maxVal = Math.max(...validRows.map(r => r.max as number));
        } else {
          minVal = 1; maxVal = 5;
        }

        const range = maxVal - minVal;
        binWidth = range > 0 ? range / binCount : 1;

        histSql = buildGridHistogramQuery({
          columns: modifiedOptions.gridColumns,
          filters: modifiedOptions.filters,
          colVar: modifiedOptions.colVar,
          minVal,
          maxVal,
          binCount
        });
      }
      // Scenario B: Standard Variable
      else if (modifiedOptions.measureVar) {
        const measure = modifiedOptions.measureVar;
        const safeMeasure = `"${escapeIdentifier(measure)}"`;

        let whereSql = '';
        if (modifiedOptions.filters && modifiedOptions.filters.length > 0) {
          const clause = buildFilterClause(modifiedOptions.filters);
          if (clause) whereSql = `WHERE ${clause}`;
        }

        const rangeSql = `SELECT MIN(${safeMeasure}) as minVal, MAX(${safeMeasure}) as maxVal FROM main ${whereSql}`;
        const rangeRes = await adapter.query(rangeSql);
        const rangeRow = rangeRes.rows[0] as any;

        if (rangeRow && rangeRow.minVal !== null && rangeRow.maxVal !== null) {
          minVal = Number(rangeRow.minVal);
          maxVal = Number(rangeRow.maxVal);
          const range = maxVal - minVal;
          binWidth = range > 0 ? range / binCount : 1;

          let rowGroups: string[] = [];
          let groupByCols: string[] = [];

          if (modifiedOptions.rowVars.length === 0 && modifiedOptions.measureLabel) {
            rowGroups = [`'${escapeString(modifiedOptions.measureLabel)}' as rowKey_0`];
          } else {
            rowGroups = modifiedOptions.rowVars.map((r, i) => `"${escapeIdentifier(r)}" as rowKey_${i}`);
            groupByCols = modifiedOptions.rowVars.map(r => `"${escapeIdentifier(r)}"`);
          }

          let colGroup = '';
          if (modifiedOptions.colVar) {
            colGroup = `"${escapeIdentifier(modifiedOptions.colVar)}" as colKey`;
          } else if (modifiedOptions.measureLabel && modifiedOptions.rowVars.length > 0) {
            colGroup = `'${escapeString(modifiedOptions.measureLabel)}' as colKey`;
          } else {
            colGroup = `'Total' as colKey`;
          }

          if (modifiedOptions.colVar) {
            groupByCols.push(`"${escapeIdentifier(modifiedOptions.colVar)}"`);
          }

          const groupByClause = groupByCols.length > 0 ? groupByCols.join(', ') + ',' : '';

          const bucketExpr = `
            CASE
              WHEN ${range} = 0 THEN 1
              ELSE LEAST(FLOOR((${safeMeasure} - ${minVal}) / ${binWidth}) + 1, ${binCount})::INTEGER
            END
          `;

          histSql = `
            SELECT
              ${rowGroups.length > 0 ? rowGroups.join(', ') + ',' : ''}
              ${colGroup},
              ${bucketExpr} as bucket,
              COUNT(*) as cnt
            FROM main
            ${whereSql}
            ${whereSql ? 'AND' : 'WHERE'} ${safeMeasure} IS NOT NULL
            GROUP BY ${groupByClause} bucket
          `;
        }
      }

      if (histSql) {
        const histRes = await adapter.query(histSql);

        const binMap = new Map<string, HistogramBin[]>();

        for (const row of histRes.rows as any[]) {
          const keyParts = [];
          let i = 0;
          while (row[`rowKey_${i}`] !== undefined) {
            keyParts.push(String(row[`rowKey_${i}`]));
            i++;
          }
          keyParts.push(String(row.colKey));
          const key = keyParts.join('|||');

          if (!binMap.has(key)) binMap.set(key, []);

          const b = Number(row.bucket);
          binMap.get(key)!.push({
            x0: minVal + (b - 1) * binWidth,
            x1: minVal + b * binWidth,
            count: Number(row.cnt)
          });
        }

        rows.forEach(r => {
          const keyParts = [];
          let i = 0;
          while (r[`rowKey_${i}`] !== undefined) {
            keyParts.push(String(r[`rowKey_${i}`]));
            i++;
          }
          keyParts.push(String(r.colKey));
          const key = keyParts.join('|||');

          const bins = binMap.get(key) || [];
          bins.sort((a: HistogramBin, b: HistogramBin) => a.x0 - b.x0);

          r.histogramBins = bins;
        });
      }
    } catch (e) {
      console.warn('Histogram generation failed:', e);
    }
  }

  // 3. Significance Testing
  if (modifiedOptions.colVar) {
    const significanceOptions = {
      ...DEFAULT_SIGNIFICANCE_OPTIONS,
      ...modifiedOptions.significanceOptions,
    };
    const alpha = significanceLevelToAlpha(significanceOptions.significanceLevel);
    const pairwiseMode = significanceOptions.comparisonMethod === 'pairwise';

    const totalsOptions = {
      ...modifiedOptions,
      colVar: null,
    };
    const totalsSql = buildCrosstabQuery(totalsOptions);
    const totalsResult = await adapter.query(totalsSql);
    const totals = totalsResult.rows as any[];

    const totalsMap = new Map<string, any>();
    totals.forEach(t => {
      const keyParts = [];
      let i = 0;
      while (t[`rowKey_${i}`] !== undefined) {
        keyParts.push(String(t[`rowKey_${i}`]));
        i++;
      }
      totalsMap.set(keyParts.join('|'), t);
    });

    // Calculate Column Totals
    const colStats = new Map<string, { n: number; ess: number }>();
    rows.forEach(row => {
      const colKey = row.colKey || 'Total';
      const n = row.weightedCount ?? row.count;
      const ess = calculateESS(n, row.sumSqWeights ?? n);

      const current = colStats.get(colKey) || { n: 0, ess: 0 };
      colStats.set(colKey, { n: current.n + n, ess: current.ess + ess });
    });

    const cellTestResults: Array<{ row: any; tScore: number; pValue: number }> = [];

    // Compute raw cell-vs-rest tests first, then apply correction in one pass.
    rows.forEach(row => {
      const keyParts = [];
      let i = 0;
      while (row[`rowKey_${i}`] !== undefined) {
        keyParts.push(String(row[`rowKey_${i}`]));
        i++;
      }
      const rowKey = keyParts.join('|');
      const totalRow = totalsMap.get(rowKey);

      if (totalRow) {
        let tScore = 0;
        const isMeans = modifiedOptions.measureVar !== undefined;

        const cellN = row.weightedCount ?? row.count;
        const cellESS = calculateESS(cellN, row.sumSqWeights ?? cellN);

        const totalN = totalRow.weightedCount ?? totalRow.count;
        const totalESS = calculateESS(totalN, totalRow.sumSqWeights ?? totalN);

        const restN = totalN - cellN;
        const restESS = Math.max(0, totalESS - cellESS);

        if (cellESS > 2 && restESS > 2) {
          if (isMeans) {
            // Cell statistics
            const m1 = Number(row.mean);
            const s1 = Number(row.stdDev);
            const n1 = cellESS;

            // Compute exact Rest statistics using sum decomposition
            // Rest = Total - Cell
            const cellSumXW = row.sumXW ?? (row.mean ?? 0) * cellN;
            const cellSumX2W = row.sumX2W ?? ((row.stdDev ?? 0) ** 2 + (row.mean ?? 0) ** 2) * cellN;
            const totalSumXW = totalRow.sumXW ?? (totalRow.mean ?? 0) * totalN;
            const totalSumX2W = totalRow.sumX2W ?? ((totalRow.stdDev ?? 0) ** 2 + (totalRow.mean ?? 0) ** 2) * totalN;

            const restSumXW = totalSumXW - cellSumXW;
            const restSumX2W = totalSumX2W - cellSumX2W;

            // Rest mean and variance
            let m2 = 0;
            let s2 = 0;
            if (restN > 0) {
              m2 = restSumXW / restN;
              const restVariance = Math.max(0, (restSumX2W / restN) - (m2 * m2));
              s2 = Math.sqrt(restVariance);
            }
            const n2 = restESS;

            tScore = calculateTScore(m1, s1, n1, m2, s2, n2);
          } else {
            const colKey = row.colKey || 'Total';
            const colBase = colStats.get(colKey);
            const colN = colBase?.n || 0;

            if (colN > 0) {
              const p1 = cellN / colN;
              const s1 = Math.sqrt(p1 * (1 - p1));
              const n1 = cellESS;

              let grandCurrent = 0;
              for (const v of colStats.values()) grandCurrent += v.n;

              const restCount = totalN - cellN;
              const restBase = grandCurrent - colN;

              if (restBase > 0) {
                const p2 = restCount / restBase;
                const s2 = Math.sqrt(p2 * (1 - p2));

                const eff = totalESS / totalN;
                const n2 = restBase * eff;

                tScore = calculateTScore(p1, s1, n1, p2, s2, n2);
              }
            }
          }
        }

        const absT = Math.abs(tScore);
        const pValue = calculatePValue(tScore);

        row.stats = {
          tScore,
          pValue,
          effN: cellESS
        };
        if (absT > 0) {
          cellTestResults.push({ row, tScore, pValue });
        } else {
          cellTestResults.push({ row, tScore: 0, pValue });
        }

        // Compute confidence intervals
        if (isMeans && row.mean !== undefined && row.stdDev !== undefined) {
          // CI for mean
          row.ci95 = calculateMeanCI(Number(row.mean), Number(row.stdDev), cellESS, 0.95);
          row.ci80 = calculateMeanCI(Number(row.mean), Number(row.stdDev), cellESS, 0.80);
        } else if (!isMeans) {
          // CI for proportion
          const colKey = row.colKey || 'Total';
          const colBase = colStats.get(colKey);
          const colN = colBase?.n || 0;
          if (colN > 0) {
            const proportion = cellN / colN;
            row.ci95 = calculateProportionCI(proportion, cellESS, 0.95);
            row.ci80 = calculateProportionCI(proportion, cellESS, 0.80);
          }
        }
      }
    });

    if (cellTestResults.length > 0) {
      const rawPValues = cellTestResults.map(test => test.pValue);
      const adjustedPValues = getAdjustedPValues(rawPValues, significanceOptions.correctionType);
      const primarySig = applyMultipleTestingCorrection(rawPValues, significanceOptions.correctionType, alpha);

      // Preserve legacy "moderate" markers when operating at 95% confidence.
      const secondarySig =
        significanceOptions.significanceLevel >= 0.95
          ? applyMultipleTestingCorrection(rawPValues, significanceOptions.correctionType, 0.20)
          : null;

      cellTestResults.forEach((test, idx) => {
        if (!test.row.stats) return;

        test.row.stats.adjustedPValue = adjustedPValues[idx];
        test.row.stats.correctionMethod = significanceOptions.correctionType;

        // Pairwise mode suppresses arrows/flags from cell-vs-rest markers.
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

    // 3b. Pairwise Column Comparisons (Letter Codes)
    if (pairwiseMode) {
      // Group rows by their row key path for pairwise comparisons
      const rowKeyGroups = new Map<string, any[]>();
      rows.forEach(row => {
        const keyParts = [];
        let i = 0;
        while (row[`rowKey_${i}`] !== undefined) {
          keyParts.push(String(row[`rowKey_${i}`]));
          i++;
        }
        const rowKey = keyParts.join('|');
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
      const groupResults = new Map<string, Map<string, {
        columnLetter: string;
        higherThan: string[];
        lowerThan: string[];
      }>>();

      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const isMeans = modifiedOptions.measureVar !== undefined;

      rowKeyGroups.forEach((rowCells, rowKey) => {
        const columnStatsArray: ColumnStats[] = rowCells.map(cell => {
          const cellN = cell.weightedCount ?? cell.count;
          const cellESS = calculateESS(cellN, cell.sumSqWeights ?? cellN);
          const colKey = cell.colKey || 'Total';
          const colBase = colStats.get(colKey);
          const colN = colBase?.n || 0;

          return {
            key: cell.colKey,
            mean: isMeans ? Number(cell.mean) : undefined,
            stdDev: isMeans ? Number(cell.stdDev) : undefined,
            proportion: !isMeans && colN > 0 ? cellN / colN : undefined,
            ess: cellESS,
          };
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

            let tScore = 0;
            if (isMeans) {
              if (
                colA.mean !== undefined && colB.mean !== undefined &&
                colA.stdDev !== undefined && colB.stdDev !== undefined
              ) {
                tScore = calculateTScore(
                  colA.mean, colA.stdDev, colA.ess,
                  colB.mean, colB.stdDev, colB.ess
                );
              }
            } else {
              if (colA.proportion !== undefined && colB.proportion !== undefined) {
                const s1 = Math.sqrt(colA.proportion * (1 - colA.proportion));
                const s2 = Math.sqrt(colB.proportion * (1 - colB.proportion));
                tScore = calculateTScore(
                  colA.proportion, s1, colA.ess,
                  colB.proportion, s2, colB.ess
                );
              }
            }

            pairwiseTests.push({
              rowKey,
              colA: colA.key,
              colB: colB.key,
              letterA: columnLetters.get(colA.key)!,
              letterB: columnLetters.get(colB.key)!,
              tScore,
              pValue: calculatePValue(tScore),
            });
          }
        }
      });

      if (pairwiseTests.length > 0) {
        const pairwiseSig = applyMultipleTestingCorrection(
          pairwiseTests.map(test => test.pValue),
          significanceOptions.correctionType,
          alpha
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

      rowKeyGroups.forEach((rowCells, rowKey) => {
        const rowResults = groupResults.get(rowKey);
        rowCells.forEach(cell => {
          const result = rowResults?.get(cell.colKey);
          if (!result) return;
          result.higherThan.sort();
          cell.sigLetters = result.higherThan.join('');
          cell.columnLetter = result.columnLetter;
        });
      });
    } else {
      // Ensure pairwise markers are absent when cell-vs-rest mode is active.
      rows.forEach(row => {
        delete row.sigLetters;
        delete row.columnLetter;
      });
    }
  }

  // 4. Chi-Square Test for Categorical Independence
  let tableStats: { chiSquare?: ChiSquareResult } | undefined;

  if (modifiedOptions.colVar && !modifiedOptions.measureVar && !modifiedOptions.gridAggregate) {
    // Only compute chi-square for categorical (non-metric) crosstabs
    try {
      // Build contingency table from rows
      const rowLabels = [...new Set(rows.map(r => {
        const keyParts = [];
        let i = 0;
        while (r[`rowKey_${i}`] !== undefined) {
          keyParts.push(String(r[`rowKey_${i}`]));
          i++;
        }
        return keyParts.join('|');
      }))];
      const colLabels = [...new Set(rows.map(r => r.colKey).filter(k => k !== 'Total'))];

      if (rowLabels.length > 1 && colLabels.length > 1) {
        const contingencyTable: number[][] = [];

        for (const rowLabel of rowLabels) {
          const tableRow: number[] = [];
          for (const colLabel of colLabels) {
            const cell = rows.find(r => {
              const keyParts = [];
              let i = 0;
              while (r[`rowKey_${i}`] !== undefined) {
                keyParts.push(String(r[`rowKey_${i}`]));
                i++;
              }
              return keyParts.join('|') === rowLabel && r.colKey === colLabel;
            });
            const count = cell ? (cell.weightedCount ?? cell.count ?? 0) : 0;
            tableRow.push(count);
          }
          contingencyTable.push(tableRow);
        }

        const chiSquareResult = calculateChiSquare(contingencyTable);
        tableStats = { chiSquare: chiSquareResult };
      }
    } catch (e) {
      console.warn('Chi-square calculation failed:', e);
    }
  }

  return { rows, tableStats };
}
