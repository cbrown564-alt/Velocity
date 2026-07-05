/**
 * Pick row/col variable sets for the one-time auto-first-crosstab (STAB-UI-E §9.4).
 * Pure — no React or store dependencies.
 */

import { hasRespondentIdentifierName } from '../../../core/semantic/identifierPatterns';
import { isExcludedFromAutoAnalysis } from '../../../core/semantic/respondentIdentifier';
import { gridSetToTableConfig } from '../../../core/grid/gridUtils';
import type { Variable, VariableSet } from '../../../types';

export type AutoCrosstabPair = {
  rowSetId: string;
  colSetId: string;
};

/** Sampling weight to apply when loading the pilot-archetype brand tracker example. */
export const BRAND_TRACKER_EXAMPLE_WEIGHT_VAR = 'wt';

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
 * Find an eligible set by the name of one of its underlying variables.
 * Tracker files carry long agency-style labels as set names (e.g. "SEG. Consumer
 * segment…"), so alias matching on the set name does not work; match on the
 * short variable name/id instead.
 */
function findSetByVariableName(
  sets: VariableSet[],
  variables: Variable[] | undefined,
  names: string[],
): VariableSet | undefined {
  if (!variables?.length) return undefined;
  const wanted = new Set(names.map(normalizeName));
  return sets.find((set) =>
    set.variableIds.some((id) => {
      const variable = variables.find((v) => v.id === id);
      if (!variable) return false;
      return wanted.has(normalizeName(variable.name ?? variable.id));
    }),
  );
}

/**
 * Choose a first crosstab pair for onboarding.
 * Example datasets:
 * - brandtracker_w4.sav — funnel-relevant cut (brand preference × segment)
 * - sleep.sav — sex × marital status
 * - mock_data.csv — gender × region
 */
export function pickAutoFirstCrosstabPair(
  datasetName: string | undefined,
  variableSets: VariableSet[],
  variables?: Variable[],
): AutoCrosstabPair | null {
  const eligible = variableSets.filter((set) => isEligibleSet(set, variables));
  if (eligible.length < 2) return null;

  if (datasetName === 'brandtracker_w4.sav') {
    // Funnel-relevant first cut for the pilot-archetype tracker: brand preference
    // (a funnel-stage outcome) by attitudinal segment. Atlas consideration T2B is
    // a recipe-derived net, so preference is the equivalent clean single-variable
    // cut available on the raw analysis-ready wave.
    const segment = findSetByVariableName(eligible, variables, ['segment']);
    const preference =
      findSetByVariableName(eligible, variables, ['brand_pref']) ??
      findSetByVariableName(eligible, variables, ['unaided_first']);
    if (preference && segment) {
      return { rowSetId: preference.id, colSetId: segment.id };
    }
  }

  if (datasetName === 'sleep.sav') {
    const sex = findSetByAliases(eligible, ['sex', 'gender']);
    const marital = findSetByAliases(eligible, ['marital status', 'marital_status', 'marital']);
    if (sex && marital) {
      return { rowSetId: sex.id, colSetId: marital.id };
    }
  }

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

/**
 * Resolve the default sampling weight for example-dataset onboarding.
 * Brand tracker ships with `wt` (rim weight); other examples leave weight unset.
 */
export function resolveExampleDatasetWeightVariable(
  datasetName: string | undefined,
  variables: Variable[] | undefined,
  currentWeightVariable: string | null | undefined,
): string | null {
  if (currentWeightVariable || !variables?.length) return null;
  if (datasetName !== 'brandtracker_w4.sav') return null;

  const weightVar = variables.find(
    (variable) =>
      variable.id === BRAND_TRACKER_EXAMPLE_WEIGHT_VAR || variable.name === BRAND_TRACKER_EXAMPLE_WEIGHT_VAR,
  );
  return weightVar?.id ?? null;
}
