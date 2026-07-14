import type { VariableSet } from '../../types';
import type { TableConfigSnapshot } from '../../core/grid/gridUtils';
import { searchVariableSetsForPalette, type PaletteSearchOptions } from './commandPaletteSearch';

export interface PaletteVariableBinding {
  setId: string;
  setName: string;
  queryPart: string;
  score: number;
}

export interface PaletteNlCrosstabBinding {
  kind: 'crosstab';
  query: string;
  connector: string;
  row: PaletteVariableBinding;
  column: PaletteVariableBinding;
}

export interface PaletteNlPartialBinding {
  kind: 'partial';
  query: string;
  connector: string;
  rowQuery: string;
  columnQuery: string;
  row?: PaletteVariableBinding;
  column?: PaletteVariableBinding;
}

export interface PaletteNlNoBinding {
  kind: 'none';
}

export type PaletteNlParseResult = PaletteNlCrosstabBinding | PaletteNlPartialBinding | PaletteNlNoBinding;

const CROSSTAB_CONNECTORS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\s+crossed\s+with\s+/i, label: 'crossed with' },
  { pattern: /\s+against\s+/i, label: 'against' },
  { pattern: /\s+by\s+/i, label: 'by' },
  { pattern: /\s+vs\.?\s+/i, label: 'vs' },
  { pattern: /\s+×\s+/u, label: '×' },
  { pattern: /\s+x\s+/i, label: 'x' },
];

export function splitCrosstabQuery(query: string): { rowQuery: string; columnQuery: string; connector: string } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  for (const { pattern, label } of CROSSTAB_CONNECTORS) {
    const match = pattern.exec(trimmed);
    if (!match || match.index === undefined) continue;
    const rowQuery = trimmed.slice(0, match.index).trim();
    const columnQuery = trimmed.slice(match.index + match[0].length).trim();
    if (rowQuery && columnQuery) return { rowQuery, columnQuery, connector: label };
  }
  return null;
}

function resolveVariablePart(
  part: string,
  variableSets: VariableSet[],
  options: PaletteSearchOptions,
): PaletteVariableBinding | undefined {
  const matches = searchVariableSetsForPalette(part, variableSets, { ...options, limit: 1 });
  const top = matches[0];
  if (!top || top.score <= 0) return undefined;
  return { setId: top.set.id, setName: top.set.name, queryPart: part, score: top.score };
}

export function parsePaletteNlCrosstab(
  query: string,
  variableSets: VariableSet[],
  options: PaletteSearchOptions = {},
): PaletteNlParseResult {
  const split = splitCrosstabQuery(query);
  if (!split) return { kind: 'none' };
  const { rowQuery, columnQuery, connector } = split;
  const row = resolveVariablePart(rowQuery, variableSets, options);
  const column = resolveVariablePart(columnQuery, variableSets, options);
  if (row && column) return { kind: 'crosstab', query: query.trim(), connector, row, column };
  return { kind: 'partial', query: query.trim(), connector, rowQuery, columnQuery, row, column };
}

export function buildCrosstabBindingTableConfig(binding: PaletteNlCrosstabBinding): Partial<TableConfigSnapshot> {
  return { rowVars: [binding.row.setId], colVar: binding.column.setId };
}

export function formatCrosstabBindingPreview(binding: PaletteNlCrosstabBinding): string {
  return `${binding.row.setName} → rows · ${binding.column.setName} → columns`;
}
