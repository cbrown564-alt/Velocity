/**
 * Variable Stats Runner
 *
 * Computes frequency distributions and numeric statistics for a single variable.
 * Uses DatabaseAdapter for database-agnostic operation.
 *
 * Extracted from analysisWorker.ts for reuse in CLI and testing contexts.
 */

import { HistogramBin } from '../../types';
import { VariableStatsResult, VariableStatsFrequency } from '../../types/worker';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { AnalysisRunner } from './AnalysisRunner';
import { analysisRegistry } from './registry';
import type { MissingValueDef, VariableType } from '../../types';
import { allowsNumericStats } from '../../types';

export interface VariableStatsConfig {
  column: string;
  variableType?: VariableType;
  orderedScoring?: 'categorical_only' | 'allow_numeric_stats';
  binCount?: number;
  missingValues?: MissingValueDef;
}

export class VariableStatsRunner implements AnalysisRunner<VariableStatsConfig, VariableStatsResult> {
  readonly id = 'variableStats';
  readonly label = 'Variable Statistics';
  readonly configSchema = {
    type: 'object',
    properties: {
      column: { type: 'string' },
      variableType: {
        type: 'string',
        enum: ['categorical', 'ordered', 'numeric', 'text', 'date', 'nominal', 'ordinal', 'scale'],
      },
      binCount: { type: 'number' },
    },
    required: ['column'],
  };

  async run(adapter: DatabaseAdapter, config: VariableStatsConfig): Promise<VariableStatsResult> {
    return getVariableStats(
      adapter,
      config.column,
      config.variableType,
      config.orderedScoring,
      config.binCount,
      config.missingValues,
    );
  }
}

// Singleton instance
export const variableStatsRunner = new VariableStatsRunner();

// Register with the central registry
analysisRegistry.register(variableStatsRunner);

export async function getVariableStats(
  adapter: DatabaseAdapter,
  column: string,
  variableType?: VariableType,
  orderedScoring?: 'categorical_only' | 'allow_numeric_stats',
  binCount: number = 10,
  missingValues?: MissingValueDef,
): Promise<VariableStatsResult> {
  const escapedColumn = column.replace(/"/g, '""');
  const userMissingConditions: string[] = [];
  const missingConditions: string[] = [`"${escapedColumn}" IS NULL`];

  const discrete = missingValues?.discrete?.filter((v): v is number => Number.isFinite(v));
  if (discrete && discrete.length > 0) {
    const condition = `"${escapedColumn}" IN (${discrete.join(', ')})`;
    userMissingConditions.push(condition);
    missingConditions.push(condition);
  }
  const range = missingValues?.range;
  if (range && Number.isFinite(range.low) && Number.isFinite(range.high)) {
    const low = Math.min(range.low, range.high);
    const high = Math.max(range.low, range.high);
    const condition = `("${escapedColumn}" >= ${low} AND "${escapedColumn}" <= ${high})`;
    userMissingConditions.push(condition);
    missingConditions.push(condition);
  }
  const missingConditionSql = missingConditions.join(' OR ');
  const validConditionSql = `NOT (${missingConditionSql})`;

  // Get total count
  const totalRes = await adapter.query(`SELECT COUNT(*) as cnt FROM main`);
  const totalCount = Number(totalRes.rows[0]?.cnt);

  // Get missing count (system missing + user-defined missing).
  const missingRes = await adapter.query(`SELECT COUNT(*) as cnt FROM main WHERE ${missingConditionSql}`);
  const missingCount = Number(missingRes.rows[0]?.cnt);

  // Get frequency distribution (top 10 values by count)
  const freqRes = await adapter.query(`
    SELECT "${escapedColumn}" as value, COUNT(*) as cnt
    FROM main
    WHERE ${validConditionSql}
    GROUP BY "${escapedColumn}"
    ORDER BY cnt DESC, "${escapedColumn}" ASC
    LIMIT 10
  `);

  const frequencyMap = new Map<string, VariableStatsFrequency>();
  for (const row of freqRes.rows) {
    const value = row.value as number | string | null;
    const entry: VariableStatsFrequency = { value, count: Number(row.cnt) };
    frequencyMap.set(String(value), entry);
  }

  // Ensure user-missing coded values appear in the mapping even if not in top-10.
  if (userMissingConditions.length > 0) {
    const userMissingFreqRes = await adapter.query(`
      SELECT "${escapedColumn}" as value, COUNT(*) as cnt
      FROM main
      WHERE "${escapedColumn}" IS NOT NULL AND (${userMissingConditions.join(' OR ')})
      GROUP BY "${escapedColumn}"
    `);
    for (const row of userMissingFreqRes.rows) {
      const value = row.value as number | string | null;
      const key = String(value);
      const count = Number(row.cnt);
      const existing = frequencyMap.get(key);
      if (existing) {
        existing.count = count;
      } else {
        frequencyMap.set(key, { value, count });
      }
    }
  }

  const frequencies: VariableStatsFrequency[] = Array.from(frequencyMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const av = a.value;
    const bv = b.value;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  });

  const result: VariableStatsResult = {
    column,
    frequencies,
    missingCount,
    totalCount,
  };

  // Compute numeric statistics for numeric/scale variables
  if (allowsNumericStats(variableType, orderedScoring)) {
    try {
      const statsRes = await adapter.query(`
        SELECT
          MIN("${column}") as min_val,
          MAX("${column}") as max_val,
          AVG("${column}") as mean_val,
          MEDIAN("${column}") as median_val,
          STDDEV("${column}") as stddev_val,
          QUANTILE_CONT("${column}", 0.25) as q1_val,
          QUANTILE_CONT("${column}", 0.75) as q3_val
        FROM main
        WHERE ${validConditionSql}
      `);

      const statsRow = statsRes.rows[0] as any;

      if (statsRow && statsRow.min_val !== null && statsRow.max_val !== null) {
        const minVal = Number(statsRow.min_val);
        const maxVal = Number(statsRow.max_val);
        const mean = Number(statsRow.mean_val) || 0;
        const median = Number(statsRow.median_val) || 0;
        const stdDev = Number(statsRow.stddev_val) || 0;
        const q1 = Number(statsRow.q1_val) || minVal;
        const q3 = Number(statsRow.q3_val) || maxVal;

        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;

        // Compute adjacent values (whiskers)
        const fenceRes = await adapter.query(`
          SELECT
            MIN("${escapedColumn}") as whisker_min,
            MAX("${escapedColumn}") as whisker_max
          FROM main
          WHERE ${validConditionSql}
            AND "${escapedColumn}" >= ${lowerFence}
            AND "${escapedColumn}" <= ${upperFence}
        `);
        const fenceRow = fenceRes.rows[0] as any;
        const whiskerMin = fenceRow?.whisker_min !== null ? Number(fenceRow.whisker_min) : minVal;
        const whiskerMax = fenceRow?.whisker_max !== null ? Number(fenceRow.whisker_max) : maxVal;

        // Fetch Outliers
        const outliersRes = await adapter.query(`
          SELECT "${escapedColumn}" as val
          FROM main
          WHERE ${validConditionSql}
            AND ("${escapedColumn}" < ${lowerFence} OR "${escapedColumn}" > ${upperFence})
          LIMIT 100
        `);
        const outliers = outliersRes.rows.map((r: any) => Number(r.val));

        // Compute histogram bins
        const range = maxVal - minVal;
        const binWidth = range > 0 ? range / binCount : 1;

        const histRes = await adapter.query(`
          SELECT
            CASE
              WHEN ${range} = 0 THEN 1
              ELSE LEAST(FLOOR(("${escapedColumn}" - ${minVal}) / ${binWidth}) + 1, ${binCount})::INTEGER
            END as bucket,
            COUNT(*) as cnt
          FROM main
          WHERE ${validConditionSql}
          GROUP BY bucket
          ORDER BY bucket
        `);

        const histogramBins: HistogramBin[] = [];
        const bucketCounts = new Map<number, number>();

        for (const row of histRes.rows) {
          bucketCounts.set(Number(row.bucket), Number(row.cnt));
        }

        for (let i = 1; i <= binCount; i++) {
          histogramBins.push({
            x0: minVal + (i - 1) * binWidth,
            x1: minVal + i * binWidth,
            count: bucketCounts.get(i) || 0,
          });
        }

        result.numeric = {
          min: minVal,
          max: maxVal,
          mean,
          median,
          stdDev,
          q1,
          q3,
          histogramBins,
          iqr,
          lowerFence,
          upperFence,
          whiskerMin,
          whiskerMax,
          outliers,
        };
      }
    } catch (error: any) {
      console.warn(`Failed to compute numeric stats for ${column}:`, error.message);
    }
  }

  return result;
}
