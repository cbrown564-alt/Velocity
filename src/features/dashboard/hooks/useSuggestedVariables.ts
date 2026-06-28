/**
 * useSuggestedVariables — Compute "interesting" variables for smart empty states.
 *
 * Heuristics (in priority order):
 * 1. Variables with semantic annotations (Likert, NPS, attitude)
 * 2. Variables with most balanced category distribution (highest entropy proxy)
 * 3. Variables with the most categories (good for banners)
 * 4. Fallback: first 5 non-synthetic variables
 */

import { useMemo } from 'react';
import { isExcludedFromAutoAnalysis } from '../../../core/semantic/respondentIdentifier';
import { Variable, VariableSet } from '../../../types';

export interface SuggestedVariable {
  setId: string;
  name: string;
  label: string;
  reason: string;
}

function scoreVariable(variable: Variable): number {
  let score = 0;

  // Semantic bonus
  if (variable.semantic) {
    if (variable.semantic.measurementIntent === 'attitude') score += 30;
    if (variable.semantic.measurementIntent === 'awareness') score += 25;
    if (variable.semantic.measurementIntent === 'behavior') score += 20;
  }

  // Balanced distribution proxy: more value labels = more interesting
  const labelCount = variable.valueLabels?.length ?? 0;
  if (labelCount >= 3 && labelCount <= 7) {
    score += 15; // Sweet spot for crosstabs
  } else if (labelCount > 7) {
    score += 5; // Still interesting but might be too granular
  }

  // Prefer categorical over pure text/date
  if (variable.type === 'nominal' || variable.type === 'ordinal') {
    score += 10;
  }

  return score;
}

export function useSuggestedVariables(
  variables: Variable[] | undefined,
  variableSets: VariableSet[] | undefined,
  excludeIds: Set<string>,
  maxSuggestions = 5,
  rowCount?: number,
): SuggestedVariable[] {
  return useMemo(() => {
    if (!variables?.length || !variableSets?.length) return [];

    const scored = variables
      .filter(
        (v) => !excludeIds.has(v.id) && !isExcludedFromAutoAnalysis(v, rowCount != null ? { rowCount } : undefined),
      )
      .map((v) => ({
        variable: v,
        score: scoreVariable(v),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions * 2); // Over-fetch to account for missing sets

    const suggestions: SuggestedVariable[] = [];
    for (const { variable } of scored) {
      if (suggestions.length >= maxSuggestions) break;

      // Find the VariableSet that contains this variable
      const set = variableSets.find((s) => s.variableIds.includes(variable.id) && !excludeIds.has(s.id));
      if (!set) continue;

      let reason = 'Good starting point';
      if (variable.semantic?.measurementIntent === 'attitude') reason = 'Attitude measure — high analytical value';
      else if (variable.semantic?.measurementIntent === 'awareness')
        reason = 'Awareness question — good benchmark variable';
      else if ((variable.valueLabels?.length ?? 0) >= 3 && (variable.valueLabels?.length ?? 0) <= 7) {
        reason = 'Balanced categories — clean crosstab';
      }

      suggestions.push({
        setId: set.id,
        name: set.name,
        label: variable.label || variable.name,
        reason,
      });
    }

    return suggestions;
  }, [variables, variableSets, excludeIds, maxSuggestions, rowCount]);
}
