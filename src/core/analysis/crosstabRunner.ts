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
import { buildCrosstabQuery } from '../sql/queryBuilder';
import type { CrosstabQueryOptions } from '../../types/worker';
import { AnalysisRunner } from './AnalysisRunner';
import { analysisRegistry } from './registry';
import { attachHistograms } from './crosstab/histogram';
import { applySignificanceTesting } from './crosstab/significance';
import { computeChiSquareTableStats } from './crosstab/chiSquare';
import { extractRowKeyStrings } from './crosstab/rowKeys';
import { prepareCrosstabOptions } from './crosstab/prepare';
import { runMeasureWithNestedRowVars } from './crosstab/hybridMeasureNested';
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

  let rows: CrosstabSqlRow[];
  if (modifiedOptions.measureVar && modifiedOptions.nestedRowVars?.length) {
    rows = await runMeasureWithNestedRowVars(
      adapter,
      modifiedOptions as CrosstabQueryOptions & { includeDistributions?: boolean; nestedRowVars: string[] },
      context,
    );
  } else {
    const sql = buildCrosstabQuery(modifiedOptions);
    const mainResult = await adapter.query(sql);
    rows = mainResult.rows as CrosstabSqlRow[];
  }

  const measureOptions =
    modifiedOptions.measureVar && modifiedOptions.nestedRowVars?.length
      ? prepareCrosstabOptions(
          {
            ...modifiedOptions,
            rowVars: [],
            nestedRowVars: undefined,
          },
          context,
        )
      : modifiedOptions;

  const nestedOptions =
    modifiedOptions.measureVar && modifiedOptions.nestedRowVars?.length
      ? prepareCrosstabOptions(
          {
            ...modifiedOptions,
            rowVars: modifiedOptions.nestedRowVars,
            measureVar: undefined,
            measureLabel: undefined,
            includeDistributions: false,
            nestedRowVars: undefined,
          },
          context,
        )
      : null;

  const measureRows =
    nestedOptions && modifiedOptions.measureLabel
      ? rows.filter((row) => extractRowKeyStrings(row).length === 1)
      : rows;
  const nestedRows = nestedOptions ? rows.filter((row) => extractRowKeyStrings(row).length > 1) : rows;

  await attachHistograms(adapter, measureOptions, measureRows);
  if (nestedOptions) {
    await applySignificanceTesting(adapter, nestedOptions, nestedRows);
  } else {
    await applySignificanceTesting(adapter, modifiedOptions, rows);
  }

  const tableStats = computeChiSquareTableStats(nestedOptions ?? modifiedOptions, nestedOptions ? nestedRows : rows);

  return { rows, tableStats };
}
