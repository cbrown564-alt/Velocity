import type { VariableSet, Variable } from '../../types';
import { allowsNumericStats } from '../../types';
import { placeVariableSet } from '../../core/grid/gridUtils';

export type VariableShelfTarget = 'drop-zone-rows' | 'drop-zone-cols' | 'drop-zone-weight';

export interface VariablePaletteMatch {
  set: VariableSet;
  score: number;
}

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase();
}

function scoreVariableSet(query: string, set: VariableSet): number {
  const q = normalizeForSearch(query);
  if (!q) return 0;

  const name = normalizeForSearch(set.name);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => name.includes(token))) {
    return 50;
  }

  return 0;
}

export function searchVariableSetsForPalette(
  query: string,
  variableSets: VariableSet[],
  limit = 8,
): VariablePaletteMatch[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return variableSets
    .map((set) => ({ set, score: scoreVariableSet(trimmed, set) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.set.name.localeCompare(b.set.name))
    .slice(0, limit);
}

export function canAddVariableSetToWeight(set: VariableSet, variables: Variable[]): boolean {
  if (set.structure === 'grid') return false;
  const variable = variables.find((entry) => entry.id === set.variableIds[0]);
  if (!variable) return false;
  return allowsNumericStats(variable.type as Parameters<typeof allowsNumericStats>[0], variable.orderedScoring);
}

export function buildShelfPlacement(
  set: VariableSet,
  target: VariableShelfTarget,
  tableConfig: { rowVars: string[]; colVar: string | null },
): Partial<{ rowVars: string[]; colVar: string | null }> | null {
  if (target === 'drop-zone-weight') {
    return null;
  }
  return placeVariableSet(set.id, set.structure, target, tableConfig);
}
