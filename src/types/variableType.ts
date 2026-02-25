export type CanonicalVariableType = 'categorical' | 'ordered' | 'numeric' | 'text' | 'date';

// Legacy aliases kept for backward compatibility when reading persisted/session data.
export type LegacyVariableType = 'nominal' | 'ordinal' | 'scale';

export type VariableType = CanonicalVariableType | LegacyVariableType;

export type OrderedStyle = 'rating' | 'sequence';
export type OrderedScoring = 'categorical_only' | 'allow_numeric_stats';

export function normalizeVariableType(type: VariableType | undefined | null): CanonicalVariableType {
  switch (type) {
    case 'nominal':
      return 'categorical';
    case 'ordinal':
    case 'scale':
      return 'ordered';
    case 'numeric':
    case 'text':
    case 'date':
    case 'categorical':
    case 'ordered':
      return type;
    default:
      return 'categorical';
  }
}

export function isOrderedType(type: VariableType | undefined | null): boolean {
  return normalizeVariableType(type) === 'ordered';
}

export function isCategoricalType(type: VariableType | undefined | null): boolean {
  return normalizeVariableType(type) === 'categorical';
}

export function allowsNumericStats(
  type: VariableType | undefined | null,
  orderedScoring?: OrderedScoring
): boolean {
  if (type === 'numeric') return true;
  return normalizeVariableType(type) === 'ordered' && orderedScoring === 'allow_numeric_stats';
}
