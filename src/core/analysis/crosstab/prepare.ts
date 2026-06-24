import { MissingValueDef, Variable } from '../../../types';
import {
  CrosstabQueryOptions,
  escapeIdentifier,
} from '../../sql/queryBuilder';
import type { CrosstabContext } from './types';

function buildVariableMissingConditionSql(columnName: string, missingValues?: MissingValueDef): string {
  const escapedColumn = escapeIdentifier(columnName);
  const conditions: string[] = [`"${escapedColumn}" IS NULL`];

  const discrete = missingValues?.discrete?.filter((v): v is number => Number.isFinite(v));
  if (discrete && discrete.length > 0) {
    conditions.push(`"${escapedColumn}" IN (${discrete.join(', ')})`);
  }

  const range = missingValues?.range;
  if (range && Number.isFinite(range.low) && Number.isFinite(range.high)) {
    const low = Math.min(range.low, range.high);
    const high = Math.max(range.low, range.high);
    conditions.push(`("${escapedColumn}" >= ${low} AND "${escapedColumn}" <= ${high})`);
  }

  return conditions.join(' OR ');
}

export function buildMissingExclusionSql(
  options: CrosstabQueryOptions,
  context: CrosstabContext
): string | undefined {
  const involvedVariableIds = new Set<string>();

  options.rowVars.forEach((id) => involvedVariableIds.add(id));
  if (options.colVar) involvedVariableIds.add(options.colVar);
  if (options.measureVar) involvedVariableIds.add(options.measureVar);

  const exclusions: string[] = [];
  involvedVariableIds.forEach((variableId) => {
    const variable = context.variables[variableId];
    if (!variable) return;
    // Synthetic grid variables have no direct column in the DB (they are unpivoted into
    // _synthetic_value by the CTE), so skip them — the CTE already filters NULLs.
    if (variable.synthetic) return;
    exclusions.push(`NOT (${buildVariableMissingConditionSql(variableId, variable.missingValues)})`);
  });

  return exclusions.length > 0 ? exclusions.join(' AND ') : undefined;
}

/**
 * Apply synthetic grid expansion, nested scale detection, and missing-value SQL.
 * Returns a shallow copy of options with runner-side mutations applied.
 */
export function prepareCrosstabOptions(
  options: CrosstabQueryOptions & { includeDistributions?: boolean },
  context: CrosstabContext
): CrosstabQueryOptions & { includeDistributions?: boolean } {
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

      // Coerce to "profile grid" orientation when the numeric variable was the
      // sole rowVar: promote the colVar to rowVar so the categorical variable
      // becomes the row grouping and the metric becomes the column header.
      //
      // Before: rowVars=[], colVar=marital, measureVar=ess
      //   SQL → SELECT 'ess' as rowKey_0, marital as colKey, AVG(ess) GROUP BY marital
      //   Pivot → 1 row ('ess') × N marital columns  ← semantically inverted
      //
      // After:  rowVars=[marital], colVar=null, measureVar=ess
      //   SQL → SELECT marital as rowKey_0, 'ess' as colKey, AVG(ess) GROUP BY marital
      //   Pivot → N marital rows × 1 metric column  ← correct orientation
      if (modifiedOptions.rowVars.length === 0 && modifiedOptions.colVar) {
        modifiedOptions.rowVars = [modifiedOptions.colVar];
        modifiedOptions.colVar = null;
      }
    }
  }

  modifiedOptions.additionalWhere = buildMissingExclusionSql(modifiedOptions, context);

  return modifiedOptions;
}
