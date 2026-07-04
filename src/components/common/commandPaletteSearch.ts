import type { VariableSet, Variable } from '../../types';
import type { Dataset } from '../../types/dataset';
import { allowsNumericStats } from '../../types';
import type { ShelfPlacementResolution, TableConfigSnapshot } from '../../core/grid/gridUtils';
import { resolveShelfPlacement } from '../../core/grid/gridUtils';
import { filterSyntheticGridShellSets } from '../../core/services/syntheticGridShellFilters';
import { resolveEffectiveVariableSetType } from '../../lib/resolveVariableSetType';

export type VariableShelfTarget = 'drop-zone-rows' | 'drop-zone-cols' | 'drop-zone-weight';

/** Insertion grammar: ↵ → columns, ⌥↵ → rows, ⇧↵ → filter; weight via recipe inspector. */
export type InsertTarget = 'rows' | 'columns' | 'filter' | 'weight';

export function resolveInsertTarget(
  modifiers: { altKey?: boolean; shiftKey?: boolean },
  preset?: InsertTarget | null,
): InsertTarget {
  if (modifiers.shiftKey) return 'filter';
  if (modifiers.altKey) return 'rows';
  if (preset) return preset;
  return 'columns';
}

export interface VariablePaletteMatch {
  set: VariableSet;
  score: number;
}

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase();
}

function scoreText(q: string, raw: string | undefined, weight: number): number {
  if (!raw) return 0;
  const text = normalizeForSearch(raw);
  if (text === q) return 100 * weight;
  if (text.startsWith(q)) return 80 * weight;
  if (text.includes(q)) return 60 * weight;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => text.includes(token))) {
    return 50 * weight;
  }
  return 0;
}

function scoreVariableSet(query: string, set: VariableSet, labelLookup?: Map<string, Variable>): number {
  const q = normalizeForSearch(query);
  if (!q) return 0;

  let score = scoreText(q, set.name, 1);
  const firstVariable = labelLookup?.get(set.variableIds[0]);
  if (firstVariable) {
    score = Math.max(score, scoreText(q, firstVariable.name, 1), scoreText(q, firstVariable.label, 0.9));
  }
  return score;
}

export interface PaletteSearchOptions {
  /** Dataset variables — enables matching on variable names and labels. */
  variables?: Variable[];
  /** Full dataset — excludes synthetic grid shell sets from browse/search. */
  dataset?: Dataset | null;
  limit?: number;
}

function paletteBrowsableSets(variableSets: VariableSet[], dataset?: Dataset | null): VariableSet[] {
  const visible = variableSets.filter((set) => !set.hidden);
  return dataset ? filterSyntheticGridShellSets(visible, dataset) : visible;
}

export function searchVariableSetsForPalette(
  query: string,
  variableSets: VariableSet[],
  options: PaletteSearchOptions = {},
): VariablePaletteMatch[] {
  const { variables, dataset, limit = 12 } = options;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const lookup = variables ? new Map(variables.map((v) => [v.id, v])) : undefined;

  return paletteBrowsableSets(variableSets, dataset)
    .map((set) => ({ set, score: scoreVariableSet(trimmed, set, lookup) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.set.name.localeCompare(b.set.name))
    .slice(0, limit);
}

/** Default (empty-query) result set: browseable list of visible sets. */
export function listVariableSetsForPalette(
  variableSets: VariableSet[],
  limit = 12,
  dataset?: Dataset | null,
): VariableSet[] {
  return paletteBrowsableSets(variableSets, dataset).slice(0, limit);
}

/** Monochrome type glyph letter, per north-star `.tglyph`. */
export function variableSetGlyph(set: VariableSet, primaryVariable?: Variable): string {
  if (set.structure === 'multiple') return 'M';
  if (set.structure === 'grid') return 'G';
  switch (resolveEffectiveVariableSetType(set, primaryVariable)) {
    case 'ordered':
      return 'S';
    case 'numeric':
      return '#';
    case 'text':
      return 'T';
    case 'date':
      return 'D';
    case 'categorical':
    default:
      return 'C';
  }
}

/** Right-hand metadata column for a palette row. */
export function variableSetMeta(set: VariableSet, primaryVariable?: Variable): string {
  if (set.structure === 'multiple') return `Multi · ${set.variableIds.length}`;
  if (set.structure === 'grid') return `Grid · ${set.variableIds.length}`;
  switch (resolveEffectiveVariableSetType(set, primaryVariable)) {
    case 'ordered':
      return 'Scale';
    case 'numeric':
      return 'Numeric';
    case 'text':
      return 'Text';
    case 'date':
      return 'Date';
    case 'categorical':
    default:
      return 'Category';
  }
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
  tableConfig: TableConfigSnapshot,
): ShelfPlacementResolution {
  if (target === 'drop-zone-weight') {
    return { placement: null, redirectedFromColumn: false };
  }
  return resolveShelfPlacement(set.id, set.structure, target, tableConfig);
}

export type { ShelfPlacementResolution } from '../../core/grid/gridUtils';
