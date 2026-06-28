/**
 * Crosstab Runner
 *
 * Orchestrates crosstab analysis: grid expansion, nested scale detection,
 * histogram computation, and significance testing. Uses DatabaseAdapter
 * for database-agnostic operation.
 *
 * Extracted from analysisWorker.ts for reuse in CLI and testing contexts.
 */

import { DatabaseAdapter } from '../DatabaseAdapter';
import { buildCrosstabQuery, CrosstabQueryOptions } from '../sql/queryBuilder';
import { AnalysisRunner } from './AnalysisRunner';
import { analysisRegistry } from './registry';
import { attachHistograms } from './crosstab/histogram';
import { applySignificanceTesting } from './crosstab/significance';
import { computeChiSquareTableStats } from './crosstab/chiSquare';
import { prepareCrosstabOptions } from './crosstab/prepare';
import type {
  CrosstabConfig,
  CrosstabContext,
  CrosstabResult,
  CrosstabResultData,
  CrosstabSqlRow,
  SignificanceOptions,
} from './crosstab/types';

export type {
  CrosstabConfig,
  CrosstabContext,
  CrosstabResult,
  CrosstabResultData,
  CrosstabSqlRow,
  SignificanceOptions,
};

export class CrosstabRunner implements AnalysisRunner<CrosstabConfig, CrosstabResult> {
  readonly id = 'crosstab';
  readonly label = 'Crosstab Analysis';
  readonly configSchema = {
    type: 'object',
    properties: {
      rowVars: { type: 'array', items: { type: 'string' } },
      colVar: { type: 'string', nullable: true },
      filters: { type: 'array' },
      includeDistributions: { type: 'boolean' },
    },
  };

  async run(adapter: DatabaseAdapter, config: CrosstabConfig): Promise<CrosstabResult> {
    const { context, ...options } = config;
    return runCrosstab(adapter, options, context);
  }
}

export const crosstabRunner = new CrosstabRunner();
analysisRegistry.register(crosstabRunner);

export async function runCrosstab(
  adapter: DatabaseAdapter,
  options: CrosstabQueryOptions & { includeDistributions?: boolean; significanceOptions?: SignificanceOptions },
  context: CrosstabContext,
): Promise<CrosstabResultData> {
  const modifiedOptions = prepareCrosstabOptions(options, context);

  const sql = buildCrosstabQuery(modifiedOptions);
  const mainResult = await adapter.query(sql);
  const rows = mainResult.rows as CrosstabSqlRow[];

  await attachHistograms(adapter, modifiedOptions, rows);
  await applySignificanceTesting(adapter, modifiedOptions, rows);

  const tableStats = computeChiSquareTableStats(modifiedOptions, rows);

  return { rows, tableStats };
}
