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
import { calculateTScore, calculateESS, calculatePValue } from '../../services/statistics';

export interface CrosstabContext {
  variables: Record<string, Variable>;
  variableSets: Record<string, VariableSet>;
}

export async function runCrosstab(
  adapter: DatabaseAdapter,
  options: CrosstabQueryOptions & { includeDistributions?: boolean },
  context: CrosstabContext
): Promise<any[]> {
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
    const totalsOptions = {
      ...modifiedOptions,
      colVar: null
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

    // Apply Sig Tests
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
            const m1 = Number(row.mean);
            const s1 = Number(row.stdDev);
            const n1 = cellESS;

            const mT = Number(totalRow.mean);
            const sT = Number(totalRow.stdDev);
            const nT = totalESS;

            tScore = calculateTScore(m1, s1, n1, mT, sT, nT);
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
        if (absT > 1.96) {
          row.sig = tScore > 0 ? 'high_95' : 'low_95';
        } else if (absT > 1.28) {
          row.sig = tScore > 0 ? 'high_80' : 'low_80';
        }
      }
    });
  }

  return rows;
}
