/**
 * Variable Stats Runner
 *
 * Computes frequency distributions and numeric statistics for a single variable.
 * Uses DatabaseAdapter for database-agnostic operation.
 *
 * Extracted from analysisWorker.ts for reuse in CLI and testing contexts.
 */

import { HistogramBin } from '../../types';
import { VariableStatsResult, VariableStatsFrequency, NumericStats } from '../../types/worker';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { AnalysisRunner } from './AnalysisRunner';
import { analysisRegistry } from './registry';

export interface VariableStatsConfig {
  column: string;
  variableType?: 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date';
  binCount?: number;
}

export class VariableStatsRunner implements AnalysisRunner<VariableStatsConfig, VariableStatsResult> {
  readonly id = 'variableStats';
  readonly label = 'Variable Statistics';
  readonly configSchema = {
    type: 'object',
    properties: {
      column: { type: 'string' },
      variableType: { type: 'string', enum: ['nominal', 'ordinal', 'scale', 'numeric', 'text', 'date'] },
      binCount: { type: 'number' }
    },
    required: ['column']
  };

  async run(adapter: DatabaseAdapter, config: VariableStatsConfig): Promise<VariableStatsResult> {
    return getVariableStats(
      adapter,
      config.column,
      config.variableType,
      config.binCount
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
  variableType?: 'nominal' | 'ordinal' | 'scale' | 'numeric' | 'text' | 'date',
  binCount: number = 10
): Promise<VariableStatsResult> {
  // Get total count
  const totalRes = await adapter.query(`SELECT COUNT(*) as cnt FROM main`);
  const totalCount = Number(totalRes.rows[0]?.cnt);

  // Get missing count (NULL values)
  const missingRes = await adapter.query(`SELECT COUNT(*) as cnt FROM main WHERE "${column}" IS NULL`);
  const missingCount = Number(missingRes.rows[0]?.cnt);

  // Get frequency distribution (top 10 values by count)
  const freqRes = await adapter.query(`
    SELECT "${column}" as value, COUNT(*) as cnt
    FROM main
    WHERE "${column}" IS NOT NULL
    GROUP BY "${column}"
    ORDER BY cnt DESC, "${column}" ASC
    LIMIT 10
  `);

  const frequencies: VariableStatsFrequency[] = freqRes.rows.map((row: any) => ({
    value: row.value,
    count: Number(row.cnt),
  }));

  const result: VariableStatsResult = {
    column,
    frequencies,
    missingCount,
    totalCount,
  };

  // Compute numeric statistics for numeric/scale variables
  if (variableType === 'numeric' || variableType === 'scale') {
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
        WHERE "${column}" IS NOT NULL
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
            MIN("${column}") as whisker_min,
            MAX("${column}") as whisker_max
          FROM main
          WHERE "${column}" >= ${lowerFence} AND "${column}" <= ${upperFence}
        `);
        const fenceRow = fenceRes.rows[0] as any;
        const whiskerMin = fenceRow?.whisker_min !== null ? Number(fenceRow.whisker_min) : minVal;
        const whiskerMax = fenceRow?.whisker_max !== null ? Number(fenceRow.whisker_max) : maxVal;

        // Fetch Outliers
        const outliersRes = await adapter.query(`
          SELECT "${column}" as val
          FROM main
          WHERE ("${column}" < ${lowerFence} OR "${column}" > ${upperFence})
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
              ELSE LEAST(FLOOR(("${column}" - ${minVal}) / ${binWidth}) + 1, ${binCount})::INTEGER
            END as bucket,
            COUNT(*) as cnt
          FROM main
          WHERE "${column}" IS NOT NULL
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
          outliers
        };
      }
    } catch (error: any) {
      console.warn(`Failed to compute numeric stats for ${column}:`, error.message);
    }
  }

  return result;
}
