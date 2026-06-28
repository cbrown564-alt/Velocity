import { formatCrosstabMatrix } from '../core/analysis/formatCrosstabMatrix';
import type { Variable } from '../types';
import type { ResultEnvelope } from './types';
import type { VelocityEngineHost } from './velocityEngineTypes';

export function applyCrosstabFormat(
  envelope: ResultEnvelope<unknown>,
  analysisId: string,
  config: Record<string, unknown>,
): ResultEnvelope<unknown> {
  if (analysisId !== 'crosstab' || config.format !== 'matrix') {
    return envelope;
  }

  const data = envelope.data as { rows: Record<string, unknown>[]; tableStats?: unknown };
  const hasPerCallWeight = typeof config.weightVar === 'string' && config.weightVar.length > 0;
  const isWeighted = hasPerCallWeight || envelope.metadata?.isWeighted === true;
  const matrix = formatCrosstabMatrix(data.rows, { isWeighted });

  return {
    ...envelope,
    metadata: {
      ...envelope.metadata,
      isWeighted,
    },
    data: {
      format: 'matrix',
      columns: matrix.columns,
      rows: matrix.rows,
      grandTotal: matrix.grandTotal,
      tableStats: data.tableStats,
    },
  };
}

/**
 * Replace raw integer codes in crosstab rows with human-readable value labels.
 */
export function resolveValueLabelsInRows(
  rows: Record<string, unknown>[],
  rowVariables: Variable[],
  colVariable: Variable | null,
): Record<string, unknown>[] {
  const buildLabelMap = (variable: Variable): Map<string, string> => {
    const m = new Map<string, string>();
    for (const vl of variable.valueLabels) {
      m.set(String(vl.value), vl.label);
    }
    return m;
  };

  const rowMaps = rowVariables.map(buildLabelMap);
  const colMap = colVariable ? buildLabelMap(colVariable) : null;

  return rows.map((row) => {
    const resolved: Record<string, unknown> = { ...row };
    rowVariables.forEach((_, i) => {
      const key = `rowKey_${i}`;
      if (key in resolved) {
        resolved[key] = rowMaps[i]?.get(String(resolved[key])) ?? resolved[key];
      }
    });
    if (colMap && 'colKey' in resolved) {
      resolved['colKey'] = colMap.get(String(resolved['colKey'])) ?? resolved['colKey'];
    }
    return resolved;
  });
}

/**
 * Mirror the crosstab runner's axis-rewrite rules closely enough to resolve
 * value labels on the fields that actually ended up in rowKey_N / colKey.
 */
export function resolveCrosstabLabelAxes(
  host: VelocityEngineHost,
  rowVarIds: string[],
  colVarId: string | null,
): { rowVariables: Variable[]; colVariable: Variable | null } {
  const dataset = host.requireDataset();
  let rowVariables = rowVarIds
    .map((id) => dataset.variables.find((v) => v.id === id))
    .filter((v): v is Variable => !!v);
  let colVariable = colVarId ? (dataset.variables.find((v) => v.id === colVarId) ?? null) : null;

  if (colVariable?.type === 'numeric' && !colVariable.synthetic) {
    colVariable = null;
  }

  const lastRowVariable = rowVariables[rowVariables.length - 1];
  if (lastRowVariable?.type === 'numeric' && !lastRowVariable.synthetic) {
    rowVariables = rowVariables.slice(0, -1);

    if (rowVariables.length === 0 && colVariable) {
      rowVariables = [colVariable];
      colVariable = null;
    }
  }

  return { rowVariables, colVariable };
}
