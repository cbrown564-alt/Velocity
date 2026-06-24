import { HistogramBin } from '../../../types';
import { DatabaseAdapter } from '../../DatabaseAdapter';
import {
  buildGridHistogramQuery,
  buildFilterClause,
  CrosstabQueryOptions,
  escapeIdentifier,
  escapeString,
} from '../../sql/queryBuilder';
import { extractRowKeyStrings } from './rowKeys';
import type { CrosstabHistogramBinSqlRow, CrosstabSqlRow } from './types';

/**
 * Attach histogram bins to crosstab rows when distributions are requested.
 * Mutates rows in place; failures are logged and swallowed.
 */
export async function attachHistograms(
  adapter: DatabaseAdapter,
  options: CrosstabQueryOptions & { includeDistributions?: boolean },
  rows: CrosstabSqlRow[]
): Promise<void> {
  const shouldComputeHistogram =
    (options.measureVar || (options.gridColumns && options.gridAggregate)) &&
    options.includeDistributions;

  if (!shouldComputeHistogram) return;

  try {
    const binCount = 20;
    let histSql = '';
    let minVal = 0;
    let maxVal = 0;
    let binWidth = 1;

    // Scenario A: Numeric Grid
    if (options.gridColumns && options.gridAggregate) {
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
        columns: options.gridColumns,
        filters: options.filters,
        additionalWhere: options.additionalWhere,
        colVar: options.colVar,
        minVal,
        maxVal,
        binCount
      });
    }
    // Scenario B: Standard Variable
    else if (options.measureVar) {
      const measure = options.measureVar;
      const safeMeasure = `"${escapeIdentifier(measure)}"`;

      const whereConditions: string[] = [];
      if (options.filters && options.filters.length > 0) {
        const clause = buildFilterClause(options.filters);
        if (clause) whereConditions.push(clause);
      }
      if (options.additionalWhere) {
        whereConditions.push(options.additionalWhere);
      }
      const whereSql = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const rangeSql = `SELECT MIN(${safeMeasure}) as minVal, MAX(${safeMeasure}) as maxVal FROM main ${whereSql}`;
      const rangeRes = await adapter.query(rangeSql);
      const rangeRow = rangeRes.rows[0] as { minVal?: unknown; maxVal?: unknown };

      if (rangeRow && rangeRow.minVal !== null && rangeRow.maxVal !== null) {
        minVal = Number(rangeRow.minVal);
        maxVal = Number(rangeRow.maxVal);
        const range = maxVal - minVal;
        binWidth = range > 0 ? range / binCount : 1;

        let rowGroups: string[] = [];
        let groupByCols: string[] = [];

        if (options.rowVars.length === 0 && options.measureLabel) {
          rowGroups = [`'${escapeString(options.measureLabel)}' as rowKey_0`];
        } else {
          rowGroups = options.rowVars.map((r, i) => `"${escapeIdentifier(r)}" as rowKey_${i}`);
          groupByCols = options.rowVars.map(r => `"${escapeIdentifier(r)}"`);
        }

        let colGroup = '';
        if (options.colVar) {
          colGroup = `"${escapeIdentifier(options.colVar)}" as colKey`;
        } else if (options.measureLabel && options.rowVars.length > 0) {
          colGroup = `'${escapeString(options.measureLabel)}' as colKey`;
        } else {
          colGroup = `'Total' as colKey`;
        }

        if (options.colVar) {
          groupByCols.push(`"${escapeIdentifier(options.colVar)}"`);
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

      for (const row of histRes.rows as CrosstabHistogramBinSqlRow[]) {
        const keyParts = extractRowKeyStrings(row);
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
        const keyParts = extractRowKeyStrings(r);
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
