import type { AnalysisSettings } from '../../types/analysis';
import type { Slide, SlideAnalysisState } from '../../types/slides';
import type { SlideRecipeIssue } from './slideRecipe';
import { resolveSlideTitle } from './resolveSlideDefaults';

interface NamedSet {
  id: string;
  name: string;
}

function resolveNamedReference(
  referenceId: string,
  variableSets: NamedSet[],
  variables: { id: string; label?: string; name: string }[],
) {
  const variableSet = variableSets.find((set) => set.id === referenceId);
  if (variableSet) {
    return { id: variableSet.id, name: variableSet.name, label: variableSet.name };
  }
  const variable = variables.find((candidate) => candidate.id === referenceId);
  if (variable) {
    return { id: variable.id, name: variable.name, label: variable.label || variable.name };
  }
  return { id: referenceId, name: referenceId, label: referenceId };
}

export function buildExportRecipeSummary(analysisState: SlideAnalysisState, variableSets: NamedSet[]): string | null {
  if (analysisState.rowVars.length === 0) return null;
  const name = (id: string) => variableSets.find((set) => set.id === id)?.name || id;
  const rows = analysisState.rowVars.map(name).join(' + ');
  return analysisState.colVar ? `${rows} × ${name(analysisState.colVar)}` : rows;
}

export function resolveExportPreviewSlideTitle(
  slide: Slide,
  analysisState: SlideAnalysisState,
  variableSets: NamedSet[],
  variables: { id: string; label?: string; name: string }[],
): string {
  const trimmedTitle = slide.title?.trim();
  if (trimmedTitle && trimmedTitle !== 'New Slide') {
    return trimmedTitle;
  }

  return resolveSlideTitle(
    analysisState.rowVars.map((rowVarId) => resolveNamedReference(rowVarId, variableSets, variables)),
    analysisState.colVar ? resolveNamedReference(analysisState.colVar, variableSets, variables) : null,
  );
}

export interface SignificanceAuditSummary {
  exportMarkers: string;
  methodology: string;
  significanceLevel: string;
  weight: string | null;
}

function comparisonMethodLabel(method: AnalysisSettings['comparisonMethod']): string {
  switch (method) {
    case 'pairwise':
      return 'pairwise (A/B/C)';
    case 'cell_vs_rest':
      return 'cell vs rest';
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

function correctionTypeLabel(correction: AnalysisSettings['correctionType']): string {
  switch (correction) {
    case 'bonferroni':
      return 'Bonferroni';
    case 'fdr':
      return 'BH (FDR)';
    case 'none':
      return 'none';
    default: {
      const _exhaustive: never = correction;
      return _exhaustive;
    }
  }
}

export function buildSignificanceAuditSummary(
  analysisSettings: AnalysisSettings,
  showSignificance: boolean,
  weightVarName: string | null,
): SignificanceAuditSummary {
  const comparisonLabel = comparisonMethodLabel(analysisSettings.comparisonMethod);
  const correctionLabel = correctionTypeLabel(analysisSettings.correctionType);
  const primaryLevel = Math.round(analysisSettings.significanceLevel * 100);

  return {
    exportMarkers: showSignificance ? 'Included in export (▲▼ markers)' : 'Excluded from export',
    methodology: `Welch's t · ${comparisonLabel} · correction: ${correctionLabel}`,
    significanceLevel: `${primaryLevel}% solid markers · 80% hollow markers when enabled`,
    weight: weightVarName ? `Weighted by ${weightVarName}` : 'Unweighted',
  };
}

export type ExportPreviewSlideStatus = 'ready' | 'warning' | 'blocked';

export interface ExportPreviewSlideSummary {
  slideId: string;
  index: number;
  title: string;
  recipeSummary: string | null;
  visualizationType: Slide['visualizationType'];
  status: ExportPreviewSlideStatus;
  issues: SlideRecipeIssue[];
}

export function groupIssuesBySlide(issues: SlideRecipeIssue[]): Map<string, SlideRecipeIssue[]> {
  const grouped = new Map<string, SlideRecipeIssue[]>();
  for (const issue of issues) {
    const existing = grouped.get(issue.slideId) ?? [];
    existing.push(issue);
    grouped.set(issue.slideId, existing);
  }
  return grouped;
}

export function resolveSlidePreviewStatus(issues: SlideRecipeIssue[]): ExportPreviewSlideStatus {
  if (issues.some((issue) => issue.severity === 'block')) return 'blocked';
  if (issues.some((issue) => issue.severity === 'warn')) return 'warning';
  return 'ready';
}
