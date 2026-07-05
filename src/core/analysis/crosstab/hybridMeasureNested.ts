import { buildCrosstabQuery } from '../../sql/queryBuilder';
import type { CrosstabQueryOptions } from '../../../types/worker';
import { DatabaseAdapter } from '../../DatabaseAdapter';
import { prepareCrosstabOptions } from './prepare';
import type { CrosstabContext, CrosstabSqlRow } from './types';
import { prefixNestedCrosstabRows } from './rowKeys';

/**
 * Measure parent + nested categorical rows require two queries:
 * one for scale stats on the parent row, one for frequency on nested banners.
 */
export async function runMeasureWithNestedRowVars(
  adapter: DatabaseAdapter,
  options: CrosstabQueryOptions & { includeDistributions?: boolean; nestedRowVars: string[] },
  context: CrosstabContext,
): Promise<CrosstabSqlRow[]> {
  const { nestedRowVars, ...shared } = options;
  const measureLabel = shared.measureLabel;
  if (!shared.measureVar || !measureLabel || nestedRowVars.length === 0) {
    throw new Error('runMeasureWithNestedRowVars requires measureVar, measureLabel, and nestedRowVars');
  }

  const measureOptions = prepareCrosstabOptions(
    {
      ...shared,
      rowVars: [],
      nestedRowVars: undefined,
    },
    context,
  );

  const nestedOptions = prepareCrosstabOptions(
    {
      ...shared,
      rowVars: nestedRowVars,
      measureVar: undefined,
      measureLabel: undefined,
      includeDistributions: false,
      nestedRowVars: undefined,
    },
    context,
  );

  const [measureResult, nestedResult] = await Promise.all([
    adapter.query(buildCrosstabQuery(measureOptions)),
    adapter.query(buildCrosstabQuery(nestedOptions)),
  ]);

  const measureRows = measureResult.rows as CrosstabSqlRow[];
  const nestedRows = prefixNestedCrosstabRows(nestedResult.rows as CrosstabSqlRow[], measureLabel);

  return [...measureRows, ...nestedRows];
}
