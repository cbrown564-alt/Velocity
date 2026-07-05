import { inferVariableTyping } from '../core/ingestion/dataHeuristics';
import type { Variable, VariableSet } from '../types/dataset';
import { normalizeVariableType, type CanonicalVariableType } from '../types/variableType';

function isNonNumericMeasurementType(type: CanonicalVariableType): boolean {
  return type !== 'numeric';
}

/**
 * Resolve the measurement type shown in palette/list glyphs for a variable set.
 *
 * Single sets may store a stale `variableSet.type`; prefer the underlying
 * variable when it carries a non-numeric measurement type, and re-infer from
 * value labels when both records still say numeric.
 */
export function resolveEffectiveVariableSetType(
  variableSet: VariableSet,
  primaryVariable?: Variable | null,
): CanonicalVariableType {
  if (variableSet.structure === 'grid' || variableSet.structure === 'multiple') {
    return normalizeVariableType(variableSet.type ?? primaryVariable?.type);
  }

  const setType = variableSet.type ? normalizeVariableType(variableSet.type) : undefined;
  const variableType = primaryVariable?.type ? normalizeVariableType(primaryVariable.type) : undefined;

  if (variableType && isNonNumericMeasurementType(variableType)) return variableType;
  if (setType && isNonNumericMeasurementType(setType)) return setType;

  if (primaryVariable?.valueLabels && primaryVariable.valueLabels.length > 0) {
    return inferVariableTyping(primaryVariable.valueLabels).type;
  }

  return normalizeVariableType(variableType ?? setType);
}
