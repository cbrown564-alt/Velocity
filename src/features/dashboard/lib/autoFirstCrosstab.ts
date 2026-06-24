/**
 * Pick row/col variable sets for the one-time auto-first-crosstab (STAB-UI-E §9.4).
 * Pure — no React or store dependencies.
 */

import { hasRespondentIdentifierName } from '../../../core/semantic/identifierPatterns';
import { isExcludedFromAutoAnalysis } from '../../../core/semantic/respondentIdentifier';
import { gridSetToTableConfig } from '../../../services/gridUtils';
import type { Variable, VariableSet } from '../../../types';

export type AutoCrosstabPair = {
  rowSetId: string;
  colSetId: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

function isEligibleSet(set: VariableSet, variables?: Variable[]): boolean {
  if (set.hidden) return false;
  if (set.structure === 'grid' || set.structure === 'multiple') return false;
  if (hasRespondentIdentifierName(normalizeName(set.name))) return false;

  if (variables?.length) {
    const setVariables = set.variableIds
      .map((id) => variables.find((v) => v.id === id))
      .filter((v): v is Variable => v != null);
    if (setVariables.some((v) => isExcludedFromAutoAnalysis(v))) return false;
  }

  return true;
}

function findSetByAliases(sets: VariableSet[], aliases: string[]): VariableSet | undefined {
  const wanted = new Set(aliases.map(normalizeName));
  return sets.find((s) => wanted.has(normalizeName(s.name)));
}

/**
 * Choose a first crosstab pair for onboarding.
 * Mock-only: prefers gender × region on mock_data.csv; otherwise null.
 */
export function pickAutoFirstCrosstabPair(
  datasetName: string | undefined,
  variableSets: VariableSet[],
  variables?: Variable[],
): AutoCrosstabPair | null {
  const eligible = variableSets.filter((set) => isEligibleSet(set, variables));
  if (eligible.length < 2) return null;

  if (datasetName === 'mock_data.csv') {
    const gender = findSetByAliases(eligible, ['gender']);
    const region = findSetByAliases(eligible, ['region']);
    if (gender && region) {
      return { rowSetId: gender.id, colSetId: region.id };
    }
  }

  return null;
}

/** Apply grid expansion rules when a picked set is a matrix structure. */
export function resolveAutoCrosstabTableConfig(
  pair: AutoCrosstabPair,
  variableSets: VariableSet[],
): { rowVars: string[]; colVar: string } | null {
  const rowSet = variableSets.find((s) => s.id === pair.rowSetId);
  const colSet = variableSets.find((s) => s.id === pair.colSetId);
  if (!rowSet || !colSet) return null;

  if (rowSet.structure === 'grid') {
    return gridSetToTableConfig(rowSet.id, 'full');
  }
  if (colSet.structure === 'grid') {
    return { rowVars: [rowSet.id], colVar: gridSetToTableConfig(colSet.id, 'full').colVar };
  }

  return { rowVars: [rowSet.id], colVar: colSet.id };
}
